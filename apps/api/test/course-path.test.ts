import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CourseBrowserRepository } from "../src/courses/course-browser.repository";
import { CourseBrowserService } from "../src/courses/course-browser.service";
import { CourseBrowserController } from "../src/courses/course-browser.controller";

const ID = "00000000-0000-4000-8000-000000000010";
describe("published course preparation context", () => {
  it("rejects missing/draft course coverage and invalid IDs before reads", async () => {
    const coverage = vi.fn().mockResolvedValue(null);
    const controller = new CourseBrowserController(
      new CourseBrowserService({ coverage } as never, {} as never),
    );
    expect(() => controller.coverage("not-an-id")).toThrow("UUID");
    expect(coverage).not.toHaveBeenCalled();
    await expect(controller.coverage(ID)).rejects.toThrow("Опубликованный курс не найден");
  });
  it("aggregates only published placements and selected authored answers, never raw dictionaries/private text", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      levels: [
        {
          levelNumber: 2,
          band: "FOUNDATION",
          items: [
            {
              learningItem: {
                id: "kanji-item",
                kind: "KANJI",
                targetId: "kanji-target",
                cards: [
                  {
                    id: "meaning",
                    answerType: "MEANING",
                    answers: [{ locale: "ru-RU", answerKind: "MEANING", text: "один" }],
                  },
                  {
                    id: "reading",
                    answerType: "READING",
                    answers: [{ locale: "ru-RU", answerKind: "READING", text: "いち" }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const kanji = vi.fn().mockResolvedValue([{ id: "kanji-target", jlptLevel: 5 }]);
    const repository = new CourseBrowserRepository({
      db: { course: { findFirst }, kanji: { findMany: kanji } },
    } as never);
    const report = await repository.coverage(ID);
    expect(report).toMatchObject({
      scope: "published-course-core-cards",
      total: { items: 1, cards: 2, missingRu: 0, missingEn: 1, missingReading: 0 },
      jlpt: [{ band: "N5" }],
    });
    const query = findFirst.mock.calls[0]![0];
    expect(query.where).toEqual({
      id: ID,
      status: "PUBLISHED",
      courseType: { in: ["STRUCTURED", "DEMO"] },
    });
    expect(query.select.levels.select.items.where).toEqual({
      learningItem: { status: "PUBLISHED" },
    });
    expect(query.select.levels.select.items.select.learningItem.select.cards).toMatchObject({
      where: { promptType: { not: "LISTENING" } },
      select: { answers: { where: { sourceKind: "PROJECT_AUTHORED" } } },
    });
    expect(JSON.stringify(report)).not.toContain("один");
    expect(JSON.stringify(query)).not.toMatch(/userOverrides|srsStates|rawJson/u);
    expect(kanji).toHaveBeenCalledWith({
      where: { id: { in: ["kanji-target"] } },
      select: { id: true, jlptLevel: true },
    });
  });
  it("checks every own prerequisite card and hides unpublished predecessor identity", async () => {
    const card = (id: string, stageIndex?: number) => ({
      id,
      promptType: "MEANING",
      audioAsset: null,
      srsStates: stageIndex === undefined ? [] : [{ stageIndex }],
    });
    const dependency = vi.fn().mockResolvedValue([
      {
        learningItemId: "target",
        requiredStage: 2,
        prerequisiteItem: {
          id: "hidden",
          title: "Secret draft",
          kind: "KANJI",
          status: "DRAFT",
          cards: [card("hidden-card", 9)],
        },
      },
      {
        learningItemId: "target",
        requiredStage: 2,
        prerequisiteItem: {
          id: "missing",
          title: "Missing reading",
          kind: "KANJI",
          status: "PUBLISHED",
          cards: [card("m", 5), card("r")],
        },
      },
      {
        learningItemId: "target",
        requiredStage: 2,
        prerequisiteItem: {
          id: "ready",
          title: "Ready",
          kind: "KANJI",
          status: "PUBLISHED",
          cards: [card("ready-m", 2), card("ready-r", 3)],
        },
      },
    ]);
    const repository = new CourseBrowserRepository({
      db: {
        courseLevel: { findFirst: vi.fn().mockResolvedValue({ id: "level" }) },
        courseLevelItem: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { learningItemId: "target", learningItem: { kind: "KANJI", cards: [] } },
            ]),
        },
        dependency: { findMany: dependency },
      },
    } as never);
    const result = await repository.levelPage("owner", ID, 2, 1);
    expect(result?.progress.get("target")?.prerequisites).toEqual({
      total: 3,
      unmet: 2,
      firstUnmet: {
        itemId: null,
        title: "Материал пока недоступен",
        requiredStage: 2,
        minimumStage: null,
      },
    });
    expect(JSON.stringify(result?.progress.get("target"))).not.toContain("Secret draft");
    const query = dependency.mock.calls[0]![0];
    expect(query.where).toEqual({
      learningItemId: { in: ["target"] },
      dependencyType: "PREREQUISITE",
    });
    expect(query.select.prerequisiteItem.select.cards.select.srsStates.where).toEqual({
      userId: "owner",
    });
  });
  it("presents an explicit primary reading and meaning from cards ahead of target fallback", async () => {
    const repository = {
      levelPage: vi.fn().mockResolvedValue({
        ids: ["target"],
        total: 1,
        summary: {},
        progress: new Map([["target", { studyState: "not-started" }]]),
      }),
    };
    const lessons = {
      loadLessonItems: vi.fn().mockResolvedValue(
        new Map([
          [
            "target",
            {
              itemType: "kanji",
              title: "日",
              cards: [
                {
                  answerType: "meaning",
                  promptType: "meaning",
                  answers: [{ locale: "ru-RU", isPrimary: true, text: "солнце" }],
                },
                {
                  answerType: "reading",
                  promptType: "listening",
                  answers: [{ isPrimary: true, text: "audio-only" }],
                },
                {
                  answerType: "reading",
                  promptType: "reading",
                  answers: [{ isPrimary: true, text: "にち" }],
                },
              ],
              target: {
                japanese: "日",
                reading: "ひ",
                translations: {
                  ru: [{ text: "день" }],
                  en: [{ text: "sun", sourceKind: "imported" }],
                },
              },
            },
          ],
        ]),
      ),
    };
    const result = await new CourseBrowserService(repository as never, lessons as never).materials(
      "owner",
      ID,
      "2",
      {},
    );
    expect(result.items[0]).toMatchObject({
      reading: "にち",
      readingSource: "card",
      meaningRu: "солнце",
      meaningEn: "sun",
      meaningSources: { ru: "card", en: "target" },
    });
  });
});
