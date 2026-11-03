# Spec Delta

## Purpose

Gives the user an overview of saved words and the tools to find, filter, and remove them.

## ADDED Requirements

### Requirement: Opening the extension directly shows the dashboard

When no pending preview exists, opening the extension SHALL show the dashboard.

#### Scenario: Direct open

- **WHEN** the user clicks the extension icon with no pending preview
- **THEN** the dashboard is shown

### Requirement: Saved words are listed by initial letter

The dashboard SHALL list every saved word with its meaning, grouped by the upper-case first letter
of the word. Words that do not start with a Latin letter SHALL be grouped under `#`. Groups and
their entries SHALL be sorted alphabetically.

#### Scenario: Grouped list

- **WHEN** the library contains `apple`, `arrow`, and `বই`
- **THEN** `apple` and `arrow` appear under `A` in alphabetical order and `বই` appears under `#`

#### Scenario: Word with several meanings

- **WHEN** a listed word has several senses in its meaning string
- **THEN** the row shows the joined meanings as one line, shortened with an ellipsis when too long

### Requirement: A-Z filter narrows the list

The dashboard SHALL provide an A-Z filter, a `#` option, and an All option. Selecting a letter
SHALL show only words in that group; selecting All SHALL show the grouped full list.

#### Scenario: Filter by letter

- **WHEN** the user selects `B`
- **THEN** only words starting with `B` remain visible

#### Scenario: Clear the filter

- **WHEN** the user selects All
- **THEN** all words are visible again, grouped by initial letter

### Requirement: Search offers suggestions

Typing in search SHALL show up to eight matching suggestions. Prefix matches SHALL come before
substring matches, matching SHALL be case-insensitive, and the suggestion list SHALL be empty when
the query is empty.

#### Scenario: Prefix and substring matches

- **WHEN** the library contains `apple`, `pineapple`, and `app` and the user types `app`
- **THEN** suggestions list `app` and `apple` before `pineapple`

#### Scenario: No match

- **WHEN** the query matches no saved word
- **THEN** no suggestions are shown

### Requirement: Choosing a suggestion shows that word

Selecting a suggestion SHALL show the chosen word in the word list with its meaning.

#### Scenario: Pick a suggestion

- **WHEN** the user selects a suggestion
- **THEN** the list shows that word and its meaning

### Requirement: Delete requires confirmation

Deleting a word SHALL ask for confirmation first. Cancelling SHALL leave the word and the list
unchanged; confirming SHALL remove the word and update the list.

#### Scenario: Cancel deletion

- **WHEN** the user starts a deletion and cancels the confirmation
- **THEN** the word remains in the library

#### Scenario: Confirm deletion

- **WHEN** the user confirms the deletion
- **THEN** the word disappears from the list and the library

### Requirement: Empty and no-result states are explained

The dashboard SHALL show an empty state when no words are saved and a no-results state when a
search or filter matches nothing.

#### Scenario: No saved words

- **WHEN** the library is empty
- **THEN** the dashboard explains how to save the first word

#### Scenario: Filter matches nothing

- **WHEN** a search or filter matches no words
- **THEN** the dashboard shows a no-results message instead of an empty list
