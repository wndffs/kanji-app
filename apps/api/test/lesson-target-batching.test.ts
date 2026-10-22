import { describe, expect, it, vi } from "vitest";

import { PrismaLessonsRepository } from "../src/lessons/lessons.repository";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const TARGET_TYPES = ["COMPONENT", "KANJI", "WORD", "SENTENCE"] as const;
type TargetType = (typeof TARGET_TYPES)[number];
type Query = { where: { id: { in: string[] } }; include?: unknown };

function item(type: TargetType, n: number, targetId = id(n + 1000)) {
  return {
    id: id(n),
    kind: type,
    targetType: type as string,
    targetId,
    title: `Item ${n}`,
    levelHint: n,
    dependencies: [{ prerequisiteItemId: id(90000), requiredStage: null }],
    mnemonics: [],
    hints: [],
    userMnemonics: [{ locale: "ru-RU", mnemonicType: "MEANING", body: "Личная заметка." }],
    cards: [
      {
        id: id(n + 2000),
        learningItemId: id(n),
        cardType: "REVIEW",
        promptType: "MEANING",
        answerType: "MEANING",
        sortOrder: 1,
        answers: [
          {
            locale: "en-US",
            text: "answer",
            normalizedText: "answer",
            answerKind: "MEANING",
            isPrimary: true,
          },
        ],
        blockedAnswers: [{ text: "blocked", normalizedText: "blocked" }],
        audioAsset: null,
      },
    ],
  };
}

function table<T extends { id: string }>(
  rows: T[],
  activity: { current: number; maximum: number },
) {
  return {
    rows,
    findMany: vi.fn(async ({ where }: Query) => {
      activity.current += 1;
      activity.maximum = Math.max(activity.maximum, activity.current);
      try {
        await Promise.resolve();
        // Target row order must never become lesson source order.
        return rows.filter((row) => where.id.in.includes(row.id)).reverse();
      } finally {
        activity.current -= 1;
      }
    }),
    findUnique: vi.fn(() => {
      throw new Error("Unexpected per-item target query.");
    }),
  };
}

function harness(items: ReturnType<typeof item>[]) {
  const activity = { current: 0, maximum: 0 };
  const ids = (type: TargetType) => [
    ...new Set(items.filter((item) => item.targetType === type).map((item) => item.targetId)),
  ];
  const tables = {
    component: table(
      ids("COMPONENT").map((id) => ({
        id,
        symbol: "一",
        meaningRu: "один",
        meaningEn: "one",
        sourceKind: "PROJECT_AUTHORED",
      })),
      activity,
    ),
    kanji: table(
      ids("KANJI").map((id) => ({
        id,
        character: "一",
        jlptLevel: 5,
        readings: [
          { reading: "いち", priority: 0 },
          { reading: "ひと", priority: 1 },
        ],
        meanings: [
          { locale: "en-US", meaning: "one", isPrimary: true, sourceKind: "PROJECT_AUTHORED" },
          { locale: "ru-RU", meaning: "один", isPrimary: true, sourceKind: "IMPORTED" },
        ],
      })),
      activity,
    ),
    word: table(
      ids("WORD").map((id) => ({
        id,
        expression: `語-${id}`,
        reading: "ご",
        jlptLevel: 4,
        senses: [
          { locale: "en-US", meaning: "word", sourceKind: "IMPORTED" },
          { locale: "ru-RU", meaning: "слово", sourceKind: "PROJECT_AUTHORED" },
        ],
      })),
      activity,
    ),
    sentence: table(
      ids("SENTENCE").map((id) => ({
        id,
        japaneseText: "一です。",
        readingText: null,
        translationRu: "Это один.",
        translationEn: null,
      })),
      activity,
    ),
  };
  const course = {
    id: id(8000),
    slug: "japanese-ru-n2",
    levels: [
      {
        levelNumber: 1,
        items: items.map((learningItem, index) => ({
          sortOrder: index + 1,
          unlockPolicyJson: { policy: "level-order", fixtureLocked: true },
          learningItem,
        })),
      },
    ],
  };
  const db = {
    ...tables,
    $queryRaw: vi.fn().mockResolvedValue([]),
    userSettings: { findUnique: vi.fn().mockResolvedValue({ currentCourseId: course.id }) },
    userEnrollment: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { courseId: course.id, startedAt: new Date("2026-10-22T00:00:00Z"), course },
        ]),
    },
    deck: {
      findFirst: vi.fn().mockResolvedValue({
        id: id(8001),
        title: "Deck",
        status: "ACTIVE",
        items: items.map((learningItem, index) => ({ sortOrder: index + 1, learningItem })),
      }),
    },
  };
  const repository = new PrismaLessonsRepository({ db } as never);
  return { repository, db, tables, activity, course };
}

