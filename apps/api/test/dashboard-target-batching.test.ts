import { describe, expect, it, vi } from "vitest";

import { primaryTaughtReadingCards } from "@kanji-srs/db";

import { PrismaDashboardRepository } from "../src/dashboard/dashboard.repository";

const NOW = new Date("2026-10-22T09:00:00.000Z");
const TARGET_TYPES = ["COMPONENT", "KANJI", "WORD", "SENTENCE"] as const;
const SOURCES = ["leeches", "mistakes", "burned", "lessons"] as const;
type TargetType = (typeof TARGET_TYPES)[number];
type Source = (typeof SOURCES)[number];
type TargetQuery = { where: { id: { in: string[] } }; include?: unknown };

function item(type: TargetType, n: number, targetId = `target-${n}`, taught: string | null = null) {
  return {
    id: `item-${n}`,
    kind: type,
    targetType: type as string,
    targetId,
    levelHint: n,
    cards: [
      {
        answerType: "READING",
        promptType: "READING",
        answers:
          taught === null
            ? []
            : [{ text: taught, locale: "ru-RU", answerKind: "READING", isPrimary: true }],
        userOverrides: [{ text: "private-reading", overrideType: "ACCEPTED_READING" }],
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
    findMany: vi.fn(async ({ where }: TargetQuery) => {
      activity.current += 1;
      activity.maximum = Math.max(activity.maximum, activity.current);
      try {
        await Promise.resolve();
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
    ...new Set(items.filter((entry) => entry.targetType === type).map((entry) => entry.targetId)),
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
        jlptLevel: null as number | null,
        legacyJlptLevel: 4,
        readings: [
          { reading: "イチ", priority: 0 },
          { reading: "ひと", priority: 7 },
        ],
        meanings: [
          { locale: "en-US", meaning: "one", isPrimary: true, sourceKind: "PROJECT_AUTHORED" },
          { locale: "ru-RU", meaning: "один", isPrimary: false, sourceKind: "IMPORTED" },
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
        readingText: null as string | null,
        translationRu: "Это один.",
        translationEn: null as string | null,
      })),
      activity,
    ),
  };
  const stages = [
    { stageIndex: 2, name: "Configured stage", intervalMinutes: 480, isBurned: false },
    { stageIndex: 9, name: "Configured burned", intervalMinutes: null, isBurned: true },
  ];
  const states = items.map((learningItem, index) => ({
    id: `state-${index}`,
    learningCardId: `card-${index}`,
    srsSystemId: "srs-1",
    stageIndex: 2,
    availableAt: NOW,
    burnedAt: null as Date | null,
    wrongCount: index + 7,
    correctStreak: index + 1,
    learningCard: { learningItem },
    srsSystem: { stages },
    reviewAnswers: [
      { result: "WRONG", previousStageIndex: 5, nextStageIndex: 2 },
      { result: "REVEAL", previousStageIndex: 2, nextStageIndex: 1 },
      { result: "TYPO", previousStageIndex: 2, nextStageIndex: 2 },
      { result: "CORRECT", previousStageIndex: null, nextStageIndex: 2 },
    ],
  }));
  const db = {
    ...tables,
    learningItem: {
      findMany: vi.fn(async ({ where }: TargetQuery) =>
        items.filter((entry) => where.id.in.includes(entry.id)).reverse(),
      ),
    },
    userSrsState: {
      findMany: vi.fn(async (query: { where: { userId: string; burnedAt: unknown } }) =>
        query.where.burnedAt === null
          ? states
          : states.map((state) => ({ ...state, burnedAt: NOW })),
      ),
    },
    reviewAnswer: {
      findMany: vi
        .fn()
        .mockImplementation(async () =>
          states.map((state) => ({ answeredAt: NOW, userSrsState: state })),
        ),
    },
  };
  return {
    repository: new PrismaDashboardRepository({ db } as never),
    db,
    items,
    states,
    stages,
    tables,
    activity,
  };
}

async function load(
  h: ReturnType<typeof harness>,
  source: Source,
  limit = h.items.length,
  userId = "owner",
) {
  switch (source) {
    case "leeches":
      return h.repository.listLeechSignals(userId, NOW);
    case "mistakes":
      return h.repository.listRecentMistakeItems(userId, NOW, limit);
    case "burned":
      return h.repository.listRecentBurnedItems(userId, limit);
    case "lessons":
      return h.repository.listAvailableLessonItems(
        h.items.map((entry) => entry.id),
        limit,
      );
  }
}

describe.each(SOURCES)("dashboard %s target batching", (source) => {
  it.each(TARGET_TYPES)(
    "loads 101 unique %s targets plus duplicates in sequential bounded queries",
    async (type) => {
      const entries = Array.from({ length: 101 }, (_, index) => item(type, index + 1)).reverse();
      entries.splice(50, 0, item(type, 102, entries[0]!.targetId));
      entries.push(item(type, 103, entries[0]!.targetId));
      const h = harness(entries);
      const records = await load(h, source);
      const target = h.tables[type.toLowerCase() as keyof typeof h.tables];
      const queries = target.findMany.mock.calls.map(([query]) => query);

      expect(records.map((record) => record.item.id)).toEqual(entries.map((entry) => entry.id));
      expect(records.map((record) => record.item.level)).toEqual(
        entries.map((entry) => entry.levelHint),
      );
      expect(queries.map((query) => query.where.id.in.length)).toEqual([100, 1]);
      expect(queries.flatMap((query) => query.where.id.in)).toEqual([
        ...new Set(entries.map((entry) => entry.targetId)),
      ]);
      expect(h.activity.maximum).toBe(1);
      for (const other of Object.values(h.tables)) {
        expect(other.findUnique).not.toHaveBeenCalled();
        if (other !== target) expect(other.findMany).not.toHaveBeenCalled();
      }
      if (type === "WORD") {
        expect(records.map((record) => record.item.japanese)).toEqual(
          entries.map((entry) => `語-${entry.targetId}`),
        );
      }
    },
  );

  it("deduplicates type/ID pairs while resolving taught readings separately for each item", async () => {
    const sameId = "shared-target";
    const entries = [
      item("WORD", 1, sameId, "ignored-word-answer"),
      item("KANJI", 2, sameId, "ひと"),
      item("COMPONENT", 3, sameId),
      item("SENTENCE", 4, sameId),
      item("KANJI", 5, sameId, "いち"),
    ];
    const h = harness(entries);
    const before = structuredClone(Object.values(h.tables).map((target) => target.rows));
    const records = await load(h, source);

    expect(records.map((record) => record.item.id)).toEqual(entries.map((entry) => entry.id));
    expect(records.map((record) => record.item.itemType)).toEqual([
      "word",
      "kanji",
      "component",
      "sentence",
      "kanji",
    ]);
    expect(records.map((record) => record.item.reading)).toEqual([
      "ご",
      "ひと",
      null,
      null,
      "いち",
    ]);
    for (const target of Object.values(h.tables)) {
      expect(target.findMany).toHaveBeenCalledTimes(1);
      expect(target.findMany.mock.calls[0]?.[0].where.id.in).toEqual([sameId]);
      expect(target.findUnique).not.toHaveBeenCalled();
    }
    expect(h.activity.maximum).toBe(1);
    expect(Object.values(h.tables).map((target) => target.rows)).toEqual(before);
    expect(JSON.stringify(records)).not.toContain("private-reading");
  });

  it("retains all mixed-type summaries, translations, legacy JLPT and raw reading priorities", async () => {
    const entries = [item("SENTENCE", 1), item("WORD", 2), item("COMPONENT", 3), item("KANJI", 4)];
    const h = harness(entries);
    const before = structuredClone(h.tables.kanji.rows);
    const records = await load(h, source);

    expect(records.map((record) => record.item)).toEqual([
      {
        id: "item-1",
        itemType: "sentence",
        japanese: "一です。",
        reading: null,
        level: 1,
        jlptLevel: null,
        translations: { ru: [{ locale: "ru-RU", text: "Это один.", isPrimary: true }], en: [] },
      },
      {
        id: "item-2",
        itemType: "word",
        japanese: "語-target-2",
        reading: "ご",
        level: 2,
        jlptLevel: "N4",
        translations: {
          en: [{ locale: "en-US", text: "word", isPrimary: true, sourceKind: "imported" }],
          ru: [{ locale: "ru-RU", text: "слово", isPrimary: false, sourceKind: "curated" }],
        },
      },
      {
        id: "item-3",
        itemType: "component",
        japanese: "一",
        reading: null,
        level: 3,
        jlptLevel: null,
        translations: {
          ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
          en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
        },
      },
      {
        id: "item-4",
        itemType: "kanji",
        japanese: "一",
        reading: "イチ",
        level: 4,
        jlptLevel: "до 2010: 4",
        translations: {
          en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
          ru: [{ locale: "ru-RU", text: "один", isPrimary: false, sourceKind: "imported" }],
        },
      },
    ]);
    expect(h.tables.kanji.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["target-4"] } },
      include: {
        readings: { orderBy: [{ priority: "asc" }, { reading: "asc" }] },
        meanings: { orderBy: [{ isPrimary: "desc" }, { locale: "asc" }, { meaning: "asc" }] },
      },
    });
    expect(h.tables.word.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["target-2"] } },
      include: { senses: { orderBy: [{ locale: "asc" }, { meaning: "asc" }] } },
    });
    expect(h.tables.component.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["target-3"] } },
    });
    expect(h.tables.sentence.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["target-1"] } },
    });
    expect(h.tables.kanji.rows).toEqual(before);
  });

  it.each([
    { name: "global taught reading", taught: "ひと", hasRaw: true, expected: "ひと" },
    { name: "dictionary fallback", taught: null, hasRaw: true, expected: "イチ" },
    {
      name: "taught reading without dictionary readings",
      taught: "ひと",
      hasRaw: false,
      expected: "ひと",
    },
    { name: "no available reading", taught: null, hasRaw: false, expected: null },
  ])("uses $name and ignores private, listening and non-primary answers", async (testCase) => {
    const entry = item("KANJI", 1, "target-1", testCase.taught);
    entry.cards.unshift(
      {
        ...entry.cards[0]!,
        answerType: "MEANING",
        answers: [{ text: "wrong-type", locale: "ru-RU", answerKind: "READING", isPrimary: true }],
      },
      {
        ...entry.cards[0]!,
        promptType: "LISTENING",
        answers: [
          { text: "listening-only", locale: "ru-RU", answerKind: "READING", isPrimary: true },
        ],
      },
    );
    entry.cards[2]!.answers.unshift(
      { text: "unsupported-locale", locale: "fr-FR", answerKind: "READING", isPrimary: true },
      { text: "not-reading", locale: "ru-RU", answerKind: "MEANING", isPrimary: true },
      { text: "not-primary", locale: "en-US", answerKind: "READING", isPrimary: false },
    );
    const h = harness([entry]);
    if (!testCase.hasRaw) h.tables.kanji.rows[0]!.readings.splice(0);
    const before = structuredClone(entry.cards);
    const records = await load(h, source);
    expect(records[0]?.item.reading).toBe(testCase.expected);
    expect(entry.cards).toEqual(before);
  });

  it.each(TARGET_TYPES)(
    "fails on a missing %s target without a single-row fallback",
    async (type) => {
      const entry = item(type, 1);
      const h = harness([entry]);
      h.tables[type.toLowerCase() as keyof typeof h.tables].rows.splice(0);
      await expect(load(h, source)).rejects.toThrow(
        `Missing ${type.toLowerCase()} target target-1.`,
      );
      for (const target of Object.values(h.tables))
        expect(target.findUnique).not.toHaveBeenCalled();
    },
  );

  it("retains user filters, source ordering and global taught-card selection", async () => {
    const h = harness([item("KANJI", 1, "target-1", "ひと")]);
    const records = await load(h, source);
    let itemQuery: unknown;

    if (source === "leeches") {
      const query = h.db.userSrsState.findMany.mock.calls[0]?.[0] as unknown as {
        include: { learningCard: { select: { learningItem: unknown } } };
      };
      expect(query).toMatchObject({
        where: { userId: "owner", burnedAt: null },
        orderBy: [{ wrongCount: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
        include: { reviewAnswers: { where: { answeredAt: { gte: NOW } } } },
      });
      itemQuery = query.include.learningCard.select.learningItem;
      expect(records[0]).toMatchObject({
        id: "state-0",
        learningCardId: "card-0",
        srsSystemId: "srs-1",
        stageIndex: 2,
        wrongCount: 7,
        correctStreak: 1,
        availableAt: NOW,
        burnedAt: null,
        stages: h.stages,
        recentWrongCount: 2,
        stageDropCount: 2,
        stageDropMagnitude: 4,
      });
    } else if (source === "mistakes") {
      const query = h.db.reviewAnswer.findMany.mock.calls[0]?.[0];
      expect(query).toMatchObject({
        where: {
          userSrsState: { userId: "owner" },
          answeredAt: { gte: NOW },
          result: { in: ["WRONG", "REVEAL"] },
        },
        distinct: ["learningCardId"],
        orderBy: [{ answeredAt: "desc" }, { id: "asc" }],
        take: 4,
      });
      itemQuery = query.select.userSrsState.select.learningCard.select.learningItem;
    } else if (source === "burned") {
      const query = h.db.userSrsState.findMany.mock.calls[0]?.[0] as unknown as {
        select: { learningCard: { select: { learningItem: unknown } } };
      };
      expect(query).toMatchObject({
        where: { userId: "owner", burnedAt: { not: null } },
        orderBy: [{ burnedAt: "desc" }, { id: "asc" }],
        take: 4,
      });
      itemQuery = query.select.learningCard.select.learningItem;
    } else {
      const query = h.db.learningItem.findMany.mock.calls[0]?.[0] as unknown as { select: unknown };
      expect(query).toMatchObject({ where: { id: { in: ["item-1"] }, status: "PUBLISHED" } });
      itemQuery = { select: query.select };
      expect(records[0]).toMatchObject({ occurredAt: null, srs: null });
    }

    expect(itemQuery).toEqual({
      select: {
        id: true,
        kind: true,
        targetType: true,
        targetId: true,
        levelHint: true,
        cards: primaryTaughtReadingCards,
      },
    });
    expect(JSON.stringify(itemQuery)).not.toContain("userOverrides");
    if (source === "mistakes" || source === "burned") {
      expect(records[0]).toMatchObject({
        occurredAt: NOW,
        srs: {
          stageIndex: 2,
          availableAt: NOW,
          burnedAt: source === "burned" ? NOW : null,
          wrongCount: 7,
          correctStreak: 1,
          stages: h.stages,
        },
      });
    }
  });

  it("keeps existing card/item distinctness without collapsing shared-target learning items", async () => {
    const first = item("KANJI", 1, "same-target", "ひと");
    const second = item("KANJI", 2, "same-target", "いち");
    const h = harness([first, first, second]);
    const records = await load(h, source);
    expect(records.map((record) => record.item.id)).toEqual(
      source === "leeches" ? [first.id, first.id, second.id] : [first.id, second.id],
    );
    if (source === "leeches") {
      expect(
        records.map((record) => ("learningCardId" in record ? record.learningCardId : null)),
      ).toEqual(["card-0", "card-1", "card-2"]);
      expect(records.map((record) => ("wrongCount" in record ? record.wrongCount : null))).toEqual([
        7, 8, 9,
      ]);
    }
    expect(h.tables.kanji.findMany).toHaveBeenCalledTimes(1);
    expect(h.tables.kanji.findMany.mock.calls[0]?.[0].where.id.in).toEqual(["same-target"]);
  });

  it("reloads shared targets on each call without reusing another user's SRS data", async () => {
    const h = harness([item("WORD", 1)]);
    const first = await load(h, source);
    h.tables.word.rows[0]!.reading = "ことば";
    h.states[0]!.wrongCount = 99;
    const second = await load(h, source, 1, "other-user");

    expect(first[0]?.item.reading).toBe("ご");
    expect(second[0]?.item.reading).toBe("ことば");
    expect(h.tables.word.findMany).toHaveBeenCalledTimes(2);
    if (source === "leeches") {
      expect(first[0]).toMatchObject({ wrongCount: 7 });
      expect(second[0]).toMatchObject({ wrongCount: 99 });
    } else if (source !== "lessons") {
      expect(first[0]).toMatchObject({ srs: { wrongCount: 7 } });
      expect(second[0]).toMatchObject({ srs: { wrongCount: 99 } });
    }
    if (source === "mistakes") {
      expect(h.db.reviewAnswer.findMany.mock.calls[1]?.[0]).toMatchObject({
        where: { userSrsState: { userId: "other-user" } },
      });
    } else if (source !== "lessons") {
      expect(h.db.userSrsState.findMany.mock.calls[1]?.[0]).toMatchObject({
        where: { userId: "other-user" },
      });
    }
  });

  it("does not query target tables for empty results", async () => {
    const h = harness([]);
    expect(await load(h, source)).toEqual([]);
    for (const target of Object.values(h.tables)) {
      expect(target.findMany).not.toHaveBeenCalled();
      expect(target.findUnique).not.toHaveBeenCalled();
    }
  });

  it("rejects unsupported target types before loading targets", async () => {
    const entry = item("WORD", 1);
    entry.targetType = "UNKNOWN";
    const h = harness([entry]);
    await expect(load(h, source)).rejects.toThrow("Unsupported learning item target type: UNKNOWN");
    for (const target of Object.values(h.tables)) expect(target.findMany).not.toHaveBeenCalled();
  });
});

