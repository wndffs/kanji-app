import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaClient, type CourseBand, type Prisma } from "@prisma/client";
import { withNeonConnectionDefaults } from "../src/connection-defaults";
import { buildMainCourseBlueprint } from "../src/main-course";
import { buildCuratedMeaningBlocks } from "../src/curated-meaning-blocks";

import {
  buildMainCourseContentBatches,
  type MainCourseAcceptedMeanings,
  type MainCourseComponentContent,
  type MainCourseContentBatch,
  type MainCourseKanjiContent,
  validateMainCourseContentBatches,
} from "../src/main-course-content";

const CURATION_SOURCE_NAME = "Kanji SRS main-course curation";
const CURATION_LICENSE_NAME = "Project-authored main-course content";
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

async function main(): Promise<void> {
  const batches = buildMainCourseContentBatches();
  const options = parseMainCourseCurationArgs(process.argv.slice(2), batches);
  const selected = selectRegisteredBatches(batches, options.batchId);

  if (options.mode === "validate-only") {
    console.log(
      JSON.stringify(
        {
          status: "valid",
          selectedBatchId: options.batchId ?? null,
          validatedBatchIds: batches.map((batch) => batch.id),
          batches: selected.map((batch) => ({
            id: batch.id,
            version: batch.version,
            checksumSha256: checksum(batch),
            ...batchStats(batch),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (options.mode === "apply") for (const batch of selected) requireParentReview(batch);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for live main-course curation.");
  const prisma = new PrismaClient({ datasourceUrl: withNeonConnectionDefaults(url) });

  try {
    if (options.mode === "preflight-only") {
      const results = [];
      for (const batch of selected) {
        await planMainCourseContentBatch(prisma, batch, batches);
        results.push({ id: batch.id, checksumSha256: checksum(batch), ...batchStats(batch) });
      }
      console.log(JSON.stringify({ status: "preflight-passed", batches: results }, null, 2));
    } else {
      console.log(
        JSON.stringify(
          await applyMainCourseContentBatches(prisma, {
            registry: batches,
            ...(options.batchId === undefined ? {} : { batchId: options.batchId }),
          }),
          null,
          2,
        ),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

export function parseMainCourseCurationArgs(
  args: readonly string[],
  registry: readonly MainCourseContentBatch[] = buildMainCourseContentBatches(),
) {
  const invalid = () =>
    new Error(
      "Use no arguments to apply all batches, --validate-only, or --preflight-only; optionally select --batch <registered-id> once.",
    );
  let mode: "apply" | "validate-only" | "preflight-only" = "apply";
  let batchId: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--validate-only" || arg === "--preflight-only") {
      if (mode !== "apply") throw invalid();
      mode = arg.slice(2) as "validate-only" | "preflight-only";
    } else if (arg === "--batch") {
      const value = args[++index];
      if (batchId !== undefined || value === undefined || value.startsWith("--")) throw invalid();
      if (!registry.some((batch) => batch.id === value))
        throw new Error(`Unknown registered main-course batch ${value}.`);
      batchId = value;
    } else throw invalid();
  }
  return { mode, ...(batchId === undefined ? {} : { batchId }) };
}

function selectRegisteredBatches(registry: readonly MainCourseContentBatch[], batchId?: string) {
  const issues = validateMainCourseContentBatches(registry);
  if (issues.length) throw new Error(`Main-course content is invalid: ${issues.join("; ")}`);
  if (batchId === undefined) return registry;
  const batch = registry.find((batch) => batch.id === batchId);
  if (batch === undefined) throw new Error(`Unknown registered main-course batch ${batchId}.`);
  return [batch];
}

export async function applyMainCourseContentBatches(
  prisma: PrismaClient,
  options: {
    readonly registry?: readonly MainCourseContentBatch[];
    readonly batchId?: string;
  } = {},
) {
  const registry = options.registry ?? buildMainCourseContentBatches();
  const selected = selectRegisteredBatches(registry, options.batchId);
  for (const batch of selected) requireParentReview(batch);
  const results = [];
  for (const batch of selected)
    results.push(await applyMainCourseContentBatch(prisma, batch, registry));
  return { status: "success", batches: results };
}

type PreflightDatabase = Pick<
  Prisma.TransactionClient,
  "course" | "component" | "kanji" | "learningItem" | "courseLevelItem"
>;

export async function planMainCourseContentBatch(
  db: PreflightDatabase,
  batch: MainCourseContentBatch,
  registry: readonly MainCourseContentBatch[] = buildMainCourseContentBatches(),
) {
  const issues = validateMainCourseContentBatches(registry);
  if (issues.length > 0) {
    throw new Error(`Main-course content is invalid: ${issues.join("; ")}`);
  }
  const batchIndex = registry.findIndex((entry) => entry.id === batch.id);
  const registered = registry[batchIndex];
  if (registered === undefined || checksum(registered) !== checksum(batch)) {
    throw new Error(`Batch ${batch.id} does not match the registered manifest.`);
  }

  const course = await db.course.findUnique({
    where: { slug: batch.courseSlug },
    select: { id: true, levels: { select: { id: true, levelNumber: true, band: true } } },
  });
  if (course === null) {
    throw new Error(`Main course ${batch.courseSlug} is missing. Run npm run db:seed first.`);
  }
  const levelByNumber = new Map(course.levels.map((level) => [level.levelNumber, level]));
  const componentDefinitions = new Map(
    registry.slice(0, batchIndex + 1).flatMap((entry) =>
      entry.components.map(
        (content, index) =>
          [
            content.key,
            {
              content,
              batch: entry,
              sortOrder: (entry.componentSortOrderStart ?? 1) + index,
            },
          ] as const,
      ),
    ),
  );
  const componentKeys = new Set([
    ...batch.components.map((content) => content.key),
    ...batch.kanji.flatMap((content) => content.componentKeys),
  ]);
  const usedLevels = new Set([
    ...(batch.components.length > 0 ? [batch.componentLevelNumber] : []),
    ...batch.kanji.map((item) => item.levelNumber),
  ]);
  for (const key of componentKeys) {
    const definition = componentDefinitions.get(key);
    if (definition === undefined || definition.batch.courseSlug !== batch.courseSlug) {
      throw new Error(`Unregistered component prerequisite ${key}.`);
    }
    usedLevels.add(definition.batch.componentLevelNumber);
  }
  const blueprintLevels = new Map(
    buildMainCourseBlueprint().levels.map((level) => [level.levelNumber, level]),
  );
  for (const levelNumber of usedLevels) {
    const level = levelByNumber.get(levelNumber);
    const expected = blueprintLevels.get(levelNumber);
    if (level === undefined || expected === undefined || level.band !== expected.band) {
      throw new Error(
        `Main course ${batch.courseSlug} needs level ${levelNumber} matching the registered curriculum band.`,
      );
    }
  }

  const priorComponentLearningItemIds = new Map<string, string>();
  for (const key of componentKeys) {
    const definition = componentDefinitions.get(key);
    if (definition === undefined || definition.batch.courseSlug !== batch.courseSlug) {
      throw new Error(`Unregistered component prerequisite ${key}.`);
    }
    const component = await db.component.findUnique({
      where: { symbol: definition.content.symbol },
      select: { id: true, sourceKind: true },
    });
    if (component !== null && component.sourceKind !== "PROJECT_AUTHORED") {
      throw new Error(`Component ${key} is not project-authored.`);
    }
    const item =
      component === null ? null : await findPlacedItem(db, "COMPONENT", component.id, course.id);
    const levelId = requiredLevelId(levelByNumber, definition.batch.componentLevelNumber);
    if (definition.batch.id !== batch.id) {
      if (
        item === null ||
        item.kind !== "COMPONENT" ||
        item.status !== "PUBLISHED" ||
        !item.courseLevelItems.some(
          (placement) =>
            placement.courseLevelId === levelId && placement.sortOrder === definition.sortOrder,
        )
      ) {
        throw new Error(
          `Prior component ${key} is not published at its registered main-course placement.`,
        );
      }
      priorComponentLearningItemIds.set(key, item.id);
    }
    await checkPlacement(db, levelId, definition.sortOrder, item);
  }

  // Read every source and placement before source metadata or learning content is mutated.
  for (const content of batch.kanji) {
    const kanji = await requireKanjiEvidence(db, content);
    const item = await findPlacedItem(db, "KANJI", kanji.id, course.id);
    await checkPlacement(
      db,
      requiredLevelId(levelByNumber, content.levelNumber),
      content.sortOrder,
      item,
    );
  }
  return { courseId: course.id, levelByNumber, priorComponentLearningItemIds };
}

async function findPlacedItem(
  db: PreflightDatabase,
  targetType: "COMPONENT" | "KANJI",
  targetId: string,
  courseId: string,
) {
  return db.learningItem.findUnique({
    where: { targetType_targetId: { targetType, targetId } },
    select: {
      id: true,
      kind: true,
      status: true,
      courseLevelItems: {
        where: { courseLevel: { courseId } },
        select: { courseLevelId: true, sortOrder: true },
      },
    },
  });
}

async function checkPlacement(
  db: PreflightDatabase,
  courseLevelId: string,
  sortOrder: number,
  item: Awaited<ReturnType<typeof findPlacedItem>>,
): Promise<void> {
  if (
    item?.courseLevelItems.some(
      (placement) => placement.courseLevelId !== courseLevelId || placement.sortOrder !== sortOrder,
    )
  ) {
    throw new Error(`Refusing to move existing main-course placement for ${item.id}.`);
  }
  const occupied = await db.courseLevelItem.findUnique({
    where: { courseLevelId_sortOrder: { courseLevelId, sortOrder } },
    select: { learningItemId: true },
  });
  if (occupied !== null && occupied.learningItemId !== item?.id) {
    throw new Error(`Course level placement ${courseLevelId}:${sortOrder} is already occupied.`);
  }
}

export async function applyMainCourseContentBatch(
  prisma: PrismaClient,
  batch: MainCourseContentBatch,
  registry: readonly MainCourseContentBatch[] = buildMainCourseContentBatches(),
) {
  requireParentReview(batch);
  const { courseId, levelByNumber, priorComponentLearningItemIds } =
    await planMainCourseContentBatch(prisma, batch, registry);
  const checksumSha256 = checksum(batch);
  const dataSourceId = await upsertCurationSource(prisma);
  const importRun = await prisma.importRun.upsert({
    where: {
      dataSourceId_checksumSha256: {
        dataSourceId,
        checksumSha256,
      },
    },
    update: {
      sourceVersion: batch.version,
      sourceFileName: batch.sourceFile,
      status: "PENDING",
      finishedAt: null,
      errorText: null,
      statsJson: batchStats(batch),
    },
    create: {
      dataSourceId,
      sourceVersion: batch.version,
      sourceFileName: batch.sourceFile,
      checksumSha256,
      status: "PENDING",
      statsJson: batchStats(batch),
    },
  });

  try {
    const componentLearningItemIds = new Map(priorComponentLearningItemIds);

    for (const [index, componentContent] of batch.components.entries()) {
      const learningItemId = await prisma.$transaction(
        (db) =>
          applyComponent(
            db,
            componentContent,
            batch,
            importRun.id,
            requiredLevelId(levelByNumber, batch.componentLevelNumber),
            levelByNumber.get(batch.componentLevelNumber)!.band,
            courseId,
            (batch.componentSortOrderStart ?? 1) + index,
          ),
        TRANSACTION_OPTIONS,
      );
      componentLearningItemIds.set(componentContent.key, learningItemId);
    }

    for (const kanjiContent of batch.kanji) {
      await prisma.$transaction(
        (db) =>
          applyKanji(
            db,
            kanjiContent,
            batch,
            importRun.id,
            requiredLevelId(levelByNumber, kanjiContent.levelNumber),
            levelByNumber.get(kanjiContent.levelNumber)!.band,
            courseId,
            componentLearningItemIds,
          ),
        TRANSACTION_OPTIONS,
      );
    }

    await prisma.importRun.update({
      where: { id: importRun.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        errorText: null,
        statsJson: batchStats(batch),
      },
    });

    return {
      id: batch.id,
      version: batch.version,
      checksumSha256,
      importRunId: importRun.id,
      components: batch.components.length,
      kanji: batch.kanji.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.importRun.update({
      where: { id: importRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorText: message,
      },
    });

    throw error;
  }
}

async function upsertCurationSource(prisma: PrismaClient): Promise<string> {
  const license = await prisma.license.upsert({
    where: { name: CURATION_LICENSE_NAME },
    update: {
      spdxLikeId: "LicenseRef-Project-Authored",
      scope: "PROJECT_AUTHORED",
      requiresAttribution: false,
      requiresShareAlike: false,
      notes: "Independent bilingual learning content authored for this project.",
    },
    create: {
      name: CURATION_LICENSE_NAME,
      spdxLikeId: "LicenseRef-Project-Authored",
      scope: "PROJECT_AUTHORED",
      requiresAttribution: false,
      requiresShareAlike: false,
      notes: "Independent bilingual learning content authored for this project.",
    },
  });
  const dataSource = await prisma.dataSource.upsert({
    where: { name: CURATION_SOURCE_NAME },
    update: {
      homepageUrl: "https://github.com/wndffs/kanji-app",
      attributionText: "Project-authored bilingual main-course content.",
      licenseId: license.id,
      notes: "Versioned editorial batches; imported dictionary evidence remains separate.",
    },
    create: {
      name: CURATION_SOURCE_NAME,
      homepageUrl: "https://github.com/wndffs/kanji-app",
      attributionText: "Project-authored bilingual main-course content.",
      licenseId: license.id,
      notes: "Versioned editorial batches; imported dictionary evidence remains separate.",
    },
  });

  return dataSource.id;
}

async function applyComponent(
  db: Prisma.TransactionClient,
  content: MainCourseComponentContent,
  batch: MainCourseContentBatch,
  importRunId: string,
  courseLevelId: string,
  curriculumBand: CourseBand,
  courseId: string,
  sortOrder: number,
): Promise<string> {
  const component = await db.component.upsert({
    where: { symbol: content.symbol },
    update: {
      displayNameRu: content.displayName.ru,
      displayNameEn: content.displayName.en,
      shapeDescriptionRu: content.shapeDescription.ru,
      shapeDescriptionEn: content.shapeDescription.en,
      meaningRu: content.meaning.ru,
      meaningEn: content.meaning.en,
      sourceKind: "PROJECT_AUTHORED",
      notes: `Curated in ${batch.id}@${batch.version}.`,
    },
    create: {
      symbol: content.symbol,
      displayNameRu: content.displayName.ru,
      displayNameEn: content.displayName.en,
      shapeDescriptionRu: content.shapeDescription.ru,
      shapeDescriptionEn: content.shapeDescription.en,
      meaningRu: content.meaning.ru,
      meaningEn: content.meaning.en,
      sourceKind: "PROJECT_AUTHORED",
      notes: `Curated in ${batch.id}@${batch.version}.`,
    },
  });
  const learningItem = await db.learningItem.upsert({
    where: {
      targetType_targetId: {
        targetType: "COMPONENT",
        targetId: component.id,
      },
    },
    update: {
      kind: "COMPONENT",
      title: `Компонент ${content.symbol}`,
      levelHint: batch.componentLevelNumber,
      curriculumBand,
      status: "PUBLISHED",
    },
    create: {
      kind: "COMPONENT",
      targetType: "COMPONENT",
      targetId: component.id,
      title: `Компонент ${content.symbol}`,
      levelHint: batch.componentLevelNumber,
      curriculumBand,
      status: "PUBLISHED",
    },
  });

  await syncCard(db, learningItem.id, "MEANING", "MEANING", 1, [
    answer("ru-RU", content.meaning.ru, "MEANING", true),
    answer("en-US", content.meaning.en, "MEANING", true),
  ]);
  await upsertMnemonic(db, learningItem.id, "ru-RU", "MEANING", content.mnemonic.ru);
  await upsertMnemonic(db, learningItem.id, "en-US", "MEANING", content.mnemonic.en);
  await upsertPlacement(db, courseId, courseLevelId, learningItem.id, sortOrder);
  await upsertCurationRecord(db, importRunId, batch, "component", content.key, content);

  return learningItem.id;
}

async function requireKanjiEvidence(
  db: Pick<PreflightDatabase, "kanji">,
  content: MainCourseKanjiContent,
) {
  const kanji = await db.kanji.findUnique({
    where: { character: content.character },
    select: {
      id: true,
      kanjidicImportedRecordId: true,
      importedRecord: { select: { recordType: true, rawJson: true } },
      readings: {
        orderBy: [{ priority: "asc" }, { reading: "asc" }],
        select: { reading: true, priority: true, readingType: true },
      },
      strokeGraphic: { select: { id: true, importedRecord: { select: { recordType: true } } } },
    },
  });

  if (
    kanji === null ||
    kanji.kanjidicImportedRecordId === null ||
    kanji.importedRecord?.recordType !== "KANJIDIC2_CHARACTER"
  ) {
    throw new Error(
      `Kanji ${content.character} is missing imported KANJIDIC2 evidence. Run the content import first.`,
    );
  }

  if (
    content.requireStrokeData &&
    kanji.strokeGraphic?.importedRecord?.recordType !== "KANJIVG_CHARACTER"
  ) {
    throw new Error(`Kanji ${content.character} is missing required KanjiVG stroke data.`);
  }

  const sourceReading = normalizeReading(content.reading.source);
  const sourceType = content.reading.sourceType ?? "ja_on";
  const readingType = sourceType === "ja_kun" ? "KUNYOMI" : "ONYOMI";
  const raw = kanji.importedRecord.rawJson;
  const sourceSupported =
    isJsonObject(raw) &&
    raw.literal === content.character &&
    Array.isArray(raw.readings) &&
    raw.readings.some(
      (reading) =>
        isJsonObject(reading) &&
        reading.sourceType === sourceType &&
        reading.reading === content.reading.source,
    );
  if (
    !sourceSupported ||
    !kanji.readings.some(
      (reading) =>
        reading.readingType === readingType && normalizeReading(reading.reading) === sourceReading,
    )
  ) {
    throw new Error(
      `Kanji ${content.character} reading ${content.reading.source} is not supported by KANJIDIC2.`,
    );
  }

  if (normalizeReading(content.reading.primary) !== sourceReading) {
    throw new Error(
      `Kanji ${content.character} taught reading must match its selected KANJIDIC2 source reading.`,
    );
  }

  return kanji;
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function applyKanji(
  db: Prisma.TransactionClient,
  content: MainCourseKanjiContent,
  batch: MainCourseContentBatch,
  importRunId: string,
  courseLevelId: string,
  curriculumBand: CourseBand,
  courseId: string,
  componentLearningItemIds: ReadonlyMap<string, string>,
): Promise<void> {
  const kanji = await requireKanjiEvidence(db, content);

  const componentIds = content.componentKeys.map((key) => {
    const learningItemId = componentLearningItemIds.get(key);

    if (learningItemId === undefined) {
      throw new Error(`Kanji ${content.character} references unapplied component ${key}.`);
    }

    return learningItemId;
  });
  const availableItems = await db.learningItem.findMany({
    where: {
      id: { in: componentIds },
      targetType: "COMPONENT",
      status: "PUBLISHED",
    },
    select: { id: true, targetId: true },
  });

  const itemById = new Map(availableItems.map((item) => [item.id, item]));
  const componentItems = componentIds.map((id) => itemById.get(id));
  if (componentItems.some((item) => item === undefined)) {
    throw new Error(`Kanji ${content.character} has an unavailable component prerequisite.`);
  }
  const orderedComponentItems = componentItems.filter((item) => item !== undefined);

  await syncMeanings(db, kanji.id, "ru-RU", content.meanings.ru);
  await syncMeanings(db, kanji.id, "en-US", content.meanings.en);

  await db.kanjiComponent.deleteMany({
    where: { kanjiId: kanji.id, sourceKind: "PROJECT_AUTHORED" },
  });
  await db.kanjiComponent.createMany({
    data: orderedComponentItems.map((item, index) => ({
      kanjiId: kanji.id,
      componentId: item.targetId,
      position: `curated-${index + 1}`,
      sourceKind: "PROJECT_AUTHORED",
      confidence: 1,
    })),
  });

  const learningItem = await db.learningItem.upsert({
    where: {
      targetType_targetId: {
        targetType: "KANJI",
        targetId: kanji.id,
      },
    },
    update: {
      kind: "KANJI",
      title: `Кандзи ${content.character}`,
      levelHint: content.levelNumber,
      curriculumBand,
      status: "PUBLISHED",
    },
    create: {
      kind: "KANJI",
      targetType: "KANJI",
      targetId: kanji.id,
      title: `Кандзи ${content.character}`,
      levelHint: content.levelNumber,
      curriculumBand,
      status: "PUBLISHED",
    },
  });

  await syncCard(
    db,
    learningItem.id,
    "MEANING",
    "MEANING",
    1,
    [
      ...content.meanings.ru.accepted.map((text, index) =>
        answer("ru-RU", text, "MEANING", index === 0),
      ),
      ...content.meanings.en.accepted.map((text, index) =>
        answer("en-US", text, "MEANING", index === 0),
      ),
    ],
    buildCuratedMeaningBlocks(content.meanings),
  );
  await syncCard(
    db,
    learningItem.id,
    "READING",
    "READING",
    2,
    content.reading.accepted.map((text, index) => answer("ru-RU", text, "READING", index === 0)),
  );
  await upsertMnemonic(db, learningItem.id, "ru-RU", "MEANING", content.meaningMnemonic.ru);
  await upsertMnemonic(db, learningItem.id, "en-US", "MEANING", content.meaningMnemonic.en);
  await upsertMnemonic(db, learningItem.id, "ru-RU", "READING", content.readingMnemonic.ru);
  await upsertMnemonic(db, learningItem.id, "en-US", "READING", content.readingMnemonic.en);

  await db.dependency.deleteMany({
    where: { learningItemId: learningItem.id, dependencyType: "PREREQUISITE" },
  });
  await db.dependency.createMany({
    data: orderedComponentItems.map((item) => ({
      learningItemId: learningItem.id,
      prerequisiteItemId: item.id,
      dependencyType: "PREREQUISITE",
      requiredStage: 1,
    })),
  });

  await upsertPlacement(db, courseId, courseLevelId, learningItem.id, content.sortOrder);
  await upsertCurationRecord(db, importRunId, batch, "kanji", content.character, content);
}

async function syncMeanings(
  db: Prisma.TransactionClient,
  kanjiId: string,
  locale: "ru-RU" | "en-US",
  meanings: MainCourseAcceptedMeanings,
): Promise<void> {
  await db.kanjiMeaning.deleteMany({
    where: {
      kanjiId,
      locale,
      sourceKind: "PROJECT_AUTHORED",
      meaning: { notIn: [...meanings.accepted] },
    },
  });
  await db.kanjiMeaning.updateMany({
    where: { kanjiId, locale, sourceKind: "PROJECT_AUTHORED" },
    data: { isPrimary: false },
  });

  for (const meaning of meanings.accepted) {
    await db.kanjiMeaning.upsert({
      where: {
        kanjiId_locale_meaning_sourceKind: {
          kanjiId,
          locale,
          meaning,
          sourceKind: "PROJECT_AUTHORED",
        },
      },
      update: { isPrimary: meaning === meanings.primary },
      create: {
        kanjiId,
        locale,
        meaning,
        isPrimary: meaning === meanings.primary,
        sourceKind: "PROJECT_AUTHORED",
      },
    });
  }
}

async function syncCard(
  db: Prisma.TransactionClient,
  learningItemId: string,
  promptType: "MEANING" | "READING",
  answerType: "MEANING" | "READING",
  sortOrder: number,
  answers: readonly AnswerInput[],
  blocks: ReturnType<typeof buildCuratedMeaningBlocks> = [],
): Promise<void> {
  const card = await db.learningCard.upsert({
    where: {
      learningItemId_promptType_answerType_locale: {
        learningItemId,
        promptType,
        answerType,
        locale: "ru-RU",
      },
    },
    update: { cardType: "REVIEW", sortOrder },
    create: {
      learningItemId,
      cardType: "REVIEW",
      promptType,
      answerType,
      locale: "ru-RU",
      sortOrder,
    },
  });

  await db.learningAnswer.deleteMany({
    where: { learningCardId: card.id, sourceKind: "PROJECT_AUTHORED" },
  });
  await db.blockedAnswer.deleteMany({
    where: { learningCardId: card.id, sourceKind: "PROJECT_AUTHORED" },
  });
  await db.learningAnswer.createMany({
    data: answers.map((item) => ({
      learningCardId: card.id,
      ...item,
      sourceKind: "PROJECT_AUTHORED" as const,
    })),
  });
  if (blocks.length)
    await db.blockedAnswer.createMany({
      data: blocks.map((block) => ({
        ...block,
        learningCardId: card.id,
        sourceKind: "PROJECT_AUTHORED" as const,
      })),
    });
}

async function upsertMnemonic(
  db: Prisma.TransactionClient,
  learningItemId: string,
  locale: "ru-RU" | "en-US",
  mnemonicType: "MEANING" | "READING",
  body: string,
): Promise<void> {
  await db.mnemonic.upsert({
    where: {
      learningItemId_locale_mnemonicType_version: {
        learningItemId,
        locale,
        mnemonicType,
        version: 1,
      },
    },
    update: { body, sourceKind: "PROJECT_AUTHORED" },
    create: {
      learningItemId,
      locale,
      mnemonicType,
      body,
      sourceKind: "PROJECT_AUTHORED",
      version: 1,
    },
  });
}

async function upsertPlacement(
  db: Prisma.TransactionClient,
  courseId: string,
  courseLevelId: string,
  learningItemId: string,
  sortOrder: number,
): Promise<void> {
  await db.courseLevelItem.deleteMany({
    where: {
      learningItemId,
      courseLevelId: { not: courseLevelId },
      courseLevel: { courseId },
    },
  });
  const occupied = await db.courseLevelItem.findUnique({
    where: { courseLevelId_sortOrder: { courseLevelId, sortOrder } },
    select: { learningItemId: true },
  });

  if (occupied !== null && occupied.learningItemId !== learningItemId) {
    throw new Error(`Course level placement ${courseLevelId}:${sortOrder} is already occupied.`);
  }

  await db.courseLevelItem.upsert({
    where: {
      courseLevelId_learningItemId: {
        courseLevelId,
        learningItemId,
      },
    },
    update: {
      sortOrder,
      unlockPolicyJson: { policy: "level-order" },
    },
    create: {
      courseLevelId,
      learningItemId,
      sortOrder,
      unlockPolicyJson: { policy: "level-order" },
    },
  });
}

async function upsertCurationRecord(
  db: Prisma.TransactionClient,
  importRunId: string,
  batch: MainCourseContentBatch,
  type: "component" | "kanji",
  key: string,
  content: MainCourseComponentContent | MainCourseKanjiContent,
): Promise<void> {
  await db.importedRecord.upsert({
    where: {
      importRunId_recordType_sourceRecordId: {
        importRunId,
        recordType: "PROJECT_AUTHORED",
        sourceRecordId: `${batch.id}:${type}:${key}`,
      },
    },
    update: { rawJson: toJson(content) },
    create: {
      importRunId,
      recordType: "PROJECT_AUTHORED",
      sourceRecordId: `${batch.id}:${type}:${key}`,
      rawJson: toJson(content),
    },
  });
}

type AnswerInput = {
  readonly locale: "ru-RU" | "en-US";
  readonly text: string;
  readonly normalizedText: string;
  readonly answerKind: "MEANING" | "READING";
  readonly isPrimary: boolean;
};

function answer(
  locale: AnswerInput["locale"],
  text: string,
  answerKind: AnswerInput["answerKind"],
  isPrimary: boolean,
): AnswerInput {
  return {
    locale,
    text,
    normalizedText:
      answerKind === "READING" ? normalizeReading(text) : normalizeMeaning(text, locale),
    answerKind,
    isPrimary,
  };
}

function normalizeMeaning(value: string, locale: AnswerInput["locale"]): string {
  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase(locale).replace(/\s+/gu, " ");
  return locale === "ru-RU" ? normalized.replace(/ё/gu, "е") : normalized;
}

function normalizeReading(value: string): string {
  return [...value.normalize("NFKC").trim()]
    .filter((character) => character !== "." && character !== "-")
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && codePoint >= 0x30a1 && codePoint <= 0x30f6
        ? String.fromCodePoint(codePoint - 0x60)
        : character;
    })
    .join("");
}

function checksum(batch: MainCourseContentBatch): string {
  return createHash("sha256").update(JSON.stringify(batch), "utf8").digest("hex");
}

function batchStats(batch: MainCourseContentBatch): Prisma.InputJsonObject {
  return {
    batchId: batch.id,
    version: batch.version,
    reviewedAt: batch.reviewedAt,
    ...(batch.authoredAt === undefined ? {} : { authoredAt: batch.authoredAt }),
    ...(batch.reviewNotes === undefined ? {} : { reviewNotes: batch.reviewNotes }),
    components: batch.components.length,
    kanji: batch.kanji.length,
    cards: batch.components.length + batch.kanji.length * 2,
  };
}

function requiredLevelId(
  levels: ReadonlyMap<number, { readonly id: string }>,
  levelNumber: number,
): string {
  const level = levels.get(levelNumber);

  if (level === undefined) {
    throw new Error(`Missing main-course level ${levelNumber}.`);
  }

  return level.id;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function requireParentReview(batch: MainCourseContentBatch): void {
  if (batch.reviewedAt === null) {
    throw new Error(
      `Batch ${batch.id} needs independent parent review and reviewedAt before live application.`,
    );
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
