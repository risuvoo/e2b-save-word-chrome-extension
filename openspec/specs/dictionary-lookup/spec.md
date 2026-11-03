# dictionary-lookup Specification

## Purpose

Resolves an English word to its Bangla meaning using the dictionary bundled with the extension.

## Requirements

### Requirement: Dictionary is loaded from the packaged file

Word lookup SHALL use the bundled `data/dictionary.txt` file and SHALL NOT make any network
request.

#### Scenario: Offline lookup

- **WHEN** the browser is offline and a selected word exists in the dictionary
- **THEN** the lookup returns the Bangla meaning

### Requirement: Dictionary entries use the pipe-delimited format

The parser SHALL read the file as UTF-8 text, ignore a leading byte-order mark, and treat each
non-blank line as one entry in the form `|English word|Bangla meaning`. It SHALL split each line
on its first two pipe characters, trim both sides, and keep the meaning exactly as written,
including any later pipe characters. A line without the leading pipe or the second pipe SHALL be
skipped without error.

#### Scenario: Standard entry

- **WHEN** a line is `|apple|আপেল`
- **THEN** the word `apple` maps to `আপেল`

#### Scenario: Byte-order mark

- **WHEN** the first line of the file starts with a byte-order mark followed by `|a|এক`
- **THEN** the byte-order mark is ignored and `a` maps to `এক`

#### Scenario: Meaning contains a pipe or equals sign

- **WHEN** a line is `|test|পরীক্ষা = যাচাই|অতিরিক্ত`
- **THEN** the word `test` maps to `পরীক্ষা = যাচাই|অতিরিক্ত`

#### Scenario: Malformed or comment line

- **WHEN** the file contains a blank line, a `#` comment, or a line without two pipe characters
- **THEN** the line is skipped without error

### Requirement: Repeated dictionary words merge their meanings

The same English word MAY appear on several lines. The parser SHALL produce one entry, collect its
distinct meanings in file order, drop meanings that repeat exactly, and join the remaining meanings
with `; `. English words SHALL be compared without regard to letter case.

#### Scenario: Several meanings for one word

- **WHEN** the file contains `|a|এক` and `|a|ইংরেজি বর্ণমালার প্রথম অক্ষর`
- **THEN** `a` maps to `এক; ইংরেজি বর্ণমালার প্রথম অক্ষর`

#### Scenario: Identical meaning repeated

- **WHEN** the file contains `|abandon|ত্যাগ করা` twice
- **THEN** `abandon` maps to `ত্যাগ করা` once

#### Scenario: Headwords differ only by case

- **WHEN** the file contains `|Lead|সীসা` and `|lead|নেতৃত্ব দেওয়া`
- **THEN** one entry holds both meanings

### Requirement: Dictionary parsing happens once per service worker

The dictionary SHALL be fetched and parsed at most once per running service worker and reused for
later lookups. After the worker suspends, the next lookup SHALL rebuild it from the packaged file.

#### Scenario: Worker restarts

- **WHEN** the service worker stops and a later lookup needs the dictionary
- **THEN** the dictionary is parsed again and the lookup returns the same meaning

### Requirement: Lookup is case-insensitive and exact

Lookup SHALL compare the normalized word against dictionary keys without regard to letter case and
SHALL match the whole entry, not a substring. Headwords that contain several words SHALL be matched
as the whole phrase.

#### Scenario: Different letter case

- **WHEN** the selected word is `Apple` and the dictionary key is `apple`
- **THEN** the lookup returns the meaning for `apple`

#### Scenario: Partial word

- **WHEN** the selected word is `app` and the dictionary contains only `apple`
- **THEN** the lookup returns no meaning

#### Scenario: Multi-word headword

- **WHEN** the selected text is `open university` and the dictionary contains that phrase
- **THEN** the lookup returns its Bangla meaning

### Requirement: Unknown or empty entries return an empty meaning

A word with no dictionary entry SHALL be saved with an empty meaning instead of failing. A
dictionary entry whose Bangla side is blank SHALL behave the same way.

#### Scenario: Word not in dictionary

- **WHEN** the selected word has no dictionary entry
- **THEN** the word is saved with an empty meaning and no error is shown

#### Scenario: Blank meaning in the dictionary

- **WHEN** the dictionary line is `|credit| ` and the user selects `credit`
- **THEN** the word is saved with an empty meaning and the preview offers manual entry

### Requirement: Missing dictionary file degrades gracefully

If the dictionary file cannot be read, lookups SHALL return an empty meaning and the rest of the
extension SHALL remain usable.

#### Scenario: Dictionary file unavailable

- **WHEN** `data/dictionary.txt` is missing or unreadable
- **THEN** every lookup returns an empty meaning and saving still works
