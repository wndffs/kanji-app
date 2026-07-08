import { PrismaClient } from "@prisma/client";

import {
  buildStarterCourseSeed,
  validateStarterCourseSeed,
  type SeedHintType,
  type SeedItemKind,
  type SeedMnemonicType,
  type StarterCourseSeed,
  type StarterCourseSeedCard,
  type StarterCourseSeedItem,
  type StarterCourseSeedText,
} from "../src/course-seed";

const prisma = new PrismaClient();

const PROJECT_LICENSE_NAME = "Project-authored bootstrap content";
const PROJECT_SOURCE_NAME = "Kanji SRS bootstrap seed";
const BOOTSTRAP_CHECKSUM = "0000000000000000000000000000000000000000000000000000000000000001";
const DEV_USER_PASSWORD_HASH =
  "scrypt$v1$16384$8$1$a2Fuamktc3JzLWRldi1zZWVk$7_47H9cFgH7KJnffLc52GZ_JS1mgMrNNyDHoCeB9SEWoqIwQFxqMjei-5KN4qg2z9cRym1_PTySo7lRgCA9crg";

async function main(): Promise<void> {
  const seed = buildStarterCourseSeed();
  const validationIssues = validateStarterCourseSeed(seed);

  if (validationIssues.length > 0) {
    throw new Error(`Starter course seed is invalid: ${validationIssues.join("; ")}`);
  }

  const license = await upsertProjectLicense();
  const dataSource = await upsertProjectDataSource(license.id);
  const importRun = await upsertProjectImportRun(dataSource.id, seed);
  const targetIds = new Map<string, string>();

  for (const item of seed.items) {
    await upsertProjectRecord(importRun.id, item);
  }

  for (const item of seed.items.filter((candidate) => candidate.target.kind === "COMPONENT")) {
    targetIds.set(item.key, await upsertComponent(item));
  }

  for (const item of seed.items.filter((candidate) => candidate.target.kind === "KANJI")) {
    targetIds.set(item.key, await upsertKanji(item));
  }

  for (const item of seed.items.filter((candidate) => candidate.target.kind === "WORD")) {
    targetIds.set(item.key, await upsertWord(item));
  }

  for (const item of seed.items.filter((candidate) => candidate.target.kind === "SENTENCE")) {
    targetIds.set(item.key, await upsertSentence(item, dataSource.id, license.id));
  }

  const learningItemIds = await upsertLearningItems(seed, targetIds);
  await upsertLearningDependencies(seed, learningItemIds);
  await upsertLearningContent(seed, learningItemIds);
  const course = await upsertCourse(seed);
  await upsertCourseLevels(seed, course.id, learningItemIds);
  const srsSystem = await upsertDefaultSrsSystem();
  await upsertDefaultSrsStages(srsSystem.id);

  if (shouldSeedDevelopmentUser()) {
    await upsertDemoUser(seed, course.id);
  }
}

async function upsertProjectLicense() {
  return prisma.license.upsert({
    where: { name: PROJECT_LICENSE_NAME },
    update: {
      scope: "PROJECT_AUTHORED",
      requiresAttribution: false,
      requiresShareAlike: false,
      notes: "Handcrafted starter course content for local development and smoke testing.",
    },
    create: {
      name: PROJECT_LICENSE_NAME,
      spdxLikeId: "LicenseRef-Project-Authored",
      scope: "PROJECT_AUTHORED",
      requiresAttribution: false,
      requiresShareAlike: false,
      notes: "Handcrafted starter course content for local development and smoke testing.",
    },
  });
}

async function upsertProjectDataSource(licenseId: string) {
  return prisma.dataSource.upsert({
    where: { name: PROJECT_SOURCE_NAME },
    update: {
      homepageUrl: "https://example.local/kanji-srs/bootstrap-seed",
      attributionText: "Project-authored starter course data.",
      licenseId,
      notes: "Used only to exercise schema relations and local lesson/review flows.",
    },
    create: {
      name: PROJECT_SOURCE_NAME,
      homepageUrl: "https://example.local/kanji-srs/bootstrap-seed",
      licenseId,
      attributionText: "Project-authored starter course data.",
      notes: "Used only to exercise schema relations and local lesson/review flows.",
    },
  });
}

