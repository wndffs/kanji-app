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
