import { type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  applyMainCourseContentBatch,
  applyMainCourseContentBatches,
  planMainCourseContentBatch,
} from "../prisma/curate-main-course";
import { buildMainCourseBlueprint } from "../src/main-course";
import { buildMainCourseContentBatches } from "../src/main-course-content";

describe("main-course curation preflight and application", () => {
  it("supports an explicitly sourced kun reading without rewriting raw readings or private progress", async () => {
    const fixture = curationFixture();
    const original = fixture.registry[1]!;
    const batch = {
      ...original,
      kanji: original.kanji.map((item) =>
        item.character !== "田"
          ? item
          : {
              ...item,
              reading: {
                source: "た",
                sourceType: "ja_kun" as const,
                primary: "た",
                accepted: ["た"],
              },
            },
      ),
    };
    const source = fixture.state.kanji.get("田")!;
    source.importedRecord.rawJson.readings = [{ reading: "た", sourceType: "ja_kun" }];
    source.readings = [
      { reading: "た", readingType: "KUNYOMI", priority: 0 },
      { reading: "デン", readingType: "ONYOMI", priority: 1 },
    ];
    const before = structuredClone({ source, privateRows: fixture.privateRows });
    const registry = [fixture.registry[0]!, batch];
    await planMainCourseContentBatch(fixture.db, batch, registry);
    expect(fixture.mutations).toEqual([]);
    await applyMainCourseContentBatch(fixture.db, batch, registry);
    const item = fixture.state.items.get("KANJI:kanji-田")!;
    const card = [...fixture.state.cards.values()].find(
      (card) => card.learningItemId === item.id && card.promptType === "READING",
    )!;
    expect(
      fixture.state.answers
        .filter((answer) => answer.learningCardId === card.id)
        .map((answer) => answer.text),
    ).toEqual(["た"]);
    expect(source).toEqual(before.source);
    expect(fixture.privateRows).toEqual(before.privateRows);
    expect(fixture.privateMutation).not.toHaveBeenCalled();
    source.importedRecord.rawJson.readings[0]!.sourceType = "ja_on";
    await expect(planMainCourseContentBatch(fixture.db, batch, registry)).rejects.toThrow(
      "not supported by KANJIDIC2",
    );
  });

  it("blocks a pending fourth-batch fixture and default-all before database access", async () => {
    const fixture = curationFixture();
    const approved = buildMainCourseContentBatches();
    const pending = { ...approved[3]!, reviewedAt: null };
    const registry = [...approved.slice(0, 3), pending];
    expect(pending.reviewedAt).toBeNull();
    await expect(applyMainCourseContentBatch(fixture.db, pending, registry)).rejects.toThrow(
      "needs independent parent review",
    );
    await expect(
      applyMainCourseContentBatches(fixture.db, { registry, batchId: pending.id }),
    ).rejects.toThrow("needs independent parent review");
    await expect(applyMainCourseContentBatches(fixture.db, { registry })).rejects.toThrow(
      "needs independent parent review",
    );
    expect(fixture.readCourse).not.toHaveBeenCalled();
    expect(fixture.transaction).not.toHaveBeenCalled();
    expect(fixture.mutations).toEqual([]);
  });

  it("plans the pending one-kanji bridge using the published prior stroke, without creating components", async () => {
    const fixture = curationFixture(true);
    const bridge = fixture.registry[2]!;
    const pending = { ...bridge, reviewedAt: null };
    const plan = await planMainCourseContentBatch(fixture.db, pending, [
      fixture.registry[0]!,
      fixture.registry[1]!,
      pending,
    ]);
    expect(plan.priorComponentLearningItemIds).toEqual(
      new Map([["component-one-stroke", "item-component-one-stroke"]]),
    );
    expect(fixture.mutations).toEqual([]);
    expect(fixture.db.component.upsert).not.toHaveBeenCalled();
    expect(fixture.db.kanji.findUnique).toHaveBeenCalledTimes(1);
  });

  it("blocks unreviewed/unknown selected bridge application before any database read or write", async () => {
    const fixture = curationFixture(true);
    const pending = { ...fixture.registry[2]!, reviewedAt: null };
    const registry = [fixture.registry[0]!, fixture.registry[1]!, pending];
    await expect(
      applyMainCourseContentBatches(fixture.db, { registry, batchId: pending.id }),
    ).rejects.toThrow("needs independent parent review");
    await expect(
      applyMainCourseContentBatches(fixture.db, { registry, batchId: "unknown" }),
    ).rejects.toThrow("Unknown registered");
    await expect(applyMainCourseContentBatches(fixture.db, { registry })).rejects.toThrow(
      "needs independent parent review",
    );
    expect(fixture.readCourse).not.toHaveBeenCalled();
    expect(fixture.mutations).toEqual([]);
  });

  it("adds only the selected bridge while reusing demo target/card IDs and preserving source, modern metadata and private progress", async () => {
    const fixture = curationFixture(true);
    const bridge = fixture.registry[2]!;
    const demo = {
      id: "demo-kanji-one",
      targetId: "kanji-一",
      targetType: "KANJI",
      kind: "KANJI",
      status: "PUBLISHED",
    };
    fixture.state.items.set("KANJI:kanji-一", demo);
    const demoPlacement = {
      courseId: "starter-demo",
      courseLevelId: "demo-level-1",
      sortOrder: 1,
      learningItemId: demo.id,
    };
    fixture.state.placements.set("demo-level-1:1", demoPlacement);
    for (const promptType of ["MEANING", "READING"]) {
      const identity = {
        learningItemId: demo.id,
        promptType,
        answerType: promptType,
        locale: "ru-RU",
      };
      fixture.state.cards.set(JSON.stringify(identity), {
        id: `demo-one-${promptType}`,
        ...identity,
        cardType: "REVIEW",
        sortOrder: promptType === "MEANING" ? 1 : 2,
      });
    }
    fixture.privateRows.srs.learningCardId = "demo-one-MEANING";
    fixture.privateRows.override.learningCardId = "demo-one-MEANING";
    fixture.privateRows.mnemonic.learningItemId = demo.id;
    const source = fixture.state.kanji.get("一")!;
    source.kanjidicSourceId = "starter:kanji:kanji-one";
    source.jlptLevel = 5;
    const before = structuredClone({
      sources: fixture.state.kanji,
      components: fixture.state.components,
      cards: fixture.state.cards,
      privateRows: fixture.privateRows,
      demoPlacement,
    });
    const result = await applyMainCourseContentBatches(fixture.db, {
      registry: fixture.registry,
      batchId: bridge.id,
    });
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0]).toMatchObject({ id: bridge.id, components: 0, kanji: 1 });
    expect(fixture.state.items.get("KANJI:kanji-一")!.id).toBe(demo.id);
    expect(fixture.state.cards).toEqual(before.cards);
    expect(fixture.state.kanji).toEqual(before.sources);
    expect(fixture.state.components).toEqual(before.components);
    expect(fixture.privateRows).toEqual(before.privateRows);
    expect(fixture.state.placements.get("demo-level-1:1")).toEqual(before.demoPlacement);
    expect(fixture.state.placements.get("level-2:21")).toMatchObject({
      learningItemId: demo.id,
      courseId: "main-course",
    });
    expect(fixture.state.dependencies).toEqual([
      {
        learningItemId: demo.id,
        prerequisiteItemId: "item-component-one-stroke",
        dependencyType: "PREREQUISITE",
        requiredStage: 1,
      },
    ]);
    expect(
      fixture.state.answers
        .filter((answer) => answer.learningCardId === "demo-one-READING")
        .map((answer) => answer.text),
    ).toEqual(["いち"]);
    expect(fixture.db.component.upsert).not.toHaveBeenCalled();
    expect(fixture.db.kanji.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { character: "一" } }),
    );
    expect(fixture.state.runs.size).toBe(1);
    const first = identitySnapshot(fixture);
    await applyMainCourseContentBatches(fixture.db, {
      registry: fixture.registry,
      batchId: bridge.id,
    });
    expect(identitySnapshot(fixture)).toEqual(first);
    expect(fixture.state.kanji).toEqual(before.sources);
    expect(fixture.privateRows).toEqual(before.privateRows);
    expect(fixture.privateMutation).not.toHaveBeenCalled();
  });

  it.each(["component", "placement", "reading", "graphics"])(
    "blocks invalid bridge %s evidence before writes",
    async (condition) => {
      const fixture = curationFixture(true);
      const bridge = fixture.registry[2]!;
      if (condition === "component")
        fixture.state.items.get("COMPONENT:component-one-stroke")!.status = "DRAFT";
      if (condition === "placement")
        fixture.state.placements.set("level-2:21", {
          courseId: "main-course",
          courseLevelId: "level-2",
          sortOrder: 21,
          learningItemId: "unrelated",
        });
      if (condition === "reading") fixture.state.kanji.get("一")!.readings[0]!.reading = "ひと";
      if (condition === "graphics") fixture.state.kanji.get("一")!.strokeGraphic = null;
      await expect(
        applyMainCourseContentBatches(fixture.db, {
          registry: fixture.registry,
          batchId: bridge.id,
        }),
      ).rejects.toThrow();
      expect(fixture.mutations).toEqual([]);
      expect(fixture.transaction).not.toHaveBeenCalled();
    },
  );
  it("plans pending content without writes and resolves only registered, published prior items", async () => {
    const fixture = curationFixture();
    const pending = { ...buildMainCourseContentBatches()[1]!, reviewedAt: null };
    const registry = buildMainCourseContentBatches().map((batch) =>
      batch.id === pending.id ? pending : batch,
    );
    const plan = await planMainCourseContentBatch(fixture.db, pending, registry);
    expect(plan.priorComponentLearningItemIds.get("component-mountain")).toBe(
      "item-component-mountain",
    );
    expect(plan.priorComponentLearningItemIds.get("component-tree")).toBe("item-component-tree");
    expect(plan.priorComponentLearningItemIds.get("component-mouth-frame")).toBe(
      "item-component-mouth-frame",
    );
    expect(fixture.mutations).toEqual([]);
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it("requires real parent approval before attempting a live application", async () => {
    const fixture = curationFixture();
    const unreviewed = { ...buildMainCourseContentBatches()[1]!, reviewedAt: null };
    await expect(applyMainCourseContentBatch(fixture.db, unreviewed)).rejects.toThrow(
      "needs independent parent review",
    );
    expect(fixture.mutations).toEqual([]);
    expect(fixture.readCourse).not.toHaveBeenCalled();
  });

  it("rejects an unknown or forward component reference before any database operation", async () => {
    for (const key of ["component-not-registered", "component-future"]) {
      const fixture = curationFixture();
      const invalid = {
        ...fixture.batch,
        kanji: fixture.batch.kanji.map((content, index) =>
          index === 19 ? { ...content, componentKeys: [key] } : content,
        ),
      };
      const registry = [fixture.registry[0]!, invalid];
      if (key === "component-future")
        registry.push({
          ...fixture.batch,
          id: "future-test-batch",
          componentSortOrderStart: 41,
          components: [{ ...fixture.batch.components[0]!, key, symbol: "乙" }],
          kanji: [],
        });
      await expect(applyMainCourseContentBatch(fixture.db, invalid, registry)).rejects.toThrow(
        `references missing ${key}`,
      );
      expect(fixture.readCourse).not.toHaveBeenCalled();
      expect(fixture.mutations).toEqual([]);
    }
  });

  it.each(["missing", "unpublished", "unplaced", "other-course", "wrong-target"])(
    "blocks a %s prior component instead of publishing or substituting it",
    async (condition) => {
      const fixture = curationFixture();
      const item = fixture.state.items.get("COMPONENT:component-mountain")!;
      if (condition === "missing") fixture.state.components.delete("山");
      if (condition === "unpublished") item.status = "DRAFT";
      if (condition === "wrong-target") item.kind = "KANJI";
      if (condition === "unplaced") fixture.state.placements.delete("level-1:13");
      if (condition === "other-course")
        fixture.state.placements.get("level-1:13")!.courseId = "another-course";
      await expect(
        applyMainCourseContentBatch(fixture.db, fixture.batch, fixture.registry),
      ).rejects.toThrow("Prior component component-mountain is not published");
      expect(fixture.mutations).toEqual([]);
      expect(fixture.transaction).not.toHaveBeenCalled();
    },
  );

  it("does not accept a manifest with a registered id but a different payload", async () => {
    const fixture = curationFixture();
    await expect(
      planMainCourseContentBatch(
        fixture.db,
        { ...fixture.batch, componentSortOrderStart: 90 },
        fixture.registry,
      ),
    ).rejects.toThrow("does not match the registered manifest");
    expect(fixture.mutations).toEqual([]);
    expect(fixture.readCourse).not.toHaveBeenCalled();
  });

  it.each([
    "KANJIDIC2",
    "raw-reading",
    "reading-type",
    "first-reading",
    "KanjiVG",
    "last-placement",
  ])(
    "preflights the entire batch before writes when its last kanji has bad %s evidence",
    async (condition) => {
      const fixture = curationFixture();
      const last = fixture.state.kanji.get("田")!;
      if (condition === "KANJIDIC2") last.kanjidicImportedRecordId = null;
      if (condition === "raw-reading")
        last.importedRecord.rawJson.readings = [{ reading: "た", sourceType: "ja_kun" }];
      if (condition === "reading-type") last.readings[0]!.readingType = "KUNYOMI";
      if (condition === "first-reading")
        last.readings.unshift({ reading: "た", priority: 0, readingType: "KUNYOMI" });
      if (condition === "KanjiVG") last.strokeGraphic = null;
      if (condition === "last-placement")
        fixture.state.placements.set("level-4:13", {
          courseId: "main-course",
          courseLevelId: "level-4",
          sortOrder: 13,
          learningItemId: "unrelated-item",
        });
      await expect(
        applyMainCourseContentBatch(fixture.db, fixture.batch, fixture.registry),
      ).rejects.toThrow();
      expect(fixture.db.kanji.findUnique).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { character: "田" } }),
      );
      expect(fixture.mutations).toEqual([]);
      expect(fixture.transaction).not.toHaveBeenCalled();
    },
  );

  it("rejects occupied component slots and refuses to move existing course items", async () => {
    const occupied = curationFixture();
    occupied.state.placements.set("level-1:27", {
      courseId: "main-course",
      courseLevelId: "level-1",
      sortOrder: 27,
      learningItemId: "unrelated-item",
    });
    await expect(
      applyMainCourseContentBatch(occupied.db, occupied.batch, occupied.registry),
    ).rejects.toThrow("already occupied");
    expect(occupied.mutations).toEqual([]);

    const moved = curationFixture();
    moved.state.items.set("KANJI:kanji-山", {
      id: "existing-mountain",
      targetId: "kanji-山",
      targetType: "KANJI",
      kind: "KANJI",
      status: "PUBLISHED",
    });
    moved.state.placements.set("level-5:1", {
      courseId: "main-course",
      courseLevelId: "level-5",
      sortOrder: 1,
      learningItemId: "existing-mountain",
    });
    await expect(
      applyMainCourseContentBatch(moved.db, moved.batch, moved.registry),
    ).rejects.toThrow("Refusing to move existing");
    expect(moved.mutations).toEqual([]);
  });

  it("reapplies both batches without changing prior identities, placements or private progress", async () => {
    const fixture = curationFixture();
    const protectedBefore = protectedSnapshot(fixture);
    await applyMainCourseContentBatch(fixture.db, fixture.registry[0]!, fixture.registry);
    await applyMainCourseContentBatch(fixture.db, fixture.batch, fixture.registry);
    const firstApplication = identitySnapshot(fixture);
    await applyMainCourseContentBatch(fixture.db, fixture.batch, fixture.registry);
    expect(identitySnapshot(fixture)).toEqual(firstApplication);
    expect(protectedSnapshot(fixture)).toEqual(protectedBefore);
    expect(fixture.state.components.size).toBe(40);
    expect(fixture.state.items.size).toBe(80);
    expect(fixture.state.cards.size).toBe(120);
    expect(fixture.state.placements.size).toBe(80);
    expect(fixture.state.dependencies).toHaveLength(
      fixture.registry.flatMap((entry) => entry.kanji.flatMap((content) => content.componentKeys))
        .length,
    );
    expect(fixture.privateMutation).not.toHaveBeenCalled();
    expect(fixture.transaction).toHaveBeenCalledTimes(46 + 34 * 2);
  });

  it("uses prior component learning items and keeps decomposition order independent of query order", async () => {
    const fixture = curationFixture();
    await applyMainCourseContentBatch(fixture.db, fixture.batch, fixture.registry);
    const mountain = fixture.state.items.get("KANJI:kanji-山")!;
    expect(fixture.state.dependencies.filter((row) => row.learningItemId === mountain.id)).toEqual([
      {
        learningItemId: mountain.id,
        prerequisiteItemId: "item-component-mountain",
        dependencyType: "PREREQUISITE",
        requiredStage: 1,
      },
    ]);
    expect(
      fixture.state.links
        .filter((row) => row.kanjiId === "kanji-石")
        .map((row) => [row.componentId, row.position]),
    ).toEqual([
      ["component-cliff-ledge", "curated-1"],
      ["component-mouth-frame", "curated-2"],
    ]);
    const river = fixture.state.items.get("KANJI:kanji-川")!;
    const readingCard = [...fixture.state.cards.values()].find(
      (card) => card.learningItemId === river.id && card.promptType === "READING",
    )!;
    expect(
      fixture.state.answers
        .filter((row) => row.learningCardId === readingCard.id)
        .map((row) => row.text),
    ).toEqual(["せん"]);
  });

  it("rolls back a failed kanji transaction and permits safe reapplication", async () => {
    const fixture = curationFixture();
    fixture.failDependencyFor("kanji-石");
    await expect(
      applyMainCourseContentBatch(fixture.db, fixture.batch, fixture.registry),
    ).rejects.toThrow("test dependency failure");
    expect(fixture.state.items.has("KANJI:kanji-石")).toBe(false);
    expect(fixture.state.links.some((row) => row.kanjiId === "kanji-石")).toBe(false);
    expect(fixture.state.meanings.some((row) => row.kanjiId === "kanji-石")).toBe(false);
    fixture.failDependencyFor(null);
    await applyMainCourseContentBatch(fixture.db, fixture.batch, fixture.registry);
    expect(fixture.state.items.has("KANJI:kanji-石")).toBe(true);
    expect(fixture.state.cards.size).toBe(120);
    expect(fixture.privateMutation).not.toHaveBeenCalled();
  });
});

