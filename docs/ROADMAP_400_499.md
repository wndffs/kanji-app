# Product Roadmap 400-499

Baseline: `2b29567`, verified runtime `1fdd9b0`, 2026-10-28.
The requests authorized 400-414, 415-429 and **430-444**, with separate commits,
batched checks, push, deployment and verified publication. All three batches
are released. Tasks 445-499 remain a reserved backlog, not completed work;
445-459 is next. Revalidate each batch before editing.

## User Decisions: 2026-10-29

- Priority confirmed: kanji, vocabulary and separate kana lessons/practice,
  with an N4-N3-oriented lexical foundation. Systematic grammar and a complete
  exam-preparation programme are outside this hundred-task scope.
- The user authorizes additive publication of new teaching-content waves in
  the main course **only after verification**, preserving all accounts and
  existing learning progress. Source/license evidence, independent educational
  review, manifest/graph checks and the existing curator preflight remain
  mandatory. Authorization is not itself a content approval or a gate bypass.
- These answers removed the pending priority/publication questions, not the
  source/editorial gates. The subsequent request authorized 415-429; its
  independently reviewed copies, real source evidence and live receipts below
  resolve draft07's publication blockers without blessing the archived proposal.

## Goal And Current Gap

An independent Russian-first WaniKani alternative: components -> kanji -> whole
words, meaningful reading/meaning SRS, private accepted answers and mnemonics,
plus separate Duolingo-inspired kana practice and selected Renshuu-inspired
personal study tools. Original UI, pedagogy, order and wording throughout.
No competitor scraper, educational data, assets or exact visual reproduction.

Current V6: 88 components, 112 kanji, 160 expression-reading pairs, 360 materials,
632 core cards across twelve levels. V5 remains 111/140/590 and V4 remains
unchanged at 101/120/521. SRS, lessons, review
corrections, custom answers, pronunciation,
themes, practice, kana tracing/matching/listening and text-derived decks exist.
The published course is still a small foundation, not a full N4/N3 syllabus.
Most modern JLPT source labels are unknown. Imported dictionaries, drafts and
passing tests do not increase published, reviewed teaching content.

Long-term target remains **2,300 distinct placed kanji and 8,000 distinct
expression-reading pairs**, with independently reviewed RU/EN teaching content.
Current volume is 4.9% and 2% of those targets respectively. These are content
volume ratios, not learner proficiency, JLPT coverage or chances of passing.

## Comparison Rubric

Subjective engineering estimates, not external benchmarks or pass probabilities:

| Area                                   | Estimate /100 | Evidence and missing acceptance                                                                                        |
| -------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| WaniKani-style learning mechanics      | 75            | Card-local SRS, prerequisites, separate reading/meaning, sessions and corrections; need larger real-course validation  |
| Duolingo-style character practice only | 75            | Both 46-base kana sets, variants, adaptive exercises and tracing; quality/audio/device acceptance incomplete           |
| Selected Renshuu-style study tools     | 50            | Private decks, mistakes and related materials; full schedules, broader context and linguistic analysis remain gaps     |
| Complete WaniKani replacement today    | 35-40         | Mechanics ahead of content; small published volume, limited independent editorial evidence, variable free-host latency |

The last estimate deliberately includes content breadth, editorial reliability
and repeated daily use. It is not an average of the three feature scores.
Re-score against delivered evidence at 499; task count is not progress percent.

## N4-N3 Boundary

Useful now for kana and the existing foundation cards, not sufficient as a sole
N4/N3 preparation resource. Missing: broad reviewed vocabulary/kanji coverage,
systematic grammar, connected reading and listening-comprehension programmes,
and representative learner outcomes. Word audio/TTS is not listening comprehension.
SRS stage or an arbitrary number of cards does not certify exam readiness.
N4/N3-oriented course bands must remain project-defined estimates, never an
official exhaustive checklist or an automatic conversion of pre-2010 labels.

Sources checked 2026-10-28 (feature inspiration only, no copied content):

