# Curriculum design

## Two modes

### Structured levels

A curated course from beginner through approximately N2.

Rules:

- Components unlock kanji.
- Kanji unlock vocabulary.
- Vocabulary unlocks sentence cards.
- A level is complete when a required percentage of its core cards reaches the configured threshold.
- Do not copy WaniKani level order.

### Dynamic decks / text mining

The user pastes Japanese text. The app tokenizes it, identifies known/unknown words and kanji, and creates a deck with prerequisites.

When dictionary words overlap in the source, the deck keeps the longest match
at the earliest position instead of treating every nested substring as a
separate vocabulary item. Frequency and stable ids break equal-span ties.

Rules:

- Prefer high-value unknown words from the text.
- Include prerequisite kanji/components when useful.
- Prefer i+1 sentences when possible.
- The deck must not break structured-course progress.

An owned active deck can feed the same small-batch lesson and required-quiz
flow as the structured course. Existing SRS state is shared: already started
items are omitted, prerequisites must reach their configured stages, and newly
passed deck items create normal SRS cards without changing course ordering.

## N5 -> N2 path

Implementation should not require all N2 content at MVP. Design schema and UI for these course bands:

- Foundation: kana, basic components, first kanji, survival vocabulary.
- N5: basic kanji/vocab/sentences.
- N4: everyday vocabulary and more readings.
- N3: mixed readings, abstract words, longer sentences.
- N2: higher-frequency written vocabulary, compounds, reading-focused practice.

Each curated course, course level, and learning item can be assigned to one of these bands. Imported
dictionary or sentence candidates stay import-derived until an admin promotes the target into a curated
learning item with a band, title, and optional level hint.

Publication and course placement are separate editorial steps. A published
learning item can be placed at one level in each structured or demo course; a
new placement is appended after the current level contents. Draft,
needs-review, archived, and stale linked items are excluded from learner lesson
availability and course progress.

Published structured-course content must pass quality gates:

- every card has at least one accepted answer;
- meaning cards have Russian and English accepted answers;
- the target has Russian and English learning meanings/translations;
- Russian and English mnemonic or note content is present;
- source attribution or project authorship is traceable;
- non-component items have valid prerequisite dependencies, and prerequisites are published.

The admin curriculum completeness report summarizes these gaps by band so expansion work can move
from Foundation through N2 without requiring the full corpus upfront.

## Course scale target

The structured course target is 2,300 unique kanji and 8,000 unique vocabulary
items, where a vocabulary item is one `Word` expression-and-reading pair. This
exceeds WaniKani's advertised 2,000+ kanji and 6,000+ vocabulary scale while
keeping an independent order and independent educational text. Full KANJIDIC2
and JMdict imports are only candidate dictionaries; imported rows do not count
toward this target until a published `LearningItem`, cards, bilingual curated
meanings, and prerequisites exist.

The main course shell contains 60 project-owned levels. Their initial band
allocation is Foundation 1-5, N5 6-15, N4 16-27, N3 28-43, and N2 44-60. These
boundaries are planning capacity, not copied JLPT lists or another product's
level order. The course is seeded as `DRAFT`; it remains separate from the
published demo course until enough prerequisite-safe content has been placed
and the enrollment transition is explicitly approved.

The declarative blueprint owns course and level metadata only. Re-running the
seed updates those fields without deleting `CourseLevelItem` placements and
without changing an existing course status, so editorial work survives deploys.

The admin scale-readiness report keeps this distinction measurable. It reports
the remaining publication gap, work already in curation, unassigned imported
candidate capacity, and the raw candidates' RU/EN, reading, and stroke-data
coverage. It does not promote or publish dictionary rows automatically.

The candidate plan uses a project-owned, versioned ordering policy rather than
another product's levels. It ranks kanji and words from source metadata, then
admits a word only when every kanji in its written form is already active or
selected by the same plan. The plan is paginated editorial input, not an
automatic curriculum or a substitute for bilingual curation.

Pagination is bound to an opaque database-derived plan version. This prevents
an import or editorial update from silently shifting later pages while an
admin is inspecting the shortlist. Expired versions require a fresh first
page; they never fall back to a differently ordered plan.

