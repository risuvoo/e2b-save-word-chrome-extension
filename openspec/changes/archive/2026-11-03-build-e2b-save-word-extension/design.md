# Design

## Context

See `proposal.md` for motivation and `specs/` for the behavior contract. This project starts from
an empty directory; the only existing guidance is `AGENTS.md` and `openspec/config.yaml`.

Hard constraints:

- Manifest V3, Chrome 127+, Windows development, no build step, no npm dependencies.
- Verification is manual through `chrome://extensions`; there is no test harness.
- Permission budget is `contextMenus` and `storage` only. No host permissions.
- The dictionary is a packaged text file, not a service.

## Goals / Non-Goals

**Goals:**

- Make the save action feel instant: one right-click, then the word and meaning appear.
- Survive service worker suspension without stale or lost state.
- Keep one storage contract for capture, preview, dashboard, and backup.
- Keep the popup usable at roughly 380x560.

**Non-Goals:**

- No content script, no injected UI, no page modification.
- No background sync, accounts, or remote dictionary updates.
- No editing of the bundled dictionary.
- No framework, bundler, or dependency graph.

## Decisions

### 1. Read the selection from the context menu, not a content script

`contextMenus.onClicked` already provides `info.selectionText`. A content script would add a
permission surface, a message protocol, and a second source of truth for the selection.

Alternative rejected: inject a content script and message the service worker. Needed only if a
future feature wants double-click capture or in-page UI.

### 2. One popup page with two views, driven by persisted state

`popup.html` renders either the preview or the dashboard. Which one is shown is derived from the
`preview` key in `chrome.storage.local`, not from the URL. A direct icon click therefore lands on
the dashboard naturally, and the context menu can set a preview without navigating a page.

Alternative rejected: a separate `preview.html` and `chrome.windows.create` for every save. More
code, a second UI to style, and it bypasses the normal popup surface.

### 3. Open the popup with a fallback, and consume preview state

On menu activation the service worker saves the word, writes `preview`, and calls
`chrome.action.openPopup()`. If that rejects, it opens a small popup window onto `popup.html`.
The popup treats the preview as consumed once displayed and ignores a pending preview older than
10 minutes. This prevents a stale preview from hijacking a later icon click.

Alternative rejected: firing `chrome.action.openPopup()` and ignoring failures. The word would be
saved with no visible confirmation.

### 4. Storage: one `words` map plus one `preview` value, writes serialized

```js
{
  words: { [lowerKey]: { word, meaning, savedAt } },
  preview: { key, word, meaning, savedAt } | null
}
```

All mutations go through a promise-chain mutex so two rapid saves cannot read-modify-write over
each other. The popup re-renders on `chrome.storage.onChanged`, so the fallback window and the
action popup never disagree.

Alternatives rejected: `chrome.storage.sync` (small quota, conflicts with multi-word libraries and
import), one storage key per word (unbounded key enumeration, no atomic list read).

### 5. Dictionary loaded lazily and memoized in the service worker

`fetch(chrome.runtime.getURL('data/dictionary.txt'))` runs on the first lookup after each worker
wake, parses the file into a `Map` keyed by lower-cased English headword, and reuses that `Map`
until the worker suspends. Parsing is line-based on the pipe-delimited format: strip a leading
byte-order mark, split each line on its first two `|`, trim both sides, and skip lines without
both separators. Repeated headwords merge their distinct meanings in file order, joined with `; `.

The real library (`BengaliDictionary_17.txt`) was measured before adopting the format: 17,297
entries, 13,506 unique headwords, 2,180 headwords with several senses (at most 7), and 618 KB. One
blank meaning, 710 identical duplicate lines, 26 non-lower-case headwords, and a few mis-decoded
headwords are tolerated by these rules without special cases.

Alternatives rejected: parsing the file in the popup (duplicate logic, blocks first paint),
prebuilding a JSON index (adds a build step the project does not have), bundling as JS (no longer
a plain text dictionary), and keeping `=` as the separator (the real library is pipe-delimited, so
that would add a conversion step and a second format to maintain).

### 6. Dashboard uses one filter axis with search as the primary tool

The list is grouped by initial letter (non-Latin under `#`). The A-Z control selects a group; All
shows the grouped list. Search is prefix-first, then substring, capped at eight suggestions, and
choosing a suggestion shows that word. This avoids the "filter A plus search banana equals empty
screen" trap while still satisfying both requested filters.

### 7. Backup is a versioned JSON merge

Export downloads `{ version: 1, words }` through an object URL anchor, so no `downloads`
permission is needed. Import validates the version and shape, lower-cases keys, and adds only keys
that do not already exist. Duplicates are skipped, not overwritten, and counts are reported.

Alternative rejected: replacing the library on import. Destructive and hard to undo without a
second export.

### 8. UI is plain HTML/CSS/JS with strict text rendering

No framework. CSS custom properties hold the palette; the layout targets 380x560. Dictionary
meanings and imported values are rendered with `textContent` or `createElement`, never with
`innerHTML` interpolation. Fonts use a system stack with a Bengali fallback; no web fonts, which
would violate the extension CSP and add a network dependency.

### 9. Manual verification replaces automated tests

Each task ends with a repeatable check in the loaded extension: save, duplicate save, missing word,
filter, search, delete, export/import round-trip, service worker suspension. This is the only
available verification path and is recorded in `AGENTS.md`.

## Risks / Trade-offs

- **`action.openPopup()` may reject** -> always catch it and fall back to a window; the word is
  saved before either call.
- **Service worker suspension loses the dictionary cache** -> lazy reload with a loading promise;
  the cache is an optimization, not state.
- **Large dictionary raises first-lookup latency** -> parse once, key by lowercase; if the file
  grows past a few MB, revisit with a prebuilt index (see Open Questions).
- **Two surfaces open at once** -> both subscribe to `storage.onChanged`; writes stay atomic
  through the mutex.
- **Stale preview** -> consumed-on-read plus 10-minute expiry.
- **Untrusted text in preview, list, and import** -> text-only rendering, validated import shape.
- **Popup height limit (600px)** -> fixed layout with a scrollable list region and sticky controls.
- **Local-only data** -> deleting browser data removes words; export is the documented mitigation.

## Migration Plan

This is a new install: no existing storage keys, so no data migration is required. The export
format starts at `version: 1`; any future change to the `words` or `preview` shape must bump the
export version and handle older files on import. Rollback is uninstalling the extension, which
removes its local storage.

## Open Questions

- Should the dashboard later allow editing the meaning of an already-saved word? It does not change
  the current specs or tasks; it is a likely next change.
- Should the mis-decoded headwords in the library (for example `vinÄyak`) be cleaned up? They are
  stored as written today, so a cleaned file would be a dictionary replacement, not a code change.
