import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";
import { CONTENT_QUALITY_POLICY_VERSION } from "@kanji-srs/shared";

import { type QualityItem, validateQualityItem } from "./content-quality";
import { loadContentQualityItems, type ContentQualityDatabase } from "./content-quality-report";
import { createCourseLevelPassPolicy } from "./course-level-policy";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
  type MainCourseContentBatch,
} from "./main-course-content";
import {
  buildMainCourseWordBatch,
  mainCourseWordBatchChecksum,
  validateMainCourseWordBatch,
  wordHanCharacters,
  type MainCourseWordBatch,
} from "./main-course-word-content";

export const FOUNDATION_PILOT_SLUG = "japanese-foundation-pilot-v1";
export const FOUNDATION_PILOT_RECORD_ID = "c5d6546d-6f29-451e-bbc5-a0ba4b887048";
const SOURCE_COURSE_SLUG = "japanese-ru-n2";
const PUBLICATION_SOURCE = "Kanji SRS foundation pilot publication";
const PUBLICATION_LICENSE = "Project-authored foundation pilot metadata";
const PUBLICATION_URL =
  "https://github.com/wndffs/kanji-app/blob/main/packages/db/src/foundation-pilot.ts";
const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 60_000,
} as const;

type PilotTarget = {
  key: string;
  kind: "COMPONENT" | "KANJI" | "WORD";
  expression: string;
  reading?: string;
  jmdictEntryId?: string;
  levelNumber: number;
  sortOrder: number;
  prerequisiteKeys: readonly string[];
  requiredStage: number;
  answers: readonly {
    promptType: "MEANING" | "READING";
    locale: string;
    text: string;
    isPrimary: boolean;
  }[];
};
type SourceBatch = {
  id: string;
  version: string;
  reviewedAt: string | null;
  sourceFile: string;
  dataSourceName: string;
  checksumSha256: string;
  records: readonly { sourceRecordId: string; content: unknown; wordKey?: string }[];
};

