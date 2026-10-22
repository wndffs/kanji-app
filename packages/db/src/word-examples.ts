import { Prisma } from "@prisma/client";
import { type SentenceDto } from "@kanji-srs/shared";

export const WORD_EXAMPLE_BATCH_SIZE = 100;
// The same conservative HTTPS syntax is evaluated by JavaScript and PostgreSQL.
const SOURCE_URL_PATTERN =
  "^https://[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*(:443)?([/?#][^\\s]*)?$";

export const EXAMPLE_SENTENCE_SELECT = {
  id: true,
  japaneseText: true,
  readingText: true,
  translationRu: true,
  translationEn: true,
  difficulty: true,
  sourceId: true,
  importedRecordId: true,
  dataSourceId: true,
  licenseId: true,
  license: { select: { id: true, name: true, scope: true } },
  dataSource: {
    select: {
      id: true,
      name: true,
      licenseId: true,
      homepageUrl: true,
      downloadUrl: true,
      attributionText: true,
    },
  },
  importedRecord: {
    select: {
      id: true,
      sourceRecordId: true,
      recordType: true,
      importRun: {
        select: { dataSourceId: true, status: true, sourceVersion: true, checksumSha256: true },
      },
    },
  },
} as const satisfies Prisma.SentenceSelect;

export type ExampleSentenceRecord = Prisma.SentenceGetPayload<{
  select: typeof EXAMPLE_SENTENCE_SELECT;
}>;
export type ExampleItemRef = {
  readonly id: string;
  readonly targetType: string;
  readonly targetId: string;
};
export type WordExampleQuality = {
  readonly hasExample: boolean;
  readonly invalidExampleCount: number;
  readonly fingerprint: string;
};
type ExampleReader = Pick<Prisma.TransactionClient, "$queryRaw" | "sentence">;

export function isEligibleExampleSentence(sentence: ExampleSentenceRecord): boolean {
  const ds = sentence.dataSource;
  if (
    !nonempty(sentence.japaneseText) ||
    !nonempty(sentence.translationRu) ||
    !nonempty(sentence.translationEn) ||
    !nonempty(sentence.license.name) ||
    sentence.license.scope === "USER_PRIVATE" ||
    ds === null ||
    ds.id !== sentence.dataSourceId ||
    ds.licenseId !== sentence.licenseId ||
    sentence.license.id !== sentence.licenseId ||
    !nonempty(ds.name) ||
    !nonempty(ds.attributionText) ||
    exampleSourceUrl(ds) === null
  )
    return false;
  if (sentence.importedRecordId === null) {
    return sentence.importedRecord === null && sentence.license.scope === "PROJECT_AUTHORED";
  }
  const record = sentence.importedRecord;
  return (
    record !== null &&
    record.id === sentence.importedRecordId &&
    ((record.recordType === "TATOEBA_SENTENCE" && sentence.license.scope === "OPEN_DATA") ||
      (record.recordType === "PROJECT_AUTHORED" &&
        sentence.license.scope === "PROJECT_AUTHORED")) &&
    nonempty(record.sourceRecordId) &&
    (sentence.sourceId === null || sentence.sourceId === record.sourceRecordId) &&
    record.importRun.dataSourceId === ds.id &&
    record.importRun.status === "SUCCESS" &&
    nonempty(record.importRun.sourceVersion) &&
    /^[a-f0-9]{64}$/i.test(record.importRun.checksumSha256)
  );
}

export function toExampleSentenceDto(sentence: ExampleSentenceRecord): SentenceDto | null {
  if (!isEligibleExampleSentence(sentence)) return null;
  const ds = sentence.dataSource!;
  return {
    id: sentence.id,
    japaneseText: sentence.japaneseText,
    readingText: sentence.readingText,
    translationRu: sentence.translationRu!,
    translationEn: sentence.translationEn!,
    difficulty: sentence.difficulty,
    attribution: {
      sourceName:
        sentence.license.scope === "PROJECT_AUTHORED"
          ? `${ds.name} (авторский пример проекта)`
          : ds.name,
      sourceUrl: exampleSourceUrl(ds),
      licenseName: sentence.license.name,
      attributionText: ds.attributionText,
    },
  };
}

