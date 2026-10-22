import { Inject, Injectable } from "@nestjs/common";

import {
  parseCourseLevelPassPolicy,
  primaryTaughtReadingCards,
  resolvePrimaryTaughtReading,
  type PrimaryTaughtReadingCard,
} from "@kanji-srs/db";

import { resolveCurrentCourseId } from "../courses/current-course";
import { kanjiReadingOrderBy } from "../database/kanji-reading-order";
import { PrismaService } from "../database/prisma.service";
import { type CharacterHubCourseRecord, type CharacterHubKanjiRecord } from "./characters.types";

export abstract class CharactersRepository {
  abstract findCurrentCourseKanji(userId: string): Promise<CharacterHubCourseRecord | null>;
}

type CourseRow = {
  readonly id: string;
  readonly titleRu: string;
  readonly levels: readonly {
    readonly levelNumber: number;
    readonly band: string;
    readonly passPolicyJson: unknown;
    readonly completions: readonly { readonly completedAt: Date }[];
    readonly items: readonly {
      readonly sortOrder: number;
      readonly learningItem: {
        readonly id: string;
        readonly kind: string;
        readonly targetId: string;
        readonly cards: readonly (PrimaryTaughtReadingCard & {
          readonly id: string;
          readonly srsStates: readonly {
            readonly stageIndex: number;
            readonly burnedAt: Date | null;
            readonly wrongCount: number;
            readonly correctStreak: number;
            readonly srsSystem: {
              readonly stages: readonly {
                readonly stageIndex: number;
                readonly name: string;
              }[];
            };
          }[];
        })[];
      };
    }[];
  }[];
};

type KanjiRow = {
  readonly id: string;
  readonly character: string;
  readonly jlptLevel: number | null;
  readonly legacyJlptLevel?: number | null;
  readonly readings: readonly { readonly reading: string }[];
  readonly meanings: readonly {
    readonly locale: string;
    readonly meaning: string;
    readonly isPrimary: boolean;
  }[];
};

@Injectable()
export class PrismaCharactersRepository extends CharactersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async findCurrentCourseKanji(userId: string): Promise<CharacterHubCourseRecord | null> {
    const courseId = await resolveCurrentCourseId(this.prisma.db, userId);

    if (courseId === null) {
      return null;
    }

