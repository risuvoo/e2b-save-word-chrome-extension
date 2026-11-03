'use strict';

const PREVIEW_TTL_MS = 10 * 60 * 1000;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const SUGGESTION_LIMIT = 8;

const state = {
  words: {},
  view: 'dashboard',
  searchMode: 'saved',
  query: '',
  activeLetter: 'ALL',
  preview: null,
  pendingDeleteKey: null,
};

function $(id) {
  return document.getElementById(id);
}

const elements = {
  previewView: $('previewView'),
  dashboardView: $('dashboardView'),
  previewWord: $('previewWord'),
  previewMeaning: $('previewMeaning'),
  previewStatus: $('previewStatus'),
  meaningForm: $('meaningForm'),
  meaningInput: $('meaningInput'),
  showList: $('showList'),
  searchWrap: $('searchWrap'),
  searchInput: $('searchInput'),
  searchToggle: $('searchToggle'),
  toggleSaved: $('toggleSaved'),
  toggleDictionary: $('toggleDictionary'),
  suggestions: $('suggestions'),
  azBar: $('azBar'),
  listRegion: $('listRegion'),
  wordList: $('wordList'),
  emptyState: $('emptyState'),
  noResults: $('noResults'),
  dictEmptyState: $('dictEmptyState'),
  dashboardStatus: $('dashboardStatus'),
  appFooter: $('appFooter'),
  footerCount: $('footerCount'),
  copyrightYear: $('copyrightYear'),
  exportButton: $('exportButton'),
  importButton: $('importButton'),
  importFile: $('importFile'),
  deleteDialog: $('deleteDialog'),
  deleteWordName: $('deleteWordName'),
  confirmDelete: $('confirmDelete'),
};

function sendMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response from the extension worker.' });
    });
  });
}

function wordEntries() {
  return Object.entries(state.words)
    .filter(([, value]) => value && typeof value.word === 'string')
    .map(([key, value]) => ({
      key,
      word: value.word,
      meaning: typeof value.meaning === 'string' ? value.meaning : '',
      savedAt: value.savedAt,
    }));
}

function letterOf(entry) {
  const initial = entry.word.charAt(0).toUpperCase();
  return /[A-Z]/.test(initial) ? initial : '#';
}

function compareWords(a, b) {
  return a.word.localeCompare(b.word, undefined, { sensitivity: 'base' });
}

function isFreshPreview(preview) {
  return (
    preview &&
    typeof preview.key === 'string' &&
    typeof preview.word === 'string' &&
    Number.isFinite(preview.savedAt) &&
    Date.now() - preview.savedAt <= PREVIEW_TTL_MS
  );
}

/* ------------------------------------------------------------------ */
/* Views                                                              */
/* ------------------------------------------------------------------ */

function showPreview() {
  state.view = 'preview';
  elements.dashboardView.hidden = true;
  elements.previewView.hidden = false;
  elements.appFooter.hidden = true;
  renderPreview();

  const hasMeaning = elements.previewMeaning.textContent.trim() !== '';
  if (!hasMeaning) elements.meaningInput.focus();
}

function showDashboard() {
  state.view = 'dashboard';
  elements.previewView.hidden = true;
  elements.dashboardView.hidden = false;
  elements.appFooter.hidden = false;
  updateAzBar();
  renderDashboard();
}

function renderPreview() {
  const entry = state.preview;
  if (!entry) return;

  const meaning = typeof entry.meaning === 'string' ? entry.meaning.trim() : '';
  const hasMeaning = meaning !== '';

  elements.previewWord.textContent = entry.word;
  elements.previewMeaning.textContent = hasMeaning ? meaning : '';
  elements.previewMeaning.hidden = !hasMeaning;
  elements.meaningForm.hidden = hasMeaning;

  if (!hasMeaning && document.activeElement !== elements.meaningInput) {
    elements.meaningInput.value = '';
  }
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                          */
/* ------------------------------------------------------------------ */

function buildAzBar() {
  const options = ['ALL', ...LETTERS, '#'];
  elements.azBar.replaceChildren();

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'az-chip';
    button.dataset.letter = option;
    button.textContent = option === 'ALL' ? 'All' : option;
    button.setAttribute('aria-pressed', 'false');
    elements.azBar.append(button);
  }
}

function updateAzBar() {
  for (const chip of elements.azBar.querySelectorAll('.az-chip')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.letter === state.activeLetter));
  }
}

let dictionaryMap = null;
let dictionaryList = null;
let dictionaryLoading = null;

