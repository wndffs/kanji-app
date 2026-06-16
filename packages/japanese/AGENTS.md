# packages/japanese/AGENTS.md

This package owns Japanese and Russian normalization, lightweight linguistic helpers, and answer validation.

## Requirements

- Framework-agnostic TypeScript.
- Extensive unit tests with Japanese and Russian examples.
- Conservative fuzzy matching.
- Explicit blocked-answer handling.

## Public API direction

Expose functions similar to:

- `normalizeKana`
- `katakanaToHiragana`
- `normalizeJapaneseReading`
- `normalizeRussianMeaning`
- `isReadingAccepted`
- `isMeaningAccepted`
- `validateAnswer`

Do not call external APIs. Do not include large dictionaries directly in package code.