export function buildFoundationPilotManifest(
  kanjiBatches: readonly MainCourseContentBatch[] = buildMainCourseContentBatches(),
  words: MainCourseWordBatch = buildMainCourseWordBatch(),
) {
  const issues = [
    ...validateMainCourseContentBatches(kanjiBatches),
    ...validateMainCourseWordBatch(words),
  ];
  if (issues.length) throw new Error(`Invalid pilot sources: ${issues.join("; ")}`);
  if (
    kanjiBatches.map((batch) => batch.id).join(",") !==
      "task-118-foundation-kanji-01,task-118-foundation-kanji-02" ||
    words.id !== "task-127-foundation-words-01" ||
    [...kanjiBatches, words].some(
      (batch) => batch.version !== "1" || batch.courseSlug !== SOURCE_COURSE_SLUG,
    )
  )
    throw new Error(
      "Pilot v1 requires exactly the three registered version-1 main-course batches.",
    );
  const targets: PilotTarget[] = [];
  const sources: SourceBatch[] = [];
  for (const batch of kanjiBatches) {
    const records: SourceBatch["records"][number][] = [];
    for (const [index, content] of batch.components.entries()) {
      targets.push({
        key: content.key,
        kind: "COMPONENT",
        expression: content.symbol,
        levelNumber: batch.componentLevelNumber,
        sortOrder: (batch.componentSortOrderStart ?? 1) + index,
        prerequisiteKeys: [],
        requiredStage: 1,
        answers: answers([content.meaning.ru], [content.meaning.en], []),
      });
      records.push({ sourceRecordId: `${batch.id}:component:${content.key}`, content });
    }
    for (const content of batch.kanji) {
      targets.push({
        key: `kanji:${content.character}`,
        kind: "KANJI",
        expression: content.character,
        levelNumber: content.levelNumber,
        sortOrder: content.sortOrder,
        prerequisiteKeys: content.componentKeys,
        requiredStage: 1,
        answers: answers(
          content.meanings.ru.accepted,
          content.meanings.en.accepted,
          content.reading.accepted,
        ),
      });
      records.push({ sourceRecordId: `${batch.id}:kanji:${content.character}`, content });
    }
    sources.push({
      id: batch.id,
      version: batch.version,
      reviewedAt: batch.reviewedAt,
      sourceFile: batch.sourceFile,
      dataSourceName: "Kanji SRS main-course curation",
      checksumSha256: hash(JSON.stringify(batch)),
      records,
    });
  }
  const wordRecords: SourceBatch["records"][number][] = [];
  for (const content of words.words) {
    const key = `word:${content.expression}:${content.reading}`;
    targets.push({
      key,
      kind: "WORD",
      expression: content.expression,
      reading: content.reading,
      jmdictEntryId: content.jmdictEntryId,
      levelNumber: words.levelNumber,
      sortOrder: content.sortOrder,
      prerequisiteKeys: wordHanCharacters(content.expression).map(
        (character) => `kanji:${character}`,
      ),
      requiredStage: 2,
      answers: answers(content.meanings.ru.accepted, content.meanings.en.accepted, [
        content.reading,
      ]),
    });
    wordRecords.push({
      sourceRecordId: `${words.id}:example:${content.jmdictEntryId}:${content.expression}:${content.reading}`,
      content,
      wordKey: key,
    });
  }
  sources.push({
    id: words.id,
    version: words.version,
    reviewedAt: words.reviewedAt,
    sourceFile: words.sourceFile,
    dataSourceName: "Kanji SRS main-course word curation",
    checksumSha256: mainCourseWordBatchChecksum(words),
    records: wordRecords,
  });
  if (
    targets.filter((target) => target.kind === "COMPONENT").length !== 40 ||
    targets.filter((target) => target.kind === "KANJI").length !== 40 ||
    targets.filter((target) => target.kind === "WORD").length !== 20
  )
    throw new Error("Pilot v1 requires exactly 40 components, 40 kanji and 20 words.");
  const keys = new Map(targets.map((target) => [target.key, target]));
  if (
    keys.size !== 100 ||
    new Set(targets.map((target) => `${target.levelNumber}:${target.sortOrder}`)).size !== 100 ||
    targets.some(
      (target) =>
        target.levelNumber < 1 ||
        target.levelNumber > 5 ||
        target.prerequisiteKeys.some(
          (key) => !keys.has(key) || keys.get(key)!.levelNumber >= target.levelNumber,
        ),
    )
  )
    throw new Error("Pilot placements and earlier prerequisite closure are invalid.");
  return {
    version: "1",
    slug: FOUNDATION_PILOT_SLUG,
    sourceCourseSlug: SOURCE_COURSE_SLUG,
    titleRu: "Пилот основ: 40 компонентов, 40 кандзи и 20 слов",
    descriptionRu:
      "Отдельный пилот из 5 уровней: 40 компонентов, 40 кандзи и 20 слов. Это не полный курс до N2.",
    targetLevel: "FOUNDATION",
    counts: { components: 40, kanji: 40, words: 20, items: 100, cards: 160 },
    levels: Array.from({ length: 5 }, (_, index) => ({
      levelNumber: index + 1,
      titleRu: `Основа: этап ${index + 1}`,
      descriptionRu:
        index === 0
          ? "Компоненты пилотного курса."
          : index === 4
            ? "Первые 20 слов пилотного курса."
            : "Кандзи пилотного курса.",
      passPolicyJson: createCourseLevelPassPolicy(
        index === 0 ? "COMPONENT" : index === 4 ? "WORD" : "KANJI",
      ),
    })),
    targets,
    sources,
  };
}

export type FoundationPilotManifest = ReturnType<typeof buildFoundationPilotManifest>;
type PilotReader = ContentQualityDatabase &
  Pick<
    Prisma.TransactionClient,
    | "course"
    | "courseLevelItem"
    | "importRun"
    | "importedRecord"
    | "dataSource"
    | "license"
    | "user"
  >;
export type FoundationPilotOptions = {
  readonly manifest?: FoundationPilotManifest;
  readonly enrollUserId?: string;
};

function answers(
  ru: readonly string[],
  en: readonly string[],
  readings: readonly string[],
): PilotTarget["answers"] {
  return [
    ...(
      [
        ["ru-RU", ru],
        ["en-US", en],
      ] as const
    ).flatMap(([locale, texts]) =>
      texts.map((text, index) => ({
        promptType: "MEANING" as const,
        locale,
        text,
        isPrimary: index === 0,
      })),
    ),
    ...readings.map((text, index) => ({
      promptType: "READING" as const,
      locale: "ru-RU",
      text,
      isPrimary: index === 0,
    })),
  ];
}

