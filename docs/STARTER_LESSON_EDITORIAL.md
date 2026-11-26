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
