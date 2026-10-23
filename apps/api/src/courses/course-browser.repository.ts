import { Inject, Injectable } from "@nestjs/common";
import {
  courseMaterialStudyState,
  type CourseOutlineDto,
  type ItemKind,
  type CourseMaterialStudyState,
} from "@kanji-srs/shared";
import { PrismaService } from "../database/prisma.service";
import { listeningCardEligibilityWhere } from "../lessons/lessons.repository";
import { isEligibleListeningAudio } from "../audio/audio-asset";

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
    filters: { readonly itemType?: ItemKind; readonly studyState?: CourseMaterialStudyState } = {},
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
        ...(filters.itemType === undefined
          ? {}
          : {
              kind: filters.itemType.toUpperCase() as "COMPONENT" | "KANJI" | "WORD" | "SENTENCE",
            }),
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
            cards: {
              where: listeningCardEligibilityWhere,
              select: {
                id: true,
                promptType: true,
                audioAsset: { include: { dataSource: true, license: true } },
                srsStates: { where: { userId }, select: { burnedAt: true } },
              },
            },
          },
        },
      },
    });
    const indexed = entries
      .map((entry) => {
        const itemType = entry.learningItem.kind.toLowerCase() as ItemKind;
        const cards = entry.learningItem.cards.filter(
          (card) =>
            card.promptType !== "LISTENING" ||
            isEligibleListeningAudio(card.audioAsset, entry.learningItemId, itemType),
        );
        const states = cards.map((card) => ({
          started: card.srsStates.length > 0,
          burned: card.srsStates[0]?.burnedAt != null,
        }));
        return {
          id: entry.learningItemId,
          studyState: courseMaterialStudyState(states),
          cardCount: cards.length,
          startedCardCount: states.filter((state) => state.started).length,
          burnedCardCount: states.filter((state) => state.burned).length,
        };
      })
      .filter(
        (entry) => filters.studyState === undefined || entry.studyState === filters.studyState,
      );
    const selected = indexed.slice((page - 1) * 30, page * 30);
    return {
      ids: selected.map((entry) => entry.id),
      total: indexed.length,
      progress: new Map(selected.map((entry) => [entry.id, entry])),
    };
  }
}
