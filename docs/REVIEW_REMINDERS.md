# Foreground Review Reminder Claims

This bounded Task123 backend slice stores opt-in preferences and deduplicates
foreground notification claims. It is not background delivery, push, a polling
job, installation support or completion of all Task123 acceptance criteria.
No provider, secret, dependency, seed, reset or import is added.

The settings control requests browser permission only in its explicit opt-in
gesture; mounting, login and saving other settings never request it. An unchanged
account opt-in is preserved when this browser denies/does not support notifications:
browser permission is local, not an implicit account-wide opt-out. New enablement
requires permission, and an explicit disable is saved normally. The client never
resets the server's claim timestamp.

The dashboard uses a fresh server confirmation (at most 60 seconds old), the same
active account/token, positive due count, visible/online document and granted
permission. It makes one attempt per confirmation, with no polling or automatic
retry. Stale replies/account changes cannot create a notification. Only a generic
Russian message and fixed `/dashboard` click target are used; no counts, item
text, identifiers or credentials enter its payload. Unmount/logout clears the
owned request/notification. Actual OS delivery and mobile constructor support
remain platform-specific; mock browser tests do not prove them.

Public user/settings responses include required fields `reviewRemindersEnabled`
(boolean, default false) and `reviewReminderHour` (integer 0..23, default 9).
Internal settings shapes permit missing legacy values, normalized at response
boundaries. `PATCH /users/me/settings` accepts partial fields through the existing
settings parser and IANA timezone validation. The existing `/users/settings`
route remains available. Unspecified preferences are preserved. Neither changing
timezone nor opting out/in clears the private claim timestamp.

Authenticated `POST /users/me/review-reminders/claim` accepts no body or `{}` only
and returns exactly `{shouldNotify: boolean}`. User IDs, clocks, timezone, counts,
permission state and claim timestamps cannot be supplied by that request. The
timestamp is never part of a public DTO or response. Client-side notification
permission is not a server guarantee: the client must call only with permission
granted, a visible page and freshly confirmed eligible due reviews greater than
zero. No automatic retry, polling or notification job is introduced here.

Each transaction reads current saved preferences, rejects missing/disabled
settings and vacation mode, and checks the selected timezone's local hour. It
requires both 24 elapsed hours since the last claim and a different local calendar
day in the currently selected timezone. This also suppresses repeats during DST
fallback and prevents timezone changes from bypassing the elapsed-time limit.
Invalid legacy timezone data fails closed. Spring-forward can delay the next
claim beyond the configured hour: deduplication takes precedence over delivery.

The backend independently checks scheduled SRS states scoped to the authenticated
user: nonburned, available at/before server time and published learning items.
Listening items additionally require word/sentence kind, published audio and the
existing `isEligibleListeningAudio` validator (HTTPS playback, item binding,
checksum, attribution, source and licence). Invalid listening pages cannot yield
a false positive or hide a later valid candidate; they are traversed by keyset in
100-state pages. No schedules, review progress or answers are changed.

The final `updateMany` compares the exact previously read nullable timestamp,
user ID, enabled flag, hour, timezone and absence of vacation. One affected row
means the claim succeeded; zero means it did not. Concurrent requests reading the
same timestamp therefore cannot both claim under PostgreSQL's update predicate
recheck. Errors propagate rather than being reported as successful claims. Due
eligibility is checked in the transaction, not reserved against concurrent review
answers; the client must still use fresh due state.

The claim happens before `Notification` creation. Closing the page, a failed
notification or a lost claim response can lose a reminder, but retrying cannot
duplicate the claim. This intentionally favors at-most-once over guaranteed
delivery. A clock moving backward also suppresses claims until elapsed time is
valid again. There are no reminder payloads, counts or private item data in the
claim response.

Migration `20261022193000_review_reminder_preferences` adds the two defaulted
preferences, an hour check constraint and nullable private
`reviewReminderLastClaimedAt`. It does not alter earlier source-fix migrations.
The migration has not been applied. Deploy it before using the new Prisma client
against a database. A real PostgreSQL row-lock regression has been added for
competing claims and unchanged SRS; its cloud result remains to be recorded.
159 focused local tests and ten production-bundle desktop/mobile reminder cases
passed. Stub unit tests cover fixed-clock, DST,
timezone, legacy/default-off, due/audio eligibility, CAS concurrency, partial
settings and request/auth/privacy contracts; they do not replace that migration
or real PostgreSQL concurrency test. No external content or licence changes apply.
