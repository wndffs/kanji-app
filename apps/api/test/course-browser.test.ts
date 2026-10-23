import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CourseBrowserController } from "../src/courses/course-browser.controller";
import { CourseBrowserRepository } from "../src/courses/course-browser.repository";
import { CourseBrowserService } from "../src/courses/course-browser.service";
import { courseMaterialStudyState } from "@kanji-srs/shared";

const ID = "00000000-0000-4000-8000-000000000010";
describe("read-only published syllabus", () => {
  it("does not call an item burned when any eligible card is missing or still learning", () => {
    expect(courseMaterialStudyState([])).toBe("not-started");
    expect(
      courseMaterialStudyState([
        { started: true, burned: true },
        { started: false, burned: false },
      ]),
    ).toBe("learning");
    expect(
      courseMaterialStudyState([
        { started: true, burned: true },
        { started: true, burned: false },
      ]),
    ).toBe("learning");
    expect(courseMaterialStudyState([{ started: true, burned: true }])).toBe("burned");
  });
  it("does not read placements for a missing or unpublished course level", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const findMany = vi.fn();
    const repository = new CourseBrowserRepository({
      db: { courseLevel: { findFirst }, courseLevelItem: { findMany } },
    } as never);
    expect(await repository.levelPage("owner", ID, 1, 1)).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        courseId: ID,
        levelNumber: 1,
        course: { status: "PUBLISHED", courseType: "STRUCTURED" },
      },
      select: { id: true },
    });
  });
  it("returns only published structured course metadata with published placement counts", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: ID,
      titleRu: "Курс",
      descriptionRu: null,
      levels: [{ levelNumber: 3, titleRu: "Чтение", band: "FOUNDATION", _count: { items: 4 } }],
    });
    const repository = new CourseBrowserRepository({ db: { course: { findFirst } } } as never);
    expect(await repository.outline(ID)).toEqual({
      id: ID,
      title: "Курс",
      description: null,
      levels: [{ levelNumber: 3, title: "Чтение", band: "foundation", publishedItemCount: 4 }],
    });
    expect(findFirst.mock.calls[0]![0].where).toEqual({
      id: ID,
      status: "PUBLISHED",
      courseType: "STRUCTURED",
    });
    expect(findFirst.mock.calls[0]![0].select.levels.select._count.select.items.where).toEqual({
      learningItem: { status: "PUBLISHED" },
    });
  });
  it("rejects invalid IDs before DB access and gives 404 for an unpublished course", async () => {
    const outline = vi.fn().mockResolvedValue(null);
    const service = new CourseBrowserService({ outline } as never, {} as never);
    const controller = new CourseBrowserController(service);
    await expect(controller.outline("invalid")).rejects.toThrow("UUID");
    expect(outline).not.toHaveBeenCalled();
    await expect(controller.outline(ID)).rejects.toThrow("Опубликованный курс не найден");
  });
  it("validates page bounds before reads and hydrates only the selected stable page", async () => {
    const levelPage = vi.fn().mockResolvedValue({
      ids: ["b", "a"],
      total: 31,
      progress: new Map(
        ["a", "b"].map((id) => [
          id,
          { studyState: "not-started", cardCount: 2, startedCardCount: 0, burnedCardCount: 0 },
        ]),
      ),
    });
    const loadLessonItems = vi.fn().mockResolvedValue(
      new Map(
        ["a", "b"].map((id) => [
          id,
          {
            itemType: "kanji",
            title: id,
            cards: [
              {
                answerType: "meaning",
                answers: [
                  { locale: "ru-RU", text: "один", isPrimary: true },
                  { locale: "en-US", text: "one", isPrimary: true },
                ],
              },
            ],
            target: {
              japanese: id,
              reading: "いち",
              translations: { ru: [{ text: "Сырой перевод" }], en: [] },
            },
          },
        ]),
      ),
    );
    const service = new CourseBrowserService({ levelPage } as never, { loadLessonItems } as never);
    await expect(service.materials("owner", ID, "2", { page: "0" })).rejects.toThrow(
      "номер страницы",
    );
    expect(levelPage).not.toHaveBeenCalled();
    expect(await service.materials("owner", ID, "2", { page: "2" })).toMatchObject({
      total: 31,
      page: 2,
      items: [{ id: "b" }, { id: "a" }],
    });
    expect(loadLessonItems).toHaveBeenCalledExactlyOnceWith("owner", ["b", "a"]);
    expect((await service.materials("owner", ID, "2", {})).items[0]).toMatchObject({
      reading: "いち",
      meaningRu: "один",
      meaningEn: "one",
    });
    await service.materials("owner", ID, "2", { itemType: "word" });
    expect(levelPage).toHaveBeenLastCalledWith("owner", ID, 2, 1, {
      itemType: "word",
      studyState: undefined,
    });
    await expect(service.materials("owner", ID, "2", { itemType: "invalid" })).rejects.toThrow(
      "тип материала",
    );
  });
  it("filters full own-card state before slicing the level page", async () => {
    const card = (burned: boolean | null) => ({
      id: "card",
      promptType: "MEANING",
      audioAsset: null,
      srsStates: burned === null ? [] : [{ burnedAt: burned ? new Date() : null }],
    });
    const entries = Array.from({ length: 32 }, (_, index) => ({
      learningItemId: `item-${index}`,
      learningItem: {
        kind: "KANJI",
        cards: [card(index === 31 ? true : null), card(index === 31 ? true : null)],
      },
    }));
    const findMany = vi.fn().mockResolvedValue(entries);
    const repository = new CourseBrowserRepository({
      db: {
        courseLevel: { findFirst: vi.fn().mockResolvedValue({ id: "level" }) },
        courseLevelItem: { findMany },
      },
    } as never);
    const result = await repository.levelPage("owner", ID, 2, 1, { studyState: "burned" });
    expect(result).toMatchObject({ ids: ["item-31"], total: 1 });
    expect(result?.progress.get("item-31")).toMatchObject({
      studyState: "burned",
      cardCount: 2,
      burnedCardCount: 2,
    });
    expect(
      findMany.mock.calls[0]![0].select.learningItem.select.cards.select.srsStates.where,
    ).toEqual({ userId: "owner" });
  });
});
