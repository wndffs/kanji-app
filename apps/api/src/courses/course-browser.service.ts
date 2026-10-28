import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  ITEM_KINDS,
  type CourseMaterialPageDto,
  type ItemKind,
  type CourseMaterialStudyState,
  type CourseReviewFilter,
  type CourseMaterialSort,
} from "@kanji-srs/shared";
import { LessonsRepository } from "../lessons/lessons.repository";
import { CourseBrowserRepository } from "./course-browser.repository";

function boundedInteger(value: unknown, maximum: number, label: string, fallback?: number) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/u.test(value) || Number(value) > maximum)
    throw new BadRequestException(`Некорректный ${label}.`);
  return Number(value);
}
export type CourseMaterialQuery = {
  readonly page?: unknown;
  readonly itemType?: unknown;
  readonly studyState?: unknown;
  readonly reviewState?: unknown;
  readonly q?: unknown;
  readonly sort?: unknown;
};

@Injectable()
export class CourseBrowserService {
  constructor(
    @Inject(CourseBrowserRepository) private readonly repository: CourseBrowserRepository,
    @Inject(LessonsRepository) private readonly lessons: LessonsRepository,
  ) {}

  async outline(courseId: string) {
    const outline = await this.repository.outline(courseId);
    if (outline === null) throw new NotFoundException("Опубликованный курс не найден.");
    return outline;
  }

  async coverage(courseId: string) {
    const report = await this.repository.coverage(courseId);
    if (report === null) throw new NotFoundException("Опубликованный курс не найден.");
    return report;
  }

  async materials(
    userId: string,
    courseId: string,
    levelValue: unknown,
    query: CourseMaterialQuery,
  ): Promise<CourseMaterialPageDto> {
    const levelNumber = boundedInteger(levelValue, 60, "уровень");
    const page = boundedInteger(query.page, 10_000, "номер страницы", 1);
    if (query.itemType !== undefined && !ITEM_KINDS.includes(query.itemType as ItemKind))
      throw new BadRequestException("Некорректный тип материала.");
    if (
      query.studyState !== undefined &&
      !["not-started", "learning", "burned"].includes(query.studyState as string)
    )
      throw new BadRequestException("Некорректное состояние изучения.");
    if (
      query.reviewState !== undefined &&
      !["due", "scheduled"].includes(query.reviewState as string)
    )
      throw new BadRequestException("Некорректный срок повторения.");
    if (
      query.q !== undefined &&
      (typeof query.q !== "string" ||
        query.q.length > 80 ||
        [...query.q].some((character) => character.charCodeAt(0) < 32))
    )
      throw new BadRequestException("Поиск должен содержать не более 80 символов.");
    const q =
      typeof query.q === "string" ? query.q.normalize("NFKC").trim().replace(/\s+/gu, " ") : "";
    if (q.length > 80) throw new BadRequestException("Слишком длинный поисковый запрос.");
    if (query.sort !== undefined && !["course", "review-time"].includes(query.sort as string))
      throw new BadRequestException("Некорректная сортировка.");
    const result = await this.repository.levelPage(userId, courseId, levelNumber, page, {
      itemType: query.itemType as ItemKind | undefined,
      studyState: query.studyState as CourseMaterialStudyState | undefined,
      ...(query.reviewState === undefined
        ? {}
        : { reviewState: query.reviewState as CourseReviewFilter }),
      ...(q === "" ? {} : { q }),
      ...(query.sort === undefined ? {} : { sort: query.sort as CourseMaterialSort }),
    });
    if (result === null) throw new NotFoundException("Опубликованный уровень не найден.");
    const items = await this.lessons.loadLessonItems(userId, result.ids);
    return {
      courseId,
      levelNumber,
      page,
      pageSize: 30,
      total: result.total,
      summary: result.summary,
      items: result.ids.map((id) => {
        const item = items.get(id);
        if (item === undefined)
          throw new NotFoundException("Материалы изменились. Обновите страницу.");
        const progress = result.progress.get(id)!;
        const meaningCard = item.cards.find((card) => card.answerType === "meaning");
        const taughtReading = item.cards.filter((card) => card.answerType === "reading" && card.promptType !== "listening")
          .flatMap((card) => card.answers).find((answer) => answer.isPrimary && answer.text.trim() !== "");
        const meaning = (locale: "ru-RU" | "en-US") => {
          const answers = meaningCard?.answers.filter((answer) => answer.locale === locale && answer.text.trim() !== "") ?? [];
          const texts =
            locale === "ru-RU" ? item.target.translations.ru : item.target.translations.en;
          const chosen = (answers.find((answer) => answer.isPrimary) ?? answers[0])?.text;
          const fallback = (texts.find((text) => text.sourceKind === "curated" && text.text.trim() !== "") ?? texts.find((text) => text.text.trim() !== ""))?.text;
          return { text: chosen ?? fallback ?? null, source: chosen ? "card" as const : fallback ? "target" as const : "missing" as const };
        };
        const ru = meaning("ru-RU"); const en = meaning("en-US");
        return {
          ...progress,
          id,
          itemType: item.itemType,
          japanese: item.target.japanese,
          title: item.title,
          reading: taughtReading?.text ?? item.target.reading,
          readingSource: taughtReading ? "card" : item.target.reading ? "target" : "missing",
          meaningRu: ru.text,
          meaningEn: en.text,
          meaningSources: { ru: ru.source, en: en.source },
        };
      }),
    };
  }
}