type Item = { id: string; targetId: string; targetType: string; kind: string; status: string };
type Placement = {
  courseId: string;
  courseLevelId: string;
  sortOrder: number;
  learningItemId: string;
  unlockPolicyJson?: { policy: string };
};
type Card = {
  id: string;
  learningItemId: string;
  promptType: string;
  answerType: string;
  locale: string;
  sortOrder: number;
  cardType?: string;
};
type Meaning = {
  kanjiId: string;
  locale: string;
  meaning: string;
  sourceKind: string;
  isPrimary: boolean;
};
type Link = { kanjiId: string; componentId: string; position: string };
type Dependency = {
  learningItemId: string;
  prerequisiteItemId: string;
  dependencyType: string;
  requiredStage: number;
};
type Answer = { learningCardId: string; text: string; sourceKind: string };
type KanjiFixture = {
  id: string;
  kanjidicSourceId: string;
  jlptLevel: number | null;
  legacyJlptLevel: number | null;
  kanjidicImportedRecordId: string | null;
  importedRecord: {
    recordType: string;
    rawJson: { literal: string; readings: { reading: string; sourceType: string }[] };
  };
  readings: { reading: string; priority: number; readingType: string }[];
  strokeGraphic: { id: string; importedRecord: { recordType: string } } | null;
};

