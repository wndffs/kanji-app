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

| ID  | Deliverable and acceptance                                                                          | State       |
| --- | --------------------------------------------------------------------------------------------------- | ----------- |
| 445 | Audit existing error paths and representative published regression cases; freeze this specification | Complete    |
| 446 | Published kanji-to-word reinforcement with visible reading/meaning contrast                         | Implemented |
| 447 | Original RU/EN on/kun versus whole-word reading guidance, not composition rules                     | Implemented |
| 448 | Original contrasts for a bounded set of published visually similar kanji                            | Implemented |
| 449 | Surface sense-specific authored word context separately from raw dictionary senses                  | Implemented |
| 450 | Conservative long-vowel, small-tsu and small-kana post-answer diagnostics                           | Implemented |
| 451 | Verified recording/source/storage/attribution contract separate from TTS                            | Implemented |
| 452 | Bounded exact-word pronunciation attachment with no SRS-card changes                                | Implemented |
| 453 | Concealed optional listening recall practice, no invented SRS progress                              | Implemented |
| 454 | Bounded load/retry, source retirement and phone media controls                                      | Implemented |
| 455 | Deterministic weak-item focus retaining owner/course boundaries                                     | Implemented |
| 456 | Practice summary/history labels distinguish rehearsal from scheduled review                         | Implemented |
| 457 | Regression proof of private answers across shared cards/course versions                             | Implemented |
| 458 | Batched scoped checks and two independent review/correction passes                                  | Local pass  |
| 459 | Release/deploy and actual server reinforcement/audio acceptance with honest limits                  | Pending     |

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
Its exact bytes and 1,032 ms PCM duration pass local checks. Browser decoding
and live publication are pending below; no extra word/card count is claimed.

Scoped local checks passed 123 tests across seventeen changed contracts (plus
the separately checked rotation contract), API/web/DB typechecks and changed-file
ESLint. New E2E cases assert actual production-WAV decoding, concealment until
answer, failure recovery and zero API writes; CI/live results are not inferred.
No local browser server or duplicate full browser suite was launched.
