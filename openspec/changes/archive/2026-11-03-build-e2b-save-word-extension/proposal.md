# Proposal

## Why

Readers who meet an English word on a web page currently have to leave the page, open a
dictionary, and copy the result somewhere else. E2B Save Word keeps that loop inside the browser:
select a word, right-click, and the English-to-Bangla meaning is looked up and saved in one step.
No extension exists in this project yet; this change establishes the full first version.

## What Changes

- Add a Manifest V3 extension skeleton with a service worker, one popup page with two views, and
  a bundled dictionary file.
- Add a "Save word" context menu item that appears for selected text on any page.
- Add a preview view that shows `word = meaning` and a "List of words" button.
- Save the selected word automatically before the preview opens, with duplicate prevention.
- Add a dashboard with the saved word list, A-Z filtering, category grouping, search with
  suggestions, delete with confirmation, and JSON export/import.
- Look words up in a bundled `data/dictionary.txt` (one `|English word|Bangla meaning` entry per
  line; repeated words merge their distinct meanings in order). A word with no match is still
  saved, with an empty meaning the user can fill in.

**Storage schema**: this change introduces the `chrome.storage.local` keys `words` and `preview`.
They do not exist yet, so no migration is required, but later changes to either key must treat it
as a migration concern.

**Out of scope**

- Other browsers, Chrome Web Store publishing, and packaging outside "Load unpacked".
- Accounts, cloud sync, or cross-device sync. Data stays in `chrome.storage.local`.
- Audio pronunciation, example sentences, grammar, and spaced repetition.
- Editing the bundled dictionary from the UI; the dictionary is read-only.
- Non-English source words and languages other than English-to-Bangla.
- Automated tests; verification stays manual.

## Capabilities

### New Capabilities

- `word-capture`: Turning a right-clicked text selection into a normalized word and triggering the
  save-and-preview flow, including the context menu lifecycle.
- `dictionary-lookup`: Loading and parsing the bundled English-to-Bangla dictionary and resolving a
  word to a meaning, including the not-found case.
- `word-preview`: The preview view shown after a selection, its word-meaning display, the
  "List of words" action, and manual meaning entry when lookup found nothing.
- `word-storage`: The local word library: save, retrieve, update, delete, duplicate prevention,
  write serialization, and the `words` / `preview` storage schema.
- `word-dashboard`: The main dashboard view: word list, A-Z filter, category grouping, search with
  suggestions, delete confirmation, and empty states.
- `word-backup`: Exporting the word library as JSON and importing a JSON file with validation and
  merge rules.

### Modified Capabilities

None. `openspec/specs/` is empty.

## Impact

- New files: `manifest.json`, `background.js`, `popup.html`, `popup.css`, `popup.js`,
  `data/dictionary.txt`.
- New permissions: `contextMenus`, `storage`. No host permissions and no content script.
- New storage contract: `chrome.storage.local` keys `words` and `preview`.
- Requires Chrome 127+ for `chrome.action.openPopup()`, with a `chrome.windows.create()` fallback.
- No build step, no npm dependencies, no automated tests.
