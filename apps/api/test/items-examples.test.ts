import { describe, expect, it, vi } from "vitest";
import type { Prisma, ExampleSentenceRecord } from "@kanji-srs/db";
import { PrismaItemsRepository } from "../src/items/items.repository";
import { PrismaLessonsRepository } from "../src/lessons/lessons.repository";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function harness(count = 1) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: id(i + 1),
    targetId: id(i + 1001),
    kind: "WORD",
    targetType: "WORD",
    status: "PUBLISHED",
    title: "本",
    levelHint: 1,
    dependencies: [],
    mnemonics: [],
    hints: [],
    userMnemonics: [],
    cards: [
      {
        id: id(i + 2001),
        learningItemId: id(i + 1),
        cardType: "REVIEW",
        promptType: "MEANING",
        answerType: "MEANING",
        sortOrder: 0,
        answers: [],
        blockedAnswers: [],
        userOverrides: [],
        audioAsset: null,
      },
    ],
  }));
  const sentences: ExampleSentenceRecord[] = Array.from({ length: 6 }, (_, i) => ({
    id: id(9000 + i),
    japaneseText: `本を読みます。${i}`,
    readingText: "ほんをよみます。",
    translationRu: "Читаю книгу.",
    translationEn: "I read a book.",
    difficulty: 1,
    sourceId: null,
    importedRecordId: null,
    importedRecord: null,
    dataSourceId: id(8000),
    licenseId: id(7000),
    license: { id: id(7000), name: "Named project license", scope: "PROJECT_AUTHORED" },
    dataSource: {
      id: id(8000),
      name: "Project examples",
      licenseId: id(7000),
      homepageUrl: "https://example.test/authors",
      downloadUrl: null,
      attributionText: "Independent project authors.",
    },
  }));
  const writes = { create: vi.fn(), createMany: vi.fn(), update: vi.fn(), upsert: vi.fn() };
  const $queryRaw = vi.fn(async (query: Prisma.Sql) => {
    const limit = query.values.at(-1) as number;
    return items
      .filter((item) => query.values.includes(item.id) && query.values.includes(item.targetId))
      .flatMap((item) =>
        sentences.slice(0, limit).map((sentence) => ({ itemId: item.id, sentenceId: sentence.id })),
      );
  });
  const findMany = vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
    sentences.filter((sentence) => where.id.in.includes(sentence.id)),
  );
  const wordTarget = (targetId: string) => ({
    id: targetId,
    expression: "本",
    reading: targetId === items[0]?.targetId ? "ほん" : "もと",
    jlptLevel: 5,
    commonnessRank: null,
    jmdictEntryId: null,
    senses: [],
  });
  const db = {
    $queryRaw,
    learningItem: {
      ...writes,
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          items.find((item) => item.id === where.id) ?? null,
      ),
    },
    learningCard: { ...writes },
    dependency: { ...writes, findMany: vi.fn().mockResolvedValue([]) },
    userSrsState: { ...writes },
    word: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => wordTarget(where.id)),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map(wordTarget),
      ),
    },
    sentence: { findMany },
    deck: {
      findFirst: vi.fn().mockResolvedValue({
        id: id(5000),
        title: "Words",
        status: "READY",
        items: items.map((learningItem, i) => ({ sortOrder: i, learningItem })),
      }),
    },
    userSettings: { findUnique: vi.fn().mockResolvedValue({ currentCourseId: id(6000) }) },
    userEnrollment: {
      findMany: vi.fn().mockResolvedValue([
        {
          courseId: id(6000),
          startedAt: new Date("2026-10-22T00:00:00Z"),
          course: {
            id: id(6000),
            slug: "japanese-ru-n2",
            levels: [
              {
                levelNumber: 1,
                items: items.map((learningItem, i) => ({
                  sortOrder: i,
                  unlockPolicyJson: null,
                  learningItem,
                })),
              },
            ],
          },
        },
      ]),
    },
  };
  return {
    db,
    items,
    sentences,
    writes,
    $queryRaw,
    findMany,
    itemRepository: new PrismaItemsRepository({ db } as never),
    lessonRepository: new PrismaLessonsRepository({ db } as never),
  };
}

describe("direct word examples in Prisma item/lesson repositories", () => {
  it("shows five attributed item examples without a sentence LearningItem or any SRS/content writes", async () => {
    const h = harness();
    const record = await h.itemRepository.findItemById(h.items[0]!.id, {});
    expect(record?.target.reading).toBe("ほん");
    expect(record?.exampleSentences).toHaveLength(5);
    expect(record?.exampleSentences[0]?.attribution).toMatchObject({
      sourceName: "Project examples (авторский пример проекта)",
      licenseName: "Named project license",
      sourceUrl: "https://example.test/authors",
    });
    expect(h.db.learningItem.findUnique).toHaveBeenCalledTimes(1);
    expect(h.db.sentence.findMany).toHaveBeenCalledTimes(1);
    expect(h.db.dependency.findMany).toHaveBeenCalledTimes(1); // Existing relation groups, not example hydration.
    expect(h.items.every((item) => item.kind === "WORD")).toBe(true);
    for (const write of Object.values(h.writes)) expect(write).not.toHaveBeenCalled();
    expect(h.$queryRaw.mock.calls[0]![0].values).toContain(h.items[0]!.targetId);
  });

  it("does not load examples when explicitly excluded", async () => {
    const h = harness();
    expect(
      (await h.itemRepository.findItemById(h.items[0]!.id, { includeExamples: false }))
        ?.exampleSentences,
    ).toEqual([]);
    expect(h.$queryRaw).not.toHaveBeenCalled();
  });

  it.each(["deck", "course"] as const)(
    "shows three direct examples per exact word in %s lessons, with 100-item SQL batches",
    async (source) => {
      const h = harness(101);
      const records =
        source === "deck"
          ? (await h.lessonRepository.findDeckLesson(id(4000), id(5000)))!.items.map(
              (row) => row.item,
            )
          : (await h.lessonRepository.listCourseLessonItems(id(4000))).map((row) => row.item);
      expect(records).toHaveLength(101);
      expect(records.every((item) => item.exampleSentences.length === 3)).toBe(true);
      expect(records[0]!.target.reading).toBe("ほん");
      expect(records[1]!.target.reading).toBe("もと");
      expect(h.$queryRaw).toHaveBeenCalledTimes(2);
      expect(h.findMany).toHaveBeenCalledTimes(2);
      expect(h.db.learningItem.findUnique).not.toHaveBeenCalled();
      expect(h.db.word.findUnique).not.toHaveBeenCalled();
      expect(h.db.word.findMany).toHaveBeenCalledTimes(2);
      for (const write of Object.values(h.writes)) expect(write).not.toHaveBeenCalled();
      for (const [query] of h.$queryRaw.mock.calls) {
        expect(h.items.filter((item) => query.values.includes(item.targetId))).toHaveLength(
          query === h.$queryRaw.mock.calls[0]![0] ? 100 : 1,
        );
        expect(query.values.at(-1)).toBe(3);
      }
    },
  );

  it("hides examples whose attribution is removed after bounded selection", async () => {
    const h = harness();
    for (const sentence of h.sentences)
      Object.assign(sentence.dataSource!, { attributionText: "" });
    expect((await h.itemRepository.findItemById(h.items[0]!.id, {}))?.exampleSentences).toEqual([]);
    expect(
      (await h.lessonRepository.findDeckLesson(id(4000), id(5000)))?.items[0]?.item
        .exampleSentences,
    ).toEqual([]);
    for (const write of Object.values(h.writes)) expect(write).not.toHaveBeenCalled();
  });
});
