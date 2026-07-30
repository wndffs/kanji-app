import { createHash } from "node:crypto";

import { PrismaClient, type Prisma } from "@prisma/client";

import {
  buildMainCourseContentBatches,
  type MainCourseAcceptedMeanings,
  type MainCourseComponentContent,
  type MainCourseContentBatch,
  type MainCourseKanjiContent,
  validateMainCourseContentBatches,
} from "../src/main-course-content";

const prisma = new PrismaClient();
const CURATION_SOURCE_NAME = "Kanji SRS main-course curation";
const CURATION_LICENSE_NAME = "Project-authored main-course content";
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

async function main(): Promise<void> {
  const batches = buildMainCourseContentBatches();
  const issues = validateMainCourseContentBatches(batches);

  if (issues.length > 0) {
    throw new Error(`Main-course content is invalid: ${issues.join("; ")}`);
  }

  if (process.argv.includes("--validate-only")) {
    console.log(
      JSON.stringify(
        {
          status: "valid",
          batches: batches.map((batch) => ({
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

  const results = [];

  for (const batch of batches) {
    results.push(await applyBatch(batch));
  }

  console.log(JSON.stringify({ status: "success", batches: results }, null, 2));
}

async function applyBatch(batch: MainCourseContentBatch) {
  const checksumSha256 = checksum(batch);
  const dataSourceId = await upsertCurationSource();
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
    const course = await prisma.course.findUnique({
      where: { slug: batch.courseSlug },
      select: {
        id: true,
        levels: {
          where: {
            levelNumber: {
              in: [
                batch.componentLevelNumber,
                ...new Set(batch.kanji.map((item) => item.levelNumber)),
              ],
            },
          },
          select: { id: true, levelNumber: true, band: true },
        },
      },
    });

    if (course === null) {
      throw new Error(`Main course ${batch.courseSlug} is missing. Run npm run db:seed first.`);
    }

    const levelByNumber = new Map(course.levels.map((level) => [level.levelNumber, level]));
    const requiredLevels = new Set([
      batch.componentLevelNumber,
      ...batch.kanji.map((item) => item.levelNumber),
    ]);

    for (const levelNumber of requiredLevels) {
      const level = levelByNumber.get(levelNumber);

      if (level === undefined) {
        throw new Error(`Main course ${batch.courseSlug} is missing level ${levelNumber}.`);
      }

      if (level.band !== "FOUNDATION") {
        throw new Error(
          `Task 118 foundation batch cannot target ${level.band} level ${levelNumber}.`,
        );
      }
    }

    const componentLearningItemIds = new Map<string, string>();

    for (const [index, componentContent] of batch.components.entries()) {
      const learningItemId = await prisma.$transaction(
        (db) =>
          applyComponent(
            db,
            componentContent,
            batch,
            importRun.id,
            requiredLevelId(levelByNumber, batch.componentLevelNumber),
            course.id,
            index + 1,
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
            course.id,
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

async function upsertCurationSource(): Promise<string> {
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
      curriculumBand: "FOUNDATION",
      status: "PUBLISHED",
    },
    create: {
      kind: "COMPONENT",
      targetType: "COMPONENT",
      targetId: component.id,
      title: `Компонент ${content.symbol}`,
      levelHint: batch.componentLevelNumber,
      curriculumBand: "FOUNDATION",
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

async function applyKanji(
  db: Prisma.TransactionClient,
  content: MainCourseKanjiContent,
  batch: MainCourseContentBatch,
  importRunId: string,
  courseLevelId: string,
  courseId: string,
  componentLearningItemIds: ReadonlyMap<string, string>,
): Promise<void> {
  const kanji = await db.kanji.findUnique({
    where: { character: content.character },
    select: {
      id: true,
      kanjidicImportedRecordId: true,
      readings: {
        orderBy: [{ priority: "asc" }, { reading: "asc" }],
        select: { reading: true, priority: true },
      },
      strokeGraphic: { select: { id: true } },
    },
  });

  if (kanji === null || kanji.kanjidicImportedRecordId === null) {
    throw new Error(
      `Kanji ${content.character} is missing imported KANJIDIC2 evidence. Run the content import first.`,
    );
  }

  if (content.requireStrokeData && kanji.strokeGraphic === null) {
    throw new Error(`Kanji ${content.character} is missing required KanjiVG stroke data.`);
  }

  const sourceReading = normalizeReading(content.reading.source);
  if (!kanji.readings.some((reading) => normalizeReading(reading.reading) === sourceReading)) {
    throw new Error(
      `Kanji ${content.character} reading ${content.reading.source} is not supported by KANJIDIC2.`,
    );
  }

  if (
    normalizeReading(content.reading.primary) !== sourceReading ||
    normalizeReading(kanji.readings[0]?.reading ?? "") !== sourceReading
  ) {
    throw new Error(
      `Kanji ${content.character} taught reading must match its first KANJIDIC2 reading.`,
    );
  }

  await syncMeanings(db, kanji.id, "ru-RU", content.meanings.ru);
  await syncMeanings(db, kanji.id, "en-US", content.meanings.en);

  const componentIds = content.componentKeys.map((key) => {
    const learningItemId = componentLearningItemIds.get(key);

    if (learningItemId === undefined) {
      throw new Error(`Kanji ${content.character} references unapplied component ${key}.`);
    }

    return learningItemId;
  });
  const componentItems = await db.learningItem.findMany({
    where: {
      id: { in: componentIds },
      targetType: "COMPONENT",
      status: "PUBLISHED",
    },
    select: { id: true, targetId: true },
  });

  if (componentItems.length !== componentIds.length) {
    throw new Error(`Kanji ${content.character} has an unavailable component prerequisite.`);
  }

  await db.kanjiComponent.deleteMany({
    where: { kanjiId: kanji.id, sourceKind: "PROJECT_AUTHORED" },
  });
  await db.kanjiComponent.createMany({
    data: componentItems.map((item, index) => ({
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
      curriculumBand: "FOUNDATION",
      status: "PUBLISHED",
    },
    create: {
      kind: "KANJI",
      targetType: "KANJI",
      targetId: kanji.id,
      title: `Кандзи ${content.character}`,
      levelHint: content.levelNumber,
      curriculumBand: "FOUNDATION",
      status: "PUBLISHED",
    },
  });

  await syncCard(db, learningItem.id, "MEANING", "MEANING", 1, [
    ...content.meanings.ru.accepted.map((text, index) =>
      answer("ru-RU", text, "MEANING", index === 0),
    ),
    ...content.meanings.en.accepted.map((text, index) =>
      answer("en-US", text, "MEANING", index === 0),
    ),
  ]);
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
    data: componentItems.map((item) => ({
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

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
