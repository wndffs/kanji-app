import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CourseBrowserController } from "../src/courses/course-browser.controller";
import { CourseBrowserRepository } from "../src/courses/course-browser.repository";
import { CourseBrowserService } from "../src/courses/course-browser.service";

const ID = "00000000-0000-4000-8000-000000000010";
describe("read-only published syllabus", () => {
  it("returns only published structured course metadata with published placement counts", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: ID, titleRu: "Курс", descriptionRu: null,
      levels: [{ levelNumber: 3, titleRu: "Чтение", band: "FOUNDATION", _count: { items: 4 } }] });
    const repository = new CourseBrowserRepository({ db: { course: { findFirst } } } as never);
    expect(await repository.outline(ID)).toEqual({ id: ID, title: "Курс", description: null,
      levels: [{ levelNumber: 3, title: "Чтение", band: "foundation", publishedItemCount: 4 }] });
    expect(findFirst.mock.calls[0]![0].where).toEqual({ id: ID, status: "PUBLISHED", courseType: "STRUCTURED" });
    expect(findFirst.mock.calls[0]![0].select.levels.select._count.select.items.where).toEqual({ learningItem: { status: "PUBLISHED" } });
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
    const levelPage = vi.fn().mockResolvedValue({ ids: ["b", "a"], total: 31 });
    const loadLessonItems = vi.fn().mockResolvedValue(new Map(["a", "b"].map((id) => [id, { itemType: "kanji", title: id, target: { japanese: id } }])));
    const service = new CourseBrowserService({ levelPage } as never, { loadLessonItems } as never);
    await expect(service.materials("owner", ID, "2", { page: "0" })).rejects.toThrow("номер страницы");
    expect(levelPage).not.toHaveBeenCalled();
    expect(await service.materials("owner", ID, "2", { page: "2" })).toMatchObject({ total: 31, page: 2, items: [{ id: "b" }, { id: "a" }] });
    expect(loadLessonItems).toHaveBeenCalledExactlyOnceWith("owner", ["b", "a"]);
    await service.materials("owner", ID, "2", { itemType: "word" });
    expect(levelPage).toHaveBeenLastCalledWith(ID, 2, 1, { itemType: "word" });
    await expect(service.materials("owner", ID, "2", { itemType: "invalid" })).rejects.toThrow("тип материала");
  });
});
