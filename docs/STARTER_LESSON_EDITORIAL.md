# Starter lesson editorial

The first release covers the seven existing `starter-demo` materials: two
components, two kanji, two words and one request. It adds nine original
bilingual explanations and two bilingual reference meanings. It does not change
teaching answers, blocked answers, card IDs, course membership or progress.

## Evidence

Two independent AI reviews checked the pinned 2026-10-31
[KANJIDIC2](https://www.edrdg.org/wiki/KANJIDIC_Project.html) and
[JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) data. This is not human
linguistic certification. Only original educational wording is shipped; the
dictionary and its license information stay in the source layer.

- 一 (U+4E00): count いち versus complete words 一つ（ひとつ, JMdict 1160820）
  and 一人（ひとり, 1576150）. Ordinal use is supported by JMdict 1160790 and
  第一（だいいち, 1415270）; it is not an answer on the quantity card.
- 口 (U+53E3): mouth versus an opening people pass through (JMdict 1275640).
  入口（いりぐち, 1582820） and 出口（でぐち, 1338850） illustrate the
  compound use. 一口（ひとくち, 1162370） illustrates a bite or sip.
  囗 (U+56D7) is a different, enclosing component.
- 一つください is an original usage example based on 一つ and
  ください (JMdict 1184270), not a copied dictionary sentence.

## Apply

The starter release was [applied on 2026-11-26](https://github.com/wndffs/kanji-app/actions/runs/45823331608):
seven materials, 18 language-specific hint rows and four reference rows.

On an already seeded database, run
`npm exec -- tsx packages/db/prisma/apply-starter-lesson-editorial.ts plan`.
The plan only reads and prints aggregate counts. The same command with
`apply` checks the exact published slots again and writes atomically.
Repeated application verifies the receipt and does not duplicate texts.

For Neon, use **Deploy staging database** on `main` with only
`starter_editorial` enabled. Leave the seed and rollback fields blank/off.
This mode does not migrate or reseed the database. After a successful run,
check the two open starter lessons and both kanji detail pages without
starting a session or changing progress.

## Early main-course kanji

The follow-up covers 日, 人, 大, 十, 二, 三, 月, 本 and 田. It adds nine
bilingual meaning explanations and nine bilingual reading explanations plus
four bilingual reference pairs. The material explains differences between a
kanji's taught reading and the readings of particular words, including
calendar dates, counters and compound readings. No assessed answer is changed.
Independent reviews matched all nine taught readings and 33 scoped word-pair
checks against the pinned source and existing course. Compositional phrases
were checked as phrases, not counted as dictionary headword matches.

The same transaction runs with `plan foundation` or `apply foundation`.
It additionally verifies the existing level slot, the published item and
the actual primary reading card. The `foundation_editorial` workflow option
requires the published main course and cannot run alongside migration or seed.
The first foundation batch [applied on 2026-11-26](https://github.com/wndffs/kanji-app/actions/runs/45825229127):
nine materials, 36 language-specific hint rows and eight reference rows.

## First main-course component block

`foundation-basics-editorial-01` covers the original 26 components at
level 1 and the ten early kanji 中, 出, 分, 見, 国, 会, 年, 長, 行 and 社.
It adds 46 bilingual explanations and five bilingual reference pairs. The
component notes explain recognition and visual contrasts, not historical
etymology. The kanji notes distinguish the card's reading from the reading of
actual words. Assessment, prerequisites, level placements and SRS stay intact.

Shapes were checked against the pinned
[KanjiVG](https://kanjivg.tagaini.net/svg-format.html) geometry/group data.
Readings and sense boundaries were checked against the same 2026-10-31
[JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) and KANJIDIC2 snapshot.
Only the project's new explanations and teaching labels go into the release.

Use `plan foundation-basics` and `apply foundation-basics` with the same
command. **Deploy staging database** accepts an explicit `editorial_batch`
name on `main` or a `publish-lesson-editorial-<exact registered version>`
tag on the current `main` commit. The editor rejects unknown versions,
validates the existing published slots and taught readings in a read-only
plan, then applies only that package in a serializable transaction. Editorial
and migration/seed modes are mutually exclusive.
Use the same exact version with `-attempt-2` through `-attempt-5` when a
new attempt is required without moving the original tag. The resulting
receipt still identifies the same editorial payload. The CLI retries only
read-only connection failures (`P1001`), not writes or failed scope checks.

## Completing the first two levels

The next two reviewed main-course releases finish the 84 remaining
level-one shapes and the 32 remaining level-two kanji:

| Batch                   | Existing slots                            | Bilingual notes | Reference pairs | Apply receipt                                                                  |
| ----------------------- | ----------------------------------------- | --------------: | --------------: | ------------------------------------------------------------------------------ |
| `foundation-components` | Level 1 slots 27–63; level 2 slots 8–20   |              63 |               2 | [GitHub Actions](https://github.com/wndffs/kanji-app/actions/runs/45883505031) |
| `foundation-completion` | Level 1 slots 64–110; level 2 slots 22–40 |              85 |              10 | [GitHub Actions](https://github.com/wndffs/kanji-app/actions/runs/45884225557) |

Every component note points to an existing shape in a specific curriculum
source batch. The shape examples were reviewed against KanjiVG and distinguish
exact forms, positional variants and visual comparisons. The 32 kanji target
readings and the examples were reviewed against the local pinned KANJIDIC2
and JMdict data. Extra senses such as 金 “money” or 両 as a counter for
railcars are references, not global accepted answers. 一 already has the
bilingual starter explanation on its shared learning item.

## Continuing through levels 3 and 4

The follow-up at level 3 covers all 34 previously unedited kanji; six
kanji already have bilingual editorial notes from the starter and first
foundation releases. It adds 68 original bilingual notes and nine
bilingual reference pairs. The [publication receipt](https://github.com/wndffs/kanji-app/actions/runs/45885727338)
contains aggregate counts only.

The next level-4 block covers 34 kanji, leaving the notes on the seven
already edited materials intact. It keeps the exact curriculum readings,
including 夕・せき and 糸・し, with attested examples and more common
standalone readings clearly separated. None of these releases changes any
teaching answer, course placement or SRS state.
The [level-4 publication receipt](https://github.com/wndffs/kanji-app/actions/runs/45886952068)
records 34 matched items, 136 language-specific hint rows and 16
reference rows.

## Levels 5 and 6

The [level-5 release](https://github.com/wndffs/kanji-app/actions/runs/45888041973)
covers all 40 kanji in curriculum order, with 80 bilingual notes and eight
bilingual reference meanings. The new examples distinguish readings in
words such as 治療 and 政治. The level-6 release continues with 40 kanji,
including the existing standalone readings of 神, 命 and 松. Both releases
skip vocabulary and other material in the same level; they do not replace
existing cards or introduce new accepted answers.
The [level-6 publication receipt](https://github.com/wndffs/kanji-app/actions/runs/45889020237)
records 40 matches, 160 language-specific hint rows and 14 reference rows.

## Levels 7 and 8

The [level-7 release](https://github.com/wndffs/kanji-app/actions/runs/45890033458)
adds 80 bilingual notes and nine reference pairs to all 40 existing kanji.
It distinguishes everyday readings from compounds such as 新聞, 列島 and
奥義. The next release applies the same review to all 40 level-8 kanji,
including the variant readings illustrated by 省略 and 反省, 規模 and
模型, or 生存 and 存在. The content applies only to the exact kanji
placements in the existing course.
The [level-8 publication receipt](https://github.com/wndffs/kanji-app/actions/runs/45890989501)
records 40 matches, 160 language-specific hint rows and six reference rows.

## Levels 9 and 10

The [level-9 release](https://github.com/wndffs/kanji-app/actions/runs/45891917428)
adds new meaning and reading notes to all 40 kanji. It distinguishes
everyday family terms from compound readings such as 兄 in 実兄 and
keeps 何 in 幾何学 apart from the kana particle in 何か.
The level-10 release continues the same editorial scope for all 40
kanji. Contextual senses, such as forgiveness in 許す and an idea
coming to mind in 浮かぶ, remain reference-only.
The [level-10 publication receipt](https://github.com/wndffs/kanji-app/actions/runs/45892778880)
records 40 matches, 160 language-specific hints and eight reference rows.

## Levels 11 and 12

The [level-11 release](https://github.com/wndffs/kanji-app/actions/runs/45893923297)
covers 40 kanji, including the overlap and difference
between かく and えがく in 描く, and the distinction between the reading of
同伴 and that of 伴奏. Contextual senses are not added to grading.
The [level-12 release](https://github.com/wndffs/kanji-app/actions/runs/45894561499)
adds the same bilingual coverage to its 40 kanji, including concrete
reading examples for 甘, 詰, 津 and 甲.

## Level 13 and cumulative coverage

The level-13 release adds notes for its 40 kanji, including separate senses
for 御 in 制御 and 御飯, and context-specific readings of 旬. With the
earlier starter and foundation notes, the editorial coverage is now complete
for level 1 components and for all existing kanji at levels 2–13. New
examples are project-authored and reviewed against the pinned sources.
This is lesson text and reference coverage, not a change in course size,
grading, or which levels a learner has unlocked.
