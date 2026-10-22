import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  CONTENT_QUALITY_POLICY_VERSION,
  type ContentQualityIssueCode,
  type ContentQualityPageDto,
  type ContentQualityReportDto,
} from "@kanji-srs/shared";
import {
  isHttps,
  isValidQualitySource,
  validateQualityItem,
  type QualityItem,
  type QualityPlacement,
  type QualitySource,
} from "./content-quality";
import { loadWordExampleQuality } from "./word-examples";

export type ContentQualityDatabase = Pick<
  Prisma.TransactionClient,
  "learningItem" | "kanji" | "word" | "component" | "sentence" | "srsSystem" | "$queryRaw"
>;
export type ContentQualityPageOptions = {
  readonly cursor?: string;
  readonly limit?: number;
  readonly code?: ContentQualityIssueCode;
  readonly courseSlug?: string;
  /** Internal finite-publication scope; public reports remain unfiltered by default. */
  readonly itemIds?: readonly string[];
};

const SOURCE_INCLUDE = {
  importRun: { include: { dataSource: { include: { license: true } } } },
} as const;
type SourceRecord = Prisma.ImportedRecordGetPayload<{ include: typeof SOURCE_INCLUDE }>;

export async function loadContentQualityItems(
  db: ContentQualityDatabase,
  options: ContentQualityPageOptions = {},
): Promise<readonly QualityItem[]> {
  const limit = options.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Content quality page limit must be between 1 and 100.");
  const itemIds = options.itemIds;
  if (
    itemIds !== undefined &&
    (!Array.isArray(itemIds) ||
      itemIds.length < 1 ||
      itemIds.length > 100 ||
      Array.from(itemIds).some(
        (id) =>
          typeof id !== "string" ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(id),
      ) ||
      new Set(itemIds.map((id) => id.toLowerCase())).size !== itemIds.length)
  )
    throw new Error("Content quality itemIds must contain 1 to 100 unique UUIDs.");
  const courseSlug = options.courseSlug ?? "japanese-ru-n2";
  const placements = {
    where: { courseLevel: { course: { slug: courseSlug } } },
    include: { courseLevel: true },
    orderBy: { id: "asc" as const },
  };
  const rows = await db.learningItem.findMany({
    where: {
      status: "PUBLISHED",
      courseLevelItems: { some: { courseLevel: { course: { slug: courseSlug } } } },
      ...(itemIds === undefined && options.cursor === undefined
        ? {}
        : {
            id: {
              ...(itemIds === undefined ? {} : { in: [...itemIds] }),
              ...(options.cursor === undefined ? {} : { gt: options.cursor }),
            },
          }),
    },
    take: limit,
    orderBy: { id: "asc" },
    include: {
      cards: {
        include: {
          answers: { orderBy: { id: "asc" } },
          blockedAnswers: { orderBy: { id: "asc" } },
          audioAsset: { include: { license: true, dataSource: true } },
        },
        orderBy: { id: "asc" },
      },
      mnemonics: { orderBy: { id: "asc" } },
      courseLevelItems: placements,
      dependencies: {
        where: { dependencyType: "PREREQUISITE" },
        include: { prerequisiteItem: { include: { courseLevelItems: placements } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (rows.length === 0) return [];
  const targetIds = (kind: string) =>
    rows.filter((row) => row.targetType === kind).map((row) => row.targetId);
  const [kanji, words, components, sentences, cycles, systems, examples] = await Promise.all([
    db.kanji.findMany({
      where: { id: { in: targetIds("KANJI") } },
      include: {
        importedRecord: { include: SOURCE_INCLUDE },
        readings: { orderBy: [{ priority: "asc" }, { reading: "asc" }] },
        meanings: { orderBy: { id: "asc" } },
        components: { orderBy: { id: "asc" } },
        strokeGraphic: { include: { importedRecord: { include: SOURCE_INCLUDE } } },
      },
    }),
    db.word.findMany({
      where: { id: { in: targetIds("WORD") } },
      include: { importedRecord: { include: SOURCE_INCLUDE }, senses: { orderBy: { id: "asc" } } },
    }),
    db.component.findMany({ where: { id: { in: targetIds("COMPONENT") } } }),
    db.sentence.findMany({
      where: {
        id: {
          in: targetIds("SENTENCE"),
        },
      },
      include: { importedRecord: { include: SOURCE_INCLUDE }, license: true },
    }),
    // UNION deduplicates reachable pairs, so cycles terminate without an unbounded path array.
    db.$queryRaw<{ root: string }[]>(Prisma.sql`
      WITH RECURSIVE reachable(root, node) AS (
        SELECT "learningItemId", "prerequisiteItemId" FROM "Dependency"
        WHERE "dependencyType" = 'PREREQUISITE' AND "learningItemId" IN (${Prisma.join(rows.map((row) => Prisma.sql`${row.id}::uuid`))})
        UNION
        SELECT r.root, d."prerequisiteItemId" FROM reachable r
        JOIN "Dependency" d ON d."learningItemId" = r.node WHERE d."dependencyType" = 'PREREQUISITE'
      ) SELECT DISTINCT root FROM reachable WHERE root = node ORDER BY root
    `),
    db.srsSystem.findMany({
      orderBy: { slug: "asc" },
      include: { stages: { select: { stageIndex: true }, orderBy: { stageIndex: "asc" } } },
    }),
    loadWordExampleQuality(db, rows),
  ]);
  const validStageIndices =
    (systems.find((system) => system.slug === "default-mvp") ?? systems[0])?.stages.map(
      (stage) => stage.stageIndex,
    ) ?? [];
  const wordCharacters = [
    ...new Set(
      words.flatMap((word) => Array.from(word.expression).filter((c) => /\p{Script=Han}/u.test(c))),
    ),
  ];
  const spellingKanji = await db.kanji.findMany({
    where: { character: { in: wordCharacters } },
    select: { id: true, character: true },
    orderBy: { id: "asc" },
  });
  const kanjiMap = new Map(kanji.map((row) => [row.id, row]));
  const wordMap = new Map(words.map((row) => [row.id, row]));
  const componentMap = new Map(components.map((row) => [row.id, row]));
  const sentenceMap = new Map(sentences.map((row) => [row.id, row]));
  const cycleIds = new Set(cycles.map((row) => row.root));
  return rows.map((row) => {
    const character = kanjiMap.get(row.targetId);
    const word = wordMap.get(row.targetId);
    const component = componentMap.get(row.targetId);
    const sentence = sentenceMap.get(row.targetId);
    const record =
      character?.importedRecord ?? word?.importedRecord ?? sentence?.importedRecord ?? null;
    return {
      id: row.id,
      kind: row.kind,
      targetType: row.targetType,
      band: row.curriculumBand,
      validStageIndices,
      targetMeaningsValid: ["ru-RU", "en-US"].every((locale) =>
        character !== undefined
          ? character.meanings.filter(
              (m) =>
                m.locale === locale &&
                m.sourceKind !== "IMPORTED" &&
                m.isPrimary &&
                m.meaning.trim() !== "",
            ).length === 1
          : word !== undefined
            ? word.senses.some(
                (s) =>
                  s.locale === locale && s.sourceKind !== "IMPORTED" && s.meaning.trim() !== "",
              )
            : component !== undefined
              ? component.sourceKind !== "IMPORTED" &&
                (locale === "ru-RU" ? component.meaningRu : component.meaningEn).trim() !== ""
              : sentence !== undefined &&
                (locale === "ru-RU" ? sentence.translationRu : sentence.translationEn)?.trim() !==
                  "" &&
                (locale === "ru-RU" ? sentence.translationRu : sentence.translationEn) !== null,
      ),
      targetExists:
        character !== undefined ||
        word !== undefined ||
        component !== undefined ||
        sentence !== undefined,
      source: source(record),
      sourceReadings:
        character?.readings.map((reading) => reading.reading) ??
        (word === undefined
          ? sentence?.readingText === null || sentence?.readingText === undefined
            ? []
            : [sentence.readingText]
          : [word.reading]),
      requiresImportedSource:
        row.kind === "KANJI" ||
        row.kind === "WORD" ||
        (row.kind === "SENTENCE" && sentence?.dataSourceId !== null),
      hasStrokes:
        character?.strokeGraphic !== null &&
        character?.strokeGraphic !== undefined &&
        validSource(character.strokeGraphic.importedRecord),
      hasPartOfSpeech: word?.senses.some((sense) => sense.partOfSpeech.trim() !== "") ?? false,
      hasExample: examples.get(row.id)?.hasExample ?? false,
      exampleEvidence: examples.get(row.id),
      cards: row.cards.map((card) => ({
        ...card,
        audioValid:
          card.audioAsset !== null &&
          (row.kind === "WORD" || row.kind === "SENTENCE") &&
          card.audioAsset.learningItemId === row.id &&
          card.audioAsset.status === "PUBLISHED" &&
          isHttps(card.audioAsset.mediaUrl) &&
          card.audioAsset.durationMs > 0 &&
          /^[a-f0-9]{64}$/i.test(card.audioAsset.checksumSha256) &&
          card.audioAsset.license.name.trim() !== "" &&
          card.audioAsset.attributionText.trim() !== "",
      })),
      mnemonics: row.mnemonics,
      placements: row.courseLevelItems.map(placement),
      hasPrerequisiteCycle: cycleIds.has(row.id),
      requiredPrerequisiteTargetIds:
        character?.components.map((link) => link.componentId) ??
        (word === undefined
          ? []
          : [...new Set(Array.from(word.expression).filter((c) => /\p{Script=Han}/u.test(c)))].map(
              (c) => spellingKanji.find((k) => k.character === c)?.id ?? `missing-kanji:${c}`,
            )),
      dependencies: row.dependencies.map((dep) => ({
        id: dep.prerequisiteItemId,
        targetId: dep.prerequisiteItem.targetId,
        kind: dep.prerequisiteItem.kind,
        status: dep.prerequisiteItem.status,
        requiredStage: dep.requiredStage,
        placements: dep.prerequisiteItem.courseLevelItems.map(placement),
      })),
    };
  });
}

export async function getContentQualityPage(
  db: ContentQualityDatabase,
  options: ContentQualityPageOptions = {},
): Promise<ContentQualityPageDto> {
  const items = await loadContentQualityItems(db, options);
  const issues = items.flatMap(validateQualityItem);
  return {
    policyVersion: CONTENT_QUALITY_POLICY_VERSION,
    scannedItems: items.length,
    blockerCount: issues.filter((issue) => issue.severity === "blocker").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    issues:
      options.code === undefined ? issues : issues.filter((issue) => issue.code === options.code),
    nextCursor: items.length === (options.limit ?? 50) ? (items.at(-1)?.id ?? null) : null,
  };
}

export async function collectContentQualityReport(
  db: ContentQualityDatabase,
  options: { readonly courseSlug?: string; readonly maxIssues?: number } = {},
): Promise<ContentQualityReportDto> {
  const maxIssues = options.maxIssues ?? 1000;
  const issues: ContentQualityReportDto["issues"][number][] = [];
  const hash = createHash("sha256").update(CONTENT_QUALITY_POLICY_VERSION);
  let scannedItems = 0;
  let blockerCount = 0;
  let warningCount = 0;
  let cursor: string | undefined;
  while (true) {
    const items = await loadContentQualityItems(db, {
      cursor,
      courseSlug: options.courseSlug,
      limit: 100,
    });
    for (const item of items) {
      hash.update(JSON.stringify(item));
      scannedItems += 1;
      for (const issue of validateQualityItem(item)) {
        if (issue.severity === "blocker") blockerCount += 1;
        else warningCount += 1;
        if (issues.length < maxIssues) issues.push(issue);
      }
    }
    if (items.length < 100) break;
    cursor = items.at(-1)?.id;
  }
  return {
    policyVersion: CONTENT_QUALITY_POLICY_VERSION,
    generatedAt: new Date().toISOString(),
    contentVersion: hash.digest("hex"),
    scannedItems,
    blockerCount,
    warningCount,
    issues,
    issuesTruncated: issues.length < blockerCount + warningCount,
  };
}

function placement(row: {
  readonly sortOrder: number;
  readonly courseLevel: { readonly levelNumber: number; readonly band: string };
}): QualityPlacement {
  return {
    levelNumber: row.courseLevel.levelNumber,
    band: row.courseLevel.band,
    sortOrder: row.sortOrder,
  };
}

function source(record: SourceRecord | null | undefined): QualitySource | null {
  if (record === null || record === undefined) return null;
  const run = record.importRun;
  return {
    sourceRecordId: record.sourceRecordId,
    checksumSha256: run.checksumSha256,
    status: run.status,
    sourceVersion: run.sourceVersion,
    sourceUrl: run.dataSource.homepageUrl,
    licenseName: run.dataSource.license.name,
    attributionText: run.dataSource.attributionText,
  };
}

function validSource(record: SourceRecord | null | undefined): boolean {
  const evidence = source(record);
  return evidence !== null && isValidQualitySource(evidence);
}
