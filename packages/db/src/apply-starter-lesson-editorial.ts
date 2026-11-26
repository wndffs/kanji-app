import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

import { buildStarterCourseSeed, type StarterCourseSeedTarget } from "./course-seed";
import { CURATION_SOURCE_NAMES } from "./curation-source-names";
import { FOUNDATION_BASICS_EDITORIAL } from "./foundation-basics-editorial";
import { FOUNDATION_COMPONENTS_EDITORIAL } from "./foundation-components-editorial";
import { FOUNDATION_KANJI_EDITORIAL } from "./foundation-kanji-editorial";
import { FOUNDATION_LEVEL_EIGHT_EDITORIAL } from "./foundation-level-eight-editorial";
import { FOUNDATION_LEVEL_FIVE_EDITORIAL } from "./foundation-level-five-editorial";
import { FOUNDATION_LEVEL_FOUR_EDITORIAL } from "./foundation-level-four-editorial";
import { FOUNDATION_LEVEL_SEVEN_EDITORIAL } from "./foundation-level-seven-editorial";
import { FOUNDATION_LEVEL_SIX_EDITORIAL } from "./foundation-level-six-editorial";
import { FOUNDATION_LEVEL_THREE_EDITORIAL } from "./foundation-level-three-editorial";
import { FOUNDATION_COMPLETION_EDITORIAL } from "./foundation-level-two-editorial";
import { buildMainCourseContentBatches, type MainCourseKanjiContent } from "./main-course-content";
import type { MainCourseEditorialEntry } from "./main-course-editorial-entry";
import { STARTER_LESSON_EDITORIAL, type CourseEditorialEntry } from "./starter-lesson-editorial";

const STARTER_SOURCE = "Kanji SRS bootstrap seed";
const LOCALES = [
  ["ru", "ru-RU"],
  ["en", "en-US"],
] as const;

type EditorialTarget =
  | Pick<Extract<StarterCourseSeedTarget, { kind: "COMPONENT" }>, "kind" | "symbol">
  | Pick<Extract<StarterCourseSeedTarget, { kind: "KANJI" }>, "kind" | "character">
  | Pick<Extract<StarterCourseSeedTarget, { kind: "WORD" }>, "kind" | "expression" | "reading">
  | Pick<
      Extract<StarterCourseSeedTarget, { kind: "SENTENCE" }>,
      "kind" | "japaneseText" | "readingText"
    >;

type EditorialSlot = {
  readonly levelNumber: number;
  readonly sortOrder: number;
  readonly target: EditorialTarget;
  readonly reading?: string;
};

type EditorialRelease = {
  readonly courseSlug: string;
  readonly sourceName: string;
  readonly sourceFileName: string;
  readonly content: {
    readonly version: string;
    readonly sourceSnapshotVersion: string;
    readonly entries: readonly CourseEditorialEntry[];
  };
  readonly slots: ReadonlyMap<string, EditorialSlot>;
};

const batchVersions = {
  starter: STARTER_LESSON_EDITORIAL.version,
  foundation: FOUNDATION_KANJI_EDITORIAL.version,
  "foundation-basics": FOUNDATION_BASICS_EDITORIAL.version,
  "foundation-components": FOUNDATION_COMPONENTS_EDITORIAL.version,
  "foundation-completion": FOUNDATION_COMPLETION_EDITORIAL.version,
  "foundation-level-three": FOUNDATION_LEVEL_THREE_EDITORIAL.version,
  "foundation-level-four": FOUNDATION_LEVEL_FOUR_EDITORIAL.version,
  "foundation-level-five": FOUNDATION_LEVEL_FIVE_EDITORIAL.version,
  "foundation-level-six": FOUNDATION_LEVEL_SIX_EDITORIAL.version,
  "foundation-level-seven": FOUNDATION_LEVEL_SEVEN_EDITORIAL.version,
  "foundation-level-eight": FOUNDATION_LEVEL_EIGHT_EDITORIAL.version,
} as const;