    const course = (await this.prisma.db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        titleRu: true,
        levels: {
          orderBy: { levelNumber: "asc" },
          select: {
            levelNumber: true,
            band: true,
            passPolicyJson: true,
            completions: {
              where: { userId },
              select: { completedAt: true },
              take: 1,
            },
            items: {
              where: { learningItem: { status: "PUBLISHED" } },
              orderBy: { sortOrder: "asc" },
              select: {
                sortOrder: true,
                learningItem: {
                  select: {
                    id: true,
                    kind: true,
                    targetId: true,
                    cards: {
                      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                      select: {
                        ...primaryTaughtReadingCards.select,
                        id: true,
                        srsStates: {
                          where: { userId },
                          take: 1,
                          select: {
                            stageIndex: true,
                            burnedAt: true,
                            wrongCount: true,
                            correctStreak: true,
                            srsSystem: {
                              select: {
                                stages: {
                                  orderBy: { stageIndex: "asc" },
                                  select: { stageIndex: true, name: true },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })) as CourseRow | null;

    if (course === null) {
      return null;
    }

    const targetIds = course.levels.flatMap((level) =>
      level.items.flatMap((item) =>
        item.learningItem.kind === "KANJI" ? [item.learningItem.targetId] : [],
      ),
    );
    const kanjiRows: KanjiRow[] = [];
    const distinctIds = [...new Set(targetIds)];
    for (let offset = 0; offset < distinctIds.length; offset += 100) {
      const rows = (await this.prisma.db.kanji.findMany({
      where: { id: { in: distinctIds.slice(offset, offset + 100) } },
      select: {
        id: true,
        character: true,
        jlptLevel: true,
        legacyJlptLevel: true,
        readings: {
          orderBy: kanjiReadingOrderBy(),
          select: { reading: true },
        },
        meanings: {
          where: { locale: { in: ["ru-RU", "en-US"] } },
          orderBy: [{ isPrimary: "desc" }, { locale: "asc" }, { meaning: "asc" }],
          select: {
            locale: true,
            meaning: true,
            isPrimary: true,
          },
        },
      },
      })) as readonly KanjiRow[];
      kanjiRows.push(...rows);
    }
    const kanjiById = new Map(kanjiRows.map((kanji) => [kanji.id, kanji]));

    return {
      id: course.id,
      title: course.titleRu,
      levels: course.levels.map((level) => {
        const passPolicy = parseCourseLevelPassPolicy(level.passPolicyJson);
        const policyItems = level.items.filter(
          (item) => item.learningItem.kind === passPolicy.itemKind,
        );

        return {
          level: level.levelNumber,
          completedAt: level.completions[0]?.completedAt ?? null,
          requiredPercentage: passPolicy.requiredPercentage,
          policyItemCount: policyItems.length,
          passedPolicyItemCount: policyItems.filter((item) =>
            isLearningItemPassed(item.learningItem, passPolicy.passStageIndex),
          ).length,
          kanji: level.items.flatMap((item) =>
            item.learningItem.kind === "KANJI"
              ? [
                  toKanjiRecord(
                    item.learningItem,
                    kanjiById,
                    level.levelNumber,
                    level.band,
                    item.sortOrder,
                    passPolicy.passStageIndex,
                  ),
                ]
              : [],
          ),
        };
      }),
    };
  }
}

function toKanjiRecord(
  item: CourseRow["levels"][number]["items"][number]["learningItem"],
  kanjiById: ReadonlyMap<string, KanjiRow>,
  level: number,
  band: string,
  sortOrder: number,
  passStageIndex: number,
): CharacterHubKanjiRecord {
  const kanji = kanjiById.get(item.targetId);

  if (kanji === undefined) {
    throw new Error(`Missing kanji target ${item.targetId} for character hub.`);
  }

  return {
    id: item.id,
    character: kanji.character,
    reading: resolvePrimaryTaughtReading(item.cards, kanji.readings[0]?.reading ?? null),
    meaningRu: findPrimaryMeaning(kanji.meanings, "ru-RU"),
    meaningEn: findPrimaryMeaning(kanji.meanings, "en-US"),
    jlptLevel: kanji.jlptLevel,
    legacyJlptLevel: kanji.legacyJlptLevel ?? null,
    level,
    band: band.toLowerCase() as CharacterHubKanjiRecord["band"],
    sortOrder,
    passStageIndex,
    cards: item.cards.map((card) => {
      const state = card.srsStates[0] ?? null;
      const stage = state?.srsSystem.stages.find(
        (candidate) => candidate.stageIndex === state.stageIndex,
      );

      return {
        id: card.id,
        srs:
          state === null
            ? null
            : {
                stageIndex: state.stageIndex,
                stageName: stage?.name ?? `Stage ${state.stageIndex}`,
                burnedAt: state.burnedAt,
                wrongCount: state.wrongCount,
                correctStreak: state.correctStreak,
              },
      };
    }),
  };
}

function isLearningItemPassed(
  item: CourseRow["levels"][number]["items"][number]["learningItem"],
  passStageIndex: number,
): boolean {
  return (
    item.cards.length > 0 &&
    item.cards.every((card) => (card.srsStates[0]?.stageIndex ?? 0) >= passStageIndex)
  );
}

function findPrimaryMeaning(
  meanings: readonly KanjiRow["meanings"][number][],
  locale: "ru-RU" | "en-US",
): string | null {
  const localized = meanings.filter((meaning) => meaning.locale === locale);
  return localized.find((meaning) => meaning.isPrimary)?.meaning ?? localized[0]?.meaning ?? null;
}