const COURSE_SELECT = {
  id: true,
  slug: true,
  titleRu: true,
  descriptionRu: true,
  targetLevel: true,
  band: true,
  courseType: true,
  status: true,
  levels: {
    take: 61,
    orderBy: { levelNumber: "asc" },
    select: {
      id: true,
      levelNumber: true,
      band: true,
      titleRu: true,
      descriptionRu: true,
      passPolicyJson: true,
    },
  },
} as const satisfies Prisma.CourseSelect;

export async function planFoundationPilot(db: PilotReader, options: FoundationPilotOptions = {}) {
  const manifest = options.manifest ?? buildFoundationPilotManifest();
  requireApproved(manifest);
  validateEnrollmentId(options.enrollUserId);
  const [sourceCourse, existingPilot] = await Promise.all([
    db.course.findUnique({ where: { slug: SOURCE_COURSE_SLUG }, select: COURSE_SELECT }),
    db.course.findUnique({ where: { slug: FOUNDATION_PILOT_SLUG }, select: COURSE_SELECT }),
  ]);
  if (
    sourceCourse === null ||
    sourceCourse.slug !== SOURCE_COURSE_SLUG ||
    !["DRAFT", "PUBLISHED"].includes(sourceCourse.status) ||
    sourceCourse.courseType !== "STRUCTURED"
  )
    throw new Error("Pilot source must be the known draft/published main course.");
  if (
    existingPilot !== null &&
    (existingPilot.id === sourceCourse.id ||
      existingPilot.slug !== manifest.slug ||
      !["DRAFT", "PUBLISHED"].includes(existingPilot.status) ||
      existingPilot.courseType !== "STRUCTURED" ||
      existingPilot.band !== "FOUNDATION" ||
      existingPilot.titleRu !== manifest.titleRu ||
      existingPilot.descriptionRu !== manifest.descriptionRu ||
      existingPilot.targetLevel !== manifest.targetLevel)
  )
    throw new Error("Existing pilot identity or metadata does not match v1.");
  if (existingPilot !== null)
    for (const level of existingPilot.levels) {
      const expected = manifest.levels.find(
        (candidate) => candidate.levelNumber === level.levelNumber,
      );
      if (
        expected === undefined ||
        level.band !== "FOUNDATION" ||
        level.titleRu !== expected.titleRu ||
        level.descriptionRu !== expected.descriptionRu ||
        canonical(level.passPolicyJson) !== canonical(expected.passPolicyJson)
      )
        throw new Error("Existing pilot has unexpected level metadata.");
    }
  const { targetIds, wordEvidence } = await resolveTargets(db, manifest);
  const placements = await db.courseLevelItem.findMany({
    where: { courseLevel: { courseId: sourceCourse.id } },
    take: 101,
    orderBy: { id: "asc" },
    select: {
      learningItemId: true,
      sortOrder: true,
      unlockPolicyJson: true,
      courseLevel: { select: { id: true, levelNumber: true, band: true } },
      learningItem: {
        select: {
          id: true,
          kind: true,
          targetType: true,
          targetId: true,
          status: true,
          dependencies: {
            where: { dependencyType: "PREREQUISITE" },
            select: { prerequisiteItemId: true, requiredStage: true },
          },
          hints: {
            select: { locale: true, hintType: true, body: true, sourceKind: true, version: true },
            orderBy: [{ locale: "asc" }, { hintType: "asc" }, { version: "asc" }],
          },
        },
      },
    },
  });
  if (placements.length !== 100)
    throw new Error(
      "Pilot requires exactly 100 main-course placements, with no hidden extra items.",
    );
  const byTarget = new Map(
    placements.map((placement) => [
      `${placement.learningItem.targetType}:${placement.learningItem.targetId}`,
      placement,
    ]),
  );
  const items = manifest.targets.map((target) => {
    const targetId = targetIds.get(target.key)!;
    const placement = byTarget.get(`${target.kind}:${targetId}`);
    if (
      placement === undefined ||
      placement.learningItem.kind !== target.kind ||
      placement.learningItem.status !== "PUBLISHED" ||
      placement.courseLevel.levelNumber !== target.levelNumber ||
      placement.courseLevel.band !== "FOUNDATION" ||
      placement.sortOrder !== target.sortOrder
    )
      throw new Error(`Missing exact published main-course placement for ${target.key}.`);
    return {
      ...target,
      targetId,
      learningItemId: placement.learningItemId,
      unlockPolicyJson: placement.unlockPolicyJson,
      hints: canonicalCollection(
        placement.learningItem.hints.map(({ locale, hintType, body, sourceKind, version }) => ({
          locale,
          hintType,
          body,
          sourceKind,
          version,
        })),
      ),
      dependencies: canonicalCollection(placement.learningItem.dependencies),
    };
  });
  if (new Set(items.map((item) => item.learningItemId)).size !== 100)
    throw new Error("Pilot target identities are not unique.");
  const byKey = new Map(items.map((item) => [item.key, item]));
  for (const item of items) {
    const expected = item.prerequisiteKeys.map((key) => byKey.get(key)!);
    if (
      item.dependencies.length !== expected.length ||
      expected.some(
        (required) =>
          required.levelNumber >= item.levelNumber ||
          !item.dependencies.some(
            (dependency) =>
              dependency.prerequisiteItemId === required.learningItemId &&
              dependency.requiredStage === item.requiredStage,
          ),
      )
    )
      throw new Error(`Missing, external or non-earlier prerequisite for ${item.key}.`);
  }
  const sourceChecksums = await verifySources(db, manifest, wordEvidence);
  const quality = await scanQuality(db, SOURCE_COURSE_SLUG, items);
  const manifestChecksum = hash(canonical(manifest));
  const contentVersion = hash(
    canonical({
      manifestChecksum,
      sourceCourseId: sourceCourse.id,
      sourceChecksums,
      items,
      quality,
    }),
  );
  const record = await db.importedRecord.findUnique({
    where: { id: FOUNDATION_PILOT_RECORD_ID },
    include: { importRun: { include: { dataSource: { include: { license: true } } } } },
  });
  if (record !== null || existingPilot !== null) {
    if (
      existingPilot === null ||
      record === null ||
      record.recordType !== "PROJECT_AUTHORED" ||
      record.sourceRecordId !== manifest.slug ||
      record.importRun.status !== "SUCCESS" ||
      record.importRun.sourceVersion !== manifest.version ||
      record.importRun.checksumSha256 !== contentVersion ||
      record.importRun.dataSource.name !== PUBLICATION_SOURCE ||
      record.importRun.dataSource.license.name !== PUBLICATION_LICENSE ||
      !isObject(record.rawJson) ||
      record.rawJson.courseId !== existingPilot.id ||
      record.rawJson.manifestChecksum !== manifestChecksum ||
      record.rawJson.contentVersion !== contentVersion ||
      canonical(record.rawJson.sourceChecksums) !== canonical(sourceChecksums) ||
      canonical(record.importRun.statsJson) !== canonical(record.rawJson)
    )
      throw new Error(
        "Existing pilot publication hash/provenance changed; use a new version, not destructive replacement.",
      );
    const prior = await db.courseLevelItem.findMany({
      where: { courseLevel: { courseId: existingPilot.id } },
      take: 101,
      orderBy: { id: "asc" },
      select: {
        learningItemId: true,
        sortOrder: true,
        unlockPolicyJson: true,
        courseLevel: { select: { levelNumber: true } },
      },
    });
    if (
      prior.length !== 100 ||
      existingPilot.levels.length !== 5 ||
      prior.some(
        (placement) =>
          !items.some(
            (item) =>
              item.learningItemId === placement.learningItemId &&
              item.levelNumber === placement.courseLevel.levelNumber &&
              item.sortOrder === placement.sortOrder &&
              canonical(item.unlockPolicyJson) === canonical(placement.unlockPolicyJson),
          ),
      )
    )
      throw new Error("Existing pilot has unexpected items or moved slots.");
  }
  const publicationSource = await checkPublicationSource(db);
  if (publicationSource !== null) {
    const priorRun = await db.importRun.findUnique({
      where: {
        dataSourceId_checksumSha256: {
          dataSourceId: publicationSource.id,
          checksumSha256: contentVersion,
        },
      },
    });
    if (priorRun !== null && priorRun.id !== record?.importRunId)
      throw new Error("Orphan pilot publication run is not linked to the stable manifest record.");
  }
  if (
    options.enrollUserId !== undefined &&
    (await db.user.findUnique({ where: { id: options.enrollUserId }, select: { id: true } })) ===
      null
  )
    throw new Error("Explicit enrollment user does not exist.");
  return {
    manifest,
    manifestChecksum,
    contentVersion,
    sourceChecksums,
    sourceCourseId: sourceCourse.id,
    existingPilotId: existingPilot?.id ?? null,
    items,
    quality,
  };
}

