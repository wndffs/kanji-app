import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROJECT_LICENSE_NAME = "Project-authored bootstrap content";
const PROJECT_SOURCE_NAME = "Kanji SRS bootstrap seed";
const BOOTSTRAP_CHECKSUM = "0000000000000000000000000000000000000000000000000000000000000001";
const DEV_USER_PASSWORD_HASH =
  "scrypt$v1$16384$8$1$a2Fuamktc3JzLWRldi1zZWVk$7_47H9cFgH7KJnffLc52GZ_JS1mgMrNNyDHoCeB9SEWoqIwQFxqMjei-5KN4qg2z9cRym1_PTySo7lRgCA9crg";

async function main(): Promise<void> {
  const license = await prisma.license.upsert({
    where: { name: PROJECT_LICENSE_NAME },
    update: {
      notes: "Tiny handcrafted demo content for local development only.",
    },
    create: {
      name: PROJECT_LICENSE_NAME,
      spdxLikeId: "LicenseRef-Project-Authored",
      scope: "PROJECT_AUTHORED",
      requiresAttribution: false,
      requiresShareAlike: false,
      notes: "Tiny handcrafted demo content for local development only.",
    },
  });

  const dataSource = await prisma.dataSource.upsert({
    where: { name: PROJECT_SOURCE_NAME },
    update: {
      attributionText: "Project-authored sample data.",
      licenseId: license.id,
    },
    create: {
      name: PROJECT_SOURCE_NAME,
      homepageUrl: "https://example.local/kanji-srs/bootstrap-seed",
      licenseId: license.id,
      attributionText: "Project-authored sample data.",
      notes: "Used only to exercise schema relations in development.",
    },
  });

  const importRun = await prisma.importRun.upsert({
    where: {
      dataSourceId_checksumSha256: {
        dataSourceId: dataSource.id,
        checksumSha256: BOOTSTRAP_CHECKSUM,
      },
    },
    update: {
      finishedAt: new Date(),
      status: "SUCCESS",
      statsJson: { components: 1, kanji: 1, words: 1, cards: 4 },
    },
    create: {
      dataSourceId: dataSource.id,
      sourceVersion: "bootstrap-1",
      sourceFileName: "packages/db/prisma/seed.ts",
      checksumSha256: BOOTSTRAP_CHECKSUM,
      finishedAt: new Date(),
      status: "SUCCESS",
      statsJson: { components: 1, kanji: 1, words: 1, cards: 4 },
    },
  });

  await prisma.importedRecord.upsert({
    where: {
      importRunId_recordType_sourceRecordId: {
        importRunId: importRun.id,
        recordType: "PROJECT_AUTHORED",
        sourceRecordId: "bootstrap:one",
      },
    },
    update: {
      rawJson: { symbol: "一", meaningRu: "один" },
    },
    create: {
      importRunId: importRun.id,
      recordType: "PROJECT_AUTHORED",
      sourceRecordId: "bootstrap:one",
      rawJson: { symbol: "一", meaningRu: "один" },
    },
  });

  const component = await prisma.component.upsert({
    where: { symbol: "一" },
    update: {
      displayNameRu: "горизонтальная черта",
      meaningRu: "один",
      sourceKind: "PROJECT_AUTHORED",
    },
    create: {
      symbol: "一",
      displayNameRu: "горизонтальная черта",
      meaningRu: "один",
      sourceKind: "PROJECT_AUTHORED",
      notes: "Handcrafted bootstrap component, not imported from an external course.",
    },
  });

  const kanji = await prisma.kanji.upsert({
    where: { character: "一" },
    update: {
      strokeCount: 1,
      jlptLevel: 5,
      kanjidicSourceId: "bootstrap:kanji:one",
    },
    create: {
      character: "一",
      strokeCount: 1,
      jlptLevel: 5,
      kanjidicSourceId: "bootstrap:kanji:one",
    },
  });

  await prisma.kanjiComponent.upsert({
    where: {
      kanjiId_componentId_position: {
        kanjiId: kanji.id,
        componentId: component.id,
        position: "full",
      },
    },
    update: {
      sourceKind: "PROJECT_AUTHORED",
      confidence: 1,
    },
    create: {
      kanjiId: kanji.id,
      componentId: component.id,
      position: "full",
      sourceKind: "PROJECT_AUTHORED",
      confidence: 1,
    },
  });

  await prisma.kanjiReading.upsert({
    where: {
      kanjiId_reading_readingType: {
        kanjiId: kanji.id,
        reading: "いち",
        readingType: "ONYOMI",
      },
    },
    update: { priority: 10 },
    create: {
      kanjiId: kanji.id,
      reading: "いち",
      readingType: "ONYOMI",
      priority: 10,
    },
  });

  await prisma.kanjiReading.upsert({
    where: {
      kanjiId_reading_readingType: {
        kanjiId: kanji.id,
        reading: "ひと",
        readingType: "KUNYOMI",
      },
    },
    update: { priority: 5 },
    create: {
      kanjiId: kanji.id,
      reading: "ひと",
      readingType: "KUNYOMI",
      priority: 5,
    },
  });

  await prisma.kanjiMeaning.upsert({
    where: {
      kanjiId_locale_meaning: {
        kanjiId: kanji.id,
        locale: "ru-RU",
        meaning: "один",
      },
    },
    update: {
      isPrimary: true,
      sourceKind: "PROJECT_AUTHORED",
    },
    create: {
      kanjiId: kanji.id,
      locale: "ru-RU",
      meaning: "один",
      isPrimary: true,
      sourceKind: "PROJECT_AUTHORED",
    },
  });

  const word = await prisma.word.upsert({
    where: {
      expression_reading: {
        expression: "一",
        reading: "いち",
      },
    },
    update: {
      jlptLevel: 5,
      jmdictEntryId: "bootstrap:word:one",
    },
    create: {
      expression: "一",
      reading: "いち",
      jlptLevel: 5,
      jmdictEntryId: "bootstrap:word:one",
    },
  });

  await prisma.wordSense.createMany({
    data: [
      {
        wordId: word.id,
        locale: "ru-RU",
        meaning: "один",
        partOfSpeech: "number",
        sourceKind: "PROJECT_AUTHORED",
      },
    ],
    skipDuplicates: true,
  });

  const componentItem = await prisma.learningItem.upsert({
    where: {
      targetType_targetId: {
        targetType: "COMPONENT",
        targetId: component.id,
      },
    },
    update: {
      title: "Компонент 一",
      status: "PUBLISHED",
    },
    create: {
      kind: "COMPONENT",
      targetType: "COMPONENT",
      targetId: component.id,
      title: "Компонент 一",
      levelHint: 1,
      status: "PUBLISHED",
    },
  });

  const kanjiItem = await prisma.learningItem.upsert({
    where: {
      targetType_targetId: {
        targetType: "KANJI",
        targetId: kanji.id,
      },
    },
    update: {
      title: "Кандзи 一",
      status: "PUBLISHED",
    },
    create: {
      kind: "KANJI",
      targetType: "KANJI",
      targetId: kanji.id,
      title: "Кандзи 一",
      levelHint: 1,
      status: "PUBLISHED",
    },
  });

  const wordItem = await prisma.learningItem.upsert({
    where: {
      targetType_targetId: {
        targetType: "WORD",
        targetId: word.id,
      },
    },
    update: {
      title: "Слово 一",
      status: "PUBLISHED",
    },
    create: {
      kind: "WORD",
      targetType: "WORD",
      targetId: word.id,
      title: "Слово 一",
      levelHint: 1,
      status: "PUBLISHED",
    },
  });

  await prisma.dependency.upsert({
    where: {
      learningItemId_prerequisiteItemId_dependencyType: {
        learningItemId: kanjiItem.id,
        prerequisiteItemId: componentItem.id,
        dependencyType: "PREREQUISITE",
      },
    },
    update: { requiredStage: 1 },
    create: {
      learningItemId: kanjiItem.id,
      prerequisiteItemId: componentItem.id,
      dependencyType: "PREREQUISITE",
      requiredStage: 1,
    },
  });

  await prisma.dependency.upsert({
    where: {
      learningItemId_prerequisiteItemId_dependencyType: {
        learningItemId: wordItem.id,
        prerequisiteItemId: kanjiItem.id,
        dependencyType: "PREREQUISITE",
      },
    },
    update: { requiredStage: 2 },
    create: {
      learningItemId: wordItem.id,
      prerequisiteItemId: kanjiItem.id,
      dependencyType: "PREREQUISITE",
      requiredStage: 2,
    },
  });

  const componentMeaningCard = await upsertCard(componentItem.id, "MEANING", "MEANING", 1);
  const kanjiMeaningCard = await upsertCard(kanjiItem.id, "MEANING", "MEANING", 1);
  const kanjiReadingCard = await upsertCard(kanjiItem.id, "READING", "READING", 2);
  const wordMeaningCard = await upsertCard(wordItem.id, "MEANING", "MEANING", 1);

  await upsertAnswer(componentMeaningCard.id, "один", "один", "MEANING", true);
  await upsertAnswer(kanjiMeaningCard.id, "один", "один", "MEANING", true);
  await upsertAnswer(kanjiReadingCard.id, "いち", "いち", "READING", true);
  await upsertAnswer(wordMeaningCard.id, "один", "один", "MEANING", true);

  await prisma.blockedAnswer.upsert({
    where: {
      learningCardId_normalizedText: {
        learningCardId: componentMeaningCard.id,
        normalizedText: "черта",
      },
    },
    update: {
      reason: "Слишком общее значение для учебной карточки.",
    },
    create: {
      learningCardId: componentMeaningCard.id,
      text: "черта",
      normalizedText: "черта",
      reason: "Слишком общее значение для учебной карточки.",
    },
  });

  await upsertMnemonic(
    componentItem.id,
    "MEANING",
    "Представь одну короткую линию: это самый простой знак для количества один.",
  );
  await upsertHint(kanjiItem.id, "READING", "Для базового счета используй чтение いち.");

  const course = await prisma.course.upsert({
    where: { slug: "starter-demo" },
    update: {
      titleRu: "Демо-курс",
      status: "PUBLISHED",
    },
    create: {
      slug: "starter-demo",
      titleRu: "Демо-курс",
      descriptionRu: "Минимальный авторский курс для проверки локальной разработки.",
      targetLevel: "N5",
      courseType: "DEMO",
      status: "PUBLISHED",
    },
  });

  const level = await prisma.courseLevel.upsert({
    where: {
      courseId_levelNumber: {
        courseId: course.id,
        levelNumber: 1,
      },
    },
    update: {
      titleRu: "Первый знак",
    },
    create: {
      courseId: course.id,
      levelNumber: 1,
      titleRu: "Первый знак",
      descriptionRu: "Компонент, кандзи и слово для числа один.",
    },
  });

  await upsertCourseLevelItem(level.id, componentItem.id, 1);
  await upsertCourseLevelItem(level.id, kanjiItem.id, 2);
  await upsertCourseLevelItem(level.id, wordItem.id, 3);

  const srsSystem = await prisma.srsSystem.upsert({
    where: { slug: "default-mvp" },
    update: {
      title: "Default MVP SRS",
      configJson: { source: "bootstrap-seed" },
    },
    create: {
      slug: "default-mvp",
      title: "Default MVP SRS",
      configJson: { source: "bootstrap-seed" },
    },
  });

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
          srsSystemId: srsSystem.id,
          stageIndex: index + 1,
        },
      },
      update: {
        name,
        intervalMinutes,
        isBurned,
      },
      create: {
        srsSystemId: srsSystem.id,
        stageIndex: index + 1,
        name,
        intervalMinutes,
        isBurned,
      },
    });
  }

  if (shouldSeedDevelopmentUser()) {
    const demoUser = await prisma.user.upsert({
      where: { email: "demo@example.local" },
      update: {
        displayName: "Demo",
        role: "USER",
        passwordHash: DEV_USER_PASSWORD_HASH,
      },
      create: {
        email: "demo@example.local",
        passwordHash: DEV_USER_PASSWORD_HASH,
        displayName: "Demo",
        role: "USER",
      },
    });

    await prisma.userSettings.upsert({
      where: { userId: demoUser.id },
      update: {
        locale: "ru-RU",
        translationDisplayMode: "ru",
        timezone: "Europe/Moscow",
      },
      create: {
        userId: demoUser.id,
        locale: "ru-RU",
        translationDisplayMode: "ru",
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
          courseId: course.id,
        },
      },
      update: { status: "ACTIVE" },
      create: {
        userId: demoUser.id,
        courseId: course.id,
        status: "ACTIVE",
      },
    });
  }
}

