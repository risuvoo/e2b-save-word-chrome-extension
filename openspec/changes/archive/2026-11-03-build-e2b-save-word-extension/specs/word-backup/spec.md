# Spec Delta

## Purpose

Lets the user take the word library out of the extension as JSON and restore it on the same or
another browser profile.

## ADDED Requirements

### Requirement: Export downloads the whole library as JSON

Export SHALL produce a JSON file containing a format version and every saved word with its
meaning. The file SHALL download without leaving the extension page.

#### Scenario: Export a populated library

- **WHEN** the user exports a library containing saved words
- **THEN** a JSON file downloads containing every word and meaning

#### Scenario: Export an empty library

- **WHEN** the user exports with no saved words
- **THEN** a valid JSON file with an empty word collection downloads

#### Scenario: Export a word with several meanings

- **WHEN** a saved word's meaning string holds several senses separated by `; `
- **THEN** the exported file keeps that exact meaning string

### Requirement: Import validates the file before changing anything

Import SHALL accept only JSON with a supported version and a word collection. An invalid,
malformed, or unsupported file SHALL be rejected without changing the library, and the user SHALL
be told.

#### Scenario: Malformed file

- **WHEN** the user imports a file that is not valid JSON
- **THEN** the library is unchanged and an error is shown

#### Scenario: Unsupported version

- **WHEN** the user imports a file with an unrecognized version
- **THEN** the library is unchanged and an error is shown

### Requirement: Import merges without overwriting existing words

Imported words whose keys already exist SHALL be skipped and their stored meanings kept. Only new
keys SHALL be added. The result SHALL report how many words were added and skipped.

#### Scenario: Existing word in the import

- **WHEN** the imported file contains a word already in the library
- **THEN** the existing entry is kept and counted as skipped

#### Scenario: New words in the import

- **WHEN** the imported file contains words not in the library
- **THEN** those words are added and counted

### Requirement: Imported entries are normalized

Imported keys SHALL be lower-cased, and an entry with a missing meaning SHALL be stored with an
empty meaning. Duplicate keys inside one file SHALL produce one entry.

#### Scenario: Entry without a meaning

- **WHEN** an imported entry has no meaning field
- **THEN** it is added with an empty meaning
