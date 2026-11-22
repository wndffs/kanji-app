# Full Course Completion

Status: **OPEN. Not a completed WaniKani replacement.**

This is the single active delivery task requested on 2026-10-30. It supersedes
the automatic fifteen-task release cadence and task-count-based progress reports.
The remaining 490–499 checks are acceptance criteria inside this task, not ten
more separately marketed features. Implementation commits may remain small;
completion is measured by the usable product and reviewed learning content.

## Required Outcome

An independent Russian-first alternative to WaniKani's complete kanji/vocabulary
learning workflow, plus separate kana lessons and practice. Match useful
capabilities, not proprietary wording, data, curriculum order, assets or styling.

- At least **2,300 distinct taught kanji** and **8,000 distinct expression/reading
  word pairs**, placed across the existing sixty-level main course. Raw imports,
  candidate plans, empty levels, draft records and isolated pilots do not count.
- Every kanji has reviewed RU/EN meanings and accepted synonyms, the chosen
  teaching reading in kana, actual other readings distinguished from errors,
  meaningful component relationships, an original memory aid and source-traceable
  stroke data. Every taught reading is demonstrated in an actual dictionary word.
- Every word has the whole-word kana reading, reviewed RU/EN learning meanings,
  safe answer distinctions, original guidance and a valid bilingual example.
  Kanji readings must not be mechanically substituted into whole-word answers.
- Components precede kanji; kanji precede words. No dead ends, cycles, missing
  prerequisites or unsupported reading examples. Each kanji needs vocabulary
  reinforcement, not just a glyph and a translated label.
- Study, mandatory quiz and separate meaning/reading reviews work end to end.
  Persist sessions, handle valid alternate readings without false penalties,
  expose workload/stages/next reviews, allow private synonyms/mnemonics and
  extra practice, and support recovery/export without resetting existing users.
- Kana stays separate from the kanji/word SRS. Support the 46 base signs per
  script and separately labelled modified sounds, combinations and exercises.
- A coherent responsive web experience with configurable learning presentation,
  keyboard review flow, clear current course, latest-course entry and no routine
  technical/editorial noise in learner screens. No blanket clone or decorative
  redesign counts as filling the curriculum.
- Recorded pronunciation coverage and listening quality are measured separately
  from browser TTS. Do not label TTS as a recording or claim complete audio
  coverage from one recorded word.

The official product describes over 2,000 kanji and over 6,000 words; our existing
2,300/8,000 target remains the concrete volume floor, not a claim to use its list.
Reference: https://knowledge.wanikani.com/wanikani/wanikani-content/

## Starting Point And Bottleneck

Released V7: **117 kanji, 180 word pairs, 686 core cards, fifteen populated
levels**, plus 92 components. This is 5.1% and 2.25% of the numerical targets,
not a percentage score for learning quality or functional parity. Main course
remains DRAFT. Existing lesson/review/private-study machinery is substantial;
the primary bottleneck is reviewed content, not another set of UI controls.

The full official local dictionary/stroke snapshot already exists. Do not
redownload or reimport it for every small addition. KANJIDIC2 English meanings
are dictionary evidence, not authored Russian pedagogy. A single-character
JMdict word is not automatically the meaning of its kanji. Never invent missing
Russian translations or mark generated prose as independently reviewed.

## Work Rules

1. Reuse the current importers, curators, answer validators, publication gates
   and finite seals. No replacement pipeline for each content installment.
2. Author substantial content blocks; component/reading/word/answer review may
   run in bounded internal chunks without creating a new user-visible task or
   a new pilot course for each chunk.
3. Keep an exact distinction between authored, source-checked, independently
   reviewed, applied to the database and published in the learner course.
4. Do not stamp `reviewedAt`, bypass publication readiness, relax RU/EN checks or
   auto-enroll/migrate users merely to hit the target. Old content/progress stays.
5. Track source version, checksum, license, attribution and exact identities.
   Only aggregate database evidence goes to Git. No competitor content scraping.
6. Run relevant checks in batches, then deploy/verify meaningful learner-visible
   milestones. Commits and pushes are authorized; a pushed draft is not a release.

## Completion Gate

This task stays OPEN until actual published counts meet both volume floors,
all sixty levels are usable, required content/graph/reading/answer/source checks
pass, representative beginner/returning/continuing-user journeys pass on server,
original-user progress survives additive rollout and recovery is verified.
Report remaining audio/editorial/UX shortcomings explicitly. N4/N3 kanji and
vocabulary preparation is not a complete JLPT course: grammar, listening and
timed reading preparation are separate and must not be claimed by implication.

Do not close this task because a report, generator, draft list, fifteen commits
or the remaining numbered roadmap has been completed.

## Verified Functional Gaps

The bounded source audit found these unfinished learner workflows, in addition
to the content deficit. Keep them within this single task:

- **Implemented in code:** the lesson picker browses eligible materials beyond
  the daily-limit slice with bounded server pagination (24 default, 48 maximum).
  Filters operate on loaded materials; eligibility changes invalidate the
  current page sequence. Daily admission and prerequisites still gate session
  start. Verified in local service and browser tests.
- **Implemented in code:** scheduled reviews offer a confirmed no-answer
  reveal. It uses the audited missed-answer outcome, puts the same card in
  the correction pass, and never schedules a second result for a correction.
  Uncertain submissions can be reconciled with the saved review session.
  An optional post-answer breakdown shows the item's localized teaching
  notes and a licensed example without preloading them during recall.
  Explicit manual-ignore and reviewed-answer recovery remain open; never
  silently reverse a penalty on a synonym save.
- **Implemented in code:** stalled private-deck lessons offer a bounded plan
  of currently startable external prerequisites, and can create a separate
  private follow-up deck. Below-stage prerequisites lead to reviews; original
  deck membership and all SRS gates are preserved.
- **Implemented in code:** longest dictionary match still resolves overlaps
  before selection. The automatic text plan prioritizes unstarted matches
  and their unstarted prerequisites under the cap without rejecting a
  learner's explicit choice of an already-started item.
- Burned-item practice exists, but explicit card-scoped resurrection is not
  connected to the learner workflow.
- **Implemented in code:** the dashboard links to a ranked difficult-card
  queue. Learners can choose a subset of exact meaning/reading cards and
  resume that selection later. Extra practice writes neither scheduled
  answers nor SRS state. Verified in local service and browser tests.
- **Verified on server:** item and search headings show the authored primary
  meaning of 安心 and 良い. Regression coverage checks this independently of
  accepted synonyms. No answer changes were needed in this delivery.
- The current serial curation path is not yet performance-verified at 2,300/8,000.
  Batch database I/O while preserving complete source/graph checks, idempotency
  and private data. Removing a duplicate workflow preflight is not proof that
  importing the entire teaching corpus will fit one execution window.
  Vocabulary preflight now fetches uncached kanji and their exact course
  placements in groups of up to 256. Word staging uses four fewer database
  calls for authored senses, accepted answers and blocked answers per word;
  it retains fresh per-word provenance and placement checks and the same
  atomic publication. This reduces calls, not a claimed live speedup.
  Kanji staging groups RU and EN cleanup and the two cards' authored answers
  in each existing kanji transaction, avoiding five calls per kanji without
  changing stable card identifiers, prerequisites, or imported meanings.
  The apply workflow no longer repeats the kanji preflight in a separate
  process; the curator still verifies the entire selection before writes.

These findings are from code inspection, not a fresh exhaustive live UX audit.
Only entries explicitly marked implemented have been addressed.

## Current Content Work

On 2026-10-31 the first substantial block completed AI editorial review:
**145 kanji, 38 component cues, 145 individual bilingual reading-memory scenes,
80 reinforcement words and 80 original JP/kana/RU/EN examples**. The block adds
263 teaching targets and 488 core SRS cards, not 133 vocabulary cards inferred
from reading illustrations. Meaning scopes, visual identities, long vowels,
nasal morae, sound changes and semantic false-positive answers were corrected.

AI reviewer Hegel read all 145 meanings, 38 components and 145 reading scenes,
then all 80 word entries; Tesla independently read all 80 word readings, examples
and prerequisite placements. Parent applied and rechecked their corrections.
This is AI editorial acceptance, not human linguistic certification. The existing
source, license, imported-evidence and placement preflight remains mandatory.

All 145 exact KANJIDIC2 reading/type pairs and primary KanjiVG stroke sequences
matched the pinned local 2026-10-29 snapshot. All 80 primary word pairs/IDs and
three explicitly accepted, sense-compatible reading alternatives matched JMdict.
All primary word pairs have imported RU/EN evidence. The 133 dictionary reading
illustrations are tracked separately; two without imported Russian senses were
not promoted into word cards. Detailed observations remain outside Git.

Use `npm run --silent content:inventory -- --json`. Reviewed source totals are
**130 components, 262 kanji and 260 word pairs**; the former
`--include-completion-draft` flag is a compatibility alias and never doubles the
block. Four internal twenty-word storage chunks reuse the existing curator,
not four new courses, tasks or pilots. Every kanji in word expressions and
examples has an earlier prepared kanji placement. Immutable V1-V7 source seals
and the full-main 60-level/2,300/8,000 publication gate are unchanged.

**Publication is a separate step, not implied by registry review metadata.**
The server receipt below confirms the new reviewed library items and main-course
placements. `japanese-ru-n2` remains DRAFT; this does not make the larger curriculum
available in lessons or enlarge the finite V7 course. Published library material,
published learner-course membership and overall course completion remain distinct.

Of the new 145 kanji, **100 now occur in reviewed vocabulary cards; 45 still need
word-card reinforcement**. Their dictionary reading illustrations are not counted
as completed vocabulary lessons. Close these gaps before calling this an entirely
reinforced learning block; editorial acceptance of individual kanji is separate.

The single task stays OPEN: **2,038 further kanji and 7,740 further word pairs**
still need complete teaching and review, in addition to the functional gaps
above. Do not equate completing this block with completing the 2,300/8,000 app.

The initial live 30,000-pair raw selection lacked three of the new dictionary entries.
The existing curation workflow now offers an explicit, pinned-source supplement:
it imports at most 100 absent reviewed pairs through the existing JMdict importer,
with original-parent and derived-file checksums recorded separately. Any existing
word or entry alias blocks automatic repair. Insert-only transactions fail on
concurrent duplicates and never update existing word provenance. This does not
publish teaching or replace the curator's complete license/RU/EN/source checks.
The full corpus is not reimported. A pre-write quality check protects existing
published content before new teaching application.