export type EditorialBatch = keyof typeof batchVersions;

export function resolveEditorialBatch(selector: string): EditorialBatch | undefined {
  const batches = Object.keys(batchVersions) as EditorialBatch[];
  return batches.find((batch) => {
    const tag = `publish-lesson-editorial-${batchVersions[batch]}`;
    const retryPrefix = `${tag}-attempt-`;
    return (
      selector === batch ||
      selector === tag ||
      (selector.startsWith(retryPrefix) && /^[2-5]$/u.test(selector.slice(retryPrefix.length)))
    );
  });
}

export function shouldRetryEditorialPlan(mode: "plan" | "apply", attempt: number, error: unknown) {
  return (
    mode === "plan" &&
    attempt < 3 &&
    typeof error === "object" &&
    error !== null &&
    (("errorCode" in error && error.errorCode === "P1001") ||
      ("code" in error && error.code === "P1001"))
  );
}

export function applyStarterLessonEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  const seed = buildStarterCourseSeed();
  return applyEditorial(prisma, mode, {
    courseSlug: seed.course.slug,
    sourceName: STARTER_SOURCE,
    sourceFileName: "packages/db/src/starter-lesson-editorial.ts",
    content: STARTER_LESSON_EDITORIAL,
    slots: new Map(seed.items.map((item) => [item.key, item])),
  });
}

function mainKanjiSlots(
  entries: readonly { itemKey: string; character: string; reading: string }[],
  curriculum: readonly MainCourseKanjiContent[] = buildMainCourseContentBatches().flatMap(
    ({ kanji }) => kanji,
  ),
): ReadonlyMap<string, EditorialSlot> {
  return new Map(
    entries.map((entry) => {
      const matches = curriculum.filter(({ character }) => character === entry.character);
      const expected = matches[0];
      if (matches.length !== 1 || expected?.reading.primary !== entry.reading) {
        throw new Error(
          `Foundation editorial reading or placement does not match: ${entry.itemKey}.`,
        );
      }
      return [
        entry.itemKey,
        {
          levelNumber: expected.levelNumber,
          sortOrder: expected.sortOrder,
          target: { kind: "KANJI", character: entry.character },
          reading: entry.reading,
        },
      ];
    }),
  );
}

export function foundationEditorialSlots(): ReadonlyMap<string, EditorialSlot> {
  return mainKanjiSlots(FOUNDATION_KANJI_EDITORIAL.entries);
}

export function applyFoundationKanjiEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyEditorial(prisma, mode, {
    courseSlug: "japanese-ru-n2",
    sourceName: CURATION_SOURCE_NAMES.kanji,
    sourceFileName: "packages/db/src/foundation-kanji-editorial.ts",
    content: FOUNDATION_KANJI_EDITORIAL,
    slots: foundationEditorialSlots(),
  });
}

export function foundationBasicsEditorialSlots(): ReadonlyMap<string, EditorialSlot> {
  const entries = FOUNDATION_BASICS_EDITORIAL.entries;
  const base = buildMainCourseContentBatches().find(
    ({ id }) => id === "task-118-foundation-kanji-01",
  );
  if (base === undefined) throw new Error("The original foundation batch is required.");
  const slots = new Map(
    mainKanjiSlots(
      entries.filter((entry) => entry.kind === "KANJI"),
      base.kanji,
    ),
  );
  for (const entry of entries) {
    if (entry.kind !== "COMPONENT") continue;
    const index = base.components.findIndex(({ key }) => key === entry.componentKey);
    if (index < 0 || base.components[index]?.symbol !== entry.symbol) {
      throw new Error(
        `Foundation component does not match the registered shape: ${entry.itemKey}.`,
      );
    }
    slots.set(entry.itemKey, {
      levelNumber: base.componentLevelNumber,
      sortOrder: (base.componentSortOrderStart ?? 1) + index,
      target: { kind: "COMPONENT", symbol: entry.symbol },
    });
  }
  return slots;
}

