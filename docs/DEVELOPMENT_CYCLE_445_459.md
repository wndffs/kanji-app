# Retention And Pronunciation 445-459

Baseline `f7172b5`, 2026-10-29. Separate numbered commits, batched relevant
checks, push and verified deployment. Preserve V1-V6 seals, existing cards,
private answers and all learning progress. No task 460 work in this cycle.

## Revalidated Specification

V6 is a small foundation (112 kanji/160 exact pairs/632 core cards), not N4/N3
exam preparation. Existing on/kun evidence, dependency-based related words,
practice sessions, confusables and listening controls must be reused, not rebuilt.
This cycle adds focused reinforcement and conservative diagnostic feedback;
never accept a different word merely because its spelling is close. Additional
feedback is post-answer only. Reading diagnostics never change acceptance,
penalties, retry or scheduling. Practice remains distinct from SRS reviews.

Recorded pronunciation is separate from browser TTS. A bounded first wave may
use original Lingua Libre recordings distributed by Wikimedia Commons with
file-specific CC BY 4.0 evidence, exact word/reading binding, source date/version,
checksum, attribution and unmodified local media. Exclude all competitor-origin
audio, even if found under a permissive license. No remote URL guessing or TTS
masquerading as recordings. Acoustic/native-speaker certification is not claimed.
If an asset cannot be verified, do not publish it or report it as available.
Additional pronunciation assets must not add SRS cards or rewrite finite seals.
Only explicit bounded operator application may add database provenance metadata.

| ID  | Deliverable and acceptance                                                                          | State    |
| --- | --------------------------------------------------------------------------------------------------- | -------- |
| 445 | Audit existing error paths and representative published regression cases; freeze this specification | Complete |
| 446 | Published kanji-to-word reinforcement with visible reading/meaning contrast                         | Complete |
| 447 | Original RU/EN on/kun versus whole-word reading guidance, not composition rules                     | Complete |
| 448 | Original contrasts for a bounded set of published visually similar kanji                            | Complete |
| 449 | Surface sense-specific authored word context separately from raw dictionary senses                  | Complete |
| 450 | Conservative long-vowel, small-tsu and small-kana post-answer diagnostics                           | Complete |
| 451 | Verified recording/source/storage/attribution contract separate from TTS                            | Complete |
| 452 | Bounded exact-word pronunciation attachment with no SRS-card changes                                | Complete |
| 453 | Concealed optional listening recall practice, no invented SRS progress                              | Complete |
| 454 | Bounded load/retry, source retirement and phone media controls                                      | Complete |
| 455 | Deterministic weak-item focus retaining owner/course boundaries                                     | Complete |
| 456 | Practice summary/history labels distinguish rehearsal from scheduled review                         | Complete |
| 457 | Regression proof of private answers across shared cards/course versions                             | Complete |
| 458 | Batched scoped checks and two independent review/correction passes                                  | Complete |
| 459 | Release/deploy and actual server reinforcement/audio acceptance with honest limits                  | Complete |

## Evidence Boundaries

Only aggregate learner/database observations belong in Git. Detailed reports,
downloads and screenshots stay outside the repository until an approved asset
is intentionally added as production media. Small representative fixtures are
not learner outcomes or a claim that all possible readings were reviewed.
No new dependency or schema migration is planned. Two reviewers are authorized
by the user's standing instruction, inherit the model and are closed at handoff.

## Implementation And Independent Review

Ampere reviewed practice/private-state ownership, compare-and-swap and starts;
Descartes reviewed bilingual teaching, concealment and audio. Both completed
independent correction passes and approved their bounded static scopes. They
are closed. This is not human teaching/acoustic certification or a live receipt.

Fixed concrete findings: duplicate Add no longer overwrites a private note;
practice starts lock the owner in a ReadCommitted transaction and return the
winning session's actual cards; a bounded 200-candidate missed-card window
rotates after the last completed session instead of always repeating the same
twenty cards. Cards outside that bounded/recent window are not promised coverage.
Practice history reads at most twenty completed owner/source-scoped sessions;
new per-card accepted/missed outcomes live only in EXTRA_PRACTICE JSON, not
ReviewAnswer or SRS state. Legacy sessions keep their original CAS representation.

Reading differences explain small tsu, small kana and vowel spelling only after
rejection. They never change acceptance or stage penalties, and blocked/accepted/
alternative-reading outcomes retain precedence. Mnemonics and whole-word hints
are absent when reading hints are hidden. Healthy long media has no total-time
cutoff; a twelve-second no-progress watchdog handles stalls. Source retirement,
visibility pauses, reload and explicit pause controls preserve playback evidence.

The only new recorded pair is 食べる/たべる; see `PRONUNCIATION_SOURCES.md` for
the exact original-file license, SHA and four-byte source RIFF-size quirk.
Its exact bytes and 1,032 ms PCM duration passed local checks. Browser decoding
and live publication were pending at that checkpoint; actual receipts follow
below. No extra word/card count is claimed.

Scoped local checks passed 123 tests across seventeen changed contracts (plus
the separately checked rotation contract), API/web/DB typechecks and changed-file
ESLint. New E2E cases assert actual production-WAV decoding, concealment until
answer, failure recovery and zero API writes; CI/live results are not inferred.
No local browser server or duplicate full browser suite was launched.

