# Spec Delta

## Purpose

Shows the result of a saved selection and provides the route into the word library.

## ADDED Requirements

### Requirement: Preview shows only the word, its meaning, and one action

The preview SHALL show the word and its meaning in `word = meaning` form, plus a "List of words"
button. It SHALL NOT show the word list or dashboard controls. When the meaning holds several
senses, the preview SHALL show all of them in order, separated by `; `.

#### Scenario: Word with a meaning

- **WHEN** the preview opens for a word with a meaning
- **THEN** it shows `word = meaning` and the "List of words" button

#### Scenario: Word with several meanings

- **WHEN** the dictionary holds two senses for the saved word
- **THEN** the preview shows both senses in one `word = meaning1; meaning2` line

#### Scenario: Word without a meaning

- **WHEN** the preview opens for a word with an empty meaning
- **THEN** it shows the word with an empty meaning field and the "List of words" button

### Requirement: Preview opens automatically after a save

When a menu activation saves a word, the extension SHALL open the preview view without further
user action.

#### Scenario: Save triggers preview

- **WHEN** the user saves a selected word from the context menu
- **THEN** the preview view appears showing that word

### Requirement: List of words opens the dashboard

Activating "List of words" SHALL close the preview, clear the pending preview state, and show the
dashboard.

#### Scenario: Leave the preview

- **WHEN** the user activates "List of words"
- **THEN** the dashboard is shown and no pending preview remains

### Requirement: Empty meanings can be filled in manually

When the preview shows an empty meaning, it SHALL provide an editable meaning field and a Save
action. Saving a non-empty meaning SHALL replace the stored meaning string and display it in
`word = meaning` form.

#### Scenario: User enters a meaning

- **WHEN** the user types a meaning and saves it in the preview
- **THEN** the stored word now has that meaning and the preview shows `word = meaning`

#### Scenario: User replaces several meanings

- **WHEN** the stored word holds several senses and the user saves a new meaning
- **THEN** the stored meaning string becomes the new text, without the previous senses

### Requirement: Stored meanings take precedence over the dictionary

For a word that is already saved, the preview SHALL show its stored meaning even when the
dictionary contains a different meaning.

#### Scenario: Previously edited meaning

- **WHEN** the preview opens for a saved word whose meaning was manually edited
- **THEN** the preview shows the stored edited meaning

### Requirement: Preview state does not reappear later

A preview SHALL be treated as consumed once shown. A pending preview older than 10 minutes SHALL
NOT be shown; opening the extension directly SHALL show the dashboard instead.

#### Scenario: Reopen the extension later

- **WHEN** the user opens the extension again after a preview was shown
- **THEN** the dashboard is shown, not the previous preview

#### Scenario: Stale pending preview

- **WHEN** the extension is opened and the pending preview is older than 10 minutes
- **THEN** the dashboard is shown and the pending preview is discarded