describe.each(["mistakes", "burned"] as const)("dashboard %s selection", (source) => {
  it("hydrates only distinct selected items and preserves the first card's SRS", async () => {
    const first = item("WORD", 1);
    const excludedDuplicate = { ...first, targetId: "missing-unselected-target" };
    const h = harness([first, excludedDuplicate, item("KANJI", 2), item("SENTENCE", 3)]);
    const records = await load(h, source, 2);
    expect(records.map((record) => record.item.id)).toEqual(["item-1", "item-2"]);
    expect(records[0]).toMatchObject({ srs: { wrongCount: 7, correctStreak: 1 } });
    expect(h.tables.word.findMany.mock.calls[0]?.[0].where.id.in).toEqual([first.targetId]);
    expect(h.tables.sentence.findMany).not.toHaveBeenCalled();
  });
});

describe("dashboard summary limits", () => {
  it.each(["mistakes", "burned", "lessons"] as const)(
    "skips all queries for non-positive %s limits",
    async (source) => {
      const h = harness([item("WORD", 1)]);
      for (const limit of [0, -1]) expect(await load(h, source, limit)).toEqual([]);
      expect(h.db.learningItem.findMany).not.toHaveBeenCalled();
      expect(h.db.userSrsState.findMany).not.toHaveBeenCalled();
      expect(h.db.reviewAnswer.findMany).not.toHaveBeenCalled();
      for (const target of Object.values(h.tables)) expect(target.findMany).not.toHaveBeenCalled();
    },
  );

  it("keeps caller lesson order, ID deduplication, limits and missing-item omission", async () => {
    const h = harness([item("WORD", 1), item("KANJI", 2), item("SENTENCE", 3)]);
    const records = await h.repository.listAvailableLessonItems(
      ["item-2", "missing-item", "item-2", "item-1", "item-3"],
      4,
    );
    expect(records.map((record) => record.item.id)).toEqual(["item-2", "item-1", "item-3"]);
    const limited = await h.repository.listAvailableLessonItems(["item-2", "item-1"], 1);
    expect(limited.map((record) => record.item.id)).toEqual(["item-2"]);
    expect(h.tables.word.findMany).toHaveBeenCalledTimes(1);
    expect(h.tables.sentence.findMany).toHaveBeenCalledTimes(1);
  });
});
