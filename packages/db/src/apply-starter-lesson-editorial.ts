import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

import { buildStarterCourseSeed, type StarterCourseSeedTarget } from "./course-seed";
import { CURATION_SOURCE_NAMES } from "./curation-source-names";
import { FOUNDATION_KANJI_EDITORIAL } from "./foundation-kanji-editorial";
import { buildMainCourseContentBatches } from "./main-course-content";
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

export function foundationEditorialSlots(): ReadonlyMap<string, EditorialSlot> {
  const curriculum = buildMainCourseContentBatches().flatMap(({ kanji }) => kanji);
  return new Map(
    FOUNDATION_KANJI_EDITORIAL.entries.map((entry) => {
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

export function applyFoundationKanjiEditorial(prisma: PrismaClient, mode: "plan" | "apply") {
  return applyEditorial(prisma, mode, {
    courseSlug: "japanese-ru-n2",
    sourceName: CURATION_SOURCE_NAMES.kanji,
    sourceFileName: "packages/db/src/foundation-kanji-editorial.ts",
    content: FOUNDATION_KANJI_EDITORIAL,
    slots: foundationEditorialSlots(),
  });
}

function applyEditorial(prisma: PrismaClient, mode: "plan" | "apply", release: EditorialRelease) {
  const { content, slots: expectedSlots } = release;
  return prisma.$transaction(
    async (db) => {
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

        const current = await db.hint.findMany({
          where: { learningItemId: item.id },
          select: { locale: true, hintType: true, body: true, sourceKind: true, version: true },
        });
        for (const hintType of ["MEANING", "READING", "USAGE"] as const) {
          const pair = entry.hints[hintType];
          if (pair === undefined) continue;
          for (const [key, locale] of LOCALES) {
            const body = pair[key].trim();
            if (body.length === 0) throw new Error("Both editorial languages are required.");
            const versions = current.filter(
              (row) => row.locale === locale && row.hintType === hintType,
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
    { isolationLevel: "Serializable", timeout: 30_000 },
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