async function ensureDictionary() {
  if (dictionaryList && dictionaryMap) {
    return { map: dictionaryMap, list: dictionaryList };
  }
  if (dictionaryLoading) return dictionaryLoading;

  dictionaryLoading = (async () => {
    try {
      const response = await fetch(chrome.runtime.getURL('data/dictionary.txt'));
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const text = await response.text();
      const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
      const collected = new Map();
      for (const line of source.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.startsWith('|')) continue;
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
      dictionaryMap = new Map();
      dictionaryList = [];
      for (const [english, meanings] of collected) {
        const meaning = meanings.join('; ');
        dictionaryMap.set(english, meaning);
        dictionaryList.push({
          key: english,
          word: english,
          meaning,
        });
      }
    } catch (error) {
      console.warn('E2B Save Word: could not load dictionary in popup.', error);
      dictionaryMap = new Map();
      dictionaryList = [];
    } finally {
      dictionaryLoading = null;
    }
    return { map: dictionaryMap, list: dictionaryList };
  })();

  return dictionaryLoading;
}

function setSearchMode(mode) {
  if (state.searchMode === mode) return;
  state.searchMode = mode;

  elements.toggleSaved.setAttribute('aria-pressed', String(mode === 'saved'));
  elements.toggleSaved.classList.toggle('is-active', mode === 'saved');

  elements.toggleDictionary.setAttribute('aria-pressed', String(mode === 'dictionary'));
  elements.toggleDictionary.classList.toggle('is-active', mode === 'dictionary');

  if (mode === 'dictionary') {
    elements.searchInput.placeholder = 'Search dictionary...';
    if (!dictionaryList) {
      ensureDictionary().then(() => {
        renderSuggestions();
        renderDashboard();
      });
    } else {
      renderSuggestions();
      renderDashboard();
    }
  } else {
    elements.searchInput.placeholder = 'Search saved words...';
    renderSuggestions();
    renderDashboard();
  }

  elements.searchInput.focus();
}

function visibleEntries() {
  const query = state.query.trim().toLowerCase();

  if (state.searchMode === 'dictionary') {
    if (!dictionaryList) return [];
    if (!query && state.activeLetter === 'ALL') {
      return [];
    }

    let entries = dictionaryList;
    if (query) {
      const prefix = [];
      const substring = [];
      for (const entry of entries) {
        if (entry.key.startsWith(query)) prefix.push(entry);
        else if (entry.key.includes(query)) substring.push(entry);
      }
      entries = [...prefix.sort(compareWords), ...substring.sort(compareWords)];
    }
    if (state.activeLetter !== 'ALL') {
      entries = entries.filter((entry) => letterOf(entry) === state.activeLetter);
    }
    return entries.slice(0, 100);
  }

  let entries = wordEntries();

  if (query) {
    entries = entries.filter((entry) => entry.word.toLowerCase().includes(query));
  }
  if (state.activeLetter !== 'ALL') {
    entries = entries.filter((entry) => letterOf(entry) === state.activeLetter);
  }
  return entries.sort(compareWords);
}

function renderDashboard() {
  const total = Object.keys(state.words).length;
  elements.dashboardStatus.textContent = '';

  const entries = visibleEntries();
  elements.wordList.replaceChildren();
  elements.listRegion.scrollTop = 0;

  if (state.searchMode === 'dictionary') {
    elements.emptyState.hidden = true;
    const isDefaultBlank = !state.query.trim() && state.activeLetter === 'ALL';
    elements.dictEmptyState.hidden = !isDefaultBlank;
    elements.noResults.hidden = isDefaultBlank || entries.length > 0;
    elements.wordList.hidden = entries.length === 0;

    if (isDefaultBlank) {
      const count = dictionaryList ? dictionaryList.length : 13506;
      elements.footerCount.textContent = `${count} words in dictionary`;
    } else {
      elements.footerCount.textContent = `${entries.length} ${entries.length === 1 ? 'match' : 'matches'}`;
    }

    if (entries.length === 0) return;

    for (const entry of entries) {
      elements.wordList.append(createWordRow(entry));
    }
    return;
  }

  elements.dictEmptyState.hidden = true;
  elements.footerCount.textContent = `${total} ${total === 1 ? 'word' : 'words'}`;

  elements.emptyState.hidden = total !== 0;
  elements.noResults.hidden = !(total > 0 && entries.length === 0);
  elements.wordList.hidden = entries.length === 0;

  if (entries.length === 0) return;

  if (state.activeLetter === 'ALL' && state.query.trim() === '') {
    renderGrouped(entries);
  } else {
    for (const entry of entries) {
      elements.wordList.append(createWordRow(entry));
    }
  }
}

function renderGrouped(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const letter = letterOf(entry);
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(entry);
  }

  const letters = [...groups.keys()].sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  for (const letter of letters) {
    const heading = document.createElement('div');
    heading.className = 'group-heading';
    heading.textContent = letter;
    elements.wordList.append(heading);

    for (const entry of groups.get(letter).sort(compareWords)) {
      elements.wordList.append(createWordRow(entry));
    }
  }
}