async function upsertProjectImportRun(dataSourceId: string, seed: StarterCourseSeed) {
  const statsJson = {
    levels: seed.course.levels.length,
    items: seed.items.length,
    components: countItems(seed, "COMPONENT"),
    kanji: countItems(seed, "KANJI"),
    words: countItems(seed, "WORD"),
    sentences: countItems(seed, "SENTENCE"),
    cards: seed.items.reduce((count, item) => count + item.cards.length, 0),
  };

  return prisma.importRun.upsert({
    where: {
      dataSourceId_checksumSha256: {
        dataSourceId,
        checksumSha256: BOOTSTRAP_CHECKSUM,
      },
    },
    update: {
      sourceVersion: "starter-course-1",
      sourceFileName: "packages/db/src/course-seed.ts",
      finishedAt: new Date(),
      status: "SUCCESS",
      statsJson,
      errorText: null,
    },
    create: {
      dataSourceId,
      sourceVersion: "starter-course-1",
      sourceFileName: "packages/db/src/course-seed.ts",
      checksumSha256: BOOTSTRAP_CHECKSUM,
      finishedAt: new Date(),
      status: "SUCCESS",
      statsJson,
      errorText: null,
    },
  });
}

async function upsertProjectRecord(
  importRunId: string,
  item: StarterCourseSeedItem,
): Promise<void> {
  await prisma.importedRecord.upsert({
    where: {
      importRunId_recordType_sourceRecordId: {
        importRunId,
        recordType: "PROJECT_AUTHORED",
        sourceRecordId: sourceRecordIdFor(item),
      },
    },
    update: {
      rawJson: item,
    },
    create: {
      importRunId,
      recordType: "PROJECT_AUTHORED",
      sourceRecordId: sourceRecordIdFor(item),
      rawJson: item,
    },
  });
}

async function upsertComponent(item: StarterCourseSeedItem): Promise<string> {
  if (item.target.kind !== "COMPONENT") {
    throw new Error(`${item.key} is not a component target.`);
  }

  const component = await prisma.component.upsert({
    where: { symbol: item.target.symbol },
    update: {
      displayNameRu: item.target.displayNameRu,
      meaningRu: item.target.meaningRu,
      meaningEn: item.target.meaningEn,
      sourceKind: "PROJECT_AUTHORED",
      notes: item.target.notes,
    },
    create: {
      symbol: item.target.symbol,
      displayNameRu: item.target.displayNameRu,
      meaningRu: item.target.meaningRu,
      meaningEn: item.target.meaningEn,
      sourceKind: "PROJECT_AUTHORED",
      notes: item.target.notes,
    },
  });

  return component.id;
}