function curationFixture(includeBridge = false) {
  const [first, pending] = buildMainCourseContentBatches();
  if (first === undefined || pending === undefined) throw new Error("Expected both manifests.");
  // Keep fixture approval explicit so the unreviewed-application guard is tested separately.
  const batch = { ...pending, reviewedAt: "2026-10-22" };
  const registry = [first, batch];
  // Test-only approval never changes shipped manifest metadata.
  if (includeBridge)
    registry.push({ ...buildMainCourseContentBatches()[2]!, reviewedAt: "2026-10-22" });
  const mutations: string[] = [];
  const state = {
    components: new Map(
      first.components.map((content) => [
        content.symbol,
        { id: content.key, sourceKind: "PROJECT_AUTHORED" },
      ]),
    ),
    kanji: new Map<string, KanjiFixture>(
      registry.flatMap((entry) =>
        entry.kanji.map(
          (content) =>
            [
              content.character,
              {
                id: `kanji-${content.character}`,
                kanjidicSourceId: `kanjidic2:${content.character.codePointAt(0)!.toString(16)}`,
                jlptLevel: null,
                legacyJlptLevel: null,
                kanjidicImportedRecordId: `raw-${content.character}` as string | null,
                importedRecord: {
                  recordType: "KANJIDIC2_CHARACTER",
                  rawJson: {
                    literal: content.character,
                    readings: [{ reading: content.reading.source, sourceType: "ja_on" }],
                  },
                },
                readings: [{ reading: content.reading.source, priority: 1, readingType: "ONYOMI" }],
                strokeGraphic: {
                  id: `svg-${content.character}`,
                  importedRecord: { recordType: "KANJIVG_CHARACTER" },
                } as { id: string; importedRecord: { recordType: string } } | null,
              },
            ] satisfies [string, KanjiFixture],
        ),
      ),
    ),
    items: new Map<string, Item>(),
    placements: new Map<string, Placement>(),
    cards: new Map<string, Card>(),
    meanings: [] as Meaning[],
    links: [] as Link[],
    dependencies: [] as Dependency[],
    answers: [] as Answer[],
    mnemonics: new Map<string, unknown>(),
    records: new Map<string, unknown>(),
    runs: new Map<string, { id: string }>(),
  };
  for (const [index, content] of first.components.entries()) {
    const item = {
      id: `item-${content.key}`,
      targetId: content.key,
      targetType: "COMPONENT",
      kind: "COMPONENT",
      status: "PUBLISHED",
    };
    state.items.set(`COMPONENT:${content.key}`, item);
    state.placements.set(`level-1:${index + 1}`, {
      courseId: "main-course",
      courseLevelId: "level-1",
      sortOrder: index + 1,
      learningItemId: item.id,
      unlockPolicyJson: { policy: "level-order" },
    });
    addInitialCard(item.id, "MEANING", 1);
  }
  for (const content of first.kanji) {
    const item = {
      id: `item-kanji-${content.character}`,
      targetId: `kanji-${content.character}`,
      targetType: "KANJI",
      kind: "KANJI",
      status: "PUBLISHED",
    };
    state.items.set(`KANJI:${item.targetId}`, item);
    state.placements.set(`level-${content.levelNumber}:${content.sortOrder}`, {
      courseId: "main-course",
      courseLevelId: `level-${content.levelNumber}`,
      sortOrder: content.sortOrder,
      learningItemId: item.id,
      unlockPolicyJson: { policy: "level-order" },
    });
    addInitialCard(item.id, "MEANING", 1);
    addInitialCard(item.id, "READING", 2);
  }
  const privateRows = {
    srs: { learningCardId: [...state.cards.values()][0]!.id, stageIndex: 5, dueAt: "2026-12-01" },
    override: { learningCardId: [...state.cards.values()][0]!.id, text: "личный ответ" },
    mnemonic: { learningItemId: "item-component-mountain", body: "личная заметка" },
  };
  const privateMutation = vi.fn(() => {
    throw new Error("Private data must not be mutated.");
  });
  function addInitialCard(learningItemId: string, promptType: string, sortOrder: number) {
    const key = JSON.stringify({
      learningItemId,
      promptType,
      answerType: promptType,
      locale: "ru-RU",
    });
    state.cards.set(key, {
      id: `card-${state.cards.size + 1}`,
      learningItemId,
      promptType,
      answerType: promptType,
      locale: "ru-RU",
      sortOrder,
    });
  }
  function write<TArgs, TResult>(name: string, action: (args: TArgs) => TResult) {
    return vi.fn((args: TArgs) => {
      mutations.push(name);
      return action(args);
    });
  }
  const readCourse = vi.fn(async () => ({
    id: "main-course",
    levels: buildMainCourseBlueprint().levels.map((level) => ({
      ...level,
      id: `level-${level.levelNumber}`,
    })),
  }));
  let failedTarget: string | null = null;
  const delegates = {
    course: { findUnique: readCourse },
    component: {
      findUnique: vi.fn(
        async ({ where }: { where: { symbol: string } }) =>
          state.components.get(where.symbol) ?? null,
      ),
      upsert: write(
        "component.upsert",
        ({ where, update }: { where: { symbol: string }; update: { sourceKind: string } }) => {
          const existing = state.components.get(where.symbol);
          const content =
            batch.components.find((entry) => entry.symbol === where.symbol) ??
            first.components.find((entry) => entry.symbol === where.symbol)!;
          const row = { ...existing, ...update, id: existing?.id ?? content.key };
          state.components.set(where.symbol, row);
          return row;
        },
      ),
    },
    kanji: {
      findUnique: vi.fn(
        async ({ where }: { where: { character: string } }) =>
          state.kanji.get(where.character) ?? null,
      ),
    },
    learningItem: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { targetType_targetId: { targetType: string; targetId: string } };
        }) => {
          const { targetType, targetId } = where.targetType_targetId;
          const row = state.items.get(`${targetType}:${targetId}`);
          return row === undefined
            ? null
            : {
                ...row,
                courseLevelItems: [...state.placements.values()].filter(
                  (placement) =>
                    placement.courseId === "main-course" && placement.learningItemId === row.id,
                ),
              };
        },
      ),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        [...state.items.values()]
          .filter(
            (item) =>
              where.id.in.includes(item.id) &&
              item.targetType === "COMPONENT" &&
              item.status === "PUBLISHED",
          )
          .reverse(),
      ),
      upsert: write(
        "learningItem.upsert",
        ({
          where,
          create,
          update,
        }: {
          where: { targetType_targetId: { targetType: string; targetId: string } };
          create: Omit<Item, "id">;
          update: Partial<Item>;
        }) => {
          const { targetType, targetId } = where.targetType_targetId;
          const key = `${targetType}:${targetId}`;
          const existing = state.items.get(key);
          const row =
            existing === undefined
              ? { ...create, id: `new-item-${state.items.size + 1}` }
              : { ...existing, ...update };
          state.items.set(key, row);
          return row;
        },
      ),
    },
    courseLevelItem: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { courseLevelId_sortOrder: { courseLevelId: string; sortOrder: number } };
        }) => {
          const { courseLevelId, sortOrder } = where.courseLevelId_sortOrder;
          return state.placements.get(`${courseLevelId}:${sortOrder}`) ?? null;
        },
      ),
      deleteMany: write(
        "placement.deleteMany",
        ({
          where,
        }: {
          where: {
            learningItemId: string;
            courseLevelId: { not: string };
            courseLevel: { courseId: string };
          };
        }) => {
          for (const [key, row] of state.placements) {
            if (
              row.learningItemId === where.learningItemId &&
              row.courseLevelId !== where.courseLevelId.not &&
              row.courseId === where.courseLevel.courseId
            )
              state.placements.delete(key);
          }
        },
      ),
      upsert: write("placement.upsert", ({ create }: { create: Omit<Placement, "courseId"> }) => {
        const row = { ...create, courseId: "main-course" };
        state.placements.set(`${row.courseLevelId}:${row.sortOrder}`, row);
        return row;
      }),
    },
    learningCard: {
      upsert: write(
        "card.upsert",
        ({
          where,
          create,
          update,
        }: {
          where: { learningItemId_promptType_answerType_locale: Omit<Card, "id" | "sortOrder"> };
          create: Omit<Card, "id">;
          update: Pick<Card, "sortOrder">;
        }) => {
          const key = JSON.stringify(where.learningItemId_promptType_answerType_locale);
          const existing = state.cards.get(key);
          const row =
            existing === undefined
              ? { ...create, id: `card-${state.cards.size + 1}` }
              : { ...existing, ...update };
          state.cards.set(key, row);
          return row;
        },
      ),
    },
    learningAnswer: {
      deleteMany: write(
        "answer.deleteMany",
        ({ where }: { where: { learningCardId: string; sourceKind: string } }) => {
          state.answers = state.answers.filter(
            (row) =>
              row.learningCardId !== where.learningCardId || row.sourceKind !== where.sourceKind,
          );
        },
      ),
      createMany: write("answer.createMany", ({ data }: { data: Answer[] }) => {
        state.answers.push(...data);
      }),
    },
    blockedAnswer: { deleteMany: write("blockedAnswer.deleteMany", () => undefined) },
    kanjiMeaning: {
      deleteMany: write(
        "meaning.deleteMany",
        ({ where }: { where: Omit<Meaning, "meaning"> & { meaning: { notIn: string[] } } }) => {
          state.meanings = state.meanings.filter(
            (row) =>
              row.kanjiId !== where.kanjiId ||
              row.locale !== where.locale ||
              row.sourceKind !== where.sourceKind ||
              where.meaning.notIn.includes(row.meaning),
          );
        },
      ),
      updateMany: write(
        "meaning.updateMany",
        ({ where, data }: { where: Partial<Meaning>; data: Partial<Meaning> }) => {
          for (const row of state.meanings) {
            if (
              row.kanjiId === where.kanjiId &&
              row.locale === where.locale &&
              row.sourceKind === where.sourceKind
            )
              Object.assign(row, data);
          }
        },
      ),
      upsert: write("meaning.upsert", ({ create }: { create: Meaning }) => {
        const existing = state.meanings.find(
          (row) =>
            row.kanjiId === create.kanjiId &&
            row.locale === create.locale &&
            row.meaning === create.meaning &&
            row.sourceKind === create.sourceKind,
        );
        if (existing === undefined) state.meanings.push(create);
        else Object.assign(existing, create);
      }),
    },
    kanjiComponent: {
      deleteMany: write("link.deleteMany", ({ where }: { where: { kanjiId: string } }) => {
        state.links = state.links.filter((row) => row.kanjiId !== where.kanjiId);
      }),
      createMany: write("link.createMany", ({ data }: { data: Link[] }) => {
        state.links.push(...data);
      }),
    },
    dependency: {
      deleteMany: write(
        "dependency.deleteMany",
        ({ where }: { where: { learningItemId: string } }) => {
          state.dependencies = state.dependencies.filter(
            (row) => row.learningItemId !== where.learningItemId,
          );
        },
      ),
      createMany: write("dependency.createMany", ({ data }: { data: Dependency[] }) => {
        if (
          failedTarget !== null &&
          data.some((row) =>
            [...state.items.values()].some(
              (item) => item.id === row.learningItemId && item.targetId === failedTarget,
            ),
          )
        )
          throw new Error("test dependency failure");
        state.dependencies.push(...data);
      }),
    },
    mnemonic: {
      upsert: write("mnemonic.upsert", ({ where, create }: { where: unknown; create: unknown }) => {
        state.mnemonics.set(JSON.stringify(where), create);
      }),
    },
    importedRecord: {
      upsert: write("record.upsert", ({ where, create }: { where: unknown; create: unknown }) => {
        state.records.set(JSON.stringify(where), create);
      }),
    },
    license: { upsert: write("license.upsert", () => ({ id: "license" })) },
    dataSource: { upsert: write("source.upsert", () => ({ id: "source" })) },
    importRun: {
      upsert: write(
        "run.upsert",
        ({ where }: { where: { dataSourceId_checksumSha256: { checksumSha256: string } } }) => {
          const key = where.dataSourceId_checksumSha256.checksumSha256;
          const row = state.runs.get(key) ?? { id: `run-${state.runs.size + 1}` };
          state.runs.set(key, row);
          return row;
        },
      ),
      update: write("run.update", () => undefined),
    },
    userSrsState: {
      upsert: privateMutation,
      update: privateMutation,
      updateMany: privateMutation,
      deleteMany: privateMutation,
    },
    userItemOverride: {
      upsert: privateMutation,
      update: privateMutation,
      deleteMany: privateMutation,
    },
    userMnemonic: { upsert: privateMutation, update: privateMutation, deleteMany: privateMutation },
  };
  const transaction = vi.fn(async (callback: (db: typeof delegates) => Promise<unknown>) => {
    const before = structuredClone(state);
    try {
      return await callback(delegates);
    } catch (error) {
      Object.assign(state, before);
      throw error;
    }
  });
  return {
    db: { ...delegates, $transaction: transaction } as unknown as PrismaClient,
    state,
    batch,
    registry,
    mutations,
    transaction,
    readCourse,
    privateRows,
    privateMutation,
    failDependencyFor: (target: string | null) => {
      failedTarget = target;
    },
  };
}

function identitySnapshot(fixture: ReturnType<typeof curationFixture>) {
  return {
    items: [...fixture.state.items],
    cards: [...fixture.state.cards],
    placements: [...fixture.state.placements],
    answerCount: fixture.state.answers.length,
    mnemonicCount: fixture.state.mnemonics.size,
    recordCount: fixture.state.records.size,
  };
}

function protectedSnapshot(fixture: ReturnType<typeof curationFixture>) {
  return structuredClone({
    items: [...fixture.state.items.values()]
      .filter((item) => !item.id.startsWith("new-"))
      .map((item) => ({ id: item.id, targetId: item.targetId, targetType: item.targetType })),
    cards: [...fixture.state.cards.values()].slice(0, 66).map((card) => ({
      id: card.id,
      learningItemId: card.learningItemId,
      promptType: card.promptType,
      answerType: card.answerType,
      locale: card.locale,
    })),
    placements: [...fixture.state.placements].filter(
      ([, placement]) => !placement.learningItemId.startsWith("new-"),
    ),
    privateRows: fixture.privateRows,
  });
}