export function applyFoundationBasicsEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyEditorial(prisma, mode, {
    courseSlug: "japanese-ru-n2",
    sourceName: CURATION_SOURCE_NAMES.kanji,
    sourceFileName: "packages/db/src/foundation-basics-editorial.ts",
    content: FOUNDATION_BASICS_EDITORIAL,
    slots: foundationBasicsEditorialSlots(),
  });
}

export function registeredMainEditorialSlots(
  entries: readonly MainCourseEditorialEntry[],
): ReadonlyMap<string, EditorialSlot> {
  const curriculum = buildMainCourseContentBatches();
  const batches = new Map(curriculum.map((batch) => [batch.id, batch]));
  const slots = new Map(
    mainKanjiSlots(
      entries.filter((entry) => entry.kind === "KANJI"),
      curriculum.flatMap(({ kanji }) => kanji),
    ),
  );
  for (const entry of entries) {
    if (entry.kind !== "COMPONENT") continue;
    const batch = batches.get(entry.sourceBatchId);
    const index = batch?.components.findIndex(({ key }) => key === entry.componentKey) ?? -1;
    if (!batch || index < 0 || batch.components[index]?.symbol !== entry.symbol) {
      throw new Error(`Editorial component does not match its source batch: ${entry.itemKey}.`);
    }
    slots.set(entry.itemKey, {
      levelNumber: batch.componentLevelNumber,
      sortOrder: (batch.componentSortOrderStart ?? 1) + index,
      target: { kind: "COMPONENT", symbol: entry.symbol },
    });
  }
  return slots;
}

export function applyFoundationComponentsEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyRegisteredMainEditorial(
    prisma,
    mode,
    FOUNDATION_COMPONENTS_EDITORIAL,
    "packages/db/src/foundation-components-editorial.ts",
  );
}

export function applyFoundationCompletionEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyRegisteredMainEditorial(
    prisma,
    mode,
    FOUNDATION_COMPLETION_EDITORIAL,
    "packages/db/src/foundation-level-two-editorial.ts",
  );
}

export function applyFoundationLevelThreeEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyRegisteredMainEditorial(
    prisma,
    mode,
    FOUNDATION_LEVEL_THREE_EDITORIAL,
    "packages/db/src/foundation-level-three-editorial.ts",
  );
}

export function applyFoundationLevelFourEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyRegisteredMainEditorial(
    prisma,
    mode,
    FOUNDATION_LEVEL_FOUR_EDITORIAL,
    "packages/db/src/foundation-level-four-editorial.ts",
  );
}

export function applyFoundationLevelFiveEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyRegisteredMainEditorial(
    prisma,
    mode,
    FOUNDATION_LEVEL_FIVE_EDITORIAL,
    "packages/db/src/foundation-level-five-editorial.ts",
  );
}

export function applyFoundationLevelSixEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyRegisteredMainEditorial(
    prisma,
    mode,
    FOUNDATION_LEVEL_SIX_EDITORIAL,
    "packages/db/src/foundation-level-six-editorial.ts",
  );
}

export function applyFoundationLevelSevenEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyRegisteredMainEditorial(
    prisma,
    mode,
    FOUNDATION_LEVEL_SEVEN_EDITORIAL,
    "packages/db/src/foundation-level-seven-editorial.ts",
  );
}

export function applyFoundationLevelEightEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyRegisteredMainEditorial(
    prisma,
    mode,
    FOUNDATION_LEVEL_EIGHT_EDITORIAL,
    "packages/db/src/foundation-level-eight-editorial.ts",
  );
}