async function upsertKanji(item: StarterCourseSeedItem): Promise<string> {
  if (item.target.kind !== "KANJI") {
    throw new Error(`${item.key} is not a kanji target.`);
  }

  const kanji = await prisma.kanji.upsert({
    where: { character: item.target.character },
    update: {
      strokeCount: item.target.strokeCount,
      jlptLevel: item.target.jlptLevel,
      kanjidicSourceId: sourceRecordIdFor(item),
    },
    create: {
      character: item.target.character,
      strokeCount: item.target.strokeCount,
      jlptLevel: item.target.jlptLevel,
      kanjidicSourceId: sourceRecordIdFor(item),
    },
  });

  for (const reading of item.target.readings) {
    await prisma.kanjiReading.upsert({
      where: {
        kanjiId_reading_readingType: {
          kanjiId: kanji.id,
          reading: reading.reading,
          readingType: reading.readingType,
        },
      },
      update: { priority: reading.priority },
      create: {
        kanjiId: kanji.id,
        reading: reading.reading,
        readingType: reading.readingType,
        priority: reading.priority,
      },
    });
  }

  for (const meaning of item.target.meanings) {
    await prisma.kanjiMeaning.upsert({
      where: {
        kanjiId_locale_meaning: {
          kanjiId: kanji.id,
          locale: meaning.locale,
          meaning: meaning.text,
        },
      },
      update: {
        isPrimary: meaning.isPrimary,
        sourceKind: "PROJECT_AUTHORED",
      },
      create: {
        kanjiId: kanji.id,
        locale: meaning.locale,
        meaning: meaning.text,
        isPrimary: meaning.isPrimary,
        sourceKind: "PROJECT_AUTHORED",
      },
    });
  }

  for (const componentLink of item.target.components) {
    const component = await prisma.component.findUnique({
      where: {
        symbol: componentSymbolForKey(componentLink.componentKey),
      },
    });

    if (component === null) {
      throw new Error(`${item.key} references missing component ${componentLink.componentKey}.`);
    }

    await prisma.kanjiComponent.upsert({
      where: {
        kanjiId_componentId_position: {
          kanjiId: kanji.id,
          componentId: component.id,
          position: componentLink.position,
        },
      },
      update: {
        sourceKind: "PROJECT_AUTHORED",
        confidence: 1,
      },
      create: {
        kanjiId: kanji.id,
        componentId: component.id,
        position: componentLink.position,
        sourceKind: "PROJECT_AUTHORED",
        confidence: 1,
      },
    });
  }

  return kanji.id;
}

async function upsertWord(item: StarterCourseSeedItem): Promise<string> {
  if (item.target.kind !== "WORD") {
    throw new Error(`${item.key} is not a word target.`);
  }

  const word = await prisma.word.upsert({
    where: {
      expression_reading: {
        expression: item.target.expression,
        reading: item.target.reading,
      },
    },
    update: {
      jlptLevel: item.target.jlptLevel,
      jmdictEntryId: sourceRecordIdFor(item),
    },
    create: {
      expression: item.target.expression,
      reading: item.target.reading,
      jlptLevel: item.target.jlptLevel,
      jmdictEntryId: sourceRecordIdFor(item),
    },
  });

  for (const sense of item.target.senses) {
    await prisma.wordSense.upsert({
      where: {
        wordId_locale_meaning_partOfSpeech: {
          wordId: word.id,
          locale: sense.locale,
          meaning: sense.meaning,
          partOfSpeech: sense.partOfSpeech,
        },
      },
      update: { sourceKind: "PROJECT_AUTHORED" },
      create: {
        wordId: word.id,
        locale: sense.locale,
        meaning: sense.meaning,
        partOfSpeech: sense.partOfSpeech,
        sourceKind: "PROJECT_AUTHORED",
      },
    });
  }

  return word.id;
}

async function upsertSentence(
  item: StarterCourseSeedItem,
  dataSourceId: string,
  licenseId: string,
): Promise<string> {
  if (item.target.kind !== "SENTENCE") {
    throw new Error(`${item.key} is not a sentence target.`);
  }

  const sentence = await prisma.sentence.upsert({
    where: {
      dataSourceId_sourceId: {
        dataSourceId,
        sourceId: sourceRecordIdFor(item),
      },
    },
    update: {
      japaneseText: item.target.japaneseText,
      readingText: item.target.readingText,
      translationRu: item.target.translationRu,
      translationEn: item.target.translationEn,
      difficulty: item.target.difficulty,
      licenseId,
    },
    create: {
      japaneseText: item.target.japaneseText,
      readingText: item.target.readingText,
      translationRu: item.target.translationRu,
      translationEn: item.target.translationEn,
      difficulty: item.target.difficulty,
      sourceId: sourceRecordIdFor(item),
      dataSourceId,
      licenseId,
    },
  });

  return sentence.id;
}

