# word-storage Specification

## Purpose

Owns the local word library: persistence, duplicate prevention, updates, deletes, and the storage
contract shared by the other capabilities.

## Requirements

### Requirement: Words persist locally across browser restarts

Each saved word SHALL be stored in `chrome.storage.local` with its display form, meaning, and save
timestamp. Entries SHALL survive browser restarts and SHALL NOT leave the device.

#### Scenario: Restart the browser

- **WHEN** the user saves a word and restarts the browser
- **THEN** the word is still in the library with the same meaning

### Requirement: Word identity is case-insensitive

The library SHALL identify a word by its normalized form converted to lower case. The display form
of the first saved entry SHALL be kept.

#### Scenario: Same word with different case

- **WHEN** the user saves `Apple` and later saves `apple`
- **THEN** the library contains one entry displayed as `Apple`

### Requirement: Saving an existing word does not duplicate it

Saving a word that is already in the library SHALL keep a single entry and SHALL preserve the
stored meaning. An empty lookup result SHALL NOT replace a non-empty stored meaning.

#### Scenario: Duplicate save preserves the meaning

- **WHEN** the user saves a word that already has a stored meaning
- **THEN** no second entry is created and the stored meaning is unchanged

### Requirement: Concurrent saves do not lose words

Two saves that start close together SHALL both be persisted, and neither SHALL overwrite the
other's entry.

#### Scenario: Rapid consecutive saves

- **WHEN** the user saves two different words in quick succession
- **THEN** the library contains both words

### Requirement: Meaning updates persist

Updating the meaning of a stored word SHALL replace its meaning and keep the entry available after
a restart.

#### Scenario: Update and reload

- **WHEN** the user saves a new meaning for a word and reopens the extension
- **THEN** the new meaning is shown

### Requirement: One meaning string holds every dictionary sense

When the dictionary gives a word several meanings, the entry SHALL keep one `meaning` string that
contains all distinct senses in dictionary order, separated by `; `. The entry shape SHALL remain
`{ word, meaning, savedAt }`; no extra field or array SHALL be stored, so existing libraries need
no migration.

#### Scenario: Word with several senses

- **WHEN** the dictionary maps `a` to `এক` and `ইংরেজি বর্ণমালার প্রথম অক্ষর`
- **THEN** the stored entry for `a` has the meaning `এক; ইংরেজি বর্ণমালার প্রথম অক্ষর`

#### Scenario: Manual edit replaces the sense list

- **WHEN** the user saves a new meaning for a word that had several senses
- **THEN** the stored `meaning` becomes exactly the new text

### Requirement: Deleting a word affects only that word

Deleting a word SHALL remove its entry and leave every other entry unchanged.

#### Scenario: Delete one of several words

- **WHEN** the user deletes a word from a library containing several words
- **THEN** only that word is removed

### Requirement: Storage uses the words and preview keys

The extension SHALL keep library entries under the `chrome.storage.local` key `words` and the
pending preview under the key `preview`. Changes to either shape SHALL be treated as a migration
concern.

#### Scenario: Read the stored library

- **WHEN** the extension reads the library
- **THEN** it finds a `words` object keyed by lowercased word and a `preview` value that is either
  a pending preview or null