- [WaniKani scope](https://knowledge.wanikani.com/wanikani/wanikani-content/): over 2,000 kanji/6,000 words; grammar is outside its course.
- [Duolingo characters](https://blog.duolingo.com/learning-to-read-japanese-characters/): character charts and writing/recognition practice; platform parity is not assumed.
- [Renshuu developer changelog](https://app.renshuu.org/forums/topics/17223/Changelog_for_July_2026): study scheduling and contextual learning patterns.
- [JLPT competence](https://www.jlpt.jp/e/about/levelsummary.html): language knowledge used in reading/listening.
- [JLPT FAQ](https://www.jlpt.jp/sp/e/faq/): no post-2010 official item checklist; sample questions are copyrighted and are linked, not imported.

## 400-414: Trustworthy Coverage And Local Source Evidence

| ID  | Deliverable and acceptance                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------- |
| 400 | Audit, comparison rubric and this 100-task roadmap; freeze first-batch boundaries                                 |
| 401 | Reading-gap applicability based on actual card answer types; cloze-only sentences are not falsely missing reading |
| 402 | Separate missing required kanji/word teaching aspects from nonempty answer-field counts                           |
| 403 | Explicit modern JLPT metadata completeness, including unknown labels, without exam percentages                    |
| 404 | Compact on-demand course scope view showing actual published counts, answer gaps and metadata limits              |
| 405 | Persistent source cache defaults outside Git; explicit offline reuse rather than silent downloads                 |
| 406 | Verified local snapshot contract: identity, version, checksums, paths and licensing references                    |
| 407 | Bounded streaming exact KANJIDIC2 evidence for candidate characters/readings using a proven parser                |
| 408 | Exact JMdict spelling-reading evidence respecting reading restrictions and ambiguity                              |
| 409 | KanjiVG primary-character/stroke evidence; variants and absent graphics are not invented matches                  |
| 410 | Deterministic aggregate evidence report, separating observed source matches from publication readiness            |
| 411 | Local-only evidence CLI with safe external report paths, bounded input and no database/network writes             |
| 412 | Bind review worksheets to candidate/source fingerprints; stale or missing evidence cannot become approval         |
| 413 | Batched focused units/browser tests and real-snapshot verification where sources are available                    |
| 414 | Version, push, deploy, exact runtime and live read-only acceptance; report content blockers honestly              |

Detailed specification: `DEVELOPMENT_CYCLE_400_414.md`. Actual publication is
separate from code deployment and requires authorization plus existing source,
editorial, license and curator gates. The user's 2026-10-29 answers above grant
conditional publication authorization, not approval of any unverified wave.

Checkpoint: **400-414 complete and released**. Tag
`cycle-400-414-source-evidence`, exact web/API revision `7726d85`, green CI
`40743297499` (479 browser cases passed, one skipped), live V4/DEMO coverage
verified. At that checkpoint, published content remained 101 kanji/120 word
pairs and full local source attestation was download-blocked. The next batch's
separate evidence and resolution are recorded below.

## 415-429: First Verified Expansion And Editorial Production

| ID  | Deliverable and acceptance                                                                        |
| --- | ------------------------------------------------------------------------------------------------- |
| 415 | Audit 400-414 evidence and actual wave07 blockers, choose the smallest publishable wave           |
| 416 | Independently review RU primary meanings and blocked near-synonyms                                |
| 417 | Independently review EN meanings against the same selected senses                                 |
| 418 | Review whole-word readings, special readings and accepted alternatives                            |
| 419 | Review original examples, kana transcriptions and both translations                               |
| 420 | Correct component naming and mnemonic factual claims without changing sealed batches              |
| 421 | Resolve proven source identities through existing import/curator preflight                        |
| 422 | Validate prerequisite graph, placement order and level policies for the chosen wave               |
| 423 | Produce a versioned review decision with reviewer/source/content fingerprints                     |
| 424 | Prepare a new finite manifest without modifying V1-V4 hashes                                      |
| 425 | Preview additive application, storage/query costs and idempotent rerun                            |
| 426 | With explicit authorization, apply approved teaching rows without resetting SRS                   |
| 427 | With explicit authorization, publish the new manifest; otherwise retain a clearly blocked preview |
| 428 | Batch content/answer/integrity checks and unchanged-progress acceptance                           |
| 429 | Deploy and report real new published counts, not proposed counts                                  |

Checkpoint: **415-429 complete and released**, specification and receipts in
`DEVELOPMENT_CYCLE_415_429.md`, tag `cycle-415-429-verified-content`, exact web/API
revision `3f9d62d`. All three full source archives are cached and verified outside
Git; two independent AI reviewers approved corrected teaching content. Selected
application/rerun passed; V5 publication `40855074022`, post-publication plan
`40855686356`, remote smoke `40855779425`, CI `40854655871` and study-integrity
`40854655910` passed. Actual published V5 is 111 kanji/140 word pairs/590 cards;
original users/progress and old versions are unchanged. No human certification,
modern JLPT checklist or complete N4/N3 preparation is claimed.

## 430-444: N4-Oriented Vocabulary And Kanji Backbone

| ID  | Deliverable and acceptance                                                          |
| --- | ----------------------------------------------------------------------------------- |
| 430 | Define an independent N4-oriented lexical selection policy and nonofficial labels   |
| 431 | Rank reusable source candidates by frequency, usefulness and prerequisite readiness |
| 432 | Separate word senses/readings; deduplicate by exact expression-reading identity     |
| 433 | Build bounded batches for everyday verbs and adjectives                             |
| 434 | Build bounded batches for everyday nouns and time/place vocabulary                  |
| 435 | Prepare prerequisite kanji/components for those batches                             |
| 436 | Author curated RU meanings and conservative accepted answers                        |
| 437 | Author matching EN content and sense restrictions                                   |
| 438 | Select taught kanji versus word readings with exact evidence                        |
| 439 | Create original reinforcement examples with known-lexicon checks                    |
| 440 | Independently review and correct the bounded batches                                |
| 441 | Validate placement, accessibility, load and reviewed/content/source fingerprints    |
| 442 | Authorized additive publication with rollback preview and preserved progress        |
| 443 | Batch learner/content quality acceptance and measured database impact               |
| 444 | Release with actual N4-oriented coverage gaps; no claim of complete N4 preparation  |

Checkpoint: **430-444 complete and released**, with the revalidated twenty-word
slice and receipts in `DEVELOPMENT_CYCLE_430_444.md`, tag
`cycle-430-444-lexical-backbone`. Application `40905867645` passed with zero
quality blockers/warnings across 360 items. V6 publication `40908104197`,
post-publication read-only plan `40908802623` and exact-revision remote V6 smoke
`40909088233` passed. CI `40904285471` passed on retry after an infrastructure
Chromium crash; Study integrity `40904285419` passed. Verified runtime is
`37898b1`; the later CI checkpoint `36f2b9c` changes a test expectation,
not runtime code. Further receipts are documentation-only.

New published teaching content is one kanji and twenty exact pairs (ten verbs,
five i-adjectives, five nouns), twenty original bilingual examples and 42 cards
relative to V5. All 272 kanji/word materials have meaning/reading, with zero
missing RU/EN/required readings. Modern JLPT metadata is unknown for 110 kanji
and 159 words. Original user state and V1-V5 remain unchanged; no account was
silently switched. Remaining full targets: 2,188 kanji/7,840 word pairs. This
closes basic lexical gaps, not a complete N4 syllabus or N3 exam preparation.

## 445-459: Retention, Context And Pronunciation

| ID  | Deliverable and acceptance                                                              |
| --- | --------------------------------------------------------------------------------------- |
| 445 | Audit missed readings/meanings on real representative test data                         |
| 446 | Improve kanji-to-word reinforcement from published relationships                        |
| 447 | Contrast on/kun and whole-word special readings without overgeneralized rules           |
| 448 | Distinguish visually similar published kanji with original explanations                 |
| 449 | Add sense-specific usage/context where source evidence and original prose permit        |
| 450 | Improve long-vowel, small-tsu and kana spelling feedback                                |
| 451 | Introduce a validated audio source/storage/attribution policy, distinct from TTS        |
| 452 | Attach only licensed verified word audio to appropriate cards                           |
| 453 | Offer listening practice without revealing answers prematurely                          |
| 454 | Bound media loading, failure recovery and phone controls                                |
| 455 | Tune focused weak-item practice without changing core scheduling silently               |
| 456 | Make practice-to-review distinctions and result history unambiguous                     |
| 457 | Preserve personal answers/notes through additive content versions                       |
| 458 | Batch pronunciation/context/concealment and owner-isolation tests                       |
| 459 | Deploy and validate a real reinforcement path without claiming exam listening readiness |

## 460-474: N3-Oriented Expansion

| ID  | Deliverable and acceptance                                                       |
| --- | -------------------------------------------------------------------------------- |
| 460 | Re-audit published N4-oriented coverage and reserve concrete N3-oriented batches |
| 461 | Define broader everyday-topic selection, not a copied competitor level order     |
| 462 | Prepare new prerequisite kanji/components in bounded waves                       |
| 463 | Prepare verb/adjective word-reading pairs and sense boundaries                   |
| 464 | Prepare topic vocabulary with common-use evidence                                |
| 465 | Author independent RU teaching copy and blocked-answer distinctions              |
| 466 | Author corresponding EN teaching copy                                            |
| 467 | Verify exact source identities, pronunciations and special readings              |
| 468 | Review original context and transcription quality                                |
| 469 | Independently review all candidate educational material                          |
| 470 | Validate manifests, graph coverage and query/storage budgets                     |
| 471 | Preview additive application and preserve existing target/card identities        |
| 472 | Authorized publication of only the approved waves                                |
| 473 | Batch course progression and content/source integrity acceptance                 |
| 474 | Release with measured published counts and unresolved N3 gaps                    |

## 475-489: Kana And Personal Study Tools

| ID  | Deliverable and acceptance                                                                    |
| --- | --------------------------------------------------------------------------------------------- |
| 475 | Re-audit kana exercise coverage and actual phone ergonomics                                   |
| 476 | Close specific base/dakuten/handakuten/yoon recognition gaps                                  |
| 477 | Improve similar-kana contrast based on real error categories                                  |
| 478 | Improve matching/typing pacing without misleading mastery labels                              |
| 479 | Strengthen tracing geometry and forgiving touch recovery                                      |
| 480 | Refine optional kana audio with explicit TTS/source status                                    |
| 481 | Improve adaptive short sessions without adding kana to SRS                                    |
| 482 | Audit text-derived decks against actual Japanese segmentation limitations                     |
| 483 | Adopt a proven analyzer only if justified; retain an explicit fallback and license boundaries |
| 484 | Let users correct ambiguous source matches privately                                          |
| 485 | Improve dictionary-to-private-deck selection without duplicate cards                          |
| 486 | Add efficient private study grouping and pacing using existing queue constraints              |
| 487 | Keep custom content and progress isolated across users/versions                               |
| 488 | Batch kana, analysis and deck regressions with device/theme checks                            |
| 489 | Deploy and verify the chosen Renshuu/Duolingo-inspired workflows                              |

## 490-499: Sustainable Replacement Acceptance

| ID  | Deliverable and acceptance                                                              |
| --- | --------------------------------------------------------------------------------------- |
| 490 | Re-score the comparison rubric using delivered code and live content                    |
| 491 | Measure complete published kanji/word placement versus 2,300/8,000                      |
| 492 | Measure editorial review, examples and source/reading gaps separately                   |
| 493 | Test representative beginner, returning and continuing-learner journeys                 |
| 494 | Measure large-course query/storage/media budgets without perpetual keepalive            |
| 495 | Fix evidenced cold/warm latency bottlenecks with comparable measurements                |
| 496 | Verify export/restore and additive content recovery without real-account resets         |
| 497 | Targeted UX repair from daily-use findings, not another blanket redesign                |
| 498 | Batch release/security dependency audit, integrity, licensing and responsive acceptance |
| 499 | Deploy and publish an honest replacement/N4/N3 readiness report and remaining backlog   |

## Delivery Rules

Each task is a substantive, separately committed deliverable, not a renamed
checkmark. Content batches are bounded by review capacity and actual source
availability. No fixed amount of unreviewed prose is promised merely to hit a
task number. At expansion checkpoints, report proposed, reviewed and published
counts separately. The 100-task plan does not guarantee 2,300/8,000 completion.
Do not spend another hundred tasks polishing the same shells while ignoring
content. Grammar/full exam preparation is not silently added to this scope.
Only aggregates from Neon go to Git; detailed evidence and source caches stay
outside it. No paid service, reset, schema change, publication bypass or new
production dependency without a demonstrated need and applicable authorization.

Known dependency follow-up from 400-414: npm audit reports six high advisories
in the current Nest/Prisma chains, none in the new local XML reader. Assess
reachability and compatible patches before full release sign-off; do not hide
unresolved advisories behind unrelated green functional tests or blind upgrades.