async function upsertLearningItems(
  seed: StarterCourseSeed,
  targetIds: ReadonlyMap<string, string>,
): Promise<Map<string, string>> {
  const learningItemIds = new Map<string, string>();

  for (const item of seed.items) {
    const targetId = requiredMapValue(targetIds, item.key);
    const learningItem = await prisma.learningItem.upsert({
      where: {
        targetType_targetId: {
          targetType: item.kind,
          targetId,
        },
      },
      update: {
        kind: item.kind,
        title: item.title,
        levelHint: item.levelNumber,
        curriculumBand: item.band,
        status: "PUBLISHED",
      },
      create: {
        kind: item.kind,
        targetType: item.kind,
        targetId,
        title: item.title,
        levelHint: item.levelNumber,
        curriculumBand: item.band,
        status: "PUBLISHED",
      },
    });

    learningItemIds.set(item.key, learningItem.id);
  }

  return learningItemIds;
}

async function upsertLearningDependencies(
  seed: StarterCourseSeed,
  learningItemIds: ReadonlyMap<string, string>,
): Promise<void> {
  for (const item of seed.items) {
    const learningItemId = requiredMapValue(learningItemIds, item.key);

    for (const dependency of item.dependencies ?? []) {
      await prisma.dependency.upsert({
        where: {
          learningItemId_prerequisiteItemId_dependencyType: {
            learningItemId,
            prerequisiteItemId: requiredMapValue(learningItemIds, dependency.prerequisiteKey),
            dependencyType: "PREREQUISITE",
          },
        },
        update: { requiredStage: dependency.requiredStage },
        create: {
          learningItemId,
          prerequisiteItemId: requiredMapValue(learningItemIds, dependency.prerequisiteKey),
          dependencyType: "PREREQUISITE",
          requiredStage: dependency.requiredStage,
        },
      });
    }
  }
}

async function upsertLearningContent(
  seed: StarterCourseSeed,
  learningItemIds: ReadonlyMap<string, string>,
): Promise<void> {
  for (const item of seed.items) {
    const learningItemId = requiredMapValue(learningItemIds, item.key);

    for (const card of item.cards) {
      const learningCard = await upsertCard(learningItemId, card);

      for (const answer of card.acceptedAnswers) {
        await upsertAnswer(learningCard.id, answer);
      }

      for (const blockedAnswer of card.blockedAnswers ?? []) {
        await prisma.blockedAnswer.upsert({
          where: {
            learningCardId_normalizedText: {
              learningCardId: learningCard.id,
              normalizedText: blockedAnswer.normalizedText,
            },
          },
          update: {
            text: blockedAnswer.text,
            reason: blockedAnswer.reason,
          },
          create: {
            learningCardId: learningCard.id,
            text: blockedAnswer.text,
            normalizedText: blockedAnswer.normalizedText,
            reason: blockedAnswer.reason,
          },
        });
      }
    }

    for (const mnemonic of item.mnemonics ?? []) {
      await upsertMnemonic(learningItemId, mnemonic);
    }

    for (const hint of item.hints ?? []) {
      await upsertHint(learningItemId, hint);
    }
  }
}

async function upsertCourse(seed: StarterCourseSeed) {
  return prisma.course.upsert({
    where: { slug: seed.course.slug },
    update: {
      titleRu: seed.course.titleRu,
      descriptionRu: seed.course.descriptionRu,
      targetLevel: seed.course.targetLevel,
      band: seed.course.band,
      courseType: "DEMO",
      status: "PUBLISHED",
    },
    create: {
      slug: seed.course.slug,
      titleRu: seed.course.titleRu,
      descriptionRu: seed.course.descriptionRu,
      targetLevel: seed.course.targetLevel,
      band: seed.course.band,
      courseType: "DEMO",
      status: "PUBLISHED",
    },
  });
}

