import { Inject, Injectable } from "@nestjs/common";
import { type CourseOutlineDto, type ItemKind } from "@kanji-srs/shared";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class CourseBrowserRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async outline(courseId: string): Promise<CourseOutlineDto | null> {
    const course = await this.prisma.db.course.findFirst({
      where: { id: courseId, status: "PUBLISHED", courseType: "STRUCTURED" },
      select: { id: true, titleRu: true, descriptionRu: true,
        levels: { orderBy: { levelNumber: "asc" }, select: {
          levelNumber: true, titleRu: true, band: true,
          _count: { select: { items: { where: { learningItem: { status: "PUBLISHED" } } } } },
        } },
      },
    });
    return course === null ? null : {
      id: course.id, title: course.titleRu, description: course.descriptionRu,
      levels: course.levels.map((level) => ({ levelNumber: level.levelNumber, title: level.titleRu,
        band: level.band.toLowerCase(), publishedItemCount: level._count.items })),
    };
  }

  async levelPage(courseId: string, levelNumber: number, page: number, filters: { readonly itemType?: ItemKind } = {}) {
    const level = await this.prisma.db.courseLevel.findFirst({
      where: { courseId, levelNumber, course: { status: "PUBLISHED", courseType: "STRUCTURED" } },
      select: { id: true },
    });
    if (level === null) return null;
    const where = { courseLevelId: level.id, learningItem: { status: "PUBLISHED" as const,
      ...(filters.itemType === undefined ? {} : { kind: filters.itemType.toUpperCase() as "COMPONENT" | "KANJI" | "WORD" | "SENTENCE" }) } };
    const total = await this.prisma.db.courseLevelItem.count({ where });
    const entries = await this.prisma.db.courseLevelItem.findMany({
      where, orderBy: [{ sortOrder: "asc" }, { learningItemId: "asc" }],
      skip: (page - 1) * 30, take: 30, select: { learningItemId: true },
    });
    return { ids: entries.map((entry) => entry.learningItemId), total };
  }
}
