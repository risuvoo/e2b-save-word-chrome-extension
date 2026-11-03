# AGENTS.md — E2B Save Word (Chrome Extension)

Manifest V3 Chrome extension. No build step, no npm, no tests, no git repo.
Dev loop: open `chrome://extensions`, enable Developer mode, "Load unpacked" on this directory,
click the reload icon after every edit. Do not invent lint/test commands.
Target Chrome 127+ (needed for `chrome.action.openPopup`). Development is on Windows.

## OpenSpec workflow

Feature work goes through OpenSpec: `openspec new change` (or `opsx propose`) → implement via
apply → archive. `openspec/specs/` is the source of truth for shipped behavior; this file owns
coding rules and implementation detail. Project context and artifact rules live in
`openspec/config.yaml` — do not duplicate them here.

## Files and boundaries

- `manifest.json` — MV3. Permissions: `contextMenus`, `storage` only. **No content script and no
  host permissions**: `contextMenus.onClicked` delivers the selection via `info.selectionText`.
  Only add a content script if a future feature needs in-page UI or double-click capture.
- `background.js` — service worker. Owns context menu creation, dictionary loading, and **every**
  storage mutation. Writes are serialized through `withLock()`.
- `popup.html` / `popup.css` / `popup.js` — ONE popup page with two views: **preview** and
  **dashboard**. The popup reads storage directly but sends `chrome.runtime.sendMessage` for
  `update-meaning`, `delete-word`, `import-words`, and `clear-preview`; do not write `words`
  from the popup, or you bypass the mutex.
- `data/dictionary.txt` — UTF-8, one `|English word|Bangla meaning` entry per line. The real
  library is 17,297 lines / 13,506 unique headwords; a leading BOM is ignored, and repeated
  headwords merge their distinct meanings in file order, joined with `; `. Replace the file
  without changing the format.

## Critical MV3 gotchas

1. **A context-menu click cannot open a popup directly.** Flow: save the word, write `preview`
   state, call `chrome.action.openPopup()` (Chrome 127+), and on rejection open
   `chrome.windows.create()` with `popup.html`. The popup reads `preview` on load: present →
   preview view, absent → dashboard.
2. Event listeners (`contextMenus.onClicked`, `runtime.onMessage`, `runtime.onInstalled`) must
   register at the **top level** of the service worker — never after an `await`.
3. Create the context menu inside `chrome.runtime.onInstalled` using `removeAll()` first.
   Re-creating on every worker wake throws duplicate-ID errors.
4. Service workers suspend and lose memory. The dictionary `Map` is memoized per worker and
   rebuilt lazily via `fetch(chrome.runtime.getURL('data/dictionary.txt'))`; a failed fetch
   resets the cache so the next lookup retries.
5. Read-modify-write races: two rapid saves interleave async storage calls. All mutations go
   through the promise-chain mutex in `background.js`.

## Data model (`chrome.storage.local`)

```js
{
  words: { [key]: { word, meaning, savedAt } },    // key = normalized word, lowercased
  preview: { key, word, meaning, savedAt } | null
}
```

- Duplicate check = key already in `words`. If it exists, keep its meaning; never replace a
  non-empty meaning with an empty one.
- Normalization: trim, collapse internal whitespace, strip leading/trailing punctuation, keep
  internal apostrophes and hyphens (`don't`, `well-being`). Blank results are ignored.
- Preview state is consumed when first displayed and expires after 10 minutes.
- Dictionary parsing: read UTF-8, strip a leading BOM, split each non-blank line on its **first two**
  `|` characters, trim both sides, and skip lines without both separators. Lowercase the headword;
  repeated headwords collect their distinct meanings in file order, joined with `; `. Lookup is
  case-insensitive and exact, never substring, and multi-word headwords match as a phrase.
- Import JSON shape: `{ version: 1, words }`. Merge adds only new keys and reports added/skipped;
  validation must happen before any write.

## UI conventions

- Popup is fixed at 380x560 (`body`), list region scrolls, header and footer stay pinned.
- The dashboard list is grouped by initial letter (non-Latin under `#`); the A-Z bar filters a
  group and wraps into rows so every chip (All, A-Z, `#`) stays visible, All restores grouping,
  and search is prefix-first then substring, capped at 8.
- Render dictionary and imported text with `textContent` / `createElement`. **Never**
  `innerHTML` — meanings and backup files are untrusted.
- No web fonts or external assets (extension CSP); use the system stacks in `popup.css`.

## Manual verification (no automated tests exist)

1. Load unpacked; select a word on any page → right-click → "Save ..." → preview shows
   `word = meaning`; the word is in storage before the popup appears.
2. Save the same word again → one entry, meaning preserved.
3. Word missing from the dictionary → preview shows an editable empty meaning; saving persists it.
4. Direct popup click → dashboard; A-Z filter, search suggestions, delete-with-confirm work.
5. Export → reload the extension → Import → counts restored, duplicates skipped.
6. Stop the service worker in `chrome://serviceworker-internals` (or wait for idle) → repeat
   step 1; the dictionary reloads.
7. Rename `data/dictionary.txt` → lookups return empty meanings but saving still works; restore
   the file.
8. Save a word with several senses (for example `abandon`) → the preview and the dashboard show
   the senses in one line separated by `; `.