async function upsertCourseLevels(
  seed: StarterCourseSeed,
  courseId: string,
  learningItemIds: ReadonlyMap<string, string>,
): Promise<void> {
  await prisma.courseLevelItem.deleteMany({
    where: {
      courseLevel: {
        courseId,
      },
    },
  });

  const activeLevelNumbers = seed.course.levels.map((level) => level.levelNumber);
  await prisma.courseLevel.deleteMany({
    where: {
      courseId,
      levelNumber: { notIn: activeLevelNumbers },
    },
  });

  for (const level of seed.course.levels) {
    const courseLevel = await prisma.courseLevel.upsert({
      where: {
        courseId_levelNumber: {
          courseId,
          levelNumber: level.levelNumber,
        },
      },
      update: {
        band: level.band,
        titleRu: level.titleRu,
        descriptionRu: level.descriptionRu,
      },
      create: {
        courseId,
        levelNumber: level.levelNumber,
        band: level.band,
        titleRu: level.titleRu,
        descriptionRu: level.descriptionRu,
      },
    });

    for (const item of seed.items
      .filter((candidate) => candidate.levelNumber === level.levelNumber)
      .sort((left, right) => left.sortOrder - right.sortOrder)) {
      await prisma.courseLevelItem.upsert({
        where: {
          courseLevelId_learningItemId: {
            courseLevelId: courseLevel.id,
            learningItemId: requiredMapValue(learningItemIds, item.key),
          },
        },
        update: {
          sortOrder: item.sortOrder,
          unlockPolicyJson: { policy: "level-order" },
        },
        create: {
          courseLevelId: courseLevel.id,
          learningItemId: requiredMapValue(learningItemIds, item.key),
          sortOrder: item.sortOrder,
          unlockPolicyJson: { policy: "level-order" },
        },
      });
    }
  }
}

async function upsertDefaultSrsSystem() {
  return prisma.srsSystem.upsert({
    where: { slug: "default-mvp" },
    update: {
      title: "Default MVP SRS",
      configJson: { source: "starter-course-seed" },
    },
    create: {
      slug: "default-mvp",
      title: "Default MVP SRS",
      configJson: { source: "starter-course-seed" },
    },
  });
}

async function upsertDefaultSrsStages(srsSystemId: string): Promise<void> {
  const stages = [
    ["Apprentice 1", 240, false],
    ["Apprentice 2", 480, false],
    ["Apprentice 3", 1440, false],
    ["Apprentice 4", 2880, false],
    ["Guru 1", 10080, false],
    ["Guru 2", 20160, false],
    ["Master", 43200, false],
    ["Enlightened", 172800, false],
    ["Burned", null, true],
  ] as const;

  for (const [index, [name, intervalMinutes, isBurned]] of stages.entries()) {
    await prisma.srsStage.upsert({
      where: {
        srsSystemId_stageIndex: {
          srsSystemId,
          stageIndex: index + 1,
        },
      },
      update: {
        name,
        intervalMinutes,
        isBurned,
      },
      create: {
        srsSystemId,
        stageIndex: index + 1,
        name,
        intervalMinutes,
        isBurned,
      },
    });
  }
}

async function upsertDemoUser(seed: StarterCourseSeed, courseId: string): Promise<void> {
  const demoUser = await prisma.user.upsert({
    where: { email: seed.demoUser.email },
    update: {
      displayName: seed.demoUser.displayName,
      role: "USER",
      passwordHash: DEV_USER_PASSWORD_HASH,
    },
    create: {
      email: seed.demoUser.email,
      passwordHash: DEV_USER_PASSWORD_HASH,
      displayName: seed.demoUser.displayName,
      role: "USER",
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: demoUser.id },
    update: {
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
      dailyLessonLimit: 10,
      reviewBudget: 100,
      strictMode: false,
    },
    create: {
      userId: demoUser.id,
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
      dailyLessonLimit: 10,
      reviewBudget: 100,
      strictMode: false,
    },
  });

  await prisma.userEnrollment.upsert({
    where: {
      userId_courseId: {
        userId: demoUser.id,
        courseId,
      },
    },
    update: { status: "ACTIVE" },
    create: {
      userId: demoUser.id,
      courseId,
      status: "ACTIVE",
    },
  });
}

