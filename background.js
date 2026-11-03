'use strict';

const MENU_ID = 'save-word';
const PREVIEW_TTL_MS = 10 * 60 * 1000;
const DICTIONARY_PATH = 'data/dictionary.txt';

let dictionaryPromise = null;
let writeQueue = Promise.resolve();

/**
 * Serialize read-modify-write cycles so rapid saves cannot overwrite each other.
 */
function withLock(operation) {
  const run = writeQueue.then(operation);
  writeQueue = run.catch(() => {});
  return run;
}

/**
 * Trim, collapse whitespace, and strip edge punctuation while keeping internal
 * apostrophes and hyphens ("don't", "well-being").
 */
function normalizeWord(raw) {
  if (typeof raw !== 'string') return '';
  let word = raw.trim().replace(/\s+/g, ' ');
  word = word.replace(/^[\p{P}]+|[\p{P}]+$/gu, '').trim();
  return word;
}

function keyFor(word) {
  return word.toLowerCase();
}

/**
 * Fetch and parse the bundled dictionary lazily. The Map is memoized for the
 * life of this service worker instance and rebuilt after a suspension.
 */
function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = (async () => {
      const map = new Map();
      try {
        const response = await fetch(chrome.runtime.getURL(DICTIONARY_PATH));
        if (!response.ok) {
          throw new Error(`Dictionary request failed with status ${response.status}`);
        }
        const text = await response.text();
        const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
        const collected = new Map();
        for (const line of source.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          if (!trimmed.startsWith('|')) continue;
          const second = trimmed.indexOf('|', 1);
          if (second === -1) continue;
          const english = trimmed.slice(1, second).trim().toLowerCase();
          const bangla = trimmed.slice(second + 1).trim();
          if (!english) continue;
          const meanings = collected.get(english);
          if (!meanings) {
            collected.set(english, bangla ? [bangla] : []);
          } else if (bangla && !meanings.includes(bangla)) {
            meanings.push(bangla);
          }
        }
        for (const [english, meanings] of collected) {
          map.set(english, meanings.join('; '));
        }
      } catch (error) {
        console.warn('E2B Save Word: dictionary unavailable, using empty meanings.', error);
        dictionaryPromise = null;
        return new Map();
      }
      return map;
    })();
  }
  return dictionaryPromise;
}

async function openPreviewSurface() {
  try {
    if (!chrome.action.openPopup) {
      throw new Error('chrome.action.openPopup is unavailable');
    }
    await chrome.action.openPopup();
  } catch (error) {
    console.warn('E2B Save Word: opening the action popup failed, using a window.', error);
    try {
      await chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 400,
        height: 620,
        focused: true,
      });
    } catch (fallbackError) {
      console.error('E2B Save Word: could not open the preview window.', fallbackError);
    }
  }
}

/**
 * Save a selection and stage its preview. Returns the stored entry, or null
 * when the selection is blank.
 */
async function saveWord(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return null;

  const dictionary = await loadDictionary();
  const key = keyFor(word);

  const entry = await withLock(async () => {
    const stored = await chrome.storage.local.get('words');
    const words = stored.words || {};
    let saved = words[key];

    if (!saved) {
      saved = {
        word,
        meaning: dictionary.get(key) ?? '',
        savedAt: Date.now(),
      };
      words[key] = saved;
      await chrome.storage.local.set({ words });
    }

    await chrome.storage.local.set({
      preview: {
        key,
        word: saved.word,
        meaning: saved.meaning,
        savedAt: Date.now(),
      },
    });

    return saved;
  });

  await openPreviewSurface();
  return entry;
}

/**
 * Save a word directly from the popup search/dictionary interface without
 * opening the preview window.
 */
async function saveWordDirect(rawWord, rawMeaning) {
  const word = normalizeWord(rawWord);
  if (!word) return null;

  const key = keyFor(word);
  const meaning = typeof rawMeaning === 'string' ? rawMeaning.trim() : '';

  return withLock(async () => {
    const stored = await chrome.storage.local.get('words');
    const words = stored.words || {};
    let saved = words[key];

    if (!saved) {
      saved = {
        word,
        meaning,
        savedAt: Date.now(),
      };
      words[key] = saved;
      await chrome.storage.local.set({ words });
    } else if (!saved.meaning && meaning) {
      saved.meaning = meaning;
      await chrome.storage.local.set({ words });
    }

    return saved;
  });
}

async function updateMeaning(rawKey, rawMeaning) {
  const key = String(rawKey || '').toLowerCase();
  const meaning = typeof rawMeaning === 'string' ? rawMeaning.trim() : '';

  return withLock(async () => {
    const stored = await chrome.storage.local.get(['words', 'preview']);
    const words = stored.words || {};
    const entry = words[key];
    if (!entry) throw new Error('Word not found.');

    entry.meaning = meaning;
    await chrome.storage.local.set({ words });

    if (stored.preview && stored.preview.key === key) {
      await chrome.storage.local.set({
        preview: { ...stored.preview, meaning, savedAt: Date.now() },
      });
    }

    return entry;
  });
}

async function deleteWord(rawKey) {
  const key = String(rawKey || '').toLowerCase();

  return withLock(async () => {
    const stored = await chrome.storage.local.get(['words', 'preview']);
    const words = stored.words || {};
    if (!Object.prototype.hasOwnProperty.call(words, key)) return false;

    delete words[key];
    await chrome.storage.local.set({ words });

    if (stored.preview && stored.preview.key === key) {
      await chrome.storage.local.set({ preview: null });
    }
    return true;
  });
}

/**
 * Merge imported entries. Existing keys are kept untouched; only new keys are
 * added. Duplicate keys inside one file collapse to the first valid entry.
 */
async function importWords(incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw new Error('The backup does not contain a word collection.');
  }

  return withLock(async () => {
    const stored = await chrome.storage.local.get('words');
    const words = stored.words || {};
    let added = 0;
    let skipped = 0;

    for (const value of Object.values(incoming)) {
      if (!value || typeof value.word !== 'string') {
        skipped += 1;
        continue;
      }
      const word = normalizeWord(value.word);
      if (!word) {
        skipped += 1;
        continue;
      }
      const key = keyFor(word);
      if (Object.prototype.hasOwnProperty.call(words, key)) {
        skipped += 1;
        continue;
      }
      words[key] = {
        word,
        meaning: typeof value.meaning === 'string' ? value.meaning.trim() : '',
        savedAt: Number.isFinite(value.savedAt) ? value.savedAt : Date.now(),
      };
      added += 1;
    }

    await chrome.storage.local.set({ words });
    return { added, skipped, total: Object.keys(words).length };
  });
}

async function clearPreview() {
  await chrome.storage.local.set({ preview: null });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: 'Save "%s"',
        contexts: ['selection'],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('E2B Save Word: could not create the context menu.', chrome.runtime.lastError);
        }
      }
    );
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  saveWord(info.selectionText).catch((error) => {
    console.error('E2B Save Word: saving the selection failed.', error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false;

  let operation;
  switch (message.type) {
    case 'save-word':
      operation = saveWordDirect(message.word, message.meaning);
      break;
    case 'update-meaning':
      operation = updateMeaning(message.key, message.meaning);
      break;
    case 'delete-word':
      operation = deleteWord(message.key);
      break;
    case 'import-words':
      operation = importWords(message.words);
      break;
    case 'clear-preview':
      operation = clearPreview().then(() => true);
      break;
    default:
      return false;
  }

  operation
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || 'Unexpected error.' }));

  return true;
});
