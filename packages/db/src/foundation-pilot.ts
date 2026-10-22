import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";
import { CONTENT_QUALITY_POLICY_VERSION } from "@kanji-srs/shared";

import { type QualityItem, validateQualityItem } from "./content-quality";
import { loadContentQualityItems, type ContentQualityDatabase } from "./content-quality-report";
import { createCourseLevelPassPolicy } from "./course-level-policy";
import { buildMainCourseBlueprint } from "./main-course";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
  type MainCourseContentBatch,
} from "./main-course-content";
import {
  buildMainCourseWordBatch,
  buildMainCourseWordBatches,
  mainCourseWordAcceptedReadings,
  mainCourseWordBatchChecksum,
  validateMainCourseWordBatch,
  wordHanCharacters,
  type MainCourseWordBatch,
} from "./main-course-word-content";

export const FOUNDATION_PILOT_SLUG = "japanese-foundation-pilot-v1";
export const FOUNDATION_PILOT_RECORD_ID = "c5d6546d-6f29-451e-bbc5-a0ba4b887048";
export const FOUNDATION_PILOT_V2_SLUG = "japanese-foundation-pilot-v2";
export const FOUNDATION_PILOT_V2_RECORD_ID = "4c599bc8-e28c-4527-9d9b-a99a3a7c8779";
export const FOUNDATION_PILOT_V3_SLUG = "japanese-foundation-pilot-v3";
export const FOUNDATION_PILOT_V3_RECORD_ID = "41a64921-eb2c-433e-9761-250e3b31015e";
export const FOUNDATION_PILOT_V4_SLUG = "japanese-foundation-pilot-v4";
export const FOUNDATION_PILOT_V4_RECORD_ID = "a88880b1-27a3-474d-af1f-0e9ef261d6f7";
const KANJI_SOURCE_IDS = ["01", "02", "03", "04"].map(
  (suffix) => `task-118-foundation-kanji-${suffix}`,
);
const WORD_SOURCE_IDS = ["01", "02", "03"].map((suffix) => `task-127-foundation-words-${suffix}`);
const SOURCE_HASHES: Readonly<Record<string, string>> = {
  [KANJI_SOURCE_IDS[0]!]: "34676566c590fd19d10349e6bb07c75d01471fc618872fa103db2e676fd138b8",
  [KANJI_SOURCE_IDS[1]!]: "99268635c984603c30a1a53c2beb0bcd63a53316b9cb3a83b4e51c54e1c18714",
  [KANJI_SOURCE_IDS[2]!]: "fe1998be5842a0ca2f233670318949c51d82c58d68068851c3859f8e3560af92",
  [KANJI_SOURCE_IDS[3]!]: "5547b31673a20cffdfc817b0a95bd8b3e202108529c844f5090e0234fefa7850",
  [WORD_SOURCE_IDS[0]!]: "1ceeb2467961f707e57047ab0c46a91badaa048f036ac3299a5a7d0685f99daf",
  [WORD_SOURCE_IDS[1]!]: "0110505331b1066653f4b62ce20f4c8bbb98e94ccf701eafac26ecda9a0e6a4f",
  [WORD_SOURCE_IDS[2]!]: "ef7090a4cea8c4b74c04a3cebfe85dc9832d64e1b7d071e409232287e7cf2ff4",
};
const V3_KANJI_SOURCE_IDS = [...KANJI_SOURCE_IDS, "task-118-foundation-kanji-05"];
const V3_WORD_SOURCE_IDS = [
  ...WORD_SOURCE_IDS,
  "task-127-foundation-words-04",
  "task-127-course-words-05",
];
const V3_SOURCE_HASHES: Readonly<Record<string, string>> = {
  ...SOURCE_HASHES,
  "task-118-foundation-kanji-05":
    "95a4b69a331f200caa5044717cde9d628c3d3ad1d79600000c142a55967a3c1b",
  "task-127-foundation-words-04":
    "81496c6ffcb91d0d7fa046b8f075b4b1aff6e2ccec7f69d48c48708bb043b5b6",
  "task-127-course-words-05": "e1fd34111d46183f4376934d9d55429c191524e7d319ec367b8bdb2c4d972f36",
};
const V4_KANJI_SOURCE_IDS = [...V3_KANJI_SOURCE_IDS, "task-118-course-kanji-06"];
const V4_WORD_SOURCE_IDS = [...V3_WORD_SOURCE_IDS, "task-127-course-words-06"];
const V4_SOURCE_HASHES: Readonly<Record<string, string>> = {
  ...V3_SOURCE_HASHES,
  "task-118-course-kanji-06": "74482be25706778fafe6e18b5ffc144718a3bf7a4181a5aacc8323516b223833",
  "task-127-course-words-06": "8a9e0cef7dc10ec355125ffb7bb989d96cd531d0f85767280b735b6ad9790858",
};
// L6's WORD core does not waive the mixed level's component prerequisites for L7.
const V4_LEVEL_KINDS = ["COMPONENT", "KANJI", "KANJI", "KANJI", "WORD", "WORD", "KANJI"] as const;
const PILOTS = {
  v1: {
    slug: FOUNDATION_PILOT_SLUG,
    recordId: FOUNDATION_PILOT_RECORD_ID,
    version: "1",
    counts: { components: 40, kanji: 40, words: 20, items: 100, cards: 160 },
    kanjiIds: KANJI_SOURCE_IDS.slice(0, 2),
    wordIds: WORD_SOURCE_IDS.slice(0, 1),
    canonicalChecksum: "f2febe7e3a1e5a11800530c7992819ab2c3a06f5c33ae3dd0f5218de68c68b86",
  },
  v2: {
    slug: FOUNDATION_PILOT_V2_SLUG,
    recordId: FOUNDATION_PILOT_V2_RECORD_ID,
    version: "2",
    counts: { components: 53, kanji: 61, words: 60, items: 174, cards: 295 },
    kanjiIds: KANJI_SOURCE_IDS,
    wordIds: WORD_SOURCE_IDS,
    canonicalChecksum: "4d2f3aab0b2b160774ab5a2ca19a675f28423c48561218abca4c8737c47d53e1",
  },
  v3: {
    slug: FOUNDATION_PILOT_V3_SLUG,
    recordId: FOUNDATION_PILOT_V3_RECORD_ID,
    version: "3",
    counts: { components: 63, kanji: 81, words: 100, items: 244, cards: 425 },
    kanjiIds: V3_KANJI_SOURCE_IDS,
    wordIds: V3_WORD_SOURCE_IDS,
    canonicalChecksum: "a7261a33902acba75a8058ba043b4f6ab786978315783e23cb9479cd040617d1",
  },
  v4: {
    slug: FOUNDATION_PILOT_V4_SLUG,
    recordId: FOUNDATION_PILOT_V4_RECORD_ID,
    version: "4",
    counts: { components: 79, kanji: 101, words: 120, items: 300, cards: 521 },
    kanjiIds: V4_KANJI_SOURCE_IDS,
    wordIds: V4_WORD_SOURCE_IDS,
    canonicalChecksum: "7353baf893c3bde9fb7279529bcf69d66d7e0b9ef81396a8fb96169c686e70fc",
  },
} as const;
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
  kanjiBatches: readonly MainCourseContentBatch[] = buildMainCourseContentBatches().filter(
    (batch) =>
      batch.id === "task-118-foundation-kanji-01" || batch.id === "task-118-foundation-kanji-02",
  ),
  words: MainCourseWordBatch = buildMainCourseWordBatch(),
) {
  return buildPilotManifest(kanjiBatches, [words], "v1");
}