async function load(h: ReturnType<typeof harness>, source: "course" | "deck") {
  return source === "course"
    ? (await h.repository.listCourseLessonItems("owner")).map((row) => row.item)
    : (await h.repository.findDeckLesson("owner", id(8001)))!.items.map((row) => row.item);
}

describe.each(["course", "deck"] as const)("%s lesson target batching", (source) => {
  it("hydrates 101 words in two bounded calls, without per-item queries or dropping locked source items", async () => {
    const items = Array.from({ length: 101 }, (_, index) => item("WORD", index + 1)).reverse();
    const h = harness(items);
    const records = await load(h, source);
    expect(records.map((row) => row.id)).toEqual(items.map((row) => row.id));
    expect(records.map((row) => row.target.japanese)).toEqual(
      items.map((row) => `語-${row.targetId}`),
    );
    expect(records.every((row) => row.dependencies[0]?.prerequisiteItemId === id(90000))).toBe(
      true,
    );
    expect(records.at(-1)?.level).toBe(items.at(-1)?.levelHint);
    expect(h.tables.word.findMany).toHaveBeenCalledTimes(2);
    const queries = h.tables.word.findMany.mock.calls.map(([query]) => query);
    expect(queries.map((query) => query.where.id.in.length)).toEqual([100, 1]);
    expect(queries.flatMap((query) => query.where.id.in)).toEqual(items.map((row) => row.targetId));
    expect(h.activity.maximum).toBe(1);
    for (const target of Object.values(h.tables)) expect(target.findUnique).not.toHaveBeenCalled();
    expect(h.tables.component.findMany).not.toHaveBeenCalled();
    expect(h.tables.kanji.findMany).not.toHaveBeenCalled();
    expect(h.tables.sentence.findMany).not.toHaveBeenCalled();
    for (const query of queries)
      expect(query).toEqual({
        where: { id: { in: expect.any(Array) } },
        include: { senses: { orderBy: [{ locale: "asc" }, { meaning: "asc" }] } },
      });
  });

  it("deduplicates exact type/ID pairs, not source records or IDs shared across target tables", async () => {
    const sameId = id(9001);
    const word = item("WORD", 1, sameId);
    const kanji = item("KANJI", 2, sameId);
    const h = harness([word, kanji, word]);
    const records = await load(h, source);
    expect(records.map((record) => record.id)).toEqual([word.id, kanji.id, word.id]);
    expect(records.map((record) => record.target.japanese)).toEqual([
      `語-${sameId}`,
      "一",
      `語-${sameId}`,
    ]);
    expect(h.tables.word.findMany.mock.calls[0]?.[0].where.id.in).toEqual([sameId]);
    expect(h.tables.kanji.findMany.mock.calls[0]?.[0].where.id.in).toEqual([sameId]);
    expect(h.tables.word.findMany).toHaveBeenCalledTimes(1);
    expect(h.tables.kanji.findMany).toHaveBeenCalledTimes(1);
  });

  it("retains mixed-type mappings, reading/meaning includes, answer locales and private lesson text", async () => {
    const items = [item("SENTENCE", 1), item("WORD", 2), item("COMPONENT", 3), item("KANJI", 4)];
    const h = harness(items);
    const before = structuredClone(Object.values(h.tables).map((target) => target.rows));
    const records = await load(h, source);
    expect(records.map((record) => record.id)).toEqual(items.map((item) => item.id));
    expect(records[0]?.target).toEqual({
      japanese: "一です。",
      reading: null,
      jlptLevel: null,
      translations: { ru: [{ locale: "ru-RU", text: "Это один.", isPrimary: true }], en: [] },
    });
    expect(records[1]?.target).toMatchObject({
      reading: "ご",
      jlptLevel: "N4",
      translations: {
        en: [{ locale: "en-US", text: "word", isPrimary: true, sourceKind: "imported" }],
        ru: [{ locale: "ru-RU", text: "слово", isPrimary: false, sourceKind: "curated" }],
      },
    });
    expect(records[2]?.target).toMatchObject({
      japanese: "一",
      reading: null,
      translations: {
        ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
        en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
      },
    });
    expect(records[3]?.target).toMatchObject({
      japanese: "一",
      reading: "いち",
      jlptLevel: "N5",
      translations: {
        ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "imported" }],
      },
    });
    expect(h.tables.kanji.findMany).toHaveBeenCalledWith({
      where: { id: { in: [items[3]!.targetId] } },
      include: {
        readings: { orderBy: [{ priority: "asc" }, { reading: "asc" }] },
        meanings: { orderBy: [{ isPrimary: "desc" }, { locale: "asc" }, { meaning: "asc" }] },
      },
    });
    expect(h.tables.component.findMany).toHaveBeenCalledWith({
      where: { id: { in: [items[2]!.targetId] } },
    });
    expect(h.tables.sentence.findMany).toHaveBeenCalledWith({
      where: { id: { in: [items[0]!.targetId] } },
    });
    for (const record of records) {
      expect(record.cards[0]?.answers[0]).toMatchObject({
        locale: "en-US",
        text: "answer",
        normalizedText: "answer",
        isPrimary: true,
      });
      expect(record.cards[0]?.blockedAnswers[0]).toEqual({
        locale: "ru-RU",
        text: "blocked",
        normalizedText: "blocked",
      });
      expect(record.mnemonics[0]?.texts.ru[0]).toMatchObject({
        text: "Личная заметка.",
        sourceKind: "user",
      });
      expect(record.exampleSentences).toEqual([]);
    }
    expect(Object.values(h.tables).map((target) => target.rows)).toEqual(before);
    expect(h.activity.maximum).toBe(1);
    for (const target of Object.values(h.tables)) expect(target.findMany).toHaveBeenCalledTimes(1);
  });

  it.each(TARGET_TYPES)(
    "retains single-item missing %s errors without fallback findUnique calls",
    async (type) => {
      const entry = item(type, 1);
      const h = harness([entry]);
      h.tables[type.toLowerCase() as keyof typeof h.tables].rows.splice(0);
      await expect(load(h, source)).rejects.toThrow(
        `Missing ${type.toLowerCase()} target ${entry.targetId}.`,
      );
      for (const target of Object.values(h.tables))
        expect(target.findUnique).not.toHaveBeenCalled();
    },
  );

  it("does not issue target/example queries for an empty source", async () => {
    const h = harness([]);
    expect(await load(h, source)).toEqual([]);
    expect(h.db.$queryRaw).not.toHaveBeenCalled();
    for (const target of Object.values(h.tables)) expect(target.findMany).not.toHaveBeenCalled();
  });

  it("keeps ownership filters and existing nested lesson includes", async () => {
    const h = harness([item("WORD", 1)]);
    await load(h, source);
    let includes: unknown;
    if (source === "course") {
      const query = h.db.userEnrollment.findMany.mock.calls[1]?.[0] as unknown as {
        include: {
          course: {
            include: {
              levels: { include: { items: { include: { learningItem: { include: object } } } } };
            };
          };
        };
      };
      expect(query).toMatchObject({
        where: {
          userId: "owner",
          courseId: h.course.id,
          status: "ACTIVE",
          course: { status: "PUBLISHED" },
        },
      });
      includes = query.include.course.include.levels.include.items.include.learningItem.include;
    } else {
      const query = h.db.deck.findFirst.mock.calls[0]?.[0] as unknown as {
        include: { items: { include: { learningItem: { include: object } } } };
      };
      expect(query).toMatchObject({ where: { id: id(8001), ownerUserId: "owner" } });
      includes = query.include.items.include.learningItem.include;
    }
    expect(includes).toMatchObject({
      cards: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: {
          answers: { orderBy: [{ isPrimary: "desc" }, { text: "asc" }] },
          blockedAnswers: { orderBy: { text: "asc" } },
          audioAsset: { include: { dataSource: true, license: true } },
        },
      },
      dependencies: {
        where: { dependencyType: "PREREQUISITE" },
        orderBy: { prerequisiteItemId: "asc" },
      },
      mnemonics: { orderBy: [{ locale: "asc" }, { mnemonicType: "asc" }, { version: "desc" }] },
      hints: { orderBy: [{ locale: "asc" }, { hintType: "asc" }, { version: "desc" }] },
      userMnemonics: {
        where: { userId: "owner" },
        orderBy: [{ locale: "asc" }, { mnemonicType: "asc" }],
      },
    });
  });
});