function applyRegisteredMainEditorial(
  prisma: PrismaClient,
  mode: "plan" | "apply",
  content: EditorialRelease["content"] & { readonly entries: readonly MainCourseEditorialEntry[] },
  sourceFileName: string,
) {
  return applyEditorial(prisma, mode, {
    courseSlug: "japanese-ru-n2",
    sourceName: CURATION_SOURCE_NAMES.kanji,
    sourceFileName,
    content,
    slots: registeredMainEditorialSlots(content.entries),
  });
}

function applyEditorial(prisma: PrismaClient, mode: "plan" | "apply", release: EditorialRelease) {
  const { content, slots: expectedSlots } = release;
  return prisma.$transaction(
    async (db) => {
      if (content.entries.length !== expectedSlots.size) {
        throw new Error("Editorial release must bind one exact course slot to every entry.");
      }
      if (mode === "plan") await db.$executeRaw`SET TRANSACTION READ ONLY`;
      const source = await db.dataSource.findUnique({
        where: { name: release.sourceName },
        include: { license: true },
      });
      if (source?.license.scope !== "PROJECT_AUTHORED") {
        throw new Error("Course editorial requires its project-authored source.");
      }
      const course = await db.course.findUnique({
        where: { slug: release.courseSlug },
        select: {
          status: true,
          levels: {
            where: {
              levelNumber: {
                in: [...new Set([...expectedSlots.values()].map(({ levelNumber }) => levelNumber))],
              },
            },
            select: {
              levelNumber: true,
              items: {
                select: {
                  sortOrder: true,
                  learningItem: {
                    select: {
                      id: true,
                      kind: true,
                      targetType: true,
                      targetId: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (course?.status !== "PUBLISHED") {
        throw new Error("Course editorial requires its published course.");
      }

      const checksumSha256 = createHash("sha256").update(JSON.stringify(content)).digest("hex");
      const existing = await db.importRun.findUnique({
        where: { dataSourceId_checksumSha256: { dataSourceId: source.id, checksumSha256 } },
        select: { status: true },
      });
      const hintRows: Prisma.HintCreateManyInput[] = [];
      const meaningRows: Prisma.KanjiMeaningCreateManyInput[] = [];
      const seen = new Set<string>();
      const resolved = [];
      for (const entry of content.entries) {
        const expected = expectedSlots.get(entry.itemKey);
        const levels = course.levels.find(
          ({ levelNumber }) => levelNumber === expected?.levelNumber,
        );
        const slots = levels?.items.filter(({ sortOrder }) => sortOrder === expected?.sortOrder);
        const item = slots?.[0]?.learningItem;
        if (
          expected === undefined ||
          seen.has(entry.itemKey) ||
          slots?.length !== 1 ||
          item?.status !== "PUBLISHED" ||
          item.kind !== expected.target.kind ||
          item.targetType !== expected.target.kind ||
          !(await matchesTarget(db, item.targetId, expected.target))
        ) {
          throw new Error(`Editorial target no longer matches its course slot: ${entry.itemKey}.`);
        }
        if (
          expected.reading !== undefined &&
          !(await db.learningAnswer.findFirst({
            where: {
              learningCard: {
                learningItemId: item.id,
                answerType: "READING",
                promptType: "READING",
              },
              isPrimary: true,
              normalizedText: expected.reading,
            },
            select: { id: true },
          }))
        ) {
          throw new Error(
            `Editorial target no longer teaches the expected reading: ${entry.itemKey}.`,
          );
        }
        seen.add(entry.itemKey);
        resolved.push({ item, entry });
      }

      const currentHints = await db.hint.findMany({
        where: { learningItemId: { in: resolved.map(({ item }) => item.id) } },
        select: {
          learningItemId: true,
          locale: true,
          hintType: true,
          body: true,
          sourceKind: true,
          version: true,
        },
      });
      for (const { item, entry } of resolved) {
        for (const hintType of ["MEANING", "READING", "USAGE"] as const) {
          const pair = entry.hints[hintType];
          if (pair === undefined) continue;
          for (const [key, locale] of LOCALES) {
            const body = pair[key].trim();
            if (body.length === 0) throw new Error("Both editorial languages are required.");
            const versions = currentHints.filter(
              (row) =>
                row.learningItemId === item.id &&
                row.locale === locale &&
                row.hintType === hintType,
            );
            if (
              versions.some((row) => row.sourceKind === "PROJECT_AUTHORED" && row.body === body)
            ) {
              continue;
            }
            hintRows.push({
              learningItemId: item.id,
              hintType,
              locale,
              body,
              sourceKind: "PROJECT_AUTHORED",
              version: 1 + Math.max(0, ...versions.map(({ version }) => version)),
            });
          }
        }
        if (entry.referenceMeanings !== undefined) {
          if (item.targetType !== "KANJI") throw new Error("Expected a kanji reference target.");
          const currentMeanings = await db.kanjiMeaning.findMany({
            where: { kanjiId: item.targetId, sourceKind: "PROJECT_AUTHORED" },
            select: { locale: true, meaning: true },
          });
          for (const pair of entry.referenceMeanings) {
            for (const [key, locale] of LOCALES) {
              const meaning = pair[key].trim();
              if (!meaning) throw new Error("Both reference-meaning languages are required.");
              if (currentMeanings.some((row) => row.locale === locale && row.meaning === meaning)) {
                continue;
              }
              meaningRows.push({
                kanjiId: item.targetId,
                locale,
                meaning,
                isPrimary: false,
                sourceKind: "PROJECT_AUTHORED",
              });
            }
          }
        }
      }
      const summary = {
        revision: content.version,
        matchedMaterials: seen.size,
        newHints: hintRows.length,
        newReferenceMeanings: meaningRows.length,
        alreadyApplied: existing !== null,
      };
      if (existing !== null) {
        if (existing.status !== "SUCCESS" || hintRows.length + meaningRows.length !== 0) {
          throw new Error("Course editorial receipt no longer matches the stored texts.");
        }
        return summary;
      }
      if (mode === "plan") return summary;

      if (hintRows.length > 0) await db.hint.createMany({ data: hintRows });
      if (meaningRows.length > 0) await db.kanjiMeaning.createMany({ data: meaningRows });
      const run = await db.importRun.create({
        data: {
          dataSourceId: source.id,
          sourceVersion: content.version,
          sourceFileName: release.sourceFileName,
          checksumSha256,
          status: "SUCCESS",
          finishedAt: new Date(),
          statsJson: summary,
        },
      });
      await db.importedRecord.createMany({
        data: content.entries.map((entry) => ({
          importRunId: run.id,
          recordType: "PROJECT_AUTHORED",
          sourceRecordId: `${content.version}:${entry.itemKey}`,
          rawJson: { ...entry, sourceSnapshotVersion: content.sourceSnapshotVersion },
        })),
      });
      return summary;
    },
    { isolationLevel: "Serializable", maxWait: 5_000, timeout: 60_000 },
  );
}

async function matchesTarget(db: Prisma.TransactionClient, id: string, target: EditorialTarget) {
  const where = { id };
  switch (target.kind) {
    case "COMPONENT":
      return (
        (await db.component.findUnique({ where, select: { symbol: true } }))?.symbol ===
        target.symbol
      );
    case "KANJI":
      return (
        (await db.kanji.findUnique({ where, select: { character: true } }))?.character ===
        target.character
      );
    case "WORD": {
      const word = await db.word.findUnique({ where, select: { expression: true, reading: true } });
      return word?.expression === target.expression && word.reading === target.reading;
    }
    case "SENTENCE": {
      const sentence = await db.sentence.findUnique({
        where,
        select: { japaneseText: true, readingText: true },
      });
      return (
        sentence?.japaneseText === target.japaneseText &&
        sentence.readingText === target.readingText
      );
    }
  }
}