async function resolveTargets(db: PilotReader, manifest: FoundationPilotManifest) {
  const components = manifest.targets.filter((target) => target.kind === "COMPONENT");
  const kanji = manifest.targets.filter((target) => target.kind === "KANJI");
  const words = manifest.targets.filter((target) => target.kind === "WORD");
  const [componentRows, kanjiRows, wordRows] = await Promise.all([
    db.component.findMany({
      where: { symbol: { in: components.map((target) => target.expression) } },
      select: { id: true, symbol: true },
    }),
    db.kanji.findMany({
      where: { character: { in: kanji.map((target) => target.expression) } },
      select: { id: true, character: true },
    }),
    db.word.findMany({
      where: {
        OR: words.map((target) => ({ expression: target.expression, reading: target.reading! })),
      },
      select: {
        id: true,
        expression: true,
        reading: true,
        jmdictEntryId: true,
        jmdictImportedRecordId: true,
        importedRecord: {
          select: {
            id: true,
            sourceRecordId: true,
            importRun: {
              select: {
                id: true,
                sourceVersion: true,
                checksumSha256: true,
                dataSource: { select: { licenseId: true } },
              },
            },
          },
        },
      },
    }),
  ]);
  const resolved = new Map<string, string>();
  for (const target of manifest.targets) {
    const row =
      target.kind === "COMPONENT"
        ? componentRows.find((row) => row.symbol === target.expression)
        : target.kind === "KANJI"
          ? kanjiRows.find((row) => row.character === target.expression)
          : wordRows.find(
              (row) =>
                row.expression === target.expression &&
                row.reading === target.reading &&
                row.jmdictEntryId === target.jmdictEntryId,
            );
    if (row === undefined) throw new Error(`Missing exact manifest target ${target.key}.`);
    resolved.set(target.key, row.id);
  }
  const wordEvidence = new Map(
    wordRows.map((word) => {
      const record = word.importedRecord;
      if (record === null || record.id !== word.jmdictImportedRecordId)
        throw new Error(`Missing word provenance for ${word.expression}.`);
      const wordKey: string = `word:${word.expression}:${word.reading}`;
      return [
        wordKey,
        {
          importedRecordId: record.id,
          sourceRecordId: record.sourceRecordId,
          importRunId: record.importRun.id,
          sourceVersion: record.importRun.sourceVersion,
          checksumSha256: record.importRun.checksumSha256,
          licenseId: record.importRun.dataSource.licenseId,
        },
      ] as const;
    }),
  );
  return { targetIds: resolved, wordEvidence };
}

