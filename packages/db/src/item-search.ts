import { Prisma } from "@prisma/client";
import { ITEM_KINDS, type SearchFilters } from "@kanji-srs/shared";
import { normalizeKanaSearchReading } from "@kanji-srs/japanese";

const KATAKANA = Array.from({ length: 0x30f6 - 0x30a1 + 1 }, (_, index) => String.fromCodePoint(0x30a1 + index)).join("");
const HIRAGANA = Array.from(KATAKANA, (character) => String.fromCodePoint(character.codePointAt(0)! - 0x60)).join("");

export type PublishedItemSearch = SearchFilters & {
  readonly query: string;
  readonly page: number;
  readonly limit: number;
};

export async function findPublishedItemSearchPage(
  db: Pick<Prisma.TransactionClient, "$queryRaw">,
  params: PublishedItemSearch,
): Promise<{ readonly ids: readonly string[]; readonly total: number }> {
  const { query, page, limit } = params;
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000 || !Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new Error("Invalid search page bounds.");
  const offset = (page - 1) * limit;
  if (params.itemType !== undefined && !ITEM_KINDS.includes(params.itemType)) throw new Error("Invalid search item type.");
  if (params.level !== undefined && (!Number.isInteger(params.level) || params.level < 1 || params.level > 60)) throw new Error("Invalid search level.");
  const kindFilter = params.itemType === undefined ? Prisma.empty : Prisma.sql`AND li.kind = ${params.itemType.toUpperCase()}::"LearningItemKind"`;
  const levelFilter = params.level === undefined ? Prisma.empty : Prisma.sql`AND li."levelHint" = ${params.level}`;
  const kana = normalizeKanaSearchReading(query);
  const readingMatch = (column: Prisma.Sql) => kana === null ? Prisma.sql`FALSE` : Prisma.sql`POSITION(${kana} IN TRANSLATE(${column}, ${KATAKANA}, ${HIRAGANA})) > 0`;
  // POSITION treats %, _ and backslashes literally; every user value stays bound.
  const rows = await db.$queryRaw<{ ids: string[]; total: bigint }[]>(Prisma.sql`
    WITH matched AS (
      SELECT li.id, li.kind, li.title, li."levelHint"
      FROM "LearningItem" li
      WHERE li.status = 'PUBLISHED' ${kindFilter} ${levelFilter} AND (
        POSITION(LOWER(${query}) IN LOWER(li.title)) > 0
        OR EXISTS (
          SELECT 1 FROM "LearningAnswer" a JOIN "LearningCard" c ON c.id = a."learningCardId"
          WHERE c."learningItemId" = li.id AND a."sourceKind" <> 'USER_PRIVATE'
            AND (POSITION(LOWER(${query}) IN LOWER(a.text)) > 0
              OR (a."answerKind" = 'READING' AND ${readingMatch(Prisma.sql`a.text`)}))
        )
        OR (li."targetType" = 'COMPONENT' AND EXISTS (
          SELECT 1 FROM "Component" t WHERE t.id = li."targetId" AND (
            POSITION(LOWER(${query}) IN LOWER(t.symbol)) > 0
            OR POSITION(LOWER(${query}) IN LOWER(t."displayNameRu")) > 0
            OR POSITION(LOWER(${query}) IN LOWER(t."displayNameEn")) > 0
            OR POSITION(LOWER(${query}) IN LOWER(t."meaningRu")) > 0
            OR POSITION(LOWER(${query}) IN LOWER(t."meaningEn")) > 0
            OR POSITION(LOWER(${query}) IN LOWER(t."shapeDescriptionRu")) > 0
            OR POSITION(LOWER(${query}) IN LOWER(t."shapeDescriptionEn")) > 0
          )
        ))
        OR (li."targetType" = 'KANJI' AND (
          EXISTS (SELECT 1 FROM "Kanji" t WHERE t.id = li."targetId" AND POSITION(${query} IN t.character) > 0)
          OR EXISTS (SELECT 1 FROM "KanjiReading" r WHERE r."kanjiId" = li."targetId" AND (POSITION(${query} IN r.reading) > 0 OR ${readingMatch(Prisma.sql`r.reading`)}))
          OR EXISTS (SELECT 1 FROM "KanjiMeaning" m WHERE m."kanjiId" = li."targetId" AND POSITION(LOWER(${query}) IN LOWER(m.meaning)) > 0)
        ))
        OR (li."targetType" = 'WORD' AND (
          EXISTS (SELECT 1 FROM "Word" t WHERE t.id = li."targetId" AND (
            POSITION(${query} IN t.expression) > 0 OR POSITION(${query} IN t.reading) > 0 OR ${readingMatch(Prisma.sql`t.reading`)}
          ))
          OR EXISTS (SELECT 1 FROM "WordSense" m WHERE m."wordId" = li."targetId" AND POSITION(LOWER(${query}) IN LOWER(m.meaning)) > 0)
        ))
        OR (li."targetType" = 'SENTENCE' AND EXISTS (
          SELECT 1 FROM "Sentence" t WHERE t.id = li."targetId" AND (
            POSITION(${query} IN t."japaneseText") > 0 OR POSITION(${query} IN t."readingText") > 0 OR ${readingMatch(Prisma.sql`t."readingText"`)}
            OR POSITION(LOWER(${query}) IN LOWER(t."translationRu")) > 0
            OR POSITION(LOWER(${query}) IN LOWER(t."translationEn")) > 0
          )
        ))
      )
    )
    SELECT (SELECT COUNT(*) FROM matched) AS total,
      ARRAY(SELECT id FROM matched ORDER BY "levelHint" ASC NULLS LAST, kind, title, id
        LIMIT ${limit} OFFSET ${offset}) AS ids
  `);
  const row = rows[0];
  return { ids: row?.ids ?? [], total: Number(row?.total ?? 0) };
}