function createWordRow(entry) {
  const row = document.createElement('div');
  row.className = 'word-row';

  const text = document.createElement('div');
  text.className = 'word-text';

  const word = document.createElement('span');
  word.className = 'word-name';
  word.textContent = entry.word;
  word.title = entry.word;

  const meaning = document.createElement('span');
  meaning.className = 'word-meaning';
  meaning.textContent = entry.meaning || 'No meaning yet';
  if (!entry.meaning) meaning.classList.add('is-empty');
  meaning.title = entry.meaning || 'No meaning yet';

  text.append(word, meaning);

  if (state.searchMode === 'dictionary') {
    const isSaved = Boolean(state.words && Object.prototype.hasOwnProperty.call(state.words, entry.key));
    if (isSaved) {
      const badge = document.createElement('span');
      badge.className = 'saved-badge';
      badge.textContent = '✓ Saved';
      badge.title = 'Saved in your list';
      row.append(text, badge);
    } else {
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'icon-button icon-button-add';
      saveBtn.dataset.key = entry.key;
      saveBtn.dataset.word = entry.word;
      saveBtn.dataset.meaning = entry.meaning || '';
      saveBtn.dataset.action = 'save';
      saveBtn.setAttribute('aria-label', `Save ${entry.word}`);
      saveBtn.title = `Save "${entry.word}" to your list`;
      saveBtn.textContent = '+';
      row.append(text, saveBtn);
    }
  } else {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-button';
    remove.dataset.key = entry.key;
    remove.dataset.action = 'delete';
    remove.setAttribute('aria-label', `Delete ${entry.word}`);
    remove.title = `Delete ${entry.word}`;
    remove.textContent = '×';
    row.append(text, remove);
  }

  return row;
}

async function renderSuggestions() {
  const query = state.query.trim().toLowerCase();
  elements.suggestions.replaceChildren();

  if (!query) {
    elements.suggestions.hidden = true;
    return;
  }

  let sourceList;
  if (state.searchMode === 'dictionary') {
    if (!dictionaryList) await ensureDictionary();
    sourceList = dictionaryList || [];
  } else {
    sourceList = wordEntries();
  }

  if (state.query.trim().toLowerCase() !== query) return;

  const prefix = [];
  const substring = [];

  for (const entry of sourceList) {
    const lower = entry.key;
    if (lower.startsWith(query)) {
      prefix.push(entry);
    } else if (lower.includes(query)) {
      substring.push(entry);
    }
  }

  const matches = [...prefix.sort(compareWords), ...substring.sort(compareWords)].slice(
    0,
    SUGGESTION_LIMIT
  );

  if (matches.length === 0) {
    elements.suggestions.hidden = true;
    return;
  }

  for (const entry of matches) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion';
    button.dataset.word = entry.word;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');

    const word = document.createElement('span');
    word.className = 'suggestion-word';
    word.textContent = entry.word;

    const meaning = document.createElement('span');
    meaning.className = 'suggestion-meaning';
    meaning.textContent = entry.meaning || '—';

    button.append(word, meaning);
    elements.suggestions.append(button);
  }

  elements.suggestions.hidden = false;
}

function chooseSuggestion(word) {
  state.query = word;
  state.activeLetter = 'ALL';
  elements.searchInput.value = word;
  elements.suggestions.hidden = true;
  updateAzBar();
  renderDashboard();
  elements.searchInput.focus();
}

/* ------------------------------------------------------------------ */
/* Delete                                                             */
/* ------------------------------------------------------------------ */

function requestDelete(key) {
  const entry = state.words[key];
  if (!entry) return;

  state.pendingDeleteKey = key;
  elements.deleteWordName.textContent = entry.word;
  elements.confirmDelete.disabled = false;
  elements.deleteDialog.showModal();
}

async function confirmDelete() {
  const key = state.pendingDeleteKey;
  if (!key) return;

  elements.confirmDelete.disabled = true;
  const response = await sendMessage('delete-word', { key });

  if (!response.ok) {
    elements.confirmDelete.disabled = false;
    elements.dashboardStatus.textContent = response.error || 'Could not delete the word.';
    return;
  }

  state.pendingDeleteKey = null;
  elements.deleteDialog.close();

  const stored = await chrome.storage.local.get('words');
  state.words = stored.words || {};
  renderDashboard();
  elements.dashboardStatus.textContent = 'Word deleted.';
}

/* ------------------------------------------------------------------ */
/* Backup                                                             */
/* ------------------------------------------------------------------ */