async function verifySources(
  db: PilotReader,
  manifest: FoundationPilotManifest,
  wordEvidence: Awaited<ReturnType<typeof resolveTargets>>["wordEvidence"],
) {
  const verified = [];
  for (const source of manifest.sources) {
    const dataSource = await db.dataSource.findUnique({
      where: { name: source.dataSourceName },
      include: { license: true },
    });
    if (dataSource === null || dataSource.license.scope !== "PROJECT_AUTHORED")
      throw new Error(`Missing project-authored curation source ${source.id}.`);
    const run = await db.importRun.findUnique({
      where: {
        dataSourceId_checksumSha256: {
          dataSourceId: dataSource.id,
          checksumSha256: source.checksumSha256,
        },
      },
      include: { records: { take: 101, orderBy: { sourceRecordId: "asc" } } },
    });
    if (
      run === null ||
      run.status !== "SUCCESS" ||
      run.checksumSha256 !== source.checksumSha256 ||
      run.sourceVersion !== source.version ||
      run.sourceFileName !== source.sourceFile ||
      !isObject(run.statsJson) ||
      run.statsJson.batchId !== source.id ||
      run.statsJson.reviewedAt !== source.reviewedAt ||
      run.records.length !== source.records.length
    )
      throw new Error(`Missing exact reviewed SUCCESS import for ${source.id}.`);
    for (const expected of source.records) {
      const record = run.records.find(
        (record) => record.sourceRecordId === expected.sourceRecordId,
      );
      const raw = record?.rawJson;
      if (
        record?.recordType !== "PROJECT_AUTHORED" ||
        canonical(expected.wordKey === undefined ? raw : isObject(raw) ? raw.word : null) !==
          canonical(expected.content) ||
        (expected.wordKey !== undefined &&
          (!isObject(raw) ||
            raw.batchId !== source.id ||
            !wordEvidence.has(expected.wordKey) ||
            canonical(raw.sourceEvidence) !== canonical(wordEvidence.get(expected.wordKey))))
      )
        throw new Error(
          `Curation record does not match approved manifest: ${expected.sourceRecordId}.`,
        );
    }
    verified.push({
      batchId: source.id,
      version: source.version,
      reviewedAt: source.reviewedAt,
      checksumSha256: source.checksumSha256,
      importRunId: run.id,
      dataSourceId: dataSource.id,
    });
  }
  return verified;
}