function shouldSeedDevelopmentUser(): boolean {
  return process.env.NODE_ENV !== "production";
}

async function upsertCard(
  learningItemId: string,
  promptType: "MEANING" | "READING",
  answerType: "MEANING" | "READING",
  sortOrder: number,
) {
  return prisma.learningCard.upsert({
    where: {
      learningItemId_promptType_answerType_locale: {
        learningItemId,
        promptType,
        answerType,
        locale: "ru-RU",
      },
    },
    update: {
      cardType: "REVIEW",
      sortOrder,
    },
    create: {
      learningItemId,
      cardType: "REVIEW",
      promptType,
      answerType,
      locale: "ru-RU",
      sortOrder,
    },
  });
}

async function upsertAnswer(
  learningCardId: string,
  text: string,
  normalizedText: string,
  answerKind: "MEANING" | "READING",
  isPrimary: boolean,
): Promise<void> {
  await prisma.learningAnswer.upsert({
    where: {
      learningCardId_normalizedText_answerKind_locale: {
        learningCardId,
        normalizedText,
        answerKind,
        locale: "ru-RU",
      },
    },
    update: {
      text,
      isPrimary,
    },
    create: {
      learningCardId,
      text,
      normalizedText,
      answerKind,
      locale: "ru-RU",
      isPrimary,
    },
  });
}

