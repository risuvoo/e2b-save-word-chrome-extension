# Tasks

## 1. Scaffold and manifest

- [x] 1.1 Create `manifest.json` (MV3, `contextMenus` + `storage`, service worker `background.js`, action popup `popup.html`, Chrome 127 minimum) and verify it loads without errors at `chrome://extensions`.
- [x] 1.2 Create empty `background.js`, `popup.html`, `popup.css`, `popup.js`, and `data/dictionary.txt` and verify the extension reloads with no console errors.

## 2. Dictionary lookup

- [x] 2.1 Replace the sample `data/dictionary.txt` with the real `BengaliDictionary_17.txt` library (pipe-delimited, UTF-8) and verify the parsed result holds 17,297 entries and 13,506 unique headwords, with the leading byte-order mark ignored.
- [x] 2.2 Implement lazy fetch and memoized parsing in `background.js` and verify a lookup survives a service worker restart by repeating it after the worker suspends.
- [x] 2.3 Implement case-insensitive exact lookup and the not-found path and verify `Apple` matches `apple`, `app` does not match `apple`, and an unknown word returns an empty meaning.
- [x] 2.4 Verify that renaming `data/dictionary.txt` makes lookups return empty meanings while saving still works, then restore the file.
- [x] 2.5 Implement pipe-delimited parsing (strip BOM, split on the first two `|`, skip lines without both separators) and multi-meaning merge (distinct meanings in file order, identical repeats dropped, joined with `; `), then verify `|a|এক` plus `|a|ইংরেজি বর্ণমালার প্রথম অক্ষর` yields `এক; ইংরেজি বর্ণমালার প্রথম অক্ষর`.

## 3. Storage layer

- [x] 3.1 Implement the `words` map and `preview` value in `chrome.storage.local` with a promise-chain write mutex and verify via DevTools that both keys have the documented shape.
- [x] 3.2 Implement save with lower-case key identity, timestamp, and duplicate prevention and verify saving `Apple` then `apple` leaves one entry with the stored meaning.
- [x] 3.3 Implement update-meaning and delete helpers and verify an update survives an extension reload and a delete removes only the target word.
- [x] 3.4 Verify two rapid saves of different words both persist and neither entry is lost.

## 4. Context menu capture

- [x] 4.1 Register the "Save word" menu in `chrome.runtime.onInstalled` and verify exactly one item appears after two extension reloads.
- [x] 4.2 Implement selection normalization and verify `"don't,"` saves as `don't`, `  well-being  ` saves as `well-being`, `hello,   world` saves as `hello, world`, and whitespace-only input is ignored.
- [x] 4.3 Implement the menu click flow (save, write `preview`, `chrome.action.openPopup()`, `chrome.windows.create()` fallback) and verify a saved word appears in storage before the preview surface opens.
- [x] 4.4 Verify the fallback path by forcing `openPopup` to fail and confirming the word is still saved and a window opens.

## 5. Preview view

- [x] 5.1 Build the popup view switch driven by `preview` and verify a direct icon click shows the dashboard while a menu save shows the preview.
- [x] 5.2 Render `word = meaning` and the "List of words" button and verify a known word shows its dictionary meaning.
- [x] 5.3 Implement manual meaning entry for empty meanings and verify typing a meaning and saving updates the stored entry and the display.
- [x] 5.4 Verify the preview shows a previously edited stored meaning even when the dictionary differs.
- [x] 5.5 Implement consume-on-read and the 10-minute expiry and verify reopening the extension after a preview shows the dashboard, and that a preview older than 10 minutes is discarded.

## 6. Dashboard list, filter, and search

- [x] 6.1 Render the grouped word list (A-Z groups, non-Latin under `#`, alphabetical within groups) and verify grouping and order with mixed-case and Bangla entries.
- [x] 6.2 Implement the A-Z / `#` / All filter and verify selecting `B` shows only B words and All restores the grouped list.
- [x] 6.3 Implement search suggestions (prefix-first, then substring, cap eight, case-insensitive) and verify `app` lists `app` and `apple` before `pineapple`, and no match shows no suggestions.
- [x] 6.4 Implement suggestion selection, the empty state, and the no-results state and verify each state is visible with the matching library contents.

## 7. Delete and backup

- [x] 7.1 Implement delete with a confirmation dialog and verify cancel keeps the word and confirm removes only that word from the list and storage.
- [x] 7.2 Implement JSON export with a version and all entries and verify a populated export downloads with every word and an empty library exports a valid empty file.
- [x] 7.3 Implement import validation, merge-without-overwrite, key normalization, and added/skipped counts, and verify a malformed file changes nothing while a valid file adds only new words and reports both counts.

## 8. Integration and polish

- [x] 8.1 Verify the full flow after service worker suspension: right-click a selected word, preview opens with the meaning, and the word is in the dashboard.
- [x] 8.2 Verify two open surfaces stay in sync by saving in one and observing the other update without a manual reload.
- [x] 8.3 Verify a dictionary line or imported meaning containing HTML is shown as text, never executed.
- [x] 8.4 Verify the popup fits within 380x560 with a scrollable list and no clipped controls at 100% and 125% zoom.
- [x] 8.5 Update `AGENTS.md` so it no longer calls the repo greenfield and matches the shipped files, then re-read it for stale commands.

## Workflow follow-up

- Archive the change after manual verification passes.
- Verify the archived result updates `openspec/specs/` with all six capabilities.