function shouldSeedDevelopmentUser(): boolean {
  return process.env.NODE_ENV !== "production";
}

async function upsertCard(learningItemId: string, card: StarterCourseSeedCard) {
  return prisma.learningCard.upsert({
    where: {
      learningItemId_promptType_answerType_locale: {
        learningItemId,
        promptType: card.promptType,
        answerType: card.answerType,
        locale: "ru-RU",
      },
    },
    update: {
      cardType: "REVIEW",
      sortOrder: card.sortOrder,
    },
    create: {
      learningItemId,
      cardType: "REVIEW",
      promptType: card.promptType,
      answerType: card.answerType,
      locale: "ru-RU",
      sortOrder: card.sortOrder,
    },
  });
}

async function upsertAnswer(
  learningCardId: string,
  answer: StarterCourseSeedCard["acceptedAnswers"][number],
): Promise<void> {
  await prisma.learningAnswer.upsert({
    where: {
      learningCardId_normalizedText_answerKind_locale: {
        learningCardId,
        normalizedText: answer.normalizedText,
        answerKind: answer.answerKind,
        locale: answer.locale,
      },
    },
    update: {
      text: answer.text,
      isPrimary: answer.isPrimary,
    },
    create: {
      learningCardId,
      text: answer.text,
      normalizedText: answer.normalizedText,
      answerKind: answer.answerKind,
      locale: answer.locale,
      isPrimary: answer.isPrimary,
    },
  });
}

async function upsertMnemonic(learningItemId: string, text: StarterCourseSeedText): Promise<void> {
  const mnemonicType = toMnemonicType(text.type);

  await prisma.mnemonic.upsert({
    where: {
      learningItemId_locale_mnemonicType_version: {
        learningItemId,
        locale: text.locale,
        mnemonicType,
        version: 1,
      },
    },
    update: { body: text.body },
    create: {
      learningItemId,
      locale: text.locale,
      mnemonicType,
      body: text.body,
      sourceKind: "PROJECT_AUTHORED",
      version: 1,
    },
  });
}

async function upsertHint(learningItemId: string, text: StarterCourseSeedText): Promise<void> {
  const hintType = toHintType(text.type);

  await prisma.hint.upsert({
    where: {
      learningItemId_locale_hintType_version: {
        learningItemId,
        locale: text.locale,
        hintType,
        version: 1,
      },
    },
    update: { body: text.body },
    create: {
      learningItemId,
      locale: text.locale,
      hintType,
      body: text.body,
      sourceKind: "PROJECT_AUTHORED",
      version: 1,
    },
  });
}

function countItems(seed: StarterCourseSeed, kind: SeedItemKind): number {
  return seed.items.filter((item) => item.kind === kind).length;
}

function sourceRecordIdFor(item: StarterCourseSeedItem): string {
  return `starter:${item.kind.toLowerCase()}:${item.key}`;
}

function componentSymbolForKey(componentKey: string): string {
  const component = buildStarterCourseSeed().items.find(
    (item) => item.key === componentKey && item.target.kind === "COMPONENT",
  );

  if (component?.target.kind !== "COMPONENT") {
    throw new Error(`Unknown component key ${componentKey}.`);
  }

  return component.target.symbol;
}

function requiredMapValue(map: ReadonlyMap<string, string>, key: string): string {
  const value = map.get(key);

  if (value === undefined) {
    throw new Error(`Missing seed map value for ${key}.`);
  }

  return value;
}

function toMnemonicType(type: StarterCourseSeedText["type"]): SeedMnemonicType {
  if (type === "MEANING" || type === "READING" || type === "STORY") {
    return type;
  }

  throw new Error(`Unsupported mnemonic type ${type}.`);
}

function toHintType(type: StarterCourseSeedText["type"]): SeedHintType {
  if (type === "MEANING" || type === "READING" || type === "USAGE") {
    return type;
  }

  throw new Error(`Unsupported hint type ${type}.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
