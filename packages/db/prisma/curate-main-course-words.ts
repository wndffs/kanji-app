import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeJapaneseReading, normalizeMeaning } from "@kanji-srs/japanese";
import { PrismaClient, type Prisma } from "@prisma/client";

import { withNeonConnectionDefaults } from "../src/connection-defaults";
import { buildMainCourseBlueprint } from "../src/main-course";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
} from "../src/main-course-content";
import {
  AUTHORED_WORD_PART_OF_SPEECH,
  buildMainCourseWordBatch,
  buildMainCourseWordBatches,
  mainCourseWordAcceptedReadings,
  mainCourseWordBatchChecksum,
  validateMainCourseWordBatch,
  validateMainCourseWordBatches,
  wordHanCharacters,
  type MainCourseWordBatch,
  type MainCourseWordContent,
} from "../src/main-course-word-content";
import { writeWordExample } from "../src/word-examples";

const SOURCE_NAME = "Kanji SRS main-course word curation";
const LICENSE_NAME = "Project-authored main-course word content";
const SOURCE_URL =
  "https://github.com/wndffs/kanji-app/blob/main/packages/db/src/main-course-word-content.ts";
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;
type Reader = Pick<
  Prisma.TransactionClient,
  | "course"
  | "word"
  | "kanji"
  | "learningItem"
  | "courseLevelItem"
  | "license"
  | "dataSource"
  | "sentence"
>;

