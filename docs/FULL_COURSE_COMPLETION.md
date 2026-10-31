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
Until a server receipt confirms application, live totals remain the previous
117 kanji / 180 word pairs. Additive curation can publish verified library items
while `japanese-ru-n2` remains DRAFT; that does not make the larger curriculum
available in lessons or enlarge the finite V7 course. Preserve existing accounts,
SRS, private content, enrollments and old course identities during application.

The single task stays OPEN: **2,038 further kanji and 7,740 further word pairs**
still need complete teaching and review, in addition to the functional gaps
above. Do not equate completing this block with completing the 2,300/8,000 app.
