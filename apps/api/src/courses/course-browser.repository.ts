import { Inject, Injectable } from "@nestjs/common";
import {
  courseMaterialStudyState,
  courseReviewTimeline,
  summarizeCourseLevel,
  buildCourseCoverage,
  satisfiesCardPrerequisite,
  type CoursePrerequisiteStatus,
  type CourseOutlineDto,
  type ItemKind,
  type CourseMaterialStudyState,
  type CourseReviewFilter,
  type CourseMaterialSort,
} from "@kanji-srs/shared";
import { PrismaService } from "../database/prisma.service";
import { listeningCardEligibilityWhere } from "../lessons/lessons.repository";
import { isEligibleListeningAudio } from "../audio/audio-asset";
import { normalizeJapaneseReading, normalizeRussianMeaning } from "@kanji-srs/japanese";

const publishedBrowsableCourse = {
  status: "PUBLISHED" as const,
  courseType: { in: ["STRUCTURED" as const, "DEMO" as const] },
};

@Injectable()
export class CourseBrowserRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async coverage(courseId: string) {
    const course = await this.prisma.db.course.findFirst({
      where: { id: courseId, ...publishedBrowsableCourse },
      select: {
        levels: {
          orderBy: { levelNumber: "asc" },
          select: {
            levelNumber: true,
            band: true,
            items: {
              where: { learningItem: { status: "PUBLISHED" } },
              select: {
                learningItem: {
                  select: {
                    id: true,
                    kind: true,
                    targetId: true,
                    cards: {
                      where: { promptType: { not: "LISTENING" } },
                      select: {
                        id: true,
                        answerType: true,
                        answers: {
                          where: { sourceKind: "PROJECT_AUTHORED" },
                          select: { locale: true, answerKind: true, text: true },
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
    });
    if (course === null) return null;
    const items = course.levels.flatMap((level) =>
      level.items.map(({ learningItem }) => learningItem),
    );
    const jlpt = new Map<string, string | null>();
    for (const kind of ["KANJI", "WORD"] as const) {
      const ids = [
        ...new Set(items.filter((item) => item.kind === kind).map((item) => item.targetId)),
      ];
      if (ids.length === 0) continue;
      const rows =
        kind === "KANJI"
          ? await this.prisma.db.kanji.findMany({
              where: { id: { in: ids } },
              select: { id: true, jlptLevel: true },
            })
          : await this.prisma.db.word.findMany({
              where: { id: { in: ids } },
              select: { id: true, jlptLevel: true },
            });
      for (const row of rows)
        jlpt.set(`${kind}:${row.id}`, row.jlptLevel === null ? null : `N${row.jlptLevel}`);
    }
    return buildCourseCoverage(
      courseId,
      course.levels.flatMap((level) =>
        level.items.map(({ learningItem: item }) => {
          const answers = item.cards.flatMap((card) =>
            card.answers.filter(
              (answer) => answer.answerKind === card.answerType && answer.text.trim() !== "",
            ),
          );
          return {
            id: item.id,
            kind: item.kind.toLowerCase() as ItemKind,
            level: level.levelNumber,
            band: level.band.toLowerCase(),
            jlpt: jlpt.get(`${item.kind}:${item.targetId}`) ?? null,
            cardIds: item.cards.map((card) => card.id),
            cardAnswerTypes: item.cards.map((card) =>
              card.answerType === "READING" ? ("reading" as const) : ("meaning" as const),
            ),
            hasRu: answers.some(
              (answer) => answer.answerKind === "MEANING" && answer.locale === "ru-RU",
            ),
            hasEn: answers.some(
              (answer) => answer.answerKind === "MEANING" && answer.locale === "en-US",
            ),
            hasReading: answers.some((answer) => answer.answerKind === "READING"),
            readingRequired:
              item.kind === "KANJI" ||
              item.kind === "WORD" ||
              item.cards.some((card) => card.answerType === "READING"),
          };
        }),
      ),
      new Date().toISOString(),
      course.levels.map((level) => ({ level: level.levelNumber, band: level.band.toLowerCase() })),
    );
  }

  async outline(courseId: string): Promise<CourseOutlineDto | null> {
    const course = await this.prisma.db.course.findFirst({
      where: { id: courseId, ...publishedBrowsableCourse },
      select: {
        id: true,
        titleRu: true,
        descriptionRu: true,
        levels: {
          orderBy: { levelNumber: "asc" },
          select: {
            levelNumber: true,
            titleRu: true,
            band: true,
            _count: { select: { items: { where: { learningItem: { status: "PUBLISHED" } } } } },
          },
        },
      },
    });
    return course === null
      ? null
      : {
          id: course.id,
          title: course.titleRu,
          description: course.descriptionRu,
          levels: course.levels.map((level) => ({
            levelNumber: level.levelNumber,
            title: level.titleRu,
            band: level.band.toLowerCase(),
            publishedItemCount: level._count.items,
          })),
        };
  }

  async levelPage(
    userId: string,
    courseId: string,
    levelNumber: number,
    page: number,
    filters: {
      readonly itemType?: ItemKind;
      readonly studyState?: CourseMaterialStudyState;
      readonly reviewState?: CourseReviewFilter;
      readonly q?: string;
      readonly sort?: CourseMaterialSort;
    } = {},
  ) {
    const level = await this.prisma.db.courseLevel.findFirst({
      where: { courseId, levelNumber, course: publishedBrowsableCourse },
      select: { id: true },
    });
    if (level === null) return null;
    const where = {
      courseLevelId: level.id,
      learningItem: {
        status: "PUBLISHED" as const,
      },
    };
    const entries = await this.prisma.db.courseLevelItem.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { learningItemId: "asc" }],
      select: {
        learningItemId: true,
        learningItem: {
          select: {
            kind: true,
            targetId: true,
            cards: {
              where: listeningCardEligibilityWhere,
              select: {
                id: true,
                promptType: true,
                audioAsset: { include: { dataSource: true, license: true } },
                srsStates: {
                  where: { userId },
                  select: { burnedAt: true, availableAt: true, stageIndex: true },
                },
              },
            },
          },
        },
      },
    });
    const now = Date.now();
    const all = entries.map((entry) => {
      const itemType = entry.learningItem.kind.toLowerCase() as ItemKind;
      const cards = entry.learningItem.cards.filter(
        (card) =>
          card.promptType !== "LISTENING" ||
          isEligibleListeningAudio(card.audioAsset, entry.learningItemId, itemType),
      );
      const states = cards.map((card) => ({
        id: card.id,
        promptType: card.promptType.toLowerCase(),
        started: card.srsStates.length > 0,
        burned: card.srsStates[0]?.burnedAt != null,
        stageIndex: card.srsStates[0]?.stageIndex ?? null,
        availableAt: card.srsStates[0]?.availableAt?.toISOString() ?? null,
      }));
      return {
        id: entry.learningItemId,
        itemType,
        studyState: courseMaterialStudyState(states),
        cardCount: cards.length,
        startedCardCount: states.filter((state) => state.started).length,
        burnedCardCount: states.filter((state) => state.burned).length,
        progressCards: states,
        ...courseReviewTimeline(states, now),
      };
    });
    const summary = summarizeCourseLevel(all);
    const matches = filters.q
      ? await this.searchIds(
          entries,
          filters.q,
          all.flatMap((entry) => entry.progressCards.map((card) => card.id)),
        )
      : null;
    const indexed = all
      .filter((entry) => matches === null || matches.has(entry.id))
      .filter((entry) => filters.itemType === undefined || entry.itemType === filters.itemType)
      .filter(
        (entry) => filters.studyState === undefined || entry.studyState === filters.studyState,
      )
      .filter(
        (entry) =>
          filters.reviewState === undefined ||
          (filters.reviewState === "due"
            ? entry.dueCardCount > 0
            : entry.dueCardCount === 0 && entry.scheduledCardCount > 0),
      );
    const ordered =
      filters.sort === "review-time"
        ? indexed
            .map((entry, index) => ({ entry, index }))
            .sort(
              (left, right) =>
                (left.entry.nextReviewAt === null
                  ? Infinity
                  : Date.parse(left.entry.nextReviewAt)) -
                  (right.entry.nextReviewAt === null
                    ? Infinity
                    : Date.parse(right.entry.nextReviewAt)) || left.index - right.index,
            )
            .map(({ entry }) => entry)
        : indexed;
    const selected = ordered.slice((page - 1) * 30, page * 30);
    const prerequisites = await this.prerequisiteStatus(
      userId,
      selected.map((entry) => entry.id),
    );
    return {
      ids: selected.map((entry) => entry.id),
      total: indexed.length,
      summary,
      progress: new Map(
        selected.map((entry) => [
          entry.id,
          { ...entry, prerequisites: prerequisites.get(entry.id)! },
        ]),
      ),
    };
  }

  private async prerequisiteStatus(userId: string, ids: readonly string[]) {
    const result = new Map<string, CoursePrerequisiteStatus>();
    if (ids.length === 0) return result;
    const rows = await this.prisma.db.dependency.findMany({
      where: { learningItemId: { in: [...ids] }, dependencyType: "PREREQUISITE" },
      orderBy: [{ learningItemId: "asc" }, { prerequisiteItemId: "asc" }],
      select: {
        learningItemId: true,
        requiredStage: true,
        prerequisiteItem: {
          select: {
            id: true,
            title: true,
            status: true,
            kind: true,
            cards: {
              where: listeningCardEligibilityWhere,
              select: {
                id: true,
                promptType: true,
                audioAsset: { include: { dataSource: true, license: true } },
                srsStates: { where: { userId }, select: { stageIndex: true } },
              },
            },
          },
        },
      },
    });
    for (const id of ids) {
      const dependencies = rows.filter((row) => row.learningItemId === id);
      const unmet = dependencies.flatMap((row) => {
        const item = row.prerequisiteItem;
        const cards =
          item.status !== "PUBLISHED"
            ? []
            : item.cards.filter(
                (card) =>
                  card.promptType !== "LISTENING" ||
                  isEligibleListeningAudio(
                    card.audioAsset,
                    item.id,
                    item.kind.toLowerCase() as ItemKind,
                  ),
              );
        const requiredStage = row.requiredStage ?? 1;
        const stages = new Map(
          cards.flatMap((card) =>
            card.srsStates[0] ? [[card.id, card.srsStates[0].stageIndex] as const] : [],
          ),
        );
        if (
          satisfiesCardPrerequisite(
            cards.map((card) => card.id),
            stages,
            requiredStage,
          )
        )
          return [];
        return [
          {
            itemId: item.status === "PUBLISHED" ? item.id : null,
            title: item.status === "PUBLISHED" ? item.title : "Материал пока недоступен",
            requiredStage,
            minimumStage:
              cards.length > 0 && cards.every((card) => stages.has(card.id))
                ? Math.min(...stages.values())
                : null,
          },
        ];
      });
      result.set(id, {
        total: dependencies.length,
        unmet: unmet.length,
        firstUnmet: unmet[0] ?? null,
      });
    }
    return result;
  }

  private async searchIds(
    entries: readonly {
      readonly learningItemId: string;
      readonly learningItem: { readonly kind: string; readonly targetId: string };
    }[],
    q: string,
    eligibleCardIds: readonly string[],
  ) {
    const escape = (value: string) => value.replace(/[\\%_]/gu, "\\$&");
    const contains = escape(q);
    const normalized = [
      ...new Set([normalizeJapaneseReading(q), normalizeRussianMeaning(q)]),
    ].filter(Boolean);
    const ids = entries.map((entry) => entry.learningItemId);
    if (ids.length === 0) return new Set<string>();
    const direct = await this.prisma.db.learningItem.findMany({
      where: {
        id: { in: ids },
        status: "PUBLISHED",
        OR: [
          { title: { contains, mode: "insensitive" } },
          ...normalized.map((text) => ({
            cards: {
              some: {
                id: { in: [...eligibleCardIds] },
                answers: {
                  some: {
                    normalizedText: { contains: escape(text), mode: "insensitive" as const },
                  },
                },
              },
            },
          })),
        ],
      },
      select: { id: true },
    });
    const matching = new Set(direct.map((item) => item.id));
    const targets = (kind: string) =>
      entries
        .filter((entry) => entry.learningItem.kind === kind)
        .map((entry) => entry.learningItem.targetId);
    const targetMatches = new Set<string>();
    // Polymorphic targets have no Prisma relation. Each lookup is limited to this level's IDs.
    const componentIds = targets("COMPONENT");
    if (componentIds.length)
      for (const row of await this.prisma.db.component.findMany({
        where: { id: { in: componentIds }, symbol: { contains } },
        select: { id: true },
      }))
        targetMatches.add(`COMPONENT:${row.id}`);
    const kanjiIds = targets("KANJI");
    if (kanjiIds.length)
      for (const row of await this.prisma.db.kanji.findMany({
        where: { id: { in: kanjiIds }, character: { contains } },
        select: { id: true },
      }))
        targetMatches.add(`KANJI:${row.id}`);
    const wordIds = targets("WORD");
    if (wordIds.length)
      for (const row of await this.prisma.db.word.findMany({
        where: {
          id: { in: wordIds },
          OR: [
            { expression: { contains } },
            { reading: { contains: escape(normalizeJapaneseReading(q)) } },
          ],
        },
        select: { id: true },
      }))
        targetMatches.add(`WORD:${row.id}`);
    const sentenceIds = targets("SENTENCE");
    if (sentenceIds.length)
      for (const row of await this.prisma.db.sentence.findMany({
        where: { id: { in: sentenceIds }, japaneseText: { contains } },
        select: { id: true },
      }))
        targetMatches.add(`SENTENCE:${row.id}`);
    for (const entry of entries)
      if (targetMatches.has(`${entry.learningItem.kind}:${entry.learningItem.targetId}`))
        matching.add(entry.learningItemId);
    return matching;
  }
}