The remote 2026-10-29 source cache was unavailable. The resulting checksum
mismatch correctly stopped the first word run before source or teaching writes.
The official 2026-10-31 snapshot was then downloaded separately and verified:
all 80 primary pairs and three alternatives still match, all have RU/EN evidence,
and primary lexical metadata is byte-for-byte identical to the reviewed local
observations. The supplement workflow pins and caches this newly checked source;
the old local snapshot and finite course seals remain unchanged.

Multiple explicitly named vocabulary batches can be applied together after one
full-registry preflight. Duplicate, pending, unknown, unsafe and excessive
selections fail before writes; unselected old batches are never reapplied.

## Server Receipt: 2026-10-31

- Application code: `9495aa144dad4ceff19f32a7578d0dafc14306a5`.
  Web and API health both returned 200 with that revision.
- [Kanji read-only preflight](https://github.com/wndffs/kanji-app/actions/runs/41219134967)
  passed. The [kanji application](https://github.com/wndffs/kanji-app/actions/runs/41219565444)
  committed 145 kanji / 38 components; its post-write audit found one normalization
  drift in the old curator. The curator now uses the shared meaning normalizer,
  with a regression test; exactly one new answer's normalized field was repaired.
  No sealed batch was reapplied to repair that field.
- [Complete word publication](https://github.com/wndffs/kanji-app/actions/runs/41222796370)
  succeeded: three absent raw dictionary entries, 80 reviewed word pairs,
  160 word cards and 80 original examples. Only the four explicitly named new
  word manifests were written. The complete registry was preflighted first.
- Final main-set totals: **130 components / 262 kanji / 260 word pairs /
  652 teaching targets / 1,174 core meaning-reading cards**. All five new content
  import runs are SUCCESS. There are 24 populated levels out of 60; course status
  is still DRAFT. V7 remains 389 items, 117 kanji / 180 words / 686 core cards.
- Post-publication quality: **652 items, zero blockers, zero warnings**;
  content version `28a77ffc252980b1718298b854faa986ee4f2b7457c01844253aa83e94435971`.
- All **23 monitored preservation groups** have exactly unchanged row counts
  and digests, including 30 accounts, settings, SRS, private meanings/mnemonics,
  reviews, enrollments, kana progress and sealed course content. Only aggregate
  confirmation is recorded here; no private rows or digests are committed.
- [CI](https://github.com/wndffs/kanji-app/actions/runs/41222717861) passed,
  including 487 browser cases and one existing skip. Targeted local checks cover
  content, source guards, selection, curation and insert-only conflict handling;
  DB/importer/source-tool typechecks and changed-file lint/format passed.
- The real site was checked through ordinary search and the new 安 / 安心 pages:
  kana readings, memory aids, component/kanji links and the original word example
  render. This is not a claim that all outstanding learner workflows passed.

The subsequent workflow-only optimization removes duplicate vocabulary preflight
in apply mode: the apply command still checks the entire registry before writes.
Its targeted guard/curation suite passed 97 cases. The large-run timeout is now
45 minutes; this does not retroactively change the successful 28-minute run above.

**Task remains OPEN.** Next content work in this same task must close the 45
reinforcement gaps and continue the remaining 2,038 kanji / 7,740 word pairs,
not start another numbered microtask cycle or declare WaniKani-equivalent coverage.

## Reinforcement Extension: 2026-10-31

This is work inside the same OPEN full-course task, not another numbered cycle,
pilot course, or claim of WaniKani equivalence.

- Scope: 80 original word lessons, 12 supporting kanji and seven visual cues.
  The new manifests use free levels 31 (components), 32 (support kanji), and 33
  (words). All earlier 262-kanji / 260-word manifests and placements are frozen;
  aggregate SHA-256 regression pins cover the complete earlier registry, not
  just V1-V7. Four twenty-word manifests are storage units, not four tasks.
- `reinforcement-reading-evidence.ts` explicitly aligns all 45 outstanding
  completion-block kanji and all 12 support kanji to exact primary word cards.
  It records whole-word reading boundaries, the JMdict entry ID and the
  checked `へん -> ぺん` change in `近辺`. An example-only glyph occurrence,
  another sense's reading, or an alternate-answer-only reading is not proof.
- The verified local 2026-10-31 snapshot supplies 80 unique, bilingual primary
  JMdict pairs plus four same-sense reading alternatives, 12 exact KANJIDIC2
  on-readings and 12 primary KanjiVG sequences.
  No download, dictionary-wide reimport, competitor content or new dependency
  is needed. Dictionaries are source evidence; meanings, scope, memory aids
  and JP/kana/RU/EN sentences are separately authored and reviewed.
- Deliberate sense boundaries include atmospheric `寒気 / かんき`, autograph
  board `色紙 / しきし`, organism `生物 / せいぶつ`, and popularity
  `人気 / にんき`. Their unrelated readings are not accepted as alternatives.
  `昭和` ends in 1989; the old Russian source's open-ended era description is
  not copied into teaching. Rental `礼金` is distinguished from a refundable
  deposit. Actual source pairs, not mechanically concatenated kanji readings,
  determine accepted answers.
- The newly prepared registry contains 274 kanji and 340 primary word pairs.
  Independent AI reviewers Dalton and Lorentz accepted meaning/context and
  source/reading/dependency checks after corrections, finalized on 2026-11-01
  for words and 2026-10-31 for kanji. Local preparation and AI
  acceptance are not human certification, a live count or a publication receipt.
  Complete live source, licensing, prerequisite and quality checks remain required.
- Preserve all accounts, private content, SRS and kana history, all sealed
  courses and the complete previous main set. The pre-write baseline covers
  35 aggregate row-count/digest groups, including the 652 prior main items;
  private rows and digests must not enter Git.
- The kanji curator now checks successful licensed imports, version/checksum,
  exact foreign-key-bound record identity, source identity, attribution and
  share-alike metadata in preflight and again inside each kanji transaction.
  Historical display labels remain unchanged and are not used as provenance.
  Canonical EDRDG and CC BY-SA license URLs are accepted; arbitrary URLs are not.
- A proposed extra word required adding a missing reading alongside an existing
  raw-entry alias. That remains blocked by the existing preservation guard;
  another independently checked word takes its place. No source alias repair,
  provenance rewrite or importer-wide exception is introduced for this block.

After this extension, **2,026 kanji and 7,660 word pairs** still need full
teaching and review to reach 2,300 / 8,000. Closing these 45 gaps does not imply
that every older foundation kanji has word reinforcement: ten older glyphs
still lack any word expression in the expanded source registry. Taught-reading
coverage for the entire course remains a larger editorial obligation.
Keep the 60-level main course DRAFT and V7 membership unchanged; do not silently
move existing users or advertise unfinished levels as a complete learner course.

## Reinforcement Server Receipt: 2026-11-01

- Release code: `7bae74671efdf6e3f4c340420dd27c4abbd4a687` (content commit
  `2edeed355f2e916fa0e77672d4bd3a56151f15e3`). Both web and API health returned
  200 with the release revision. No new local dev server was started.
- [Explicit reinforcement publication](https://github.com/wndffs/kanji-app/actions/runs/41242220572)
  succeeded. Only the new support-kanji manifest and four new word manifests
  were selected. All five authored import runs are SUCCESS. All registered
  vocabulary passed source/license/prerequisite preflight before word teaching
  writes; existing manifests were not reapplied.
- The pinned source supplement added five absent JMdict entries for six
  requested spelling/reading pairs through the existing insert-only importer.
  It did not reimport the corpus or repair existing aliases. All three pinned
  archives were reused from verified cache without downloading again.
- Final live main-set totals: **137 components / 274 kanji / 340 primary word
  pairs / 751 teaching targets / 1,365 core meaning-reading cards**. There are
  27 populated levels out of 60; main-course status remains DRAFT.
- All **45 requested completion-block expression gaps are closed**. The new
  code additionally validates 57 exact taught-reading alignments: those 45
  plus all 12 new support kanji. All 80 new words have published primary-reading
  answers and original JP/kana/RU/EN examples. Four same-sense alternatives are
  additional accepted answers, not additional word totals.
- Final published-content audit: **751 scanned items, zero blockers, zero
  warnings**, content version
  `1dbf6c9ec9f8b9750988f8e5c0aed9dec18b1d7b341dc40017b9d62ab480750d`.
- All **35 monitored preservation groups** retain exactly the same counts and
  private digests: accounts/settings, SRS, private content, review/enrollment/
  kana history, sealed courses, and the prior main-set items/cards/answers/
  placements/dependencies/mnemonics/hints/raw targets/example links. This
  includes 30 accounts, 162 SRS states and all 652 previous main items. V7
  remains 389 items. Only this aggregate confirmation enters Git.
- Final targeted local batch: **312 tests passed across 12 files**, plus DB
  typecheck and changed-file lint/format checks. [CI](https://github.com/wndffs/kanji-app/actions/runs/41242160024)
  passed, including 487 browser cases and one existing skip;
  [study integrity on PostgreSQL 18](https://github.com/wndffs/kanji-app/actions/runs/41242160021)
  passed. These checks do not constitute human linguistic certification.
- Live ordinary search and item navigation verified `顔面 / がんめん`, its
  original example, and `面 / めん` with three linked reinforcement words.
  Its rendered KanjiVG SVG has nine paths at 320 x 320. No reviews, enrollments
  or translation preferences were changed for this check. Browser tabs and
  both review agents were closed; no local job was left running.

**Current task status: OPEN.** The requested 45-gap block is complete; the full
2,300-kanji / 8,000-word course is not. Continue substantial authored/reviewed
content inside this same task: **2,026 kanji and 7,660 primary word pairs remain**,
along with course-wide taught-reading coverage and the previously listed
functional gaps. Do not publish the unfinished 60-level curriculum or switch
existing learners from V7 to it.

The item/search UI still sometimes picks an alphabetically earlier accepted
synonym instead of the authored primary meaning (confirmed on the new face
word). Both displayed meanings are valid; primary-meaning display priority
remains an open presentation issue, not a reason to rewrite accepted answers.

## Large Growth Block: 2026-11-01

This is the next extension of the same OPEN delivery task, not a new task list.
The block adds 106 kanji, 160 distinct primary word pairs and 48 visual cues.
One kanji manifest and eight twenty-word manifests are publication/storage
units, not nine separately counted tasks. Components occupy level 34, kanji
35-36 and words 37-38; existing manifests and V1-V7 seals are not rewritten.

- All 106 chosen KANJIDIC2 readings and primary KanjiVG graphics, plus 160
  primary JMdict pairs and 24 same-sense alternatives, match the verified local
  2026-10-31 snapshot with no mismatched IDs. Sources are reused from cache;
  original JP/kana/RU/EN examples, scopes, meanings and memory aids remain a
  separate project-authored layer. No competitor content or new dependency.
- Two independent AI reviews cover meanings/context and readings/components.
  Jason and Huygens accepted the corrected content; final review on 2026-11-01.
  This is not human linguistic certification. Publication additionally requires
  the existing live source, license, prerequisite and quality checks.
- Historical variants remain nonprimary; irregular `はなじ` and `ていいん`
  are exact accepted exceptions, not normalization rules. Standard `はなぢ`
  and `てんいん` remain taught. Grassland readings share only the selected
  grassy-ground sense, not every restricted dictionary sense.
- `昨年 / さくねん` replaces the proposed `昨夜` card rather than teaching a
  card that would reject the separately indexed ordinary `ゆうべ` reading.
  All accepted alternatives must keep exact, same-entry source evidence.
- All 106 new selected kanji readings have explicit, source-ID-bound primary
  vocabulary reinforcement. Ten earlier expression gaps are also closed:
  百/千/止/花/草/馬/鳥/魚/米/門. Every one of the 380 prepared kanji now
  appears in an actual word expression. This does not automatically prove
  selected-reading alignment for every older foundation entry.
- Seven missing raw JMdict entries for nine requested pairs have no existing
  aliases or ID conflicts in the live read-only plan. Only the established
  insert-only supplement is allowed; no corpus-wide import or alias repair.
- The pre-write preservation snapshot covers 35 groups, 30 accounts, 162 SRS
  states, every sealed course and all 751 prior main teaching items. Private
  values and hashes stay outside Git. Compare it after publication.

Prepared totals: **185 components / 380 kanji / 500 primary word pairs**.
The full target still needs **1,920 kanji and 7,500 primary word pairs**.
These are preparation counts until a server receipt below confirms publication.
Keep the unfinished main curriculum DRAFT and existing enrollments unchanged.

## Growth Server Receipt: 2026-11-01

- Content/release commit: `73f420203cd31c76e4922913fa29fef9625eba8c`.
  Reviewed payload seals: `2da8a978e20ff32fd084fb9e8deae43be4eda24a`.
  Web and API health both returned 200 with the content revision. The final
  test/documentation changes do not require another runtime build.
- [Kanji publication](https://github.com/wndffs/kanji-app/actions/runs/41248474475)
  and [word publication](https://github.com/wndffs/kanji-app/actions/runs/41249059767)
  both succeeded. They are two operational phases of this one large block.
  Only the new kanji manifest and eight new word manifests were selected;
  all nine authored import runs are SUCCESS and match the sealed checksums.
  Existing teaching manifests were not reapplied.
- The source supplement reused all three verified cached archives and inserted
  seven missing JMdict entries for nine requested pairs. No dictionary-wide
  reimport, alias repair or rewrite of existing raw provenance was performed.
  Full registered-word source/license/prerequisite preflight ran before new
  word teaching writes. The existing safety checks were not weakened.
- Live main-set totals are **185 components / 380 kanji / 500 primary word
  pairs / 1,065 published teaching targets / 1,945 core meaning-reading
  cards**. All 380 kanji have stroke graphics and occur in an actual word
  expression. All 160 new words have published original examples. There are
  32 populated levels of 60; the main course remains **DRAFT**.
- Final quality audit: **1,065 scanned items, zero blockers, zero warnings**,
  content version
  `1721831cc03708c2499e2544f08338ee00b4c6e984553925339c4574068e04a9`.
- All **35 preservation groups** have exactly unchanged row counts and private
  digests: 30 accounts, 162 SRS states, private content/settings, review/
  enrollment/kana history, all sealed courses and all 751 previous main items,
  targets, placements, cards, answers, dependencies and example links. No
  private rows or digests are stored in this receipt. V1-V7 remain unchanged.
- Final focused local coverage: **343 tests across 13 relevant files**,
  including all nine new payload seals, 116 primary reading links, 24 accepted
  variants, semantic near-miss blocks and the bare-tooth regression. DB
  typecheck, changed-file lint/format and diff checks passed.
  [CI](https://github.com/wndffs/kanji-app/actions/runs/41251074247) and
  [study integrity on PostgreSQL 18](https://github.com/wndffs/kanji-app/actions/runs/41251074173)
  passed for the sealed revision. No human linguistic certification is claimed.
- Live search and ordinary item navigation confirmed `鼻血 / はなぢ`, its
  persisted alternate answer `はなじ`, original JP/kana/RU example and kanji
  relationships. `鼻 / はな` links back to that reinforcement word and renders
  14 KanjiVG paths in a 320 x 320 SVG. No graded answers, enrollments or
  translation settings were changed. The initial search loaded slowly before
  returning correctly; this content release does not claim a latency fix or
  fix the previously recorded primary-meaning display priority issue.
- Both review agents and all temporary browser tabs were closed. No local dev
  server was needed. Temporary analysis/evidence files were kept outside Git
  and removed; the verified reusable source cache is retained.

**Current task remains OPEN:** **1,920 kanji and 7,500 primary word pairs**
still need complete authored teaching, review and publication to reach the
2,300 / 8,000 target. Continue with substantial content blocks in this same
task, not microtasks. Do not advertise raw imports, prepared manifests or the
unfinished main curriculum as a complete learner course, create another tiny
pilot, or silently move existing learners from V7.

## Balanced Continuation: 2026-11-01

This is another substantial extension of the same OPEN completion task:
134 kanji, 300 primary vocabulary pairs and 34 independently named visual
components. Preparation alone is not publication or completion evidence.

The former five-level-per-block layout would exhaust sixty levels long before
the target. New kanji instead fill free earlier slots after their components,
up to forty kanji per level; older already larger levels are not altered.
The 500 older vocabulary slots are explicitly reserved. No previous placement,
card, item or finite-course seal is rewritten. New components extend existing
level 1; new kanji stay within existing levels 2-37.

Vocabulary now uses explicit bounded manifest sizes, not forced twenty-word
groups that postpone an early word until an unrelated later prerequisite.
Legacy manifests still default to twenty and retain their exact payloads.
New manifests declare a count from 1-200 and must match it exactly. All words
in a continuation manifest have the same earliest readable level, including
the kanji used in the original example. The 300 words occupy sixteen existing
levels, with no target beyond level 38. These are storage groups, not tasks.

The block emphasizes everyday verbs, descriptions and practical nouns, not
only compounds. Explicit authored grammatical metadata now supports
na-adjectives, pronouns and adverbs alongside nouns, verbs and i-adjectives.
This does not change the previous source-selection quota model or old senses.
All examples and RU/EN scopes are authored separately from dictionary evidence.

- Verified local sources match all 134 selected KANJIDIC2 readings, 134 primary
  KanjiVG sequences and 300 unique bilingual primary JMdict pairs exactly.
  Every new selected kanji reading has an explicit primary word link. The
  contractions `けつ -> けっ` in 決定 and `こつ -> こっ` in 骨折 are explicit
  reviewed alignments, not a general answer-normalization rule.
- The final live read-only source plan covers 300 primary pairs and eighteen
  accepted exact alternatives: 308 pairs already exist, ten are absent without
  old aliases, and no source IDs conflict. The existing insert-only supplement
  and complete publication preflight remain mandatory.
- Reading provenance explicitly distinguishes same-entry alternatives, the
  separate bilingual JMdict entry for 怒る / いかる, and the source sense note
  `also いい (all senses)` for 良い / よい. The latter is not a fictitious
  良い / いい dictionary row. A bounded parser proves the primary expression,
  reading, applicable sense and exact note in the pinned full JMdict snapshot.
  It stores a separately versioned, checksummed evidence record under the
  existing JMdict license without rewriting old raw records or Word rows.
  Publication rechecks that proof inside each teaching transaction. The final
  quality audit shares the same source verifier rather than broadly accepting
  other entries or unproven reading text.
- Private before/after preservation checks now select the previous main items
  by a frozen pre-write timestamp, not a level-number cutoff: additions can
  safely fill earlier levels without accidentally joining the old comparison
  set. All 35 groups, 30 accounts, 162 SRS states and 1,065 earlier main items
  are covered. No private rows or hashes may enter Git.
- The curation workflow retains all source/license/placement/quality gates;
  its bounded timeout is raised to ninety minutes so a large reviewed block
  can finish without arbitrary twenty-word publication cycles.
- Two independent AI reviewers accepted the corrected RU/EN content and the
  source/shape/phonology review. A separate bounded security review accepted
  the insert-only proof pipeline. Seventeen exact manifest checksums are
  frozen in the continuation regression test. These are AI-assisted checks,
  not human linguistic certification or evidence of a completed full course.
- Server application uses two sequential operational phases of this same block,
  not separate tasks: kanji/components, then all 300 words. Final publication of
  a word manifest still revalidates every example in one atomic transaction.
  Its deadline now scales with the validated manifest size (1.5 seconds per
  word, minimum thirty seconds, maximum five minutes for 200 words). Per-word
  staging transactions keep the original thirty-second limit. Regression tests
  cover the unchanged legacy budget, the 98-word group, and rollback when its
  final example fails. The initial word attempt was deliberately cancelled to
  deploy this safety correction before resuming; manifest payloads are unchanged.

Prepared targets after acceptance: **219 components / 514 kanji / 800 primary
word pairs**. The full course would still require **1,786 kanji and 7,200 word
pairs**. Keep the main curriculum DRAFT, preserve V1-V7 and enrollments, and
record a separate live receipt only after actual successful publication.

## Continuation Server Receipt: 2026-11-01

- Reviewed content commit: `14e5c7b7995ab27089e395ad32ed638ceab0cf55`.
  Finalization scaling fix/runtime release:
  `3b3a8d15f9c0e7effa0683c4694df295ee5213d0`. The content payloads did not
  change in the fix. All seventeen live authored import runs are SUCCESS and
  match the exact independently reviewed manifest seals.
- [Kanji/component publication](https://github.com/wndffs/kanji-app/actions/runs/41306739925)
  and [complete word publication](https://github.com/wndffs/kanji-app/actions/runs/41309752071)
  succeeded. They are two operational phases of this one large block. Only
  the new kanji manifest and sixteen new word manifests were applied; no old
  teaching manifest was reapplied. The 98-word finalization succeeded with
  its bounded atomic deadline.
- The deliberately [cancelled initial word attempt](https://github.com/wndffs/kanji-app/actions/runs/41306870374)
  was still in full-registry preflight: a read-only database check confirmed
  no word teaching import run or new published word. Its source supplement
  had already successfully inserted ten absent JMdict entries and one exact
  sense-note evidence record. The resumed attempt reused them without writes
  to old raw records, alias repair, dictionary-wide import or a fake Word row
  for the note-only reading. Existing licensing and full-registry source,
  placement, prerequisite and example checks remained enabled.
- Live main-set totals: **219 components / 514 kanji / 800 primary word
  pairs / 1,533 published teaching targets / 2,847 core cards**. All 514 kanji
  have stroke graphics and occur in a published word expression. All 300 new
  words have published original bilingual examples. There are **35 populated
  main-course levels**, up to level 38 of 60. A course-scoped count is required:
  shared items also occur in sealed courses and their placements must not be
  counted as extra main-course levels. The main curriculum remains **DRAFT**.
- Final quality report: **1,533 scanned items, zero blockers, zero warnings**;
  content version
  `582e33ecd5c16634b78683a251e9b98837ec6fc7e143b52d3a1fb7c4168f49a9`.
  This verifies registered source-backed material, not human linguistic
  certification or completion of the final curriculum.
- All **35 preservation groups** retained identical counts and private
  digests: 30 accounts, 162 SRS states, private settings/content and review,
  enrollment and kana history, every sealed course, and all 1,065 previous
  main targets with their placements, cards, answers, dependencies and example
  links. V1-V7 and enrollments remain unchanged. No private rows or digests
  are stored in this receipt.
- Relevant local coverage: **482 tests across seventeen files**, including
  immutable legacy/new payloads, 134 primary reading links, eighteen exact
  variants, one sense-note reading, strict source-proof rejection, semantic
  near-miss blocks, 20/98-word transaction budgets and atomic rollback.
  DB/API typechecks, changed-file lint/format and diff checks passed.
  [Final CI including web smoke](https://github.com/wndffs/kanji-app/actions/runs/41309655590)
  and [study integrity on PostgreSQL 18](https://github.com/wndffs/kanji-app/actions/runs/41309655457)
  passed. Documentation-only receipt changes need no additional runtime test.
- Public web/API health both returned 200 on runtime revision `3b3a8d1`.
  The first API probe timed out while the free Render service was cold; its
  bounded retry returned 200. This release makes no cold-start latency claim.
  Live search and ordinary item pages confirmed 良い / よい with accepted
  いい, 怒る / おこる with accepted いかる and its register note, original
  JP/kana/RU examples, and related kanji. 怒 / ど links to 怒声 / どせい
  and renders nine KanjiVG paths in a 320 x 320 SVG. No graded answers,
  enrollments or translation settings were changed.
- The previously recorded primary-meaning display ordering issue remains:
  item/search summaries may lead with another valid curated synonym instead
  of the manifest's primary answer (e.g. добротный before хороший for 良い).
  The actual accepted-answer disclosure retains the correct primary order.
  This content release does not claim to fix that UI issue.
- All review/worker agents and temporary in-app tabs were closed. No local
  dev server was needed; one-off evidence/scripts stayed outside Git and were
  removed. The verified reusable official source cache is retained.

**Large task remains OPEN:** reaching **2,300 kanji / 8,000 primary word
pairs** still requires **1,786 kanji / 7,200 words** with complete independent
teaching, review and publication. Continue substantial blocks in this same
task, not numbered microtasks. Published additions are not a finished main
course or grounds to switch existing learners away from V7.

## Practical Expansion In Preparation: 2026-11-01

Continue the same OPEN delivery task with **200 kanji and 500 new primary
word forms**. This is preparation, not a publication claim. The intended
post-publication totals are **714 kanji / 1,300 words**, leaving **1,586 kanji
and 6,700 words** to author, review and publish for the full target.

- Reuse the verified official 2026-10-31 local snapshot; no new download or
  proprietary content is required. All 200 selected readings have an exact
  bilingual reinforcement pair and a primary KanjiVG sequence whose stroke
  count matches KANJIDIC2. Independent editorial/source review is still required.
- Prefer practical reinforcement (e.g. 指示, 日常, 収入, 呼吸), not accidental
  kana substrings, historical abbreviations or name-only frequency artifacts.
  Source-supported plain kun readings remain distinct from on readings.
- The 500 new written forms are distinct from each other and the previous
  800 words. No full-width-number variants or compositional multi-number words
  are used to inflate the delivery count. Include verbs, i/na-adjectives and
  adverbs as well as nouns. Explicit prefixes, suffixes, counters, numerals
  and proper names must not be mislabeled as ordinary nouns.
- Freeze all previous 514/800 payloads and all 800 vocabulary placement slots.
  Fill free kanji capacity and place each word at its exact earliest readable
  level, including the kanji in its original example. Retain the 200-word
  manifest bound, atomic finalization and all source/quality protections.
- Correct the recorded content-display defect: search/item/related summaries
  should prioritize the actual global primary meaning per locale, not an
  alphabetically earlier synonym. Keep raw dictionary senses separate and
  never promote private overrides or blocked answers into global meanings.
- Independent AI reviews, focused batched checks, commit/push, guarded server
  publication, live UI verification and before/after preservation checks are
  required before a new server receipt can confirm these prepared totals.
  Main remains DRAFT; V1-V7 and all enrollments/progress remain unchanged.
- The full quality-report CLI now budgets its existing RepeatableRead
  transaction from the published course item count: ten seconds per 100-item
  page, minimum two minutes, maximum thirty minutes. The preliminary count
  controls only the deadline; all reported rows still come from one consistent
  snapshot. No quality checks or provenance gates are skipped.
- Twenty-two level-aligned vocabulary manifests describe this one 500-word
  block. Explicit deployment/CLI selection is bounded at forty distinct
  registered IDs, rather than twenty, so the block can use one complete
  source preflight and publication command. Unknown/duplicate IDs, over-limit
  lists, unreviewed content and unsafe mode combinations remain rejected.
- The final read-only source plan finds all **513 exact pairs** (500 primary,
  thirteen accepted variants) already in Neon, with no missing pair or ID
  conflict. Two initial candidates were replaced without changing old rows:
  ambiguous 共同 became 共通, and legacy starter 一つ became 輸入.
- Raw Russian glosses are not blindly promoted into teaching meanings. Some
  are cross-references or cover a different sense; project-authored Russian
  may accurately translate the verified English sense, with independent
  review. For example, 大手 teaches a major company, not castle gates, and
  短め teaches shortish length, not the inconsistent raw Russian gloss.
  Original raw evidence and attribution remain separate and unchanged.
- All 200 character-to-reading alignments are frozen explicitly with their
  written-character index and kana offset. A reading substring belonging to
  another character is not evidence: 示 is じ at offset 1 in 指示 / しじ,
  not し at offset 0. Targeted semantic blocks reject genuinely wrong close
  answers without rejecting reviewed valid number forms or synonyms.
- Live publication showed that a full-registry preflight plus this 500-word
  block may exceed the previous ninety-minute workflow ceiling on Neon.
  Future attempts have a bounded three-hour job deadline. Individual staging
  and atomic finalization transaction budgets, manifest seals, source gates
  and quality checks are unchanged. An interrupted attempt must resume only
  its unfinished explicit manifests, without reapplying completed ones.

## Practical Expansion Server Receipt: 2026-11-01

- Content and primary-meaning display fix:
  `d48a1f0054b37c366b4e3abd1bf0df744675390c`. Bounded workflow deadline fix:
  `d94eb833ca662099e10628793fb5493c000c1a7a`. Reviewed payloads are unchanged
  by the workflow fix. All **23 authored import runs are SUCCESS** and match
  the exact frozen manifest checksums: one kanji/component manifest and
  twenty-two level-aligned word manifests, describing one substantial block.
- [Kanji/component publication](https://github.com/wndffs/kanji-app/actions/runs/41321783513)
  succeeded. The [complete 500-word application](https://github.com/wndffs/kanji-app/actions/runs/41321875676)
  finished all teaching writes and its corpus report before the old ninety-minute
  job ceiling interrupted only the final quality report. No completed manifest
  was reapplied and no unfinished teaching manifest remained. The subsequent
  [read-only quality and source preflight](https://github.com/wndffs/kanji-app/actions/runs/41333637069)
  succeeded in `plan` mode without teaching writes. Future jobs use the bounded
  three-hour ceiling; transaction deadlines and all safety gates are unchanged.
- Live main-set totals: **232 components / 714 kanji / 1,300 primary word
  pairs / 2,246 published teaching targets / 4,260 core cards**. All 714 kanji
  have stroke graphics and occur in a published word expression. All **500 new
  words** have published original Japanese/kana/Russian/English examples.
  There are **37 populated main-course levels**, up to level 39 of 60. These
  counts exclude shared placements in other courses. Main remains **DRAFT**;
  no finite release, automatic enrollment change or progress reset was made.
- Final quality report: **2,246 scanned items, zero blockers, zero warnings**;
  content version
  `f1cffd6b3f36e8a79befd9ed3b3271c61fb6b69155ed34c39ca767dbacbe91ad`.
  The 500 primary pairs and thirteen accepted variants already had exact
  JMdict evidence in Neon: no source supplement, raw-record repair or
  dictionary-wide import was needed. Primary readings, shape sequences,
  phonology, meanings and examples received independent AI source/editorial
  review. This is not human linguistic certification.
- All **35 preservation groups** retained identical counts and private
  digests: 30 accounts, 162 SRS states, private settings/content and history,
  enrollments and kana data, every sealed V1-V7 course, and all **1,533 prior
  main targets** with their placements, cards, answers, dependencies and
  example links. No private rows or digests are stored in this receipt.
- **501 distinct relevant tests across 21 files** passed after correcting
  one stale CLI registry expectation. This includes immutable prior payloads,
  200 explicit reading alignments, source-ID and kana-offset rejection,
  grammar metadata, conservative semantic near-miss blocks, manifest seals,
  placement, selection bounds, quality-report deadlines and per-locale
  primary meanings without private-answer leakage. The deployment guard's
  25 tests were also rerun after its timeout-only correction. DB/API
  typechecks and changed-file lint, formatting and diff checks passed.
  [Content CI including web smoke](https://github.com/wndffs/kanji-app/actions/runs/41321394458),
  [content study integrity](https://github.com/wndffs/kanji-app/actions/runs/41321394459),
  [workflow-fix CI](https://github.com/wndffs/kanji-app/actions/runs/41331548931)
  and [workflow-fix study integrity](https://github.com/wndffs/kanji-app/actions/runs/41331548830)
  passed. No additional full monorepo suite was run locally.
- Web/API health both returned 200 on deployed content revision `d48a1f0`.
  Live search and ordinary item pages confirmed **良い / よい / хороший**
  with accepted **いい**, fixing the previously recorded summary ordering
  defect. Raw dictionary senses remain separate. New **大手 / おおて**
  correctly teaches a major company with its original example; **共通 /
  きょうつう** links to **共 / きょう** and its reinforcement words.
  共 renders six KanjiVG paths in a 320 x 320 SVG. No graded answers,
  enrollment or translation settings were changed during browser checks.
- Review agents and temporary in-app tabs are closed. No local dev server
  was needed. One-off evidence and scripts stayed outside Git and were
  removed; the verified reusable official source cache is retained.

**Large task remains OPEN:** **1,586 kanji / 6,700 primary words** still
require independent teaching, review and publication to reach **2,300 /
8,000**. Continue substantial content blocks, not numbered microtasks.
This expansion is not a completed main curriculum or permission to switch
existing learners away from V7.

## Course Broadening: 2026-11-21

The next block targets **200 new kanji and 500 new primary vocabulary pairs**.
The published baseline is the preceding **714 kanji / 1,300 words**. Following
successful publication this block would reach **914 kanji / 1,800 words**,
with **1,386 kanji / 6,200 words** remaining. These targets are not a live receipt.

- Choose from the existing pinned JMdict, KANJIDIC2 and KanjiVG snapshot.
  Reuse 232 existing visual cues, require an earlier cue for every kanji, and
  retain the 40-kanji cap for newly filled levels. New placements follow
  existing sort orders; earlier manifests and all V1-V7 seals stay unchanged.
- Every added kanji has an explicit character index and kana offset in a
  distinct reinforcement word. Prefer ordinary vocabulary: 就職 for 就,
  故障 for 障, and 興味 for 興. The matching primary source type and exact
  dictionary pair are checked separately from the authored learning text.
- Use a mixed vocabulary selection without alternative-spelling or numeric
  padding. Original examples supply Japanese, kana, Russian and English;
  all characters in the written word and its example precede the word level.
  Keep original source senses out of the authored layer. Use an explicit
  prenominal-adjective label for 単なる rather than calling it a na-adjective.
- Local source review can be rerun with
  `npm exec -- tsx scripts/local-course-evidence.mts --snapshot-dir ABSOLUTE_DIR`
  plus explicit `--kanji-batch` and one or more `--word-batch` IDs. It checks
  source identities, bilingual evidence and stroke sequences; it does not
  perform independent editorial review, use database credentials or approve
  publication. Source-note-only alternatives still require their separate proof.
- Publication work now batches the final example lookup and exact staged-link
  update while retaining atomic provenance, item status and rollback checks.
  Read-only kanji evidence checks run four at a time; staging writes remain
  individually transactional. No live Neon speedup is claimed before measurement.
- A local capacity probe (not an inventory) found **1,559 unregistered kanji**
  with an existing reusable cue, matching primary strokes and some candidate
  pair under the strict initial selection. This is an optimistic upper bound
  for that filter, not reviewed content. Together with 714 prior entries it
  is still below 2,300; later blocks will need additional useful cues and/or
  other verified lexical evidence. Do not pad either volume target.

Keep the main curriculum DRAFT. Before claiming a release, pass independent
editorial checks, full source and placement preflight, explicit selection
in GitHub Actions, live corpus/quality checks and progress preservation.

### Broadening verification and release handoff

- Independent AI reviewers checked all **200 kanji and 500 words**, including
  their RU/EN scopes, visual cues, phonology, meanings and original examples.
  They accepted the corrected batch after rechecking flagged rows. This is
  not human linguistic certification. Local checks match **200 KANJIDIC2
  readings, 200 primary KanjiVG sequences and 504 exact bilingual JMdict
  pairs**, including four independently accepted same-entry alternatives.
  The authored layer contains 500 distinct written forms and source IDs;
  none reuse one of the prior 1,300 primary source entries.
- The scoped 19-file checks pass **534 tests**, including the old published
  payload hashes, new manifest seals, strict distinction between actual
  reading bindings and matching substrings, supported alternatives, and
  conservative semantic answer validation. DB and local source tooling
  typechecks, changed-file lint and formatting passed. The reviewed registry
  now has **914 kanji / 1,800 words / 232 components** across 38 populated
  levels through level 40, not a claim that those counts are live.
- Primary word provenance preflight now loads one exact-pair group per
  manifest, with the same validator and a fresh individual provenance check
  inside each write transaction. Alternative sources, ownership, placement,
  graph, license, and rollback guards are unchanged. Actual Neon performance
  and source availability still need verification.
- Release only `full-course-kanji-broadening` first (explicit kanji selection,
  skip words), then the **21** explicit word IDs
  `full-course-vocabulary-broadening-01` through `-21`. The local source
  match does not establish that all four alternate rows or all primary rows
  are already in Neon. Run server-side preflight and resolve any real source
  conflicts without rewriting existing rows. No all-registry reapplication.
- Expected live totals after successful publication: **2,946 teaching targets
  and 5,660 core cards**. Confirm the 500 new examples, manifest seals,
  914 stroke graphics, final quality report and pre-existing course and
  progress preservation.

### Broadening kanji server receipt: 2026-11-22

- The explicit kanji plan and
  [apply run](https://github.com/wndffs/kanji-app/actions/runs/45015982250)
  succeeded for `full-course-kanji-broadening`: **200 kanji / 400 core cards**
  added. The full corpus command passed. The final content audit scanned
  **2,446 items with zero blockers and zero warnings**, consistent with
  **914 kanji / 1,300 words / 232 components**. The public Render endpoint
  returned both the established item 一 and the final new item 令.
- This is a kanji-only receipt. The 500 reinforcing and additional words
  require their separate teaching preflight and application. The main
  curriculum remains DRAFT; the workflow does not change enrollment or
  existing published versions.

### Broadening word server receipt: 2026-11-22

- The [word preflight](https://github.com/wndffs/kanji-app/actions/runs/45016071235)
  passed for all 21 selected manifests and all **500** words on existing
  licensed sources. The separate
  [apply run](https://github.com/wndffs/kanji-app/actions/runs/45019277649)
  reported **500 words / 1,000 cards / 500 original examples** and reached
  the 21/21 committed checkpoint. It did not rewrite raw sources or rerun
  the broadening kanji manifest.
- The full corpus report and quality audit passed: **2,946 scanned items,
  zero blockers and zero warnings**, consistent with **914 kanji / 1,800 words
  / 232 components / 5,660 core cards** in the main curriculum. The main course
  remains DRAFT. No public enrollment switch was made. Render returned both
  育てる / そだてる and 因子 / いんし with authored RU/EN meanings, two review
  cards, and a Japanese/kana/RU/EN example with attribution.
- The sequential, optimized apply command ran for about **45 minutes** from
  the end of pre-write quality to the final word checkpoint; the overall
  job also included dependencies, corpus verification and final quality.
  This measures the broadening selection only, not the optional paired mode
  or a direct same-data benchmark against a prior revision.

## Course Deepening: 2026-11-21

This independent block adds **200 kanji, 640 distinct words and 640 original
JP/kana/RU/EN examples**. Every new kanji has an explicit character index and
kana offset in an actual reinforcement word. The 440 additional vocabulary
items use existing course kanji, with an emphasis on useful ordinary words.
The registered reviewed totals are **1,114 kanji / 2,440 words / 232
components** across **40 populated levels**. This is not a live release
receipt. **1,186 kanji / 5,560 words** remain to the target after these blocks
are applied; the confirmed live Broadening baseline is **914 / 1,800**.

- Two independent AI review passes covered every item, with cross-review for
  authored vocabulary and parent resolution of findings. The pinned
  2026-10-31 snapshot matched **200 KANJIDIC2 readings, 200 primary KanjiVG
  sequences, and 642 exact bilingual JMdict pairs** (includes two accepted
  same-entry alternates). This is not human linguistic certification. No
  competitor materials were copied; raw sources and authored text are separate.
- The new structural example check anchors the target reading at the written
  word and retains surrounding literal kana and punctuation. It deliberately
  does not claim to read unannotated kanji or replace editorial review.
  Scope-specific answer blocks prevent false positives such as
  infection/injection, evaluation/evacuation and предложение/предположение.
- The source checker can now support an explicit kun stem, without rewriting
  the imported form or changing old accepted answers. For example, a candidate
  can bind 戻 to もど through the raw もど.る reading and teach 戻る as もどる.
  The suffix must match where written as kana. The current deepening payload
  uses plain source readings; the stem support prepares the subsequent block.
- Previous registry payloads (914 kanji and 1,800 words), placements and
  V1-V7 seals are preserved. The reviewed payload SHA-256 is
  `18ebed77062678bb7496e52589133911312193b666401674cbcfba74bd93affd`.
  Reading alignment SHA-256:
  `74367396ed8fc5c8888ae7bec937fa5c7ecadd2f55ab92a9c5148adf2bca78ec`.
- All 637 scoped tests across 24 files passed, including the inventory
  expectation rerun. DB and source-tool typechecks passed.
- Release needs authenticated GitHub Actions access and live Neon preflight.
  First complete the earlier broadening handoff. Then use explicit
  `full-course-kanji-deepening` (kanji only with skip words), followed by the
  **29** explicit word IDs `full-course-vocabulary-deepening-01` through
  `-29`. Empty apply selections are rejected; a full read-only plan remains
  supported. Keep the raw supplement off unless a scoped server plan shows
  missing evidence. Do not replace existing raw identities or reapply the
  entire registry.
- Expected after both outstanding blocks are applied: **3,786 teaching
  targets / 7,340 core cards**. Check final source and quality gates and
  compare only aggregate preservation evidence for existing progress and
  courses. Keep the main curriculum DRAFT; do not create V8 or switch users.

### Deepening kanji server receipt: 2026-11-22

- The [read-only preflight](https://github.com/wndffs/kanji-app/actions/runs/45022026374)
  passed all 200 kanji. The first apply stopped in CI selection tests before
  database access; it did not leave a partial import. The corrected
  [paired apply](https://github.com/wndffs/kanji-app/actions/runs/45024912897)
  reached 200/200 committed kanji and verified the exact receipt as complete.
- The kanji command took **about 11 minutes**, including its mandatory live
  preflight. Broadening's earlier sequential 200-kanji command took about
  21 minutes. These are different blocks and revisions, not a same-data speed
  comparison. All selected kanji kept individually atomic transactions.
- The final corpus and quality checks passed: **1,114 kanji / 1,800 words /
  232 components / 3,146 targets / 6,060 core review cards**, with 1,114
  licensed stroke graphics and zero quality blockers or warnings. The course
  remains DRAFT. Public API samples 仏 / ぶつ and 柱 / ちゅう both returned
  RU/EN meanings, two review cards and stroke graphics. The 640 words require
  their separate live preflight and apply.

### Deepening source-cache recovery: 2026-11-22

The teaching plan found an unverified exact JMdict pair, and the runner's
2026-10-31 source cache had expired. The original archives remained intact
locally. A separate [read-only refresh audit](https://github.com/wndffs/kanji-app/actions/runs/45028767414)
compared effective lexical evidence without accessing Neon or uploading raw
source data. All **642** Deepening pairs retained their exact bilingual
identities. **26 manifests for 431 words** also have unchanged bilingual
lexical fingerprints. Those manifests may use the separately pinned official
2026-11-22 archives for source-only windows. The other **3 manifests / 209
words** (`-15`, `-21`, `-24`) needed a narrower inventory check: a changed
manifest fingerprint does not imply that the pairs missing in Neon changed.

### Deepening vocabulary server receipt: 2026-11-22

- A [source-only supplement](https://github.com/wndffs/kanji-app/actions/runs/45029223681)
  inserted five missing dictionary pairs. The subsequent [live plan](https://github.com/wndffs/kanji-app/actions/runs/45029277380)
  passed 431 words in 26 manifests. The [paired apply](https://github.com/wndffs/kanji-app/actions/runs/45029820418)
  published all 26 with complete receipts, **431 words and 431 original examples**.
- The live total was **1,114 kanji / 2,231 words / 232 components / 6,922 core
  review cards**, with 40/60 populated levels, 1,114 stroke sequences and
  2,231 eligible examples. Quality scanned 3,577 targets with no blockers or
  warnings. All 15 learner-data groups and three protected curriculum groups
  matched their pre-release state. The main curriculum remained `DRAFT`.
- [Read-only inventory](https://github.com/wndffs/kanji-app/actions/runs/45030143142)
  found all 37 exact pairs for `-15`; `-21` and `-24` jointly lacked three.
  Six Followthrough manifests lacked seven additional pairs. The other rows
  were left in place and still require normal curator validation.
- For archive recovery, the source-supplement command verifies only absent
  pairs against both the pinned refreshed archive and independent per-pair
  lexical seals from the original archive. The seals contain no raw glosses
  or database rows and are tied to the exact teaching-manifest checksums.
  Regenerate them locally with `compare-reviewed-source-snapshots.mts
--pair-seals --snapshot-dir ABSOLUTE_DIRECTORY --batch ID` (repeated IDs are
  supplied as separate batch arguments). A missing seal or a changed exact
  pair blocks the entire import window before raw or teaching writes.

The [sealed-source plan](https://github.com/wndffs/kanji-app/actions/runs/45037952687)
and [source-only import](https://github.com/wndffs/kanji-app/actions/runs/45038136955)
verified and inserted ten missing pairs across Deepening and Followthrough,
leaving no missing pairs in the selection. The final
[209-word plan](https://github.com/wndffs/kanji-app/actions/runs/45038206546)
and [teaching apply](https://github.com/wndffs/kanji-app/actions/runs/45038907080)
completed all three remaining Deepening manifests. With width four, the
209-word curation step took about three minutes including its own live
preflight. This is a single successful run, not a controlled benchmark.
Final totals were **1,114 kanji / 2,440 words / 232 components / 7,340 core
review cards**, 40/60 populated levels and zero blockers or warnings.
All 18 protected groups matched again, and main remained `DRAFT`.

The [Coverage inventory](https://github.com/wndffs/kanji-app/actions/runs/45039505004)
checked 787 pairs for 784 authored words. It found 15 absent pairs across
nine manifests, with no conflicting identities or incomplete import runs.
The original-archive seals for those manifests are checked in; they are not
a live import, and a refreshed archive must still satisfy all absent seals.

## Course Followthrough: 2026-11-21

This independently reviewed block adds **200 kanji / 746 primary words**,
with a distinct reading reinforcement word for every kanji and **746
original JP/kana/RU/EN examples**. The authored registry now contains
**1,314 kanji / 3,186 words / 232 components** across **41 populated levels
through level 42**. **986 kanji / 4,814 words** remain to the full-course
target. This is not a live release receipt; the last confirmed live count
remains **714 kanji / 1,300 words**.

- Independent AI reviewers checked 200 reinforcement pairs and cross-reviewed
  the additional 546 vocabulary entries. The corrected batch matched **754
  exact bilingual JMdict pairs** (eight reviewed alternatives), **200
  KANJIDIC2 readings**, and **200 KanjiVG primary stroke sequences** in the
  previously pinned 2026-10-31 snapshot. Authored examples and meanings remain
  separate from dictionary data. This is not human linguistic certification.
- Eighteen new kun readings distinguish the taught kanji stem from the
  written okurigana: 戻 teaches もど, while 戻る teaches もどる. The word
  check also preserves independently verified same-entry pronunciation
  variants such as いぞん / いそん for 依存. Semantic near-miss guards reject
  unrelated answers such as medication/mediation and morality/mortality.
- The new payload SHA-256 is
  `9bbbc07401ef1b8c88d84bdc460cf3803f5327e7a95ddae125bc349619f7f0ce`.
  The prior **1,114 K / 2,440 W** manifests, coordinates and V1-V7 seals are
  unchanged. The main course remains DRAFT. No account, private progress
  or published course version was changed to prepare this release.
- Explicit vocabulary selection now preflights all selected batches in the
  database before any teaching write, with per-item checks still repeated
  during application. The entire registry still passes database-free conflict
  validation and staging still checks already published learning content.
  Later unselected kanji and raw vocabulary cannot block an earlier release
  solely because their sources or placements have not reached Neon yet.
- After Broadening and Deepening are live, use an explicit plan and apply for
  `full-course-kanji-followthrough` with vocabulary skipped. Then plan and
  apply the **33** vocabulary IDs `full-course-vocabulary-followthrough-01`
  through `-33`. Leave source supplementation off unless the live scoped plan
  shows a gap. Limit any later raw supplement to verified selected pairs.
- Expected after the three outstanding blocks reach Neon: **4,732 teaching
  targets / 9,232 core cards**. Confirm counts, source attribution, quality
  and preservation live. GitHub Actions authorization is still needed for
  the manual release; existing accounts and finite courses must not be moved.

### Followthrough kanji receipt and remaining source inventory: 2026-11-22

- The [kanji apply](https://github.com/wndffs/kanji-app/actions/runs/45040089799)
  committed 200/200 and verified the exact receipt. Its final quality step
  flagged 18 okurigana stems that had passed source preflight. The audit was
  corrected to require an explicit reviewed stem selection and the matching
  exact licensed KANJIDIC2 record, without permitting arbitrary prefixes.
  No kanji or user data were rewritten to repair the audit.
- The [corrected read-only plan](https://github.com/wndffs/kanji-app/actions/runs/45042594993)
  confirmed **1,314 kanji / 2,440 words / 232 components / 7,740 core cards**,
  zero blockers and warnings, and a `DRAFT` course. All **746 words in 33
  manifests** passed live preflight. The kanji release preservation check
  found all 18 protected groups unchanged; the public API returns 戻 / もど
  with both languages, two review cards, and a licensed stroke graphic.
- A [single read-only inventory](https://github.com/wndffs/kanji-app/actions/runs/45042668831)
  checked all **4,814 words** after Followthrough (**214 manifests / 4,836
  exact pairs**). It found **262 missing pairs**, no conflicting identities
  and no incomplete import provenance. This checks presence only; exact
  licensed lexical evidence and kanji gates still require regular preflight.

- The [Followthrough vocabulary apply](https://github.com/wndffs/kanji-app/actions/runs/45043261185)
  published 746 words in 33 manifests, all with complete receipts, in about
  14 minutes of curation including internal preflight. Final coverage:
  **1,314 kanji / 3,186 words / 232 components / 9,232 core cards**, 41/60
  populated levels, 3,186 eligible examples, no blockers or warnings, and
  all 18 protected groups unchanged. The main course remains `DRAFT`.
  Public API sample 往来 / おうらい showed RU/EN meaning, two review cards
  and an attributed bilingual example.
- The first three remaining blocks passed a scope-locked
  [97-pair source plan](https://github.com/wndffs/kanji-app/actions/runs/45043775283)
  and [source-only import](https://github.com/wndffs/kanji-app/actions/runs/45045260769).
  Coverage, Consolidation and Extension now have no missing pairs in that
  selection. This inserted 96 dictionary records for 97 exact pairs and
  did not create or publish any teaching content.

| Remaining block | Absent exact pairs |
| --------------- | -----------------: |
| Coverage        |                 15 |
| Consolidation   |                 30 |
| Extension       |                 52 |
| Finalization    |                 55 |
| Closure         |                 67 |
| Supplemental 1  |                  0 |
| Supplemental 2  |                  8 |
| Supplemental 3  |                 33 |
| Capstone        |                  2 |

## Course Coverage: 2026-11-21

This block adds **200 reviewed kanji, 784 words and 784 original
JP/kana/RU/EN examples**, with one explicitly aligned reinforcement word per
kanji. The independent teaching registry now contains **1,514 kanji, 3,970
words and 232 components** across **44 populated levels**. Remaining to the
full target: **786 kanji / 4,030 words**. The last confirmed figures in Neon
remain **714 / 1,300**, not the reviewed registry totals.

- Two AI editors cross-reviewed all vocabulary and checked each of the 200
  constituent kanji/word pairs. The pinned 2026-10-31 sources matched **787
  exact bilingual JMdict pairs** (three accepted alternative readings),
  **200 KANJIDIC2 readings**, and **200 primary KanjiVG sequences**. The
  project-authored examples and meanings do not reproduce competitors'
  content. Editorial review is not human certification.
- Common written forms such as 様々, 日々 and 別々 keep their exact source forms;
  the iteration mark does not create a separate kanji prerequisite. An
  explicitly marked compound such as 疾患 can explain how しつ becomes しっ
  without accepting the compound realization as the standalone 疾 reading.
- The prior 1,314-kanji/3,186-word payloads and course placements are
  byte-for-byte unchanged. Coverage seal:
  `1c005f272a819af9a4b09306b69943b29f83376824a075b254c6c78edb2ac0e0`.
- Release after the preceding blocks. Plan/apply `full-course-kanji-coverage`
  with vocabulary skipped. Then plan/apply the **28** explicit word IDs
  `full-course-vocabulary-coverage-01` through `-28`. Only use a narrowly scoped
  raw-source supplement if live preflight detects missing evidence.
- Expected after all outstanding reviewed batches are live: **5,716
  teaching targets / 11,200 core cards**. Verify full quality and aggregate
  preservation evidence. Do not enroll users in the DRAFT main course or
  modify any sealed V1-V7 course or historical SRS data.

### Coverage server receipt: 2026-11-22

- The [kanji plan](https://github.com/wndffs/kanji-app/actions/runs/45045326832)
  and [apply](https://github.com/wndffs/kanji-app/actions/runs/45045960153)
  completed all 200 kanji. The opt-in four-item staging command took about
  eight minutes including live preflight, with one atomic transaction per
  kanji and a complete receipt. The public API returned 祈 / いの, RU/EN
  meanings, two review cards, and licensed strokes.
- The [vocabulary plan](https://github.com/wndffs/kanji-app/actions/runs/45046025234)
  passed all 784 words. The [apply](https://github.com/wndffs/kanji-app/actions/runs/45047925219)
  verified all 28 receipts after publishing the words and their original
  bilingual examples. Public API sample 碁 / ご included two review cards
  and its credited example.
- Final live totals: **1,514 kanji / 3,970 words / 232 components / 5,716
  targets / 11,200 core review cards**, 44/60 populated levels, 1,514 licensed
  stroke sequences and 3,970 eligible bilingual examples. The audit had no
  blockers or warnings. All 18 protected groups matched the pre-release
  snapshot. The course remains `DRAFT`; **786 kanji and 4,030 words** are
  still needed on the server for the full curriculum.

## Course Consolidation: 2026-11-21

This block adds **200 independently reviewed kanji and 754 words**, with a
reinforcement word for each new character and **754 original
JP/kana/RU/EN examples**. The reviewed registry now contains **1,714 kanji,
4,724 words and 232 components** across **45 populated levels**. Remaining:
**586 kanji and 3,276 words** at the end of this block. See the live receipt
below for deployed counts.

- Two AI reviewers checked all 200 reading links and cross-reviewed all 554
  supplementary entries. The pinned 2026-10-31 snapshot confirmed **754
  exact bilingual JMdict pairs, 200 KANJIDIC2 readings, 200 KanjiVG primary
  stroke sequences and 519 actual component groups**. The optional
  `--check-components true` local evidence flag checks groups carrying
  strokes, not alias metadata or empty groups. It does not claim human
  certification or approval to publish.
- Examples teach everyday distinctions such as 扱う (handle or deal with),
  跳ねる (hop or bounce) and 縦横 read じゅうおう in a clear context; guards
  reject unrelated near-answers such as medication for 調停. The two
  sound-change links 窃盗 and 傑作 keep せつ and けつ for their standalone
  kanji cards while showing せっ and けっ in the compounds.
- All older registry coordinates and payloads remain unchanged. New seal:
  `c9e628fb69582ecbcdeb0c73965f3a10c41fb942844d3706bae21bfd423a859c`.
  No curricula or accounts have been moved to the DRAFT main course.
- After Coverage is live, plan/apply `full-course-kanji-consolidation`
  with words skipped. Plan/apply the **32** explicit word IDs
  `full-course-vocabulary-consolidation-01` through `-32`; supplement only
  a selected missing source set if the live plan requires it. Expected
  after all outstanding reviewed batches: **6,670 targets / 13,108 core
  cards**. Verify aggregate source, quality and preservation evidence
  before recording the Neon release.

### Consolidation server receipt: 2026-11-22

- The [kanji plan](https://github.com/wndffs/kanji-app/actions/runs/45048001390)
  and [apply](https://github.com/wndffs/kanji-app/actions/runs/45051256294)
  completed all 200 kanji. Neon reported **1,714 kanji / 3,970 words /
  232 components / 5,916 teaching targets / 11,600 core cards**, with no
  blockers or warnings. All 18 protected groups remained unchanged.
  The public API returned 扱 / あつか, both translations, two cards and
  six licensed strokes.
- The [vocabulary plan](https://github.com/wndffs/kanji-app/actions/runs/45051315028)
  passed all **754 words across 32 manifests** with no blockers or warnings.
  The [apply](https://github.com/wndffs/kanji-app/actions/runs/45053333546)
  verified all 32 complete receipts. Public API sample 扱う / あつかう
  returned both translations, two review cards and an attributed
  JP/kana/RU/EN example.
- Final live totals: **1,714 kanji / 4,724 words / 232 components / 6,670
  teaching targets / 13,108 core cards**, 45/60 populated levels. The
  audit found zero blockers or warnings, and all 18 protected groups were
  unchanged. The main course remains `DRAFT`; **586 kanji and 3,276
  words** are still needed on the server.

## Course Extension: 2026-11-21

This block adds **200 independently reviewed kanji, 770 words and seven
component cues**. Each word has an original JP/kana/RU/EN example. Reviewed
totals: **1,914 kanji / 5,494 words / 239 components** across **50 populated
levels**; remaining: **386 kanji / 2,506 words** at the end of the block.
See the live receipt below for deployed counts.

- The pinned snapshot matched **774 exact bilingual JMdict pairs**, including
  four alternate readings, **200 KANJIDIC2 readings**, **200 primary KanjiVG
  sequences** and **534 actual component groups**. Independent AI reviewers
  checked all 200 reinforcement pairs, seven cues, and 570 additional
  words. This is not human certification or a live publication receipt.
- Seven shape cues including 氵, 扌, 亻 and 片 begin at level 44, after
  the already allocated placements there. Each has at least one dependent
  kanji at a later level. Earlier level coordinates and V1–V7 seals are
  unchanged. Common examples include 鍵, 風呂, 箸, 伺う and 貼付; British
  and American floor numbering and the transitive/intransitive distinction
  are handled explicitly where relevant.
- Extension seal:
  `310b49162266cde950908fbf1207a284359156d38a47b9ead8c1514c5a8712aa`.
  After Consolidation is live, plan/apply `full-course-kanji-extension`
  with vocabulary skipped, then the **37** explicit word IDs
  `full-course-vocabulary-extension-01` through `-37`.
- Expected after all outstanding reviewed batches: **7,647 teaching
  targets / 15,055 core cards**. Scope any missing raw-source import to the
  exact manifest selection; confirm aggregate preservation and full quality
  before reporting a Neon release. Keep the main course DRAFT.

### Extension server receipt: 2026-11-22

- The [kanji plan](https://github.com/wndffs/kanji-app/actions/runs/45053383436)
  and [apply](https://github.com/wndffs/kanji-app/actions/runs/45056616893)
  completed all **200 kanji and seven component cues**. Neon reported
  **1,914 kanji / 4,724 words / 239 components / 6,877 teaching targets /
  13,515 core cards**, with no blockers or warnings and all 18 protected
  groups unchanged. The public API returned 鍵 / かぎ with RU/EN meanings,
  two review cards and 17 licensed strokes, and 氵 as a level-44 component.
- The [word plan](https://github.com/wndffs/kanji-app/actions/runs/45056664564)
  passed 770 words in 37 manifests. The [apply](https://github.com/wndffs/kanji-app/actions/runs/45058354260)
  committed all 37 receipts and preserved all 18 protected groups. The
  final audit initially mistook the secondary Russian meaning of 栓 / せん
  for a placeholder. The corrected [read-only audit](https://github.com/wndffs/kanji-app/actions/runs/45062553288)
  passed with no blockers or warnings, without reapplying any teaching data.
  Public API sample 風呂 / ふろ returned both translations, two cards and an
  attributed JP/kana/RU/EN example.
- Final live totals: **1,914 kanji / 5,494 words / 239 components / 7,647
  teaching targets / 15,055 core review cards**, 50/60 populated levels,
  1,914 licensed stroke sequences and 5,494 eligible bilingual examples.
  The main course remains `DRAFT`; **386 kanji and 2,506 words** are still
  needed on the server.

## Course Finalization, First Block: 2026-11-21

This block adds **160 independently reviewed kanji and 160 words**, with
one reinforced reading and an original JP/kana/RU/EN word example per
kanji. Reviewed totals: **2,074 kanji / 5,654 words / 239 components**
across **54 populated levels**. Remaining to the requested volume:
**226 kanji / 2,346 words** after applying both parts. See the live receipt
below for deployed counts.

- Two independent AI reviewers checked all 160 pairs in two halves, then
  the corrected block matched **160 exact bilingual JMdict pairs, 160
  KANJIDIC2 readings, 160 KanjiVG primary sequences and 432 actual component
  groups**. Retained the existing 補佐, 会う and 穴 identities; used distinct
  reinforcement for 輔, 逢 and 孔. This is not human certification.
- Earlier positions and V1–V7 seals are unchanged. The Finalization payload
  seal is `342325e43f375aa98f40e241bcfdc4547c0049483a3736195ab647740ddc06e4`.
  After Extension and all preceding batches, use an explicit plan/apply for
  `full-course-kanji-finalization` with words skipped, then the **10**
  word IDs `full-course-vocabulary-finalization-01` through `-10`.
- Expected after all pending releases: **7,967 teaching targets / 15,695
  core cards**. Verify actual counts, provenance, and preservation in Neon.
  Main stays DRAFT with no enrollment changes. Keep the next large editorial
  block focused on the remaining coverage and actionable vocabulary.

### Finalization kanji server receipt: 2026-11-22

- The [plan](https://github.com/wndffs/kanji-app/actions/runs/45062553288)
  and [kanji apply](https://github.com/wndffs/kanji-app/actions/runs/45063604678)
  completed the exact 160-kanji manifest. Live coverage: **2,074 kanji /
  5,494 words / 239 components / 7,807 teaching targets / 15,375 core
  cards**, 53/60 populated levels. The audit found zero blockers and
  warnings, and all 18 protected groups matched. The public API returned
  鴎 / かもめ, both translations, two cards and 15 licensed strokes.
- The 160 reinforcement words were not applied. The existing source
  inventory found 55 absent exact pairs in six of ten manifests. The
  remaining reviewed kanji can be applied independently while the main
  course is `DRAFT`; this does not complete vocabulary reinforcement or
  enroll learners in the new levels.

## Kanji Coverage Closure: 2026-11-21

The reviewed registry reaches **2,300 kanji / 5,880 words / 244 components**
across **59 populated levels** by adding **226 kanji, 226 reinforcement words
and five shape cues**. The remaining volume goal is **2,120 words**. The
registry is not a live publication receipt.

- Against pinned KANJIDIC2 grade metadata, the registry includes all **1,026**
  school-grade characters and **2,134 of 2,136** grade 1–8 characters overall.
  Swapped 28 lower-priority candidates before registration to add common
  forms including 角, 逮, 巡, 缶, and both glyphs in 挨拶 and 犠牲. 旺 lacks
  bilingual evidence for the straightforward 旺盛 pair; the ordinary
  曖昧 entry already supports earlier content and was not duplicated.
  The grade audit is not a JLPT vocabulary or test-readiness claim.
- Independent AI editorial review and the pinned snapshot confirmed **226
  KANJIDIC2 readings, 226 KanjiVG primary sequences, 321 component groups and
  229 exact JMdict word readings**. Previous placements and V1–V7 seals are
  unchanged. Closure seal:
  `8cc3dd0ccb72dd0658d9a395c16a98f9a20d2e7adfb540bffa6415202cbd4623`.
- After all preceding releases, plan/apply `full-course-kanji-closure` with
  `skip_words=true`, then explicitly plan/apply the six manifests
  `full-course-vocabulary-closure-01` through `-06`. Expected after all
  outstanding releases through Closure: **8,424 targets / 16,604 core
  cards**. Confirm live counts and preservation separately; keep main
  DRAFT and do not change enrollment or learner progress.

### Kanji coverage server receipt: 2026-11-22

- The [Closure plan](https://github.com/wndffs/kanji-app/actions/runs/45063640156)
  and [kanji apply](https://github.com/wndffs/kanji-app/actions/runs/45066401809)
  completed the final **226 kanji and five component cues**. Neon now has
  **2,300 kanji / 5,494 words / 244 components / 8,038 teaching targets /
  15,832 core cards**, with 58/60 populated levels and 2,300 licensed stroke
  sequences. There were zero blockers and warnings. All 18 protected
  groups were unchanged. The public API returned 錮 / こ with both
  translations, two cards and 16 licensed strokes.
- This meets the kanji count, not the complete-course gate. The main
  course remains `DRAFT`, and **2,506 words** are still needed. The
  Finalization and Closure word manifests still need 122 exact raw pairs
  in total. Where sources already exist, independently reviewed word
  manifests can advance after a live preflight confirms that all their
  kanji and component prerequisites are present. No enrollment changes.

## Supplemental Vocabulary, First Block: 2026-11-21

Adds **700 original RU/EN words and JP/kana/RU/EN examples**, increasing
the reviewed registry to **2,300 kanji / 6,580 words / 244 components**.
The remaining goal is **1,420 words**. This is not a Neon publication.

- Independent AI reviewers checked all 700 cards. **704 exact bilingual
  JMdict pairs** passed, including four alternate readings. New words
  start after all expression and example kanji; a soft load target of 160
  words per level avoids adding to already crowded levels. No previous
  course positions or version seals changed.
- Seal `805745e95225a5295689c1f8bfa2b830f98153d0e411397fb80c58e7904b9104`.
  After Closure and prior blocks succeed, plan and apply the **35**
  explicit `full-course-vocabulary-supplemental-first-01` through `-35`
  manifests, using bounded exact-source supplements where needed.
  Expected after all outstanding releases through this block:
  **9,124 teaching targets / 18,004 core cards**. Verify aggregate
  provenance and preservation before declaring this set live.

## Supplemental Vocabulary, Second Block: 2026-11-21

Adds **710 independently AI-reviewed words and original bilingual
examples**, for **2,300 kanji / 7,290 words / 244 components** in the
reviewed registry. The final word block is **710 words**.

- The pinned snapshot matched **714 exact bilingual JMdict pairs**,
  including four alternate readings. Lessons distinguish related
  forms such as 外見・外観 and 迎え・出迎え. Quoted Japanese examples
  retain the same native quotation marks in both spelling and kana.
- Seal `8cbbc23571b87614ad0552c896d0f904baf7cf0b3dab26af9904319a2aedfe9f`.
  After the first supplement and preceding kanji are live, explicitly
  plan/apply the **33** `full-course-vocabulary-supplemental-second-01`
  through `-33` manifests. Expected after all pending releases through
  this block: **9,834 teaching targets / 19,424 core cards**. Review and
  registry counts do not certify publication or enrollment.

## Reviewed Registry Reaches Both Targets: 2026-11-21

The final block adds **710 independently AI-reviewed words**, resulting in
**2,300 kanji / 8,000 distinct expression–reading word pairs / 244
components** across all **60** levels in the registry. Alternate readings
are not counted as separate words. One historical JMdict ID intentionally
supports separate taught spellings and meanings: 早い (early) and 速い
(fast). This milestone is not database curation or a live learner release.

- The final block matched **714 exact bilingual JMdict pairs** including
  four alternate readings. Fifty of the new words form a level-60
  capstone, including related 休学・休講・休養 and contextual review
  material such as 脈絡, 完璧 and 四捨五入. No previously registered
  placements or V1–V7 seals changed.
- Seal `ed33e355c0a88ba325592fbd3ea2b77c0267db9a0c384f3ec3889c29d2f47a95`.
  After preceding releases, select the **32**
  `full-course-vocabulary-supplemental-third-01` through `-32`
  manifests and `full-course-vocabulary-supplemental-capstone-01`.
  Expected after all outstanding releases: **10,544 teaching targets /
  20,844 core cards**. Read-only preflights and server receipts still
  determine actual publication and preservation.
- Outstanding Neon workflow requires signed-in GitHub write access to
  **Deploy staging curation**. An explicitly selected source supplement
  checks only those reviewed manifests, retaining the existing 100-missing-pair
  safety bound. Verify the actual last applied batches, source readiness,
  public learner flows, all sixty levels, and retained progress before
  declaring completion. No automatic learner version switch or V8.

### Oversized Source-Only Windows

Use only if the normal preflight finds missing exact JMdict pairs. In
**Deploy staging curation**, select explicitly reviewed vocabulary manifests
in `word_batch`, leave `kanji_batch` empty and both checkboxes off:

1. `plan_sources`, with `source_pair_limit` between 1 and 100, checks the
   next bounded window against the pinned snapshot and existing identities
   without writes. The plan prints aggregate counts only.
2. `apply_sources` for the same selection repeats the checks and inserts
   only absent requested pairs, not their unrelated spelling/reading aliases.
   Each window's rows and successful raw-import receipt commit together.
   It does not run teaching curation or switch the course. Repeat only while
   `remainingPairs` is positive; reduce the window if the byte budget fails.
   Existing incomplete provenance is a separate blocker, never repaired here.
3. With no missing pairs, rerun ordinary teaching `plan` for the chosen
   manifests before `apply`. The ordinary preflight independently verifies
   licensed provenance, the prerequisite graph, and RU/EN teaching data.

First reconcile applied manifest checksums and quota before resuming in
registry order. A timed-out job can have committed individual checkpoints.
Use small first releases to measure throughput, and keep V1–V7, enrollments
and study progress intact. Final course publication is separate from raw
sources and curation; recheck admin readiness and server learner flows first.

Use `receipts` in **Deploy staging curation** with the exact kanji and/or
comma-separated word manifest IDs and both checkboxes off. This read-only
mode reports status counts and manifest IDs only. `COMPLETE` requires the
exact authored checksum, its curation source, matching version/file metadata,
and a finished successful run. `MISSING` means no receipt for this exact
revision, not that no rows were ever staged. `PENDING` and `FAILED` may have
partial writes. Resume pending or failed work only after an explicit `plan`;
do not include already completed manifests in the retry. A receipt is neither
a current content quality check nor a learner-course publication result.

Teaching `apply` now rejects a selection containing an exact completed or
inconsistent receipt before database writes. After writing, it requires all
selected receipts to be complete before the corpus and content-quality audit.
Source-only and ordinary plan modes do not perform these write gates.

Apply logs now report committed kanji transactions every 25 items and at
the end of the manifest, plus each fully published word manifest. A kanji
checkpoint does not attest the import receipt; use `receipts` after failure,
timeout, or cancellation. Checkpoints contain counts and manifest IDs only.

Vocabulary preflight reads the selected manifest's existing word items,
exact level slots and authored example ownership in groups. Each word
transaction still rechecks the same placement, ownership and source rules
against fresh database reads. The release bound and word manifest order
are unchanged.

For words with no existing learning item, staging also creates the two
cards, four mnemonics and four hints in groups inside the same word
transaction. Returned card IDs are matched by prompt type, not insert
order. Existing items retain their IDs, source ownership guards and scoped
updates. The manifest still publishes its examples and items atomically.

The workflow's optional `stage_word_pairs` mode applies only explicitly
selected word manifests with no kanji or raw-source writes. It stages up to
two adjacent new items at a time (four only with `stage_word_width: 4`),
each in its own transaction. Existing items are staged sequentially and
manifest order is preserved. A failed group drains before stopping;
already committed draft items may be retained, but
the manifest is not published. Successful exact receipts are rejected before
staging, so a restart cannot withdraw their already-published examples.
Rerun receipts and a plan before resuming.
The default is sequential. Measure a real release before broad use.

`stage_kanji_pairs` is the separate kanji-only option. Components are written
sequentially first; groups contain only new kanji, each rechecking its raw
source, prerequisites and slot. Two is the default width; four requires
explicit `stage_kanji_width: 4`. If a group fails, all its transactions
finish before the run is marked failed. Committed kanji retain their prior
per-item visibility, but the block has no complete receipt. No mode moves an
established main-course placement if it changes after preflight.

The full content-quality CLI prints `courseCoverage` from the same database
snapshot as the quality audit. It reports only aggregate published main-course
targets, core review cards, licensed strokes, eligible word examples, level
counts and remaining volume. Drafts, raw dictionary inventory and items
placed only in pilots do not count. `courseStatus` separately distinguishes
an assembled DRAFT curriculum from a published course open to learners.

Teaching releases also compare fixed learner-data and curriculum groups
before and after apply. Private fingerprints remain on the ephemeral runner
and are not uploaded or printed; output is aggregated into unchanged,
changed and over-limit group counts. Concurrent study activity can change
learner groups, so such a result is inconclusive rather than proof of loss.
Drift in course definitions, level definitions or published memberships
blocks the release verification. The comparison does not attempt rollback.

The final status change uses one full validation inside the serializable
transaction and re-reads the persisted course status. Both response hashes
are regenerated for the published status. This removes a duplicate corpus
scan. Readiness depends on the audited content hash and totals, not the report
timestamp. The full-size Neon execution time is not yet verified.

### Full Registry Source Audit

The pinned 2026-10-31 snapshots independently match **2,300 teaching
readings, 2,300 primary stroke sequences and 8,103 exact bilingual JMdict
pairs**, including accepted alternate readings. One historical reading uses
the separate sense-note proof path, not the exact-pair count.

Of **5,288** component references, **4,974** match exact ink-bearing
groups (including elementary whole signs), **210** are annotated source
variants, **29** match the whole glyph rather than a sub-group, and **75**
historical links have neither kind of direct evidence. Those 75 remain for
editorial review; no old cues, gates, V1–V7 seals, or stored progress were
automatically rewritten. The 226-kanji Closure passed all 321 strict
component checks. This is local source evidence, not a publication receipt.