async function scanQuality(
  db: ContentQualityDatabase,
  courseSlug: string,
  expected: readonly { learningItemId: string; kind: string; answers: PilotTarget["answers"] }[],
) {
  const byId = new Map(expected.map((item) => [item.learningItemId, item]));
  const found = new Set<string>();
  const items: unknown[] = [];
  let cursor: string | undefined;
  while (true) {
    const page = await loadContentQualityItems(db, {
      courseSlug,
      limit: 100,
      ...(cursor === undefined ? {} : { cursor }),
    });
    if (page.length > 100) throw new Error("Quality loader exceeded bounded page size.");
    let previousId = cursor;
    for (const item of page) {
      const target = byId.get(item.id);
      if (
        target === undefined ||
        found.has(item.id) ||
        (previousId !== undefined && item.id <= previousId)
      )
        throw new Error("Quality scan contains unexpected, repeated or unordered pilot items.");
      previousId = item.id;
      const issues = validateQualityItem(item);
      if (issues.length)
        throw new Error(
          `Pilot quality must have zero blockers and warnings: ${item.id}/${issues[0]!.code}.`,
        );
      const pairs = item.cards
        .map((card) => `${card.promptType}:${card.answerType}:${card.locale}`)
        .sort();
      const expectedPairs =
        target.kind === "COMPONENT"
          ? ["MEANING:MEANING:ru-RU"]
          : ["MEANING:MEANING:ru-RU", "READING:READING:ru-RU"];
      if (canonical(pairs) !== canonical(expectedPairs))
        throw new Error(`Pilot card identities differ from manifest slots for ${item.id}.`);
      const actualAnswers = item.cards.flatMap((card) =>
        card.answers.map((answer) => ({
          promptType: card.promptType,
          locale: answer.locale,
          text: answer.text,
          isPrimary: answer.isPrimary,
          sourceKind: answer.sourceKind,
        })),
      );
      const expectedAnswers = target.answers.map((answer) => ({
        ...answer,
        sourceKind: "PROJECT_AUTHORED",
      }));
      if (
        canonical(actualAnswers.map(canonical).sort()) !==
        canonical(expectedAnswers.map(canonical).sort())
      )
        throw new Error(`Pilot answers differ from the approved manifest for ${item.id}.`);
      found.add(item.id);
      items.push(qualitySnapshot(item));
    }
    if (page.length < 100) break;
    const next = page.at(-1)!.id;
    if (next === cursor) throw new Error("Quality cursor did not advance.");
    cursor = next;
  }
  if (found.size !== 100) throw new Error("Quality scan did not cover all 100 pilot items.");
  return { policyVersion: CONTENT_QUALITY_POLICY_VERSION, items };
}