Each planned target can be inspected on demand without expanding the planning
response or relying on the older top-100 candidate queue. The detail read keeps
all imported Russian and English meanings and readings visible alongside the
exact source record and import checksum. This remains raw editorial evidence;
it does not create cards or turn imported wording into project-authored course
content.

A missing imported Russian or English gloss is a curation gap, not a reason to
discard an otherwise valid source target. An admin may author the missing
locale while approving the candidate, but both reviewed learning meanings and
both accepted-answer sets remain mandatory. Those additions are stored only in
the project-authored layer and do not modify or mislabel the imported record.
Imported readings are evidence rather than accepted course answers. The admin
reviews a primary reading and any additional accepted readings explicitly;
only that ordered, normalized set becomes project-authored reading-card data.
Prerequisite curation follows the same explicit boundary. The admin workspace
suggests published component items linked to a kanji and published kanji found
in a word's orthography, but does not create links until the editor selects and
saves them. Unpublished or unrelated targets cannot become new prerequisites;
an optional positive stage threshold controls when the dependent item unlocks.

An admin may stage a selected subset of one bounded page from a retained
candidate-plan snapshot into the curation queue. The server verifies every
target against that exact plan and uses its suggested band, while a database
uniqueness constraint makes retries idempotent and preserves any existing
editorial work. Staging creates only `needs-review` learning items. Bilingual
meanings, accepted answers, reading cards, mnemonics, dependencies, levels, and
publication still require the normal explicit curation workflow.

The admin planning workspace exposes this staging operation for selected
candidates on the currently visible page only. A new page starts fully selected
for fast batch work, while page-level and row-level checkboxes allow a precise
subset. Confirmation is bound to the exact page and selected target ids, keeps
keyboard focus inside the dialog, reports created and previously queued counts,
and loads a fresh first page after success. If the retained plan version
expires, the UI refreshes the shortlist and asks the admin to confirm the new
selection rather than silently submitting changed candidates.

The resulting editorial queue is cursor-paginated rather than capped at the
first 50 rows. Pages preserve the active quality filters, use a deterministic
updated-time and id order, and open the first material when the admin moves
forward or back. Staging a candidate-plan page refreshes the queue from its
first page immediately, so newly created review work is actionable without a
full browser reload.

Saving item content, publication status, or card answers also reconciles the
queue against its current filters. The workspace restarts from the first page,
keeps the saved item open when it still matches, and otherwise advances to the
next matching item or a clear empty state. Completeness and candidate-plan data
refresh with the decision. A failed post-save refresh is reported separately
from the already successful mutation so retrying cannot accidentally duplicate
editorial work.

An imported kanji or word can be rejected without manufacturing an archived
course item. The reversible rejection records a constrained reason, optional
note, timestamp, and admin user, then removes the target from ranked candidate
lists, scale capacity, and newly generated plans. Reject and restore decisions
change the plan version. A stale retained plan remains inspectable but cannot
stage, promote, or approve a target that is currently rejected.
The admin workspace exposes this decision through a destructive confirmation
dialog and shows the current dictionary label rather than an opaque target id.
The label and reading are resolved when the rejection list is read; they are not
duplicated into the audit record. Restoring a target removes only the rejection
decision and immediately recalculates the visible candidate queues and plan.

Candidate-plan search runs against the complete retained plan snapshot before
pagination, rather than filtering only the visible page. It matches Japanese
writing, normalized hiragana/katakana readings, and exact source target ids.
Search does not recalculate or reorder the curriculum: original selection ranks,
the plan version, prerequisite decisions, and summary counts remain stable. A
filtered page can therefore be inspected or staged under the same stale-plan
and rejection protections as an unfiltered page.
The same snapshot can be narrowed by one course band and one coverage state:
bilingual RU/EN, missing Russian, missing English, missing reading, or missing
kanji stroke data. Coverage filters use the plan's existing source facts and do
not treat word rows, where stroke data are not applicable, as missing stroke
data. Search, band, and coverage combine before pagination and remain part of
the confirmed page identity used for staging.

## Main lesson flow