async function exportWords() {
  const stored = await chrome.storage.local.get('words');
  state.words = stored.words || {};

  const payload = JSON.stringify({ version: 1, words: state.words }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `e2b-words-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  elements.dashboardStatus.textContent = 'Backup downloaded.';
}

async function importFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (
      !data ||
      data.version !== 1 ||
      !data.words ||
      typeof data.words !== 'object' ||
      Array.isArray(data.words)
    ) {
      throw new Error('Unsupported or invalid backup file.');
    }

    const response = await sendMessage('import-words', { words: data.words });
    if (!response.ok) throw new Error(response.error || 'Import failed.');

    const stored = await chrome.storage.local.get('words');
    state.words = stored.words || {};
    renderDashboard();

    const { added, skipped } = response.result;
    elements.dashboardStatus.textContent = `Imported ${added} ${
      added === 1 ? 'word' : 'words'
    }, skipped ${skipped}.`;
  } catch (error) {
    elements.dashboardStatus.textContent = error.message || 'Import failed.';
  }
}

/* ------------------------------------------------------------------ */
/* Events                                                             */
/* ------------------------------------------------------------------ */

function bindEvents() {
  elements.showList.addEventListener('click', async () => {
    await sendMessage('clear-preview');
    state.preview = null;
    showDashboard();
  });

  elements.meaningForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.preview) return;

    const meaning = elements.meaningInput.value.trim();
    if (!meaning) {
      elements.previewStatus.textContent = 'Enter a meaning before saving.';
      elements.meaningInput.focus();
      return;
    }

    const response = await sendMessage('update-meaning', {
      key: state.preview.key,
      meaning,
    });

    if (!response.ok) {
      elements.previewStatus.textContent = response.error || 'Could not save the meaning.';
      return;
    }

    state.preview = { ...state.preview, ...response.result };
    state.words[state.preview.key] = response.result;
    renderPreview();
    elements.previewStatus.textContent = 'Meaning saved.';
  });

  elements.toggleSaved.addEventListener('click', () => setSearchMode('saved'));
  elements.toggleDictionary.addEventListener('click', () => setSearchMode('dictionary'));

  elements.searchInput.addEventListener('input', () => {
    state.query = elements.searchInput.value;
    renderSuggestions();
    renderDashboard();
  });

  elements.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Enter') {
      elements.suggestions.hidden = true;
    }
  });

  elements.suggestions.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-word]');
    if (!button) return;
    chooseSuggestion(button.dataset.word);
  });

  elements.azBar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-letter]');
    if (!button) return;
    state.activeLetter = button.dataset.letter;
    updateAzBar();
    renderDashboard();
  });

  elements.wordList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-key]');
    if (!button) return;

    if (button.dataset.action === 'save') {
      const word = button.dataset.word;
      const meaning = button.dataset.meaning || '';
      button.disabled = true;
      const response = await sendMessage('save-word', { word, meaning });
      if (response && response.ok) {
        const stored = await chrome.storage.local.get('words');
        state.words = stored.words || {};
        renderDashboard();
        elements.dashboardStatus.textContent = `"${word}" saved to your list.`;
      } else {
        button.disabled = false;
        elements.dashboardStatus.textContent =
          (response && response.error) || 'Could not save the word.';
      }
      return;
    }

    requestDelete(button.dataset.key);
  });

  elements.confirmDelete.addEventListener('click', confirmDelete);

  elements.deleteDialog.addEventListener('close', () => {
    state.pendingDeleteKey = null;
    elements.confirmDelete.disabled = false;
  });

  document.addEventListener('click', (event) => {
    if (!elements.searchWrap.contains(event.target)) {
      elements.suggestions.hidden = true;
    }
  });

  elements.exportButton.addEventListener('click', exportWords);

  elements.importButton.addEventListener('click', () => elements.importFile.click());

  elements.importFile.addEventListener('change', async () => {
    const file = elements.importFile.files && elements.importFile.files[0];
    elements.importFile.value = '';
    if (file) await importFile(file);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.words) return;

    state.words = changes.words.newValue || {};

    if (state.view === 'dashboard') {
      renderDashboard();
      return;
    }

    if (state.preview) {
      const updated = state.words[state.preview.key];
      if (updated) {
        state.preview = { ...state.preview, ...updated };
        if (document.activeElement !== elements.meaningInput) renderPreview();
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* Start                                                              */
/* ------------------------------------------------------------------ */

async function start() {
  ensureDictionary();

  if (elements.copyrightYear) {
    elements.copyrightYear.textContent = new Date().getFullYear();
  }

  bindEvents();
  buildAzBar();

  const stored = await chrome.storage.local.get(['words', 'preview']);
  state.words = stored.words && typeof stored.words === 'object' ? stored.words : {};

  if (isFreshPreview(stored.preview)) {
    state.preview = stored.preview;
    showPreview();
    await chrome.storage.local.set({ preview: null });
  } else {
    state.preview = null;
    if (stored.preview) await chrome.storage.local.set({ preview: null });
    showDashboard();
  }
}

document.addEventListener('DOMContentLoaded', start);