function qualitySnapshot(item: QualityItem) {
  // Sort unordered semantic values after removing incidental ORM IDs/timestamps.
  return {
    ...item,
    sourceReadings: canonicalCollection(item.sourceReadings),
    ...(item.validStageIndices === undefined
      ? {}
      : { validStageIndices: canonicalCollection(item.validStageIndices) }),
    cards: canonicalCollection(
      item.cards.map((card) => ({
        id: card.id,
        promptType: card.promptType,
        answerType: card.answerType,
        locale: card.locale,
        audioValid: card.audioValid,
        answers: canonicalCollection(
          card.answers.map(({ text, normalizedText, locale, isPrimary, sourceKind }) => ({
            text,
            normalizedText,
            locale,
            isPrimary,
            sourceKind,
          })),
        ),
        blockedAnswers: canonicalCollection(
          card.blockedAnswers.map(({ text, normalizedText }) => ({ text, normalizedText })),
        ),
      })),
    ),
    mnemonics: canonicalCollection(
      item.mnemonics.map(({ locale, body, sourceKind }) => ({ locale, body, sourceKind })),
    ),
    placements: canonicalCollection(item.placements),
    requiredPrerequisiteTargetIds: canonicalCollection(item.requiredPrerequisiteTargetIds),
    dependencies: canonicalCollection(
      item.dependencies.map((dependency) => ({
        ...dependency,
        placements: canonicalCollection(dependency.placements),
      })),
    ),
  };
}

export async function publishFoundationPilot(
  prisma: PrismaClient,
  options: FoundationPilotOptions = {},
) {
  const before = await planFoundationPilot(prisma, options);
  return prisma.$transaction(async (db) => {
    const plan = await planFoundationPilot(db, options);
    if (
      plan.contentVersion !== before.contentVersion ||
      plan.manifestChecksum !== before.manifestChecksum
    )
      throw new Error("Pilot content changed after read-only preflight.");
    const manifest = plan.manifest;
    const course = await db.course.upsert({
      where: { slug: manifest.slug },
      update: {},
      create: {
        slug: manifest.slug,
        titleRu: manifest.titleRu,
        descriptionRu: manifest.descriptionRu,
        targetLevel: manifest.targetLevel,
        band: "FOUNDATION",
        courseType: "STRUCTURED",
        status: "DRAFT",
      },
    });
    for (const level of manifest.levels) {
      const target = await db.courseLevel.upsert({
        where: { courseId_levelNumber: { courseId: course.id, levelNumber: level.levelNumber } },
        update: {},
        create: {
          courseId: course.id,
          levelNumber: level.levelNumber,
          titleRu: level.titleRu,
          descriptionRu: level.descriptionRu,
          band: "FOUNDATION",
          passPolicyJson: toJson(level.passPolicyJson),
        },
      });
      for (const item of plan.items.filter((item) => item.levelNumber === level.levelNumber))
        await db.courseLevelItem.upsert({
          where: {
            courseLevelId_learningItemId: {
              courseLevelId: target.id,
              learningItemId: item.learningItemId,
            },
          },
          update: {},
          create: {
            courseLevelId: target.id,
            learningItemId: item.learningItemId,
            sortOrder: item.sortOrder,
            unlockPolicyJson:
              item.unlockPolicyJson === null ? Prisma.DbNull : toJson(item.unlockPolicyJson),
          },
        });
    }
    const pilotQuality = await scanQuality(db, manifest.slug, plan.items);
    const repeatedMainQuality = await scanQuality(db, SOURCE_COURSE_SLUG, plan.items);
    if (
      canonical(pilotQuality) !== canonical(plan.quality) ||
      canonical(repeatedMainQuality) !== canonical(plan.quality)
    )
      throw new Error("Pilot/main quality checksum changed inside publication transaction.");
    const metadata = {
      schemaVersion: 1,
      courseId: course.id,
      sourceCourseId: plan.sourceCourseId,
      slug: manifest.slug,
      manifestChecksum: plan.manifestChecksum,
      contentVersion: plan.contentVersion,
      sourceChecksums: plan.sourceChecksums,
      counts: manifest.counts,
      qualityPolicyVersion: CONTENT_QUALITY_POLICY_VERSION,
      placements: plan.items.map(({ learningItemId, targetId, kind, levelNumber, sortOrder }) => ({
        learningItemId,
        targetId,
        kind,
        levelNumber,
        sortOrder,
      })),
    };
    const license = await db.license.upsert({
      where: { name: PUBLICATION_LICENSE },
      update: {},
      create: {
        name: PUBLICATION_LICENSE,
        scope: "PROJECT_AUTHORED",
        spdxLikeId: "LicenseRef-Project-Authored",
        requiresAttribution: false,
        requiresShareAlike: false,
      },
    });
    const source = await db.dataSource.upsert({
      where: { name: PUBLICATION_SOURCE },
      update: {},
      create: {
        name: PUBLICATION_SOURCE,
        licenseId: license.id,
        homepageUrl: PUBLICATION_URL,
        attributionText: "Project-authored finite Foundation pilot publication metadata.",
      },
    });
    const run = await db.importRun.upsert({
      where: {
        dataSourceId_checksumSha256: {
          dataSourceId: source.id,
          checksumSha256: plan.contentVersion,
        },
      },
      update: {},
      create: {
        dataSourceId: source.id,
        checksumSha256: plan.contentVersion,
        sourceVersion: manifest.version,
        sourceFileName: "packages/db/src/foundation-pilot.ts",
        status: "SUCCESS",
        finishedAt: new Date(),
        statsJson: toJson(metadata),
      },
    });
    await db.importedRecord.upsert({
      where: { id: FOUNDATION_PILOT_RECORD_ID },
      update: {},
      create: {
        id: FOUNDATION_PILOT_RECORD_ID,
        importRunId: run.id,
        sourceRecordId: manifest.slug,
        recordType: "PROJECT_AUTHORED",
        rawJson: toJson(metadata),
      },
    });
    await db.course.update({ where: { id: course.id }, data: { status: "PUBLISHED" } });
    if (options.enrollUserId !== undefined) {
      await db.userEnrollment.upsert({
        where: { userId_courseId: { userId: options.enrollUserId, courseId: course.id } },
        update: {},
        create: { userId: options.enrollUserId, courseId: course.id, status: "ACTIVE" },
      });
      await db.userSettings.upsert({
        where: { userId: options.enrollUserId },
        update: {},
        create: { userId: options.enrollUserId },
      });
      await db.userSettings.updateMany({
        where: { userId: options.enrollUserId, currentCourseId: null },
        data: { currentCourseId: course.id },
      });
    }
    return {
      status: "published",
      slug: manifest.slug,
      courseId: course.id,
      contentVersion: plan.contentVersion,
      manifestRecordId: FOUNDATION_PILOT_RECORD_ID,
      counts: manifest.counts,
      enrolledUserId: options.enrollUserId ?? null,
    };
  }, TRANSACTION_OPTIONS);
}

