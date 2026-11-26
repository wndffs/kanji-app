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
  const db = {
    ...tables,
    learningItem: {
      findMany: vi.fn(async ({ where }: Query) =>
        items.filter((item) => where.id.in.includes(item.id)).reverse(),
      ),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  const repository = new PrismaLessonsRepository({ db } as never);
  return { repository, db, tables, activity, items };
}

async function loadInRequestedOrder(h: ReturnType<typeof harness>) {
  const ids = h.items.map((item) => item.id);
  const loaded = await h.repository.loadLessonItems("owner", ids);
  return ids.map((id) => loaded.get(id)!);
}

describe("selected teaching hydration", () => {
  it("deduplicates exact item IDs into sequential 100-item batches and scopes private text", async () => {
    const rows = Array.from({ length: 101 }, (_, index) => item("COMPONENT", index + 1));
    const h = harness(rows);
    const ids = rows.map((row) => row.id);
    const loaded = await h.repository.loadLessonItems("owner", [...ids, ids[0]!]);
    expect(loaded.size).toBe(101);
    expect(h.db.learningItem.findMany).toHaveBeenCalledTimes(2);
    expect(
      h.db.learningItem.findMany.mock.calls.map(([query]) => query.where.id.in.length),
    ).toEqual([100, 1]);
    expect(h.db.learningItem.findMany.mock.calls[0]![0]).toMatchObject({
      where: { status: "PUBLISHED", id: { in: ids.slice(0, 100) } },
      include: { userMnemonics: { where: { userId: "owner" } } },
    });
    expect(loaded.get(ids[0]!)?.cards[0]?.blockedAnswers[0]?.text).toBe("blocked");
    expect(loaded.get(ids[0]!)?.mnemonics[0]?.texts.ru[0]?.text).toBe("Личная заметка.");
    expect(h.activity.maximum).toBe(1);
  });
  it("does not read anything for an empty selection", async () => {
    const h = harness([]);
    expect(await h.repository.loadLessonItems("owner", [])).toEqual(new Map());
    expect(h.db.learningItem.findMany).not.toHaveBeenCalled();
  });
});

describe("lesson target batching", () => {
  it("uses the item's primary taught reading without changing shared dictionary targets or cards", async () => {
    const first = item("KANJI", 1);
    const second = item("KANJI", 2, first.targetId);
    for (const [entry, text] of [
      [first, "ひと"],
      [second, "いち"],
    ] as const) {
      entry.cards.push({
        ...entry.cards[0]!,
        id: `${entry.id}-reading`,
        promptType: "READING",
        answerType: "READING",
        sortOrder: 2,
        answers: [
          { locale: "ru-RU", text, normalizedText: text, answerKind: "READING", isPrimary: true },
        ],
      });
    }
    const h = harness([first, second]);
    const before = structuredClone(h.tables.kanji.rows);
    const records = await loadInRequestedOrder(h);
    expect(records.map((row) => row.target.reading)).toEqual(["ひと", "いち"]);
    expect(records.map((row) => row.cards.length)).toEqual([2, 2]);
    expect(h.tables.kanji.findMany).toHaveBeenCalledTimes(1);
    expect(h.tables.kanji.rows).toEqual(before);
    expect(records[0]!.cards[1]!.answers[0]?.text).toBe("ひと");
  });

  it("labels the source edition instead of showing legacy level 4 as N4", async () => {
    const h = harness([item("KANJI", 1)]);
    Object.assign(h.tables.kanji.rows[0]!, { jlptLevel: null, legacyJlptLevel: 4 });
    const records = await loadInRequestedOrder(h);
    expect(records[0]!.target.jlptLevel).toBe("до 2010: 4");
  });

  it("hydrates 101 words in two bounded calls, without per-item queries or dropping prerequisite metadata", async () => {
    const items = Array.from({ length: 101 }, (_, index) => item("WORD", index + 1)).reverse();
    const h = harness(items);
    const records = await loadInRequestedOrder(h);
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
    expect(new Set(queries.flatMap((query) => query.where.id.in))).toEqual(
      new Set(items.map((row) => row.targetId)),
    );
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

  it("deduplicates exact type/ID pairs, not IDs shared across target tables", async () => {
    const sameId = id(9001);
    const word = item("WORD", 1, sameId);
    const kanji = item("KANJI", 2, sameId);
    const secondWord = item("WORD", 3, sameId);
    const h = harness([word, kanji, secondWord]);
    const records = await loadInRequestedOrder(h);
    expect(records.map((record) => record.id)).toEqual([word.id, kanji.id, secondWord.id]);
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
    const records = await loadInRequestedOrder(h);
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
      await expect(loadInRequestedOrder(h)).rejects.toThrow(
        `Missing ${type.toLowerCase()} target ${entry.targetId}.`,
      );
      for (const target of Object.values(h.tables))
        expect(target.findUnique).not.toHaveBeenCalled();
    },
  );

  it("does not issue target/example queries for an empty source", async () => {
    const h = harness([]);
    expect(await loadInRequestedOrder(h)).toEqual([]);
    expect(h.db.$queryRaw).not.toHaveBeenCalled();
    for (const target of Object.values(h.tables)) expect(target.findMany).not.toHaveBeenCalled();
  });

  it("includes ordered lesson answers, prerequisites, attribution and private text", async () => {
    const h = harness([item("WORD", 1)]);
    await loadInRequestedOrder(h);
    expect(h.db.learningItem.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { status: "PUBLISHED", id: { in: [h.items[0]!.id] } },
      include: {
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
      },
    });
  });
});