export async function writeWordExample(
  db: Pick<Prisma.TransactionClient, "sentence" | "wordExample">,
  input: {
    readonly wordId: string;
    readonly sentenceId: string;
    readonly status: "DRAFT" | "PUBLISHED";
    readonly sortOrder?: number;
  },
) {
  const sortOrder = input.sortOrder ?? 0;
  if (
    !["DRAFT", "PUBLISHED"].includes(input.status) ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0
  ) {
    throw new Error(
      "Word examples require DRAFT/PUBLISHED status and a non-negative integer sort order.",
    );
  }
  if (input.status === "PUBLISHED") {
    const sentence = await db.sentence.findUnique({
      where: { id: input.sentenceId },
      select: EXAMPLE_SENTENCE_SELECT,
    });
    if (sentence === null || !isEligibleExampleSentence(sentence)) {
      throw new Error(
        "Cannot publish a word example without bilingual text and valid licensed provenance.",
      );
    }
  }
  return db.wordExample.upsert({
    where: { wordId_sentenceId: { wordId: input.wordId, sentenceId: input.sentenceId } },
    create: { ...input, sortOrder },
    update: { status: input.status, sortOrder },
  });
}

export async function loadItemExampleSentences(
  db: ExampleReader,
  items: readonly ExampleItemRef[],
  limit: 3 | 5,
): Promise<ReadonlyMap<string, readonly SentenceDto[]>> {
  if (limit !== 3 && limit !== 5) throw new Error("Example limit must be 3 or 5.");
  const result = new Map<string, SentenceDto[]>();
  const unique = [...new Map(items.map((item) => [item.id, item])).values()];
  for (let offset = 0; offset < unique.length; offset += WORD_EXAMPLE_BATCH_SIZE) {
    const batch = unique.slice(offset, offset + WORD_EXAMPLE_BATCH_SIZE);
    const links = await db.$queryRaw<{ itemId: string; sentenceId: string }[]>(Prisma.sql`
      SELECT root.id AS "itemId", chosen."sentenceId" FROM (${inputRows(batch)}) AS root(id, "targetType", "targetId")
      CROSS JOIN LATERAL (
        SELECT q."sentenceId", q.priority, q."sortOrder", q."linkId" FROM (${candidates(true, limit)}) q
        ORDER BY q.priority, q."sortOrder", q."linkId" LIMIT ${limit}
      ) chosen
      ORDER BY root.id, chosen.priority, chosen."sortOrder", chosen."linkId"
    `);
    const sentenceIds = [...new Set(links.map((link) => link.sentenceId))];
    if (sentenceIds.length === 0) continue;
    const sentences = await db.sentence.findMany({
      where: { id: { in: sentenceIds } },
      select: EXAMPLE_SENTENCE_SELECT,
    });
    const byId = new Map(
      sentences.map((sentence) => [sentence.id, toExampleSentenceDto(sentence)]),
    );
    for (const link of links) {
      const sentence = byId.get(link.sentenceId);
      const examples = result.get(link.itemId) ?? [];
      if (
        sentence &&
        examples.length < limit &&
        !examples.some((example) => example.id === sentence.id)
      ) {
        examples.push(sentence);
        result.set(link.itemId, examples);
      }
    }
  }
  return result;
}

export async function loadWordExampleQuality(
  db: Pick<Prisma.TransactionClient, "$queryRaw">,
  items: readonly ExampleItemRef[],
): Promise<ReadonlyMap<string, WordExampleQuality>> {
  const result = new Map<string, WordExampleQuality>();
  const words = [
    ...new Map(
      items.filter((item) => item.targetType === "WORD").map((item) => [item.id, item]),
    ).values(),
  ];
  for (let offset = 0; offset < words.length; offset += WORD_EXAMPLE_BATCH_SIZE) {
    const batch = words.slice(offset, offset + WORD_EXAMPLE_BATCH_SIZE);
    const rows = await db.$queryRaw<(WordExampleQuality & { itemId: string })[]>(Prisma.sql`
      SELECT root.id AS "itemId", COALESCE(bool_or(q.eligible), false) AS "hasExample",
        (count(*) FILTER (WHERE NOT q.eligible))::int AS "invalidExampleCount",
        md5(COALESCE(string_agg(q.fingerprint, '' ORDER BY q.priority, q."sortOrder", q."linkId"), '')) AS fingerprint
      FROM (${inputRows(batch)}) AS root(id, "targetType", "targetId")
      LEFT JOIN LATERAL (${candidates(false)}) q ON true GROUP BY root.id
    `);
    for (const row of rows)
      result.set(row.itemId, {
        hasExample: row.hasExample,
        invalidExampleCount: row.invalidExampleCount,
        fingerprint: row.fingerprint,
      });
  }
  return result;
}

function inputRows(items: readonly ExampleItemRef[]) {
  return Prisma.sql`VALUES ${Prisma.join(items.map((item) => Prisma.sql`(${item.id}::uuid, ${item.targetType}::text, ${item.targetId}::uuid)`))}`;
}