async function checkPublicationSource(db: PilotReader) {
  const [license, source] = await Promise.all([
    db.license.findUnique({ where: { name: PUBLICATION_LICENSE } }),
    db.dataSource.findUnique({ where: { name: PUBLICATION_SOURCE }, include: { license: true } }),
  ]);
  if (
    license !== null &&
    (license.scope !== "PROJECT_AUTHORED" || license.spdxLikeId !== "LicenseRef-Project-Authored")
  )
    throw new Error("Conflicting pilot metadata license.");
  if (
    source !== null &&
    (source.license.name !== PUBLICATION_LICENSE ||
      source.license.scope !== "PROJECT_AUTHORED" ||
      source.homepageUrl !== PUBLICATION_URL ||
      !source.attributionText?.trim())
  )
    throw new Error("Conflicting pilot metadata source.");
  return source;
}

function requireApproved(manifest: FoundationPilotManifest): void {
  if (
    manifest.slug !== FOUNDATION_PILOT_SLUG ||
    manifest.sourceCourseSlug !== SOURCE_COURSE_SLUG ||
    manifest.version !== "1" ||
    manifest.targets.length !== 100 ||
    manifest.sources.length !== 3 ||
    manifest.sources.some(
      (source) => source.reviewedAt === null || !/^\d{4}-\d{2}-\d{2}$/u.test(source.reviewedAt),
    )
  )
    throw new Error(
      "Pilot requires the exact three independently reviewed finite source manifests.",
    );
}
function validateEnrollmentId(id: string | undefined): void {
  if (
    id !== undefined &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(id)
  )
    throw new Error("--enroll-user-id requires one explicit UUID.");
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function canonical(value: unknown): string {
  return (
    JSON.stringify(value, (_key, value: unknown) =>
      isObject(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : value,
    ) ?? "null"
  );
}
function canonicalCollection<T>(values: readonly T[]): T[] {
  // Retain duplicates and every semantic field; array positions here have no meaning.
  return values
    .map((value) => ({ value, key: canonical(value) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ value }) => value);
}
function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