async function upsertMnemonic(
  learningItemId: string,
  mnemonicType: "MEANING" | "READING" | "STORY",
  body: string,
): Promise<void> {
  await prisma.mnemonic.upsert({
    where: {
      learningItemId_locale_mnemonicType_version: {
        learningItemId,
        locale: "ru-RU",
        mnemonicType,
        version: 1,
      },
    },
    update: { body },
    create: {
      learningItemId,
      locale: "ru-RU",
      mnemonicType,
      body,
      sourceKind: "PROJECT_AUTHORED",
      version: 1,
    },
  });
}

async function upsertHint(
  learningItemId: string,
  hintType: "MEANING" | "READING" | "USAGE",
  body: string,
): Promise<void> {
  await prisma.hint.upsert({
    where: {
      learningItemId_locale_hintType_version: {
        learningItemId,
        locale: "ru-RU",
        hintType,
        version: 1,
      },
    },
    update: { body },
    create: {
      learningItemId,
      locale: "ru-RU",
      hintType,
      body,
      sourceKind: "PROJECT_AUTHORED",
      version: 1,
    },
  });
}

async function upsertCourseLevelItem(
  courseLevelId: string,
  learningItemId: string,
  sortOrder: number,
): Promise<void> {
  await prisma.courseLevelItem.upsert({
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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
