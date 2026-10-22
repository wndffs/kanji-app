import { Prisma } from "@prisma/client";

export type PublishedItemSearch = {
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
  // POSITION treats %, _ and backslashes literally; every user value stays bound.
  const rows = await db.$queryRaw<{ ids: string[]; total: bigint }[]>(Prisma.sql`
    WITH matched AS (
      SELECT li.id, li.kind, li.title, li."levelHint"
      FROM "LearningItem" li
      WHERE li.status = 'PUBLISHED' AND (
        POSITION(LOWER(${query}) IN LOWER(li.title)) > 0
        OR EXISTS (
          SELECT 1 FROM "LearningAnswer" a JOIN "LearningCard" c ON c.id = a."learningCardId"
          WHERE c."learningItemId" = li.id AND a."sourceKind" <> 'USER_PRIVATE'
            AND POSITION(LOWER(${query}) IN LOWER(a.text)) > 0
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
          OR EXISTS (SELECT 1 FROM "KanjiReading" r WHERE r."kanjiId" = li."targetId" AND POSITION(${query} IN r.reading) > 0)
          OR EXISTS (SELECT 1 FROM "KanjiMeaning" m WHERE m."kanjiId" = li."targetId" AND POSITION(LOWER(${query}) IN LOWER(m.meaning)) > 0)
        ))
        OR (li."targetType" = 'WORD' AND (
          EXISTS (SELECT 1 FROM "Word" t WHERE t.id = li."targetId" AND (
            POSITION(${query} IN t.expression) > 0 OR POSITION(${query} IN t.reading) > 0
          ))
          OR EXISTS (SELECT 1 FROM "WordSense" m WHERE m."wordId" = li."targetId" AND POSITION(LOWER(${query}) IN LOWER(m.meaning)) > 0)
        ))
        OR (li."targetType" = 'SENTENCE' AND EXISTS (
          SELECT 1 FROM "Sentence" t WHERE t.id = li."targetId" AND (
            POSITION(${query} IN t."japaneseText") > 0 OR POSITION(${query} IN t."readingText") > 0
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