## Server Preflight: Task 459

Both live health endpoints returned runtime
`fa5546c8794a23c7e0748c4ef32e8713e11eae47`. Vercel serves exactly 99,116 bytes
with the pinned SHA-256, not a remote hotlink or substituted synthesizer.
Read-only audio plan `40917369633` passed with one not-yet-attached asset.
No provenance writes have been inferred from that plan.

The 17:00:55 UTC read-only baseline captured 25 users/settings, 162 SRS states,
51 enrollments, eight review sessions, five recorded review answers, two private
overrides and six kana-progress rows. Those five attempts contain three correct
meanings, one wrong meaning and one correct reading: far too little to infer
reading-error prevalence or learning outcomes. Regression cases use exact
published readings instead of tuning SRS penalties from that tiny sample.

Five actual published finite courses (V1/V2/V4/V5/V6) share 360 distinct items,
632 cards, 1,374 accepted-answer rows and 112 blocks. Complete-row fingerprints
also include all their level/placement rows and all eleven private-state tables.
Only aggregate counts are recorded here; original digests remain in the operator
session. Initial physical PostgreSQL size is 160,956,416 bytes, not Neon quota
or billable-storage usage. No new schema migration is required.

## Actual Attachment And Preservation

[Explicit application 40918648970](https://github.com/wndffs/kanji-app/actions/runs/40918648970)
created exactly one AudioAsset and its licensed source/import provenance. It
reported `learningCardsWritten: 0` and `userStateWritten: 0`. The public item
endpoint returns asset UUID `7326a98a-22c6-4cc1-a148-c3d321590435`, the exact
SHA, human-recording origin and attribution, while retaining two ordinary word
cards. No listening SRS card or finite course was added.

[Post-attachment plan 40919928399](https://github.com/wndffs/kanji-app/actions/runs/40919928399)
passed with `existing: true`, validating the same immutable asset and complete
provenance without repeat writes. [V6 read-only plan 40920054697](https://github.com/wndffs/kanji-app/actions/runs/40920054697)
confirms the same course UUID `ae9dac23-36f5-4017-95d3-cf93b344b924`, all
360 placements/632 cards and unchanged content version
`9c599c7ab7e1dc539bd7b433e8357dda082506d05a1ef3720a1337e97ee63829`.

All original complete-row fingerprints matched after attachment and actual
browser rehearsal. After the remote audit, they still match when only
User/UserSettings/UserEnrollment exclude users created after the baseline
cutoff; all learning-progress tables are compared in full. Final physical size
is 161,021,952 bytes, an observed 65,536-byte increase for metadata/audit activity,
not a quota estimate. The WAV itself is served by Vercel, not stored in Neon.

## Final Runtime And Acceptance

Both web/API health and [remote V6 audit 40920469450](https://github.com/wndffs/kanji-app/actions/runs/40920469450)
confirm exact runtime `5443537d58a8aaf07c4af150ca844574300a733c`. The audit used
one separate generated account, enrolled/selected V6 only for it, checked kana,
settings, search and the core study endpoints, and did not start a lesson/review
or submit scheduled answers. Three HTTP samples each gave medians: dashboard
894 ms (range 604-1,469), lessons 463 ms, reviews 176 ms, characters 491 ms and
item 692 ms. This is a small warm audit, not a cold-start or latency guarantee.

[Final CI 40919772373](https://github.com/wndffs/kanji-app/actions/runs/40919772373)
passed Quality/build and **483 browser cases**, with one existing skip.
[Study integrity 40919772544](https://github.com/wndffs/kanji-app/actions/runs/40919772544)
passed against PostgreSQL 18. The earlier CI caught an ambiguous old text
selector after adding on/kun explanations; it was corrected to exact headings,
not weakened. The new original-WAV decoding/concealment/failure cases passed
on desktop and mobile emulation before attachment and again on final CI.

Live IAB confirms source decoding (`duration: 1.032`, `ended: true`, no media
error), kana/katakana answer acceptance, withheld spelling/meaning/credits before
feedback, and post-answer attribution. Acceptance found a mobile focus issue;
the final runtime focuses and scrolls to the result, with a responsive two-track
answer form. IAB mobile geometry reports equal client/scroll widths (375 CSS
pixels), and the result heading is visibly focused. No physical-phone/acoustic
certification is implied. The original test account was not enrolled or switched.

The live 日 page shows related whole-word readings, independent on/kun guidance
and the original 日/目 visual contrast. The authenticated practice-history
endpoint displays the correct empty completed-session state, not fictitious
scheduled progress. Audio recall is stateless rehearsal; it does not append
to scheduled or persisted ordinary-practice history.

Release tag `cycle-445-459-retention-pronunciation` identifies this checkpoint.
Following receipts are documentation-only; no cosmetic runtime edit forces
another deployment. Existing V6 remains 88 components/112 kanji/160 word pairs/
632 core cards. This cycle adds one recorded pair, not broad audio coverage,
new vocabulary or N4/N3 exam listening preparation. No new dependency, schema
migration, competitor content, raw corpus import or inferred JLPT labels.

Screenshots/source observations stay outside Git; only aggregate reports are
committed. Both review agents and all browser tabs are closed. No local test or
dev-server process remains. **445-459 complete; 460-474 is next, not started.**