export function buildFoundationPilotManifestV2(
  kanjiBatches: readonly MainCourseContentBatch[] = buildMainCourseContentBatches().filter(
    (batch) => KANJI_SOURCE_IDS.includes(batch.id),
  ),
  wordBatches: readonly MainCourseWordBatch[] = buildMainCourseWordBatches().filter((batch) =>
    WORD_SOURCE_IDS.includes(batch.id),
  ),
) {
  return buildPilotManifest(kanjiBatches, wordBatches, "v2");
}

export function buildFoundationPilotManifestV3(
  kanjiBatches: readonly MainCourseContentBatch[] = buildMainCourseContentBatches().filter(
    (batch) => V3_KANJI_SOURCE_IDS.includes(batch.id),
  ),
  wordBatches: readonly MainCourseWordBatch[] = buildMainCourseWordBatches().filter((batch) =>
    V3_WORD_SOURCE_IDS.includes(batch.id),
  ),
) {
  return buildPilotManifest(kanjiBatches, wordBatches, "v3");
}

export function buildFoundationPilotManifestV4(
  kanjiBatches: readonly MainCourseContentBatch[] = buildMainCourseContentBatches().filter(
    (batch) => V4_KANJI_SOURCE_IDS.includes(batch.id),
  ),
  wordBatches: readonly MainCourseWordBatch[] = buildMainCourseWordBatches().filter((batch) =>
    V4_WORD_SOURCE_IDS.includes(batch.id),
  ),
) {
  return buildPilotManifest(kanjiBatches, wordBatches, "v4");
}

