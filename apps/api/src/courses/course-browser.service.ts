import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ITEM_KINDS, type CourseMaterialPageDto, type ItemKind, type CourseMaterialStudyState } from "@kanji-srs/shared";
import { LessonsRepository } from "../lessons/lessons.repository";
import { CourseBrowserRepository } from "./course-browser.repository";

function boundedInteger(value: unknown, maximum: number, label: string, fallback?: number) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/u.test(value) || Number(value) > maximum)
    throw new BadRequestException(`Некорректный ${label}.`);
  return Number(value);
}

@Injectable()
export class CourseBrowserService {
  constructor(@Inject(CourseBrowserRepository) private readonly repository: CourseBrowserRepository,
    @Inject(LessonsRepository) private readonly lessons: LessonsRepository) {}

  async outline(courseId: string) {
    const outline = await this.repository.outline(courseId);
    if (outline === null) throw new NotFoundException("Опубликованный курс не найден.");
    return outline;
  }

  async materials(userId: string, courseId: string, levelValue: unknown, query: { readonly page?: unknown; readonly itemType?: unknown; readonly studyState?: unknown }): Promise<CourseMaterialPageDto> {
    const levelNumber = boundedInteger(levelValue, 60, "уровень");
    const page = boundedInteger(query.page, 10_000, "номер страницы", 1);
    if (query.itemType !== undefined && !ITEM_KINDS.includes(query.itemType as ItemKind)) throw new BadRequestException("Некорректный тип материала.");
    if (query.studyState !== undefined && !["not-started", "learning", "burned"].includes(query.studyState as string)) throw new BadRequestException("Некорректное состояние изучения.");
    const result = await this.repository.levelPage(userId, courseId, levelNumber, page, { itemType: query.itemType as ItemKind | undefined, studyState: query.studyState as CourseMaterialStudyState | undefined });
    if (result === null) throw new NotFoundException("Опубликованный уровень не найден.");
    const items = await this.lessons.loadLessonItems(userId, result.ids);
    return { courseId, levelNumber, page, pageSize: 30, total: result.total,
      items: result.ids.map((id) => {
        const item = items.get(id);
        if (item === undefined) throw new NotFoundException("Материалы изменились. Обновите страницу.");
        const progress = result.progress.get(id)!;
        const meaningCard = item.cards.find((card) => card.answerType === "meaning");
        const meaning = (locale: "ru-RU" | "en-US") => {
          const answers = meaningCard?.answers.filter((answer) => answer.locale === locale) ?? [];
          const texts = locale === "ru-RU" ? item.target.translations.ru : item.target.translations.en;
          return (answers.find((answer) => answer.isPrimary) ?? answers[0])?.text ??
            (texts.find((text) => text.sourceKind === "curated") ?? texts[0])?.text ?? null;
        };
        return { ...progress, id, itemType: item.itemType, japanese: item.target.japanese, title: item.title,
          reading: item.target.reading, meaningRu: meaning("ru-RU"), meaningEn: meaning("en-US") };
      }),
    };
  }
}
