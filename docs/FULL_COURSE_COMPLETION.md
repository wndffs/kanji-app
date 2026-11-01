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

- The lesson picker cannot select beyond the daily-limit slice used to build
  its catalogue. Add bounded server pagination (24 default, 48 maximum), not
  an unbounded rich teaching payload or a different hidden hard cap. Daily
  admission and prerequisite checks remain authoritative at session start.
- Learner-facing reveal/manual-ignore and reviewed-answer recovery are not
  complete just because API flags exist. Define audited, explicit recovery;
  never silently reverse a penalty on a synonym save.
- A capped private deck needs an actionable route to omitted prerequisites;
  a warning and a permanently empty lesson queue are not a complete study path.
- Text selection needs progress-aware unknown-material/prerequisite priority
  before applying caps, not merely a started-state label after truncation.
- Burned-item practice exists, but explicit card-scoped resurrection is not
  connected to the learner workflow.
- Leeches are identified, but selecting those exact cards into resumable
  non-SRS practice is not complete.
- Item/search headings can prefer an accepted synonym over the authored primary
  meaning (observed for 安心). Align read-side primary selection without removing
  valid synonyms or rewriting users' accepted answers.
- The current serial curation path is not yet performance-verified at 2,300/8,000.
  Batch database I/O while preserving complete source/graph checks, idempotency
  and private data. Removing a duplicate workflow preflight is not proof that
  importing the entire teaching corpus will fit one execution window.

These findings are from code inspection, not a fresh exhaustive live UX audit.
They are not described as fixed by this content-focused change.

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