function buildPilotManifest(
  kanjiBatches: readonly MainCourseContentBatch[],
  wordBatches: readonly MainCourseWordBatch[],
  pilot: keyof typeof PILOTS,
) {
  const definition = PILOTS[pilot];
  const issues = [
    ...validateMainCourseContentBatches(kanjiBatches),
    ...wordBatches.flatMap(validateMainCourseWordBatch),
  ];
  if (issues.length) throw new Error(`Invalid pilot sources: ${issues.join("; ")}`);
  if (
    kanjiBatches.map((batch) => batch.id).join(",") !== definition.kanjiIds.join(",") ||
    wordBatches.map((batch) => batch.id).join(",") !== definition.wordIds.join(",") ||
    [...kanjiBatches, ...wordBatches].some(
      (batch) => batch.version !== "1" || batch.courseSlug !== SOURCE_COURSE_SLUG,
    )
  )
    throw new Error(
      pilot === "v1"
        ? "Pilot v1 requires exactly the three registered version-1 main-course batches."
        : pilot === "v2"
          ? "Pilot v2 requires exactly the seven registered version-1 main-course batches."
          : pilot === "v3"
            ? "Pilot v3 requires exactly the ten registered version-1 main-course batches."
            : "Pilot v4 requires exactly the twelve registered version-1 main-course batches.",
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
  for (const words of wordBatches) {
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
        answers: answers(
          content.meanings.ru.accepted,
          content.meanings.en.accepted,
          pilot === "v1" ? [content.reading] : mainCourseWordAcceptedReadings(content),
        ),
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
  }
  if (
    targets.filter((target) => target.kind === "COMPONENT").length !==
      definition.counts.components ||
    targets.filter((target) => target.kind === "KANJI").length !== definition.counts.kanji ||
    targets.filter((target) => target.kind === "WORD").length !== definition.counts.words
  )
    throw new Error(`Pilot ${pilot} requires its exact sealed component, kanji and word counts.`);
  const keys = new Map(targets.map((target) => [target.key, target]));
  if (
    keys.size !== definition.counts.items ||
    new Set(targets.map((target) => `${target.levelNumber}:${target.sortOrder}`)).size !==
      definition.counts.items ||
    targets.some(
      (target) =>
        target.levelNumber < 1 ||
        target.levelNumber > (pilot === "v4" ? 7 : pilot === "v3" ? 6 : 5) ||
        (pilot === "v3" &&
          (target.kind === "WORD" ? target.levelNumber < 5 : target.levelNumber > 4)) ||
        (pilot === "v4" &&
          !(
            target.kind === "COMPONENT" ? [1, 6] : target.kind === "KANJI" ? [2, 3, 4, 7] : [5, 6]
          ).includes(target.levelNumber)) ||
        target.prerequisiteKeys.some(
          (key) => !keys.has(key) || keys.get(key)!.levelNumber >= target.levelNumber,
        ),
    )
  )
    throw new Error("Pilot placements and earlier prerequisite closure are invalid.");
  for (const words of wordBatches)
    for (const content of words.words)
      if (
        wordHanCharacters(content.example.japaneseText).some(
          (character) =>
            !keys.has(`kanji:${character}`) ||
            keys.get(`kanji:${character}`)!.levelNumber >= words.levelNumber,
        )
      )
        throw new Error(`Pilot example needs an earlier registered kanji: ${content.expression}.`);
  const label =
    pilot === "v1"
      ? "40 компонентов, 40 кандзи и 20 слов"
      : pilot === "v2"
        ? "53 компонента, 61 кандзи и 60 слов"
        : pilot === "v3"
          ? "63 компонента, 81 кандзи и 100 слов"
          : "79 компонентов, 101 кандзи и 120 слов";
  const levelCount = pilot === "v4" ? 7 : pilot === "v3" ? 6 : 5;
  return {
    version: definition.version,
    slug: definition.slug,
    sourceCourseSlug: SOURCE_COURSE_SLUG,
    titleRu: `Пилот основ: ${label}`,
    descriptionRu: `Отдельный пилот из ${levelCount} уровней: ${label}. Это не полный курс до N2.`,
    targetLevel: "FOUNDATION",
    counts: { ...definition.counts },
    levels: Array.from({ length: levelCount }, (_, index) => {
      const kind =
        pilot === "v4"
          ? V4_LEVEL_KINDS[index]!
          : index === 0
            ? "COMPONENT"
            : index >= 4
              ? "WORD"
              : "KANJI";
      return {
        levelNumber: index + 1,
        titleRu: `Основа: этап ${index + 1}`,
        descriptionRu:
          index === 0
            ? "Компоненты пилотного курса."
            : pilot === "v4" && index === 5
              ? "40 слов и 16 компонентов. Переход по словам не означает освоения всех элементов: компоненты остаются обязательными предпосылками кандзи этапа 7."
              : kind === "WORD"
                ? `Первые ${definition.counts.words} слов пилотного курса.`
                : "Кандзи пилотного курса.",
        passPolicyJson: createCourseLevelPassPolicy(kind),
      };
    }),
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
  const context = requireApproved(options.manifest ?? buildFoundationPilotManifest());
  const manifest = context.manifest;
  validateEnrollmentId(options.enrollUserId);
  const [sourceCourse, existingPilot] = await Promise.all([
    db.course.findUnique({ where: { slug: SOURCE_COURSE_SLUG }, select: COURSE_SELECT }),
    db.course.findUnique({ where: { slug: context.slug }, select: COURSE_SELECT }),
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
    throw new Error("Existing pilot identity or metadata does not match its sealed version.");
  if (existingPilot !== null)
    for (const level of existingPilot.levels) {
      const expected = manifest.levels.find(
        (candidate) => candidate.levelNumber === level.levelNumber,
      );
      if (
        expected === undefined ||
        level.band !== pilotLevelBand(manifest.slug, level.levelNumber) ||
        level.titleRu !== expected.titleRu ||
        level.descriptionRu !== expected.descriptionRu ||
        canonical(level.passPolicyJson) !== canonical(expected.passPolicyJson)
      )
        throw new Error("Existing pilot has unexpected level metadata.");
    }
  const { targetIds, wordEvidence, acceptedReadingEvidence } = await resolveTargets(db, manifest);
  const placements = await db.courseLevelItem.findMany({
    where: {
      courseLevel: { courseId: sourceCourse.id },
      learningItem: {
        OR: (["COMPONENT", "KANJI", "WORD"] as const).map((targetType) => ({
          targetType,
          targetId: {
            in: manifest.targets
              .filter((target) => target.kind === targetType)
              .map((target) => targetIds.get(target.key)!),
          },
        })),
      },
    },
    take: context.counts.items + 1,
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
  if (placements.length !== context.counts.items)
    throw new Error(
      `Pilot requires exactly ${context.counts.items} main-course placements for its registered targets.`,
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
      placement.courseLevel.band !== pilotLevelBand(manifest.slug, target.levelNumber) ||
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
  if (new Set(items.map((item) => item.learningItemId)).size !== context.counts.items)
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
  const sourceChecksums = await verifySources(db, manifest, wordEvidence, acceptedReadingEvidence);
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
    where: { id: context.recordId },
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
      take: context.counts.items + 1,
      orderBy: { id: "asc" },
      select: {
        learningItemId: true,
        sortOrder: true,
        unlockPolicyJson: true,
        courseLevel: { select: { levelNumber: true } },
      },
    });
    if (
      prior.length !== context.counts.items ||
      existingPilot.levels.length !== manifest.levels.length ||
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
        OR: words.flatMap((target) =>
          target.answers
            .filter((answer) => answer.promptType === "READING")
            .map((answer) => ({ expression: target.expression, reading: answer.text })),
        ),
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
  const acceptedReadingEvidence = new Map<
    string,
    {
      reading: string;
      wordId: string;
      sourceEvidence: NonNullable<ReturnType<typeof wordEvidence.get>>;
    }[]
  >();
  for (const target of words) {
    const primary = wordEvidence.get(target.key);
    const alternatives = [];
    for (const answer of target.answers.filter(
      (answer) => answer.promptType === "READING" && !answer.isPrimary,
    )) {
      const row = wordRows.find(
        (row) => row.expression === target.expression && row.reading === answer.text,
      );
      const evidence = wordEvidence.get(`word:${target.expression}:${answer.text}`);
      if (
        row === undefined ||
        row.jmdictEntryId !== target.jmdictEntryId ||
        evidence === undefined ||
        canonical(evidence) !== canonical(primary)
      )
        throw new Error(
          `Missing matching alternate word provenance for ${target.key}/${answer.text}.`,
        );
      alternatives.push({ reading: answer.text, wordId: row.id, sourceEvidence: evidence });
    }
    acceptedReadingEvidence.set(target.key, alternatives);
  }
  return { targetIds: resolved, wordEvidence, acceptedReadingEvidence };
}

async function verifySources(
  db: PilotReader,
  manifest: FoundationPilotManifest,
  wordEvidence: Awaited<ReturnType<typeof resolveTargets>>["wordEvidence"],
  acceptedReadingEvidence: Awaited<ReturnType<typeof resolveTargets>>["acceptedReadingEvidence"],
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
      include: { records: { take: source.records.length + 1, orderBy: { sourceRecordId: "asc" } } },
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
            canonical(raw.sourceEvidence) !== canonical(wordEvidence.get(expected.wordKey)) ||
            canonical(raw.acceptedReadingEvidence ?? []) !==
              canonical(acceptedReadingEvidence.get(expected.wordKey) ?? [])))
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
  const itemIds = [...byId.keys()];
  const scopedIds = itemIds.length > 100 ? [...itemIds].sort() : itemIds;
  const found = new Set<string>();
  const items: unknown[] = [];
  for (let offset = 0; offset < scopedIds.length; offset += 100) {
    const scope = scopedIds.slice(offset, offset + 100);
    let cursor: string | undefined;
    while (true) {
      const page = await loadContentQualityItems(db, {
        courseSlug,
        limit: 100,
        itemIds: scope,
        ...(cursor === undefined ? {} : { cursor }),
      });
      if (page.length > 100) throw new Error("Quality loader exceeded bounded page size.");
      let previousId = cursor;
      for (const item of page) {
        const target = byId.get(item.id);
        if (
          target === undefined ||
          !scope.includes(item.id) ||
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
  }
  if (found.size !== expected.length)
    throw new Error(`Quality scan did not cover all ${expected.length} pilot items.`);
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
  return prisma.$transaction(
    async (db) => {
      const plan = await planFoundationPilot(db, options);
      if (
        plan.contentVersion !== before.contentVersion ||
        plan.manifestChecksum !== before.manifestChecksum
      )
        throw new Error("Pilot content changed after read-only preflight.");
      const manifest = plan.manifest;
      const context = requireApproved(manifest);
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
      const levelIds = new Map<number, string>();
      for (const level of manifest.levels) {
        const target = await db.courseLevel.upsert({
          where: { courseId_levelNumber: { courseId: course.id, levelNumber: level.levelNumber } },
          update: {},
          create: {
            courseId: course.id,
            levelNumber: level.levelNumber,
            titleRu: level.titleRu,
            descriptionRu: level.descriptionRu,
            band: pilotLevelBand(manifest.slug, level.levelNumber),
            passPolicyJson: toJson(level.passPolicyJson),
          },
        });
        levelIds.set(level.levelNumber, target.id);
      }
      await db.courseLevelItem.createMany({
        skipDuplicates: true,
        data: plan.items.map((item) => ({
          courseLevelId: levelIds.get(item.levelNumber)!,
          learningItemId: item.learningItemId,
          sortOrder: item.sortOrder,
          unlockPolicyJson:
            item.unlockPolicyJson === null ? Prisma.DbNull : toJson(item.unlockPolicyJson),
        })),
      });
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
        placements: plan.items.map(
          ({ learningItemId, targetId, kind, levelNumber, sortOrder }) => ({
            learningItemId,
            targetId,
            kind,
            levelNumber,
            sortOrder,
          }),
        ),
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
        where: { id: context.recordId },
        update: {},
        create: {
          id: context.recordId,
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
        manifestRecordId: context.recordId,
        counts: manifest.counts,
        enrolledUserId: options.enrollUserId ?? null,
      };
    },
    {
      ...TRANSACTION_OPTIONS,
      // V4 repeats three bounded 300-item quality scans inside one atomic publication.
      timeout:
        before.manifest.slug === FOUNDATION_PILOT_V4_SLUG ? 120_000 : TRANSACTION_OPTIONS.timeout,
    },
  );
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

export function foundationPilotRecordId(manifest: FoundationPilotManifest): string {
  return requireApproved(manifest).recordId;
}

function pilotLevelBand(slug: string, levelNumber: number) {
  if (slug !== FOUNDATION_PILOT_V3_SLUG && slug !== FOUNDATION_PILOT_V4_SLUG)
    return "FOUNDATION" as const;
  const level = buildMainCourseBlueprint().levels.find(
    (candidate) => candidate.levelNumber === levelNumber,
  );
  if (level === undefined) throw new Error("Pilot level has no registered curriculum band.");
  return level.band;
}

function requireApproved(manifest: FoundationPilotManifest) {
  const context = Object.values(PILOTS).find((pilot) => pilot.slug === manifest.slug);
  const expected =
    context?.slug === FOUNDATION_PILOT_SLUG
      ? buildFoundationPilotManifest()
      : context?.slug === FOUNDATION_PILOT_V2_SLUG
        ? buildFoundationPilotManifestV2()
        : context?.slug === FOUNDATION_PILOT_V3_SLUG
          ? buildFoundationPilotManifestV3()
          : context?.slug === FOUNDATION_PILOT_V4_SLUG
            ? buildFoundationPilotManifestV4()
            : null;
  if (
    context === undefined ||
    expected === null ||
    hash(canonical(expected)) !== context.canonicalChecksum ||
    canonical(manifest) !== canonical(expected) ||
    expected.sources.some(
      (source) => source.reviewedAt === null || !/^\d{4}-\d{2}-\d{2}$/u.test(source.reviewedAt),
    ) ||
    expected.sources.some(
      (source) =>
        source.checksumSha256 !==
        (context.slug === FOUNDATION_PILOT_V4_SLUG
          ? V4_SOURCE_HASHES
          : context.slug === FOUNDATION_PILOT_V3_SLUG
            ? V3_SOURCE_HASHES
            : SOURCE_HASHES)[source.id],
    )
  )
    throw new Error(
      "Pilot requires the exact sealed independently reviewed finite source manifests.",
    );
  return { ...context, manifest: structuredClone(expected) };
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
