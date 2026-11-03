# Spec Delta

## Purpose

Turns a user's text selection into a saved dictionary entry, starting from the browser context
menu.

## ADDED Requirements

### Requirement: Context menu offers saving selected text

The extension SHALL add a "Save word" item to the browser context menu and SHALL show it only
when the user has selected text.

#### Scenario: Text is selected

- **WHEN** the user selects text on a page and opens the context menu
- **THEN** the menu shows a "Save word" item that includes the selected text

#### Scenario: Nothing is selected

- **WHEN** the user opens the context menu without a text selection
- **THEN** the "Save word" item is not shown

### Requirement: Selection is normalized before saving

On activation, the extension SHALL trim surrounding whitespace, collapse internal whitespace runs
to one space, and strip leading and trailing punctuation. Internal apostrophes and hyphens SHALL
be preserved.

#### Scenario: Quoted word with punctuation

- **WHEN** the selection is `"don't,"`
- **THEN** the saved word is `don't`

#### Scenario: Hyphenated word with extra spaces

- **WHEN** the selection is `  well-being  `
- **THEN** the saved word is `well-being`

#### Scenario: Multi-word phrase

- **WHEN** the selection is `hello,   world`
- **THEN** the saved word is `hello, world`

#### Scenario: Multi-word dictionary headword

- **WHEN** the selection is `open university` and the dictionary contains that headword
- **THEN** the phrase is saved as one entry and matched against the whole headword

### Requirement: Activation saves before the preview opens

Activating the menu item SHALL save the word to the library before showing the preview. The save
SHALL still complete when the preview cannot be opened.

#### Scenario: Successful save and preview

- **WHEN** the user activates "Save word"
- **THEN** the word is present in storage and the preview view opens

#### Scenario: Preview cannot open

- **WHEN** the preview surface fails to open after activation
- **THEN** the word is still saved

### Requirement: Blank selections are ignored

A selection that is empty or only whitespace after normalization SHALL NOT create an entry and
SHALL NOT open a preview.

#### Scenario: Whitespace-only selection

- **WHEN** the normalized selection is empty
- **THEN** no word is saved and no preview opens

### Requirement: Context menu is registered exactly once

The extension SHALL create one "Save word" menu item per install or update, with no duplicate
items after reloads or service worker restarts.

#### Scenario: Extension reloaded

- **WHEN** the extension is reloaded or updated
- **THEN** the context menu contains exactly one "Save word" item
