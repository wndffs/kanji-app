import { Inject, Injectable } from "@nestjs/common";
import {
  courseMaterialStudyState,
  courseReviewTimeline,
  summarizeCourseLevel,
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

@Injectable()
export class CourseBrowserRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async outline(courseId: string): Promise<CourseOutlineDto | null> {
    const course = await this.prisma.db.course.findFirst({
      where: { id: courseId, status: "PUBLISHED", courseType: "STRUCTURED" },
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
    filters: { readonly itemType?: ItemKind; readonly studyState?: CourseMaterialStudyState; readonly reviewState?: CourseReviewFilter; readonly q?: string; readonly sort?: CourseMaterialSort } = {},
  ) {
    const level = await this.prisma.db.courseLevel.findFirst({
      where: { courseId, levelNumber, course: { status: "PUBLISHED", courseType: "STRUCTURED" } },
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
                srsStates: { where: { userId }, select: { burnedAt: true, availableAt: true, stageIndex: true } },
              },
            },
          },
        },
      },
    });
    const now = Date.now();
    const all = entries
      .map((entry) => {
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
    const matches = filters.q ? await this.searchIds(entries, filters.q) : null;
    const indexed = all
      .filter((entry) => matches === null || matches.has(entry.id))
      .filter((entry) => filters.itemType === undefined || entry.itemType === filters.itemType)
      .filter(
        (entry) => filters.studyState === undefined || entry.studyState === filters.studyState,
      )
      .filter((entry) => filters.reviewState === undefined || (filters.reviewState === "due"
        ? entry.dueCardCount > 0
        : entry.dueCardCount === 0 && entry.scheduledCardCount > 0));
    const ordered = filters.sort === "review-time" ? indexed.map((entry, index) => ({ entry, index }))
      .sort((left, right) => ((left.entry.nextReviewAt === null ? Infinity : Date.parse(left.entry.nextReviewAt)) -
        (right.entry.nextReviewAt === null ? Infinity : Date.parse(right.entry.nextReviewAt))) || left.index - right.index)
      .map(({ entry }) => entry) : indexed;
    const selected = ordered.slice((page - 1) * 30, page * 30);
    return {
      ids: selected.map((entry) => entry.id),
      total: indexed.length,
      summary,
      progress: new Map(selected.map((entry) => [entry.id, entry])),
    };
  }

  private async searchIds(entries: readonly { readonly learningItemId: string; readonly learningItem: { readonly kind: string; readonly targetId: string } }[], q: string) {
    const escape = (value: string) => value.replace(/[\\%_]/gu, "\\$&");
    const contains = escape(q);
    const normalized = [...new Set([normalizeJapaneseReading(q), normalizeRussianMeaning(q)])].filter(Boolean);
    const ids = entries.map((entry) => entry.learningItemId);
    if (ids.length === 0) return new Set<string>();
    const direct = await this.prisma.db.learningItem.findMany({
      where: { id: { in: ids }, status: "PUBLISHED", OR: [
        { title: { contains, mode: "insensitive" } },
        ...normalized.map((text) => ({ cards: { some: { answers: { some: { normalizedText: { contains: escape(text), mode: "insensitive" as const } } } } } })),
      ] }, select: { id: true },
    });
    const matching = new Set(direct.map((item) => item.id));
    const targets = (kind: string) => entries.filter((entry) => entry.learningItem.kind === kind).map((entry) => entry.learningItem.targetId);
    const targetMatches = new Set<string>();
    // Polymorphic targets have no Prisma relation. Each lookup is limited to this level's IDs.
    const componentIds = targets("COMPONENT");
    if (componentIds.length) for (const row of await this.prisma.db.component.findMany({ where: { id: { in: componentIds }, symbol: { contains } }, select: { id: true } })) targetMatches.add(row.id);
    const kanjiIds = targets("KANJI");
    if (kanjiIds.length) for (const row of await this.prisma.db.kanji.findMany({ where: { id: { in: kanjiIds }, character: { contains } }, select: { id: true } })) targetMatches.add(row.id);
    const wordIds = targets("WORD");
    if (wordIds.length) for (const row of await this.prisma.db.word.findMany({ where: { id: { in: wordIds }, OR: [{ expression: { contains } }, { reading: { contains: escape(normalizeJapaneseReading(q)) } }] }, select: { id: true } })) targetMatches.add(row.id);
    const sentenceIds = targets("SENTENCE");
    if (sentenceIds.length) for (const row of await this.prisma.db.sentence.findMany({ where: { id: { in: sentenceIds }, japaneseText: { contains } }, select: { id: true } })) targetMatches.add(row.id);
    for (const entry of entries) if (targetMatches.has(entry.learningItem.targetId)) matching.add(entry.learningItemId);
    return matching;
  }
}
