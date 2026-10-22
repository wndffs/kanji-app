# Foundation Word Batch 03

This bounded Task127 candidate extends the registry in
`packages/db/src/main-course-word-content.ts`. The approved first-two-batch
operator reference remains `docs/WORD_CURATION.md`; it is not changed here.

`task-127-foundation-words-03@1` is AI-authored on 2026-10-22 and has
`reviewedAt: "2026-10-22"` after independent parent-agent content/source review.
Its SHA-256 is `ef7090a4cea8c4b74c04a3cebfe85dc9832d64e1b7d071e409232287e7cf2ff4`.
It contains twenty word items at Foundation level 5 slots 41-60,
forty meaning/reading cards and twenty original JP/kana/RU/EN examples. Each
word has original Russian/English meanings, meaning/reading mnemonics and hints.
There are no new sentence cards, raw dictionary rows or runtime dependencies.

## Source Resolution And Legacy Repair

All twenty exact spelling/reading pairs were checked against successful licensed
bilingual imported JMdict evidence in Neon. No guessed entry IDs remain; zero and
leading-zero IDs are rejected by manifest validation. The source's compact import
profile retains exact pairs and imported RU/EN senses on Word/WordSense rather
than duplicate raw gloss text. Full source/license/checksum preflight is mandatory.

The check found legacy 口/くち still using `starter:word:word-kuchi` despite its
linked successful `jmdict:1275640` record. Migration
`20261022190000_reconcile_starter_word_source_id` repairs only that exact legacy
identity with matching linked record/sequence, successful versioned checksummed
import, open attributed license and both imported locales. It does not change
target/card IDs, raw records, meanings, answers, private data or SRS states.
Seed no longer overwrites an existing word's dictionary ID. Real PostgreSQL run
[39813027818](https://github.com/wndffs/kanji-app/actions/runs/39813027818) passed
42 tests, including 30 positive/negative repair cases and idempotence. The first
test attempt exposed a temporary-table prepared-plan collision; its query was
fixed without changing the migration's acceptance guards.

Database run 39813849264 applied the migration without starter seed. Read-only
checks confirmed the same word/card IDs and unchanged answer digest, with no
SRS/private override rows on those two word cards. The curator has no legacy-ID
bypass. Curation run 39814286342 then applied only word03 successfully; its full
174-item main-course quality report has zero blockers/warnings. See
`TASK_118_PUBLICATION_STATUS.md` for hashes, import identity and exact counts.

The table lists direct word prerequisites and the full union needed by the word
plus its original example. Every listed kanji is registered at an earlier level
2-4. Kanji04 was independently reviewed and applied by run 39810338839, with zero
quality blockers/warnings. All word/example prerequisites remain mandatory.

| Slot | Exact Spelling | Exact Reading  | Primary RU             | Primary EN                | Word Kanji | Word + Example Kanji |
| ---- | -------------- | -------------- | ---------------------- | ------------------------- | ---------- | -------------------- |
| 41   | 口             | くち           | рот                    | mouth                     | 口         | 口                   |
| 42   | 目             | め             | глаз                   | eye                       | 目         | 目                   |
| 43   | 耳             | みみ           | ухо                    | ear                       | 耳         | 耳 雨                |
| 44   | 手             | て             | рука                   | hand                      | 手         | 手                   |
| 45   | 足             | あし           | нога                   | foot                      | 足         | 足                   |
| 46   | 雨             | あめ           | дождь                  | rain                      | 雨         | 雨                   |
| 47   | 空             | そら           | небо                   | sky                       | 空         | 空 月 出             |
| 48   | 天気           | てんき         | погода                 | weather                   | 天 気      | 天 気 山 行          |
| 49   | 空気           | くうき         | воздух                 | air                       | 空 気      | 空 気 山             |
| 50   | 先生           | せんせい       | учитель                | teacher                   | 先 生      | 先 生 本             |
| 51   | 学生           | がくせい       | студент                | student                   | 学 生      | 学 生 本             |
| 52   | 大学           | だいがく       | университет            | university                | 大 学      | 大 学 川             |
| 53   | 大学生         | だいがくせい   | студент университета   | university student        | 大 学 生   | 大 学 生 人          |
| 54   | 小学生         | しょうがくせい | ученик начальной школы | elementary school student | 小 学 生   | 小 学 生 手          |
| 55   | 一年生         | いちねんせい   | первоклассник          | first-year student        | 一 年 生   | 一 年 生 本          |
| 56   | 文学           | ぶんがく       | литература             | literature                | 文 学      | 文 学 大 日 本       |
| 57   | 四月           | しがつ         | апрель                 | April                     | 四 月      | 四 月 大 学 行       |
| 58   | 五月           | ごがつ         | май                    | May                       | 五 月      | 五 月 山             |
| 59   | 出口           | でぐち         | выход                  | exit                      | 出 口      | 出 口 右             |
| 60   | 人口           | じんこう       | население              | population                | 人 口      | 人 口 国             |

## Teaching And Gate Boundaries

These are scoped learning meanings, not imported dictionary gloss dumps. For
example 空/そら teaches sky, not empty; 空気 teaches physical air; 四月 and
五月 teach calendar months, not durations. 小学生 requires elementary-school
scope, whereas 一年生 accepts both a first grader and a first-year college
student. No alternate reading is asserted or added to an existing card.
All new reading cards have just the manifest's exact primary reading.

The approved word01/02 objects and fixed checksums are unchanged. The finite
pilot continues to use `buildMainCourseWordBatch()` (word01), not the growing
registry, and its pinned kanji01/02 inputs are unchanged. This candidate does
not enroll users, extend the pilot or complete Task127.

Existing curator behavior is retained: all registered manifests are preflighted
before writes, default application skips unreviewed batches, and explicitly
selected pending application fails before database access. Consequently an
unresolved pending source can block default-all or even an approved selected
application at full-registry preflight. Do not confuse pending selection's
early review rejection with source acceptance. Tests use synthetic source and
published-kanji fixtures, never live provenance evidence.

Original educational copy is project-authored. Future source evidence remains
in the licensed JMdict imported layer with its existing attribution/import-run
tracking; no proprietary content or new network dataset is used here.