Component, kanji, vocabulary, and sentence lessons use small groups of at most
five new items. The learner studies every item in the group before retrieval
begins. The required quiz then asks every meaning and reading card independently.
The browser derives a deterministic item and card order from the lesson session
id, separating retrieval order from presentation order while keeping reloads
stable. The original curriculum and selected lesson order are not mutated.
Within an item, the web flow presents only non-empty stages in the order meaning,
reading, and context. The learner can revisit stages before continuing; context
contains curated or private story and usage guidance plus attributed examples
when available.

The ordered lesson group, current item, and current stage are stored in the
server-side lesson session so a reload can resume safely. Quiz answer drafts are
deliberately not persisted; retrieval restarts from the first card of the
current item after a reload.

The learner may explicitly end an unfinished lesson. This closes the server
session without rolling back cards that already entered SRS; selected items that
were not completed remain available under the normal prerequisite and daily
limit rules.

Before starting, the learner may replace the recommended items with any other
currently eligible materials, up to the five-item batch limit. The course-order
mode preserves curriculum order. The interleaved mode alternates selected item
types while preserving order within each type. Selection never exposes or
unlocks materials whose prerequisites are unsatisfied.

The API, rather than the browser, validates each answer against global accepted
answers, private user answers, and blocked answers. The learner confirms the
result before continuing. Accepted cards leave the pending queue; failed cards
reveal the accepted Russian and/or English answers for the user's display mode
and return behind the remaining cards. An item enters the interval-based SRS
only after all of its
lesson cards pass; incomplete or failed attempts create no SRS progress.

For kanji reading cards, a rejected answer is also compared with the kanji's
other dictionary readings. An exact normalized match is explained as another
valid reading rather than a generic error. The learner retries the same card
without an SRS penalty or a recorded mistake. KANJIDIC2 dotted kunyomi can match
either their stem or full reading for this diagnostic only.

## Kana curriculum

Kana is a separate character-learning track and does not use `LearningCard` or
the interval-based SRS for components, kanji, vocabulary, and sentences.

The shared core contains 104 independent learning characters or combinations
per script:

- 46 modern basic characters;
- 20 voiced variants with dakuten;
- 5 semi-voiced variants with handakuten;
- 33 standard yoon combinations with small `ゃ`, `ゅ`, or `ょ`.

The track then teaches orthographic sound patterns as separate targets:

- 4 representative sokuon patterns per script, using small `っ` or `ッ` to
  double the following consonant;
- 7 hiragana long-vowel spellings: repeated vowels plus `えい` and `おう`;
- 5 katakana long-vowel spellings using the prolonged sound mark `ー`.

This produces 115 hiragana targets and 113 katakana targets. The counts differ
because the scripts express long vowels differently.

Modified sounds are separate units: for example, `ひ` (`hi`), `び` (`bi`), and
`ぴ` (`pi`) keep independent progress. Hiragana and katakana progress is also
independent. Yoon combinations such as `きゃ` (`kya`) and `しゃ` (`sha`) also
keep their own progress instead of inheriting mastery from their base symbol.

The character track is split into sequential row lessons. A lesson first shows
the character and its reading, then rotates six retrieval formats: typed
romaji, character-to-reading choice, reading-to-character choice, a three-pair
matching board, browser-generated Japanese listening, and stroke-order tracing
for single kana glyphs. Tracing checks stroke order, direction, endpoints, and
path proximity against KanjiVG guides. Combined targets continue to use the
other exercise formats.

Listening uses a context pair such as `かっか` for a leading sokuon target so
the doubled consonant is pronounceable. If speech synthesis or a tracing guide
is unavailable, the remaining formats continue without blocking the lesson.

Choice sets exclude duplicate readings so equivalent targets such as `じ` and
`ぢ` cannot create an ambiguous question. Every pair or answer is checked by the
API and affects the corresponding target's progress.

Three correct answers complete a target; completion is permanent, while the
current streak can still reset after a wrong answer. The free assessment remains
a separate mode for learners who already know some kana and can complete earlier
lessons.

## Lesson flow

1. Explain item.
2. Show components/relations.
3. Show readings and meanings in Russian, English, or Russian plus English according to user settings.
4. Show mnemonic/hint.
5. Mini-quiz.
6. Add cards to SRS.