function candidates(onlyEligible: boolean, limit?: number): Prisma.Sql {
  const branch = (direct: boolean) => Prisma.sql`
    (SELECT e."sentenceId", e.id AS "linkId", ${direct ? Prisma.sql`e."sortOrder"` : Prisma.sql`COALESCE(si."levelHint", 2147483647)`} AS "sortOrder",
      ${direct ? 0 : 1} AS priority, ${eligibility()} AS eligible,
      md5(concat_ws('|', e.id::text, ${direct ? Prisma.sql`e."sortOrder"::text` : Prisma.sql`si."levelHint"::text`},
        s."japaneseText", s."readingText", s."translationRu", s."translationEn", s."sourceId", s."licenseId"::text,
        ds.id::text, ds.name, ds."licenseId"::text, ds."homepageUrl", ds."downloadUrl", ds."attributionText",
        l.name, l.scope::text, ir.id::text, ir."sourceRecordId", ir."recordType"::text,
        run."dataSourceId"::text, run.status::text, run."sourceVersion", run."checksumSha256")) AS fingerprint
    FROM ${
      direct
        ? Prisma.sql`"WordExample" e`
        : Prisma.sql`"Dependency" d JOIN "LearningItem" si ON si.id = d."learningItemId"
      CROSS JOIN LATERAL (SELECT d.id, si."targetId" AS "sentenceId") e`
    }
    LEFT JOIN "Sentence" s ON s.id = e."sentenceId"
    LEFT JOIN "License" l ON l.id = s."licenseId"
    LEFT JOIN "DataSource" ds ON ds.id = s."dataSourceId"
    LEFT JOIN "ImportedRecord" ir ON ir.id = s."importedRecordId"
    LEFT JOIN "ImportRun" run ON run.id = ir."importRunId"
    WHERE ${
      direct
        ? Prisma.sql`root."targetType" = 'WORD' AND e."wordId" = root."targetId" AND e.status = 'PUBLISHED'`
        : Prisma.sql`
      d."prerequisiteItemId" = root.id AND d."dependencyType" = 'PREREQUISITE'
      AND si.kind = 'SENTENCE' AND si."targetType" = 'SENTENCE' AND si.status = 'PUBLISHED'
      AND NOT EXISTS (SELECT 1 FROM "WordExample" explicit_link WHERE root."targetType" = 'WORD'
        AND explicit_link."wordId" = root."targetId" AND explicit_link."sentenceId" = e."sentenceId")`
    }
    ${onlyEligible ? Prisma.sql`AND ${eligibility()}` : Prisma.empty}
    ${limit === undefined ? Prisma.empty : Prisma.sql`ORDER BY "sortOrder", "linkId" LIMIT ${limit}`})
  `;
  return Prisma.sql`${branch(true)} UNION ALL ${branch(false)}`;
}

function eligibility(): Prisma.Sql {
  return Prisma.sql`COALESCE((
    s."japaneseText" ~ ${"\\S"} AND s."translationRu" ~ ${"\\S"} AND s."translationEn" ~ ${"\\S"}
    AND l.name ~ ${"\\S"} AND l.scope IN ('OPEN_DATA', 'PROJECT_AUTHORED')
    AND ds."licenseId" = s."licenseId" AND ds.name ~ ${"\\S"} AND ds."attributionText" ~ ${"\\S"}
    AND ((ds."homepageUrl" ~ ${SOURCE_URL_PATTERN} AND ds."homepageUrl" !~ ${"\\s"})
      OR (ds."downloadUrl" ~ ${SOURCE_URL_PATTERN} AND ds."downloadUrl" !~ ${"\\s"}))
    AND ((s."importedRecordId" IS NULL AND l.scope = 'PROJECT_AUTHORED') OR (
      ((ir."recordType" = 'TATOEBA_SENTENCE' AND l.scope = 'OPEN_DATA') OR
        (ir."recordType" = 'PROJECT_AUTHORED' AND l.scope = 'PROJECT_AUTHORED')) AND ir."sourceRecordId" ~ ${"\\S"}
      AND (s."sourceId" IS NULL OR s."sourceId" = ir."sourceRecordId") AND run."dataSourceId" = ds.id
      AND run.status = 'SUCCESS' AND run."sourceVersion" ~ ${"\\S"} AND run."checksumSha256" ~* '^[a-f0-9]{64}$'
    ))
  ), false)`;
}

function nonempty(value: string | null): boolean {
  return value !== null && value.trim() !== "";
}
function exampleSourceUrl(source: {
  homepageUrl: string | null;
  downloadUrl: string | null;
}): string | null {
  return (
    [source.homepageUrl, source.downloadUrl].find(
      (url) => url !== null && !/\s/u.test(url) && new RegExp(SOURCE_URL_PATTERN).test(url),
    ) ?? null
  );
}