const WORD_SOURCE_SELECT = {
  id: true,
  expression: true,
  reading: true,
  jmdictEntryId: true,
  jmdictImportedRecordId: true,
  senses: { select: { locale: true, meaning: true, partOfSpeech: true, sourceKind: true } },
  importedRecord: {
    select: {
      id: true,
      recordType: true,
      sourceRecordId: true,
      rawJson: true,
      importRun: {
        select: {
          id: true,
          dataSourceId: true,
          status: true,
          sourceVersion: true,
          checksumSha256: true,
          dataSource: {
            select: {
              id: true,
              name: true,
              licenseId: true,
              homepageUrl: true,
              attributionText: true,
              license: {
                select: {
                  id: true,
                  name: true,
                  scope: true,
                  spdxLikeId: true,
                  url: true,
                  requiresAttribution: true,
                },
              },
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.WordSelect;

const PLAN_READ_CACHE_LIMIT = 512;
type PlanReadCache = {
  courses: Map<string, Awaited<ReturnType<typeof readPlanCourse>>>;
  kanji: Map<string, Awaited<ReturnType<typeof readPlanKanji>>>;
};

async function readPlanCourse(db: Reader, slug: string) {
  return db.course.findUnique({
    where: { slug },
    select: { id: true, levels: { select: { id: true, levelNumber: true, band: true } } },
  });
}

async function readPlanKanji(db: Reader, character: string, courseId: string) {
  const raw = await db.kanji.findUnique({ where: { character }, select: { id: true } });
  const item = raw === null ? null : await findItem(db, "KANJI", raw.id, courseId);
  return { raw, item };
}

export async function planMainCourseWordBatch(
  db: Reader,
  batch: MainCourseWordBatch = buildMainCourseWordBatch(),
) {
  return planWordBatch(db, batch);
}

async function planWordBatch(db: Reader, batch: MainCourseWordBatch, cache?: PlanReadCache) {
  assertManifest(batch);
  const registry = buildMainCourseContentBatches();
  const registryIssues = validateMainCourseContentBatches(registry);
  if (registryIssues.length)
    throw new Error(`Invalid registered kanji: ${registryIssues.join("; ")}`);
  const registeredKanji = new Map(
    registry
      .filter((entry) => entry.courseSlug === batch.courseSlug)
      .flatMap((entry) => entry.kanji.map((content) => [content.character, content] as const)),
  );
  let course = cache?.courses.get(batch.courseSlug);
  if (course === undefined) {
    course = await readPlanCourse(db, batch.courseSlug);
    if (cache !== undefined && cache.courses.size < PLAN_READ_CACHE_LIMIT)
      cache.courses.set(batch.courseSlug, course);
  }
  if (course === null) throw new Error(`Missing main course ${batch.courseSlug}.`);
  const level = course.levels.find((candidate) => candidate.levelNumber === batch.levelNumber);
  const blueprintLevel = buildMainCourseBlueprint().levels.find(
    (candidate) => candidate.levelNumber === batch.levelNumber,
  );
  if (level === undefined || blueprintLevel === undefined || level.band !== blueprintLevel.band)
    throw new Error("Words require a course level matching the registered curriculum band.");

  const [license, source] = await Promise.all([
    db.license.findUnique({ where: { name: LICENSE_NAME } }),
    db.dataSource.findUnique({ where: { name: SOURCE_NAME }, include: { license: true } }),
  ]);
  if (
    license !== null &&
    (license.scope !== "PROJECT_AUTHORED" || license.spdxLikeId !== "LicenseRef-Project-Authored")
  )
    throw new Error("Conflicting word-curation license.");
  if (
    source !== null &&
    (source.license.name !== LICENSE_NAME ||
      source.license.scope !== "PROJECT_AUTHORED" ||
      source.license.spdxLikeId !== "LicenseRef-Project-Authored" ||
      source.homepageUrl !== SOURCE_URL ||
      !source.attributionText?.trim())
  )
    throw new Error("Conflicting word-curation source.");

  const kanjiItems = new Map<string, string>();
  const kanjiPlacements = new Map<string, { courseLevelId: string; sortOrder: number }>();
  for (const character of new Set(
    batch.words.flatMap((content) =>
      wordHanCharacters(content.expression + content.example.japaneseText),
    ),
  )) {
    const registered = registeredKanji.get(character);
    if (registered === undefined || registered.levelNumber >= batch.levelNumber)
      throw new Error(`Unregistered earlier kanji prerequisite ${character}.`);
    const cacheKey = `${course.id}:${character}`;
    let prerequisite = cache?.kanji.get(cacheKey);
    if (prerequisite === undefined) {
      prerequisite = await readPlanKanji(db, character, course.id);
      if (cache !== undefined && cache.kanji.size < PLAN_READ_CACHE_LIMIT)
        cache.kanji.set(cacheKey, prerequisite);
    }
    const { raw, item } = prerequisite;
    if (raw === null) throw new Error(`Missing registered kanji ${character}.`);
    const expectedLevel = course.levels.find(
      (candidate) => candidate.levelNumber === registered.levelNumber,
    );
    const expectedBlueprintLevel = buildMainCourseBlueprint().levels.find(
      (candidate) => candidate.levelNumber === registered.levelNumber,
    );
    if (
      item === null ||
      item.kind !== "KANJI" ||
      item.status !== "PUBLISHED" ||
      expectedLevel === undefined ||
      expectedBlueprintLevel === undefined ||
      expectedLevel.band !== expectedBlueprintLevel.band ||
      item.courseLevelItems.length !== 1 ||
      item.courseLevelItems[0]?.courseLevelId !== expectedLevel.id ||
      item.courseLevelItems[0]?.sortOrder !== registered.sortOrder
    )
      throw new Error(
        `Kanji ${character} is not published at its registered earlier main-course placement.`,
      );
    kanjiItems.set(character, item.id);
    kanjiPlacements.set(item.id, {
      courseLevelId: expectedLevel.id,
      sortOrder: registered.sortOrder,
    });
  }

  const words = [];
  for (const content of batch.words) {
    const word = await requireWordSource(db, content);
    const sourceEvidence = wordEvidence(word);
    const acceptedReadingEvidence = await requireAlternativeReadingSources(
      db,
      content,
      sourceEvidence,
    );
    const item = await findItem(db, "WORD", word.id, course.id);
    await checkPlacement(db, level.id, content.sortOrder, item);
    assertWritableItem(item, content);
    if (source !== null)
      await checkExampleOwnership(db, batch, content, {
        dataSourceId: source.id,
        licenseId: source.licenseId,
      });
    words.push({
      content,
      wordId: word.id,
      sourceEvidence,
      acceptedReadingEvidence,
      prerequisiteItemIds: wordHanCharacters(content.expression).map(
        (character) => kanjiItems.get(character)!,
      ),
    });
  }
  return {
    courseId: course.id,
    courseLevelId: level.id,
    curriculumBand: level.band,
    words,
    kanjiPlacements,
  };
}

export async function planMainCourseWordBatches(
  db: Reader,
  batches: readonly MainCourseWordBatch[] = buildMainCourseWordBatches(),
) {
  assertRegistry(batches);
  // Share bounded reads only within this plan; write preflights must observe fresh data.
  const cache: PlanReadCache = { courses: new Map(), kanji: new Map() };
  const plans = [];
  for (const batch of batches) {
    plans.push({
      batchId: batch.id,
      checksumSha256: mainCourseWordBatchChecksum(batch),
      plan: await planWordBatch(db, batch, cache),
    });
  }
  return plans;
}

export async function applyMainCourseWordBatches(
  prisma: PrismaClient,
  options: { readonly batches?: readonly MainCourseWordBatch[]; readonly batchId?: string } = {},
) {
  const batches = options.batches ?? buildMainCourseWordBatches();
  const selected = reviewedSelection(batches, options.batchId);
  // Complete every registered read-only plan before creating even source/run metadata.
  const plans = await planMainCourseWordBatches(prisma, batches);
  const applied = [];
  for (const batch of selected) applied.push(await applyMainCourseWordBatch(prisma, batch));
  return {
    status: "applied-reviewed-batches",
    preflightedBatchIds: plans.map((entry) => entry.batchId),
    skippedUnreviewedBatchIds: batches
      .filter((batch) => batch.reviewedAt === null && batch.id !== options.batchId)
      .map((batch) => batch.id),
    batches: applied,
  };
}

async function requireWordSource(db: Pick<Reader, "word">, content: MainCourseWordContent) {
  const word = await db.word.findUnique({
    where: { expression_reading: { expression: content.expression, reading: content.reading } },
    select: WORD_SOURCE_SELECT,
  });
  const record = word?.importedRecord;
  const run = record?.importRun;
  const source = run?.dataSource;
  if (
    word === null ||
    word.expression !== content.expression ||
    word.reading !== content.reading ||
    word.jmdictEntryId !== content.jmdictEntryId ||
    record?.id !== word.jmdictImportedRecordId ||
    record?.recordType !== "JMDICT_ENTRY" ||
    record.sourceRecordId !== content.jmdictEntryId ||
    run?.status !== "SUCCESS" ||
    !run.sourceVersion?.trim() ||
    run.sourceVersion.trim().toLowerCase() === "unknown" ||
    !/^[a-f0-9]{64}$/iu.test(run.checksumSha256) ||
    source?.name !== "JMdict" ||
    source.id !== run.dataSourceId ||
    source.license.id !== source.licenseId ||
    source.license.scope !== "OPEN_DATA" ||
    source.license.spdxLikeId !== "LicenseRef-JMdict-Multilingual" ||
    !source.license.name.trim() ||
    !source.license.requiresAttribution ||
    !isHttpsSourceUrl(source.license.url) ||
    !isHttpsSourceUrl(source.homepageUrl) ||
    !source.attributionText?.trim()
  )
    throw new Error(
      `Word ${content.expression}/${content.reading} lacks exact successful licensed JMdict provenance.`,
    );
  const raw = record.rawJson;
  if (!isObject(raw) || raw.sequence !== content.jmdictEntryId.slice("jmdict:".length))
    throw new Error(
      `Word ${content.expression}/${content.reading} has invalid JMdict sequence evidence.`,
    );

  // The bounded importer deliberately stores only provenance, not duplicate glosses.
  // Its exact pair and retained senses live on Word/WordSense under this import ID.
  const compact =
    Object.keys(raw).length === 3 &&
    Number.isSafeInteger(raw.importedWordCount) &&
    Number(raw.importedWordCount) > 0 &&
    Array.isArray(raw.retainedLocales) &&
    raw.retainedLocales.length === 2 &&
    raw.retainedLocales.includes("ru-RU") &&
    raw.retainedLocales.includes("en-US");
  const full =
    Array.isArray(raw.kanjiElements) &&
    raw.kanjiElements.some((entry) => isObject(entry) && entry.expression === content.expression) &&
    Array.isArray(raw.readingElements) &&
    raw.readingElements.some(
      (entry) =>
        isObject(entry) &&
        entry.reading === content.reading &&
        Array.isArray(entry.restrictions) &&
        (entry.restrictions.length === 0 || entry.restrictions.includes(content.expression)),
    ) &&
    Array.isArray(raw.senses);
  if (!compact && !full)
    throw new Error(
      `Word ${content.expression}/${content.reading} is not supported by its raw JMdict entry.`,
    );
  for (const locale of ["ru-RU", "en-US"] as const) {
    const hasRawGloss =
      compact ||
      (Array.isArray(raw.senses) &&
        raw.senses.some(
          (sense) =>
            isObject(sense) &&
            Array.isArray(sense.glosses) &&
            sense.glosses.some(
              (gloss) =>
                isObject(gloss) &&
                gloss.locale === locale &&
                typeof gloss.text === "string" &&
                gloss.text.trim() !== "",
            ),
        ));
    if (
      !hasRawGloss ||
      !word.senses.some(
        (sense) =>
          sense.sourceKind === "IMPORTED" && sense.locale === locale && sense.meaning.trim() !== "",
      )
    )
      throw new Error(
        `Word ${content.expression}/${content.reading} lacks imported ${locale} evidence.`,
      );
    const meanings = locale === "ru-RU" ? content.meanings.ru : content.meanings.en;
    if (
      word.senses.some(
        (sense) =>
          sense.locale === locale &&
          sense.partOfSpeech === AUTHORED_WORD_PART_OF_SPEECH &&
          meanings.accepted.includes(sense.meaning) &&
          sense.sourceKind !== "PROJECT_AUTHORED",
      )
    )
      throw new Error(`Authored sense collision for ${content.expression}/${locale}.`);
  }
  return word;
}

function wordEvidence(word: Awaited<ReturnType<typeof requireWordSource>>) {
  const record = word.importedRecord!;
  return {
    importedRecordId: record.id,
    sourceRecordId: record.sourceRecordId,
    importRunId: record.importRun.id,
    sourceVersion: record.importRun.sourceVersion,
    checksumSha256: record.importRun.checksumSha256,
    licenseId: record.importRun.dataSource.licenseId,
  };
}

async function requireAlternativeReadingSources(
  db: Pick<Reader, "word">,
  content: MainCourseWordContent,
  primaryEvidence: ReturnType<typeof wordEvidence>,
) {
  const alternatives = [];
  for (const reading of content.acceptedReadings ?? []) {
    const word = await requireWordSource(db, { ...content, reading });
    const sourceEvidence = wordEvidence(word);
    if (JSON.stringify(sourceEvidence) !== JSON.stringify(primaryEvidence))
      throw new Error(
        `Alternative reading ${content.expression}/${reading} must share the primary successful JMdict source evidence.`,
      );
    alternatives.push({ reading, wordId: word.id, sourceEvidence });
  }
  return alternatives;
}

async function findItem(
  db: Pick<Reader, "learningItem">,
  targetType: "WORD" | "KANJI",
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
      mnemonics: { select: { locale: true, version: true, sourceKind: true, mnemonicType: true } },
      hints: { select: { locale: true, version: true, sourceKind: true, hintType: true } },
    },
  });
}

function assertWritableItem(
  item: Awaited<ReturnType<typeof findItem>>,
  content: MainCourseWordContent,
): void {
  if (item === null) return;
  if (item.kind !== "WORD") throw new Error(`Conflicting learning item for ${content.expression}.`);
  const texts = [
    ...item.mnemonics.filter(
      (text) => text.mnemonicType === "MEANING" || text.mnemonicType === "READING",
    ),
    ...item.hints.filter((text) => text.hintType === "MEANING" || text.hintType === "READING"),
  ];
  if (
    texts.some(
      (text) =>
        text.version === 1 &&
        ["ru-RU", "en-US"].includes(text.locale) &&
        text.sourceKind !== "PROJECT_AUTHORED",
    )
  )
    throw new Error(`Non-project teaching text would be overwritten for ${content.expression}.`);
}

async function checkExampleOwnership(
  db: Pick<Reader, "sentence">,
  batch: MainCourseWordBatch,
  content: MainCourseWordContent,
  source: { dataSourceId: string; licenseId: string },
): Promise<void> {
  const sourceId = exampleSourceId(batch, content);
  const sentence = await db.sentence.findUnique({
    where: { dataSourceId_sourceId: { dataSourceId: source.dataSourceId, sourceId } },
    select: {
      id: true,
      licenseId: true,
      importedRecord: {
        select: {
          recordType: true,
          sourceRecordId: true,
          importRun: { select: { dataSourceId: true } },
        },
      },
    },
  });
  if (
    sentence !== null &&
    (sentence.licenseId !== source.licenseId ||
      sentence.importedRecord?.recordType !== "PROJECT_AUTHORED" ||
      sentence.importedRecord.sourceRecordId !== sourceId ||
      sentence.importedRecord.importRun.dataSourceId !== source.dataSourceId)
  )
    throw new Error(`Conflicting authored example for ${content.expression}.`);
}

async function checkPlacement(
  db: Pick<Reader, "courseLevelItem">,
  courseLevelId: string,
  sortOrder: number,
  item: Awaited<ReturnType<typeof findItem>>,
) {
  if (
    item?.courseLevelItems.some(
      (placement) => placement.courseLevelId !== courseLevelId || placement.sortOrder !== sortOrder,
    )
  )
    throw new Error(`Refusing to move existing main-course word placement ${item.id}.`);
  const occupied = await db.courseLevelItem.findUnique({
    where: { courseLevelId_sortOrder: { courseLevelId, sortOrder } },
    select: { learningItemId: true },
  });
  if (occupied !== null && occupied.learningItemId !== item?.id)
    throw new Error(`Word placement ${courseLevelId}:${sortOrder} is occupied.`);
}

export async function applyMainCourseWordBatch(
  prisma: PrismaClient,
  batch: MainCourseWordBatch = buildMainCourseWordBatch(),
) {
  requireReview(batch);
  const plan = await planMainCourseWordBatch(prisma, batch);
  const checksumSha256 = mainCourseWordBatchChecksum(batch);
  const metadata = await prisma.$transaction(async (db) => {
    const license = await db.license.upsert({
      where: { name: LICENSE_NAME },
      update: {},
      create: {
        name: LICENSE_NAME,
        spdxLikeId: "LicenseRef-Project-Authored",
        scope: "PROJECT_AUTHORED",
        requiresAttribution: false,
        requiresShareAlike: false,
        notes:
          "Independent project-authored course copy and examples; approval is recorded per manifest.",
      },
    });
    const source = await db.dataSource.upsert({
      where: { name: SOURCE_NAME },
      update: {},
      create: {
        name: SOURCE_NAME,
        homepageUrl: SOURCE_URL,
        licenseId: license.id,
        attributionText:
          "Original bilingual course copy and Japanese examples authored for Kanji SRS.",
        notes:
          "Versioned word manifests; dictionary evidence and source-specific Russian terms remain separate.",
      },
    });
    const run = await db.importRun.upsert({
      where: { dataSourceId_checksumSha256: { dataSourceId: source.id, checksumSha256 } },
      update: {
        status: "PENDING",
        sourceVersion: batch.version,
        sourceFileName: batch.sourceFile,
        finishedAt: null,
        errorText: null,
        statsJson: stats(batch),
      },
      create: {
        dataSourceId: source.id,
        checksumSha256,
        sourceVersion: batch.version,
        sourceFileName: batch.sourceFile,
        status: "PENDING",
        statsJson: stats(batch),
      },
    });
    return { licenseId: license.id, dataSourceId: source.id, importRunId: run.id };
  }, TRANSACTION_OPTIONS);

  try {
    const staged: Awaited<ReturnType<typeof applyWord>>[] = [];
    for (const entry of plan.words) {
      staged.push(
        await prisma.$transaction(
          (db) => applyWord(db, batch, plan, entry, metadata),
          TRANSACTION_OPTIONS,
        ),
      );
    }
    await prisma.$transaction(async (db) => {
      // SUCCESS is visible to example validation in this transaction only. Any failed
      // validation rolls back both the status change and every publication below.
      await db.importRun.update({
        where: { id: metadata.importRunId },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          errorText: null,
          statsJson: stats(batch),
        },
      });
      for (const entry of staged)
        await writeWordExample(db, {
          wordId: entry.wordId,
          sentenceId: entry.sentenceId,
          status: "PUBLISHED",
          sortOrder: 0,
        });
      const published = await db.learningItem.updateMany({
        where: {
          id: { in: staged.map((entry) => entry.learningItemId) },
          targetType: "WORD",
          kind: "WORD",
        },
        data: { status: "PUBLISHED" },
      });
      if (published.count !== staged.length)
        throw new Error("Word publication changed during finalization.");
    }, TRANSACTION_OPTIONS);
    return {
      batchId: batch.id,
      checksumSha256,
      ...metadata,
      words: staged.length,
      cards: staged.length * 2,
      examples: staged.length,
    };
  } catch (error) {
    await prisma.importRun.update({
      where: { id: metadata.importRunId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorText: error instanceof Error ? error.message : "Word curation failed.",
      },
    });
    throw error;
  }
}

async function applyWord(
  db: Prisma.TransactionClient,
  batch: MainCourseWordBatch,
  plan: Awaited<ReturnType<typeof planMainCourseWordBatch>>,
  entry: Awaited<ReturnType<typeof planMainCourseWordBatch>>["words"][number],
  metadata: { licenseId: string; dataSourceId: string; importRunId: string },
) {
  const { content } = entry;
  const word = await requireWordSource(db, content);
  if (
    word.id !== entry.wordId ||
    JSON.stringify(wordEvidence(word)) !== JSON.stringify(entry.sourceEvidence)
  )
    throw new Error(`JMdict evidence changed after preflight for ${content.expression}.`);
  if (
    JSON.stringify(await requireAlternativeReadingSources(db, content, wordEvidence(word))) !==
    JSON.stringify(entry.acceptedReadingEvidence)
  )
    throw new Error(
      `Alternative reading evidence changed after preflight for ${content.expression}.`,
    );
  const existing = await findItem(db, "WORD", word.id, plan.courseId);
  assertWritableItem(existing, content);
  await checkPlacement(db, plan.courseLevelId, content.sortOrder, existing);
  await checkExampleOwnership(db, batch, content, metadata);
  const prerequisites = await db.learningItem.findMany({
    where: {
      id: { in: entry.prerequisiteItemIds },
      targetType: "KANJI",
      kind: "KANJI",
      status: "PUBLISHED",
      courseLevelItems: {
        some: { courseLevel: { courseId: plan.courseId, levelNumber: { lt: batch.levelNumber } } },
      },
    },
    select: {
      id: true,
      courseLevelItems: {
        where: { courseLevel: { courseId: plan.courseId } },
        select: { courseLevelId: true, sortOrder: true },
      },
    },
  });
  if (
    prerequisites.length !== entry.prerequisiteItemIds.length ||
    prerequisites.some((item) => {
      const expected = plan.kanjiPlacements.get(item.id);
      return (
        item.courseLevelItems.length !== 1 ||
        item.courseLevelItems[0]?.courseLevelId !== expected?.courseLevelId ||
        item.courseLevelItems[0]?.sortOrder !== expected?.sortOrder
      );
    })
  )
    throw new Error(`Kanji prerequisite changed after preflight for ${content.expression}.`);

  for (const [locale, meanings] of [
    ["ru-RU", content.meanings.ru],
    ["en-US", content.meanings.en],
  ] as const) {
    await db.wordSense.deleteMany({
      where: {
        wordId: word.id,
        locale,
        sourceKind: "PROJECT_AUTHORED",
        partOfSpeech: AUTHORED_WORD_PART_OF_SPEECH,
        meaning: { notIn: [...meanings.accepted] },
      },
    });
    for (const meaning of meanings.accepted)
      await db.wordSense.upsert({
        where: {
          wordId_locale_meaning_partOfSpeech: {
            wordId: word.id,
            locale,
            meaning,
            partOfSpeech: AUTHORED_WORD_PART_OF_SPEECH,
          },
        },
        update: { sourceKind: "PROJECT_AUTHORED" },
        create: {
          wordId: word.id,
          locale,
          meaning,
          partOfSpeech: AUTHORED_WORD_PART_OF_SPEECH,
          sourceKind: "PROJECT_AUTHORED",
        },
      });
  }
  const item = await db.learningItem.upsert({
    where: { targetType_targetId: { targetType: "WORD", targetId: word.id } },
    update: {
      kind: "WORD",
      title: `Слово ${content.expression}`,
      levelHint: batch.levelNumber,
      curriculumBand: plan.curriculumBand,
    },
    create: {
      kind: "WORD",
      targetType: "WORD",
      targetId: word.id,
      title: `Слово ${content.expression}`,
      levelHint: batch.levelNumber,
      curriculumBand: plan.curriculumBand,
      status: "DRAFT",
    },
  });
  for (const [promptType, sortOrder] of [
    ["MEANING", 1],
    ["READING", 2],
  ] as const) {
    const card = await db.learningCard.upsert({
      where: {
        learningItemId_promptType_answerType_locale: {
          learningItemId: item.id,
          promptType,
          answerType: promptType,
          locale: "ru-RU",
        },
      },
      update: { cardType: "REVIEW", sortOrder },
      create: {
        learningItemId: item.id,
        cardType: "REVIEW",
        promptType,
        answerType: promptType,
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
    const answers =
      promptType === "READING"
        ? mainCourseWordAcceptedReadings(content).map((reading, index) => ({
            locale: "ru-RU",
            text: reading,
            normalizedText: normalizeJapaneseReading(reading),
            isPrimary: index === 0,
          }))
        : (
            [
              ["ru-RU", content.meanings.ru],
              ["en-US", content.meanings.en],
            ] as const
          ).flatMap(([locale, meanings]) =>
            meanings.accepted.map((text, index) => ({
              locale,
              text,
              normalizedText: normalizeMeaning(text, locale),
              isPrimary: index === 0,
            })),
          );
    await db.learningAnswer.createMany({
      data: answers.map((answer) => ({
        ...answer,
        learningCardId: card.id,
        answerKind: promptType,
        sourceKind: "PROJECT_AUTHORED" as const,
      })),
    });
    for (const [key, locale] of [
      ["ru", "ru-RU"],
      ["en", "en-US"],
    ] as const) {
      const mnemonic = promptType === "MEANING" ? content.meaningMnemonic : content.readingMnemonic;
      const hint = promptType === "MEANING" ? content.meaningHint : content.readingHint;
      await db.mnemonic.upsert({
        where: {
          learningItemId_locale_mnemonicType_version: {
            learningItemId: item.id,
            locale,
            mnemonicType: promptType,
            version: 1,
          },
        },
        update: { body: mnemonic[key], sourceKind: "PROJECT_AUTHORED" },
        create: {
          learningItemId: item.id,
          locale,
          mnemonicType: promptType,
          version: 1,
          body: mnemonic[key],
          sourceKind: "PROJECT_AUTHORED",
        },
      });
      await db.hint.upsert({
        where: {
          learningItemId_locale_hintType_version: {
            learningItemId: item.id,
            locale,
            hintType: promptType,
            version: 1,
          },
        },
        update: { body: hint[key], sourceKind: "PROJECT_AUTHORED" },
        create: {
          learningItemId: item.id,
          locale,
          hintType: promptType,
          version: 1,
          body: hint[key],
          sourceKind: "PROJECT_AUTHORED",
        },
      });
    }
  }
  await db.dependency.deleteMany({
    where: { learningItemId: item.id, dependencyType: "PREREQUISITE" },
  });
  await db.dependency.createMany({
    data: entry.prerequisiteItemIds.map((id) => ({
      learningItemId: item.id,
      prerequisiteItemId: id,
      dependencyType: "PREREQUISITE",
      requiredStage: 2,
    })),
  });
  await db.courseLevelItem.upsert({
    where: {
      courseLevelId_learningItemId: { courseLevelId: plan.courseLevelId, learningItemId: item.id },
    },
    update: { sortOrder: content.sortOrder, unlockPolicyJson: { policy: "level-order" } },
    create: {
      courseLevelId: plan.courseLevelId,
      learningItemId: item.id,
      sortOrder: content.sortOrder,
      unlockPolicyJson: { policy: "level-order" },
    },
  });
  const sourceRecordId = exampleSourceId(batch, content);
  const rawJson = toJson({
    batchId: batch.id,
    word: content,
    sourceEvidence: entry.sourceEvidence,
    ...(entry.acceptedReadingEvidence.length === 0
      ? {}
      : { acceptedReadingEvidence: entry.acceptedReadingEvidence }),
  });
  const record = await db.importedRecord.upsert({
    where: {
      importRunId_recordType_sourceRecordId: {
        importRunId: metadata.importRunId,
        recordType: "PROJECT_AUTHORED",
        sourceRecordId,
      },
    },
    update: {
      rawJson,
    },
    create: {
      importRunId: metadata.importRunId,
      recordType: "PROJECT_AUTHORED",
      sourceRecordId,
      rawJson,
    },
  });
  const sentenceData = {
    ...content.example,
    difficulty: 1,
    licenseId: metadata.licenseId,
    importedRecordId: record.id,
  };
  const sentence = await db.sentence.upsert({
    where: {
      dataSourceId_sourceId: { dataSourceId: metadata.dataSourceId, sourceId: sourceRecordId },
    },
    update: sentenceData,
    create: { ...sentenceData, dataSourceId: metadata.dataSourceId, sourceId: sourceRecordId },
  });
  await writeWordExample(db, {
    wordId: word.id,
    sentenceId: sentence.id,
    status: "DRAFT",
    sortOrder: 0,
  });
  return { wordId: word.id, learningItemId: item.id, sentenceId: sentence.id };
}

function exampleSourceId(batch: MainCourseWordBatch, content: MainCourseWordContent): string {
  return `${batch.id}:example:${content.jmdictEntryId}:${content.expression}:${content.reading}`;
}
function isObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isHttpsSourceUrl(value: string | null): boolean {
  if (value === null || /\s/u.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname !== "" && url.username === "" && url.password === ""
    );
  } catch {
    return false;
  }
}
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
function assertManifest(batch: MainCourseWordBatch): void {
  const issues = validateMainCourseWordBatch(batch);
  if (issues.length) throw new Error(`Invalid word batch: ${issues.join("; ")}`);
}
function assertRegistry(batches: readonly MainCourseWordBatch[]): void {
  const issues = validateMainCourseWordBatches(batches);
  if (issues.length) throw new Error(`Invalid word batch registry: ${issues.join("; ")}`);
}
function reviewedSelection(
  batches: readonly MainCourseWordBatch[],
  batchId?: string,
): readonly MainCourseWordBatch[] {
  assertRegistry(batches);
  if (batchId !== undefined) {
    const selected = batches.find((batch) => batch.id === batchId);
    if (selected === undefined) throw new Error(`Unknown registered word batch ${batchId}.`);
    requireReview(selected);
    return [selected];
  }
  const reviewed = batches.filter((batch) => batch.reviewedAt !== null);
  if (reviewed.length === 0)
    throw new Error("No independently reviewed word batches are available for application.");
  for (const batch of reviewed) requireReview(batch);
  return reviewed;
}
function requireReview(batch: MainCourseWordBatch): void {
  assertManifest(batch);
  if (batch.reviewedAt === null)
    throw new Error(
      `Batch ${batch.id} needs independent parent review and reviewedAt before any live writes.`,
    );
}
function stats(batch: MainCourseWordBatch): Prisma.InputJsonObject {
  return {
    batchId: batch.id,
    version: batch.version,
    authoredAt: batch.authoredAt,
    reviewedAt: batch.reviewedAt,
    reviewNotes: batch.reviewNotes,
    words: batch.words.length,
    cards: batch.words.length * 2,
    examples: batch.words.length,
  };
}

export function parseMainCourseWordCurationArgs(
  args: readonly string[],
  batches: readonly MainCourseWordBatch[] = buildMainCourseWordBatches(),
) {
  const invalid = () =>
    new Error(
      "Use no arguments to apply reviewed batches, --validate-only, or --preflight-only; optionally select --batch <registered-id> once.",
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
      if (!batches.some((batch) => batch.id === value))
        throw new Error(`Unknown registered word batch ${value}.`);
      batchId = value;
    } else throw invalid();
  }
  return { mode, ...(batchId === undefined ? {} : { batchId }) };
}

async function main(): Promise<void> {
  const batches = buildMainCourseWordBatches();
  const options = parseMainCourseWordCurationArgs(process.argv.slice(2), batches);
  assertRegistry(batches);
  if (options.mode === "validate-only") {
    console.log(
      JSON.stringify(
        {
          status: "valid-manifests",
          selectedBatchId: options.batchId ?? null,
          batches: batches.map((batch) => ({
            checksumSha256: mainCourseWordBatchChecksum(batch),
            ...stats(batch),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  const preflightOnly = options.mode === "preflight-only";
  if (!preflightOnly) reviewedSelection(batches, options.batchId);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for live word curation.");
  const prisma = new PrismaClient({ datasourceUrl: withNeonConnectionDefaults(url) });
  try {
    const result = preflightOnly
      ? {
          status: "preflight-passed",
          selectedBatchId: options.batchId ?? null,
          batches: (await planMainCourseWordBatches(prisma, batches)).map((entry) => ({
            batchId: entry.batchId,
            checksumSha256: entry.checksumSha256,
            words: entry.plan.words.length,
          })),
        }
      : await applyMainCourseWordBatches(prisma, {
          batches,
          ...(options.batchId === undefined ? {} : { batchId: options.batchId }),
        });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
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
