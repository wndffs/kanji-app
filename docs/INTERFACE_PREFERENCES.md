# Interface Preferences (Task 120)

Presentation settings are independent of translations, grading, scheduling,
and kana mastery. Shared contracts are in
`packages/shared/src/interface-preferences.ts`.

| Field                     | Values                             | Default       |
| ------------------------- | ---------------------------------- | ------------- |
| `interfaceTheme`          | `system`, `light`, `dark`          | `system`      |
| `interfaceDensity`        | `comfortable`, `compact`           | `comfortable` |
| `interfaceMotion`         | `system`, `reduced`, `full`        | `system`      |
| `studyTextSize`           | `standard`, `large`, `extra-large` | `standard`    |
| `studyInformationDensity` | `comfortable`, `compact`           | `comfortable` |

Authenticated changes use the existing `PATCH /users/settings` contract and
persist in `UserSettings`. Login and `/auth/me` return the account settings;
opening Settings refreshes a stale device cache from the server. Unsent edits
are not applied as saved preferences when the API rejects a change.

Anonymous presentation changes are local to the browser. Login replaces them
with account preferences; logout resets presentation to defaults. Storage
events synchronize open tabs. A small validated, static bootstrap applies
cached values to the document before its body paints. Invalid/legacy values
fall back independently; no stored value is inserted as executable code.

Themes use CSS `color-scheme` and `light-dark()`, including native form controls.
System theme/motion follows OS changes without a reload. Reduced motion removes
nonessential CSS animations, transitions, and smooth scrolling. Full motion
does not override a browser's own accessibility controls.

Compact presentation changes spacing, not content or answer validity. Primary
controls retain a minimum 44px height. Japanese display/sentence/kana prompts
use three fixed presets, with separate mobile sizes; text never scales with
viewport width. Sentence text wraps at every preset. Information density
changes lesson/review grouping spacing without hiding learning information.

The additive migration is `20261021180000_add_interface_preferences`. Its
`IF NOT EXISTS` clauses permit adding the five columns before an automatic API
deployment. Run `prisma migrate deploy` afterwards to record the exact committed
migration. Do not change a migration already recorded as applied.

Verification: focused normalization/API/persistence tests, prepaint bootstrap
tests, desktop/mobile settings save/reload/OS-theme tests, and all three study
text presets. These are not a claim that the separate whole-product visual,
contrast, zoom, or accessibility audits (Tasks 121-122) are complete.
