import { describe, expect, it, vi } from "vitest";
import { PrismaItemsRepository } from "../src/items/items.repository";

describe("related item summaries", () => {
  it("loads only capped leaf IDs in sequential 100-ID batches, preserving group totals and order", async () => {
    const root = {
      id: "root",
      kind: "COMPONENT",
      targetType: "COMPONENT",
      targetId: "root-target",
      title: "root",
      levelHint: 1,
      status: "PUBLISHED",
      cards: [],
      dependencies: [],
    };
    const entries = ["WORD", "KANJI"].flatMap((kind) =>
      Array.from({ length: 61 }, (_, index) => ({
        id: `${kind}-${index}`,
        targetId: `${kind}-target-${index}`,
        targetType: kind,
        kind,
        title: kind,
        levelHint: 2,
        status: "PUBLISHED",
        cards: [],
      })),
    );
    const query = vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      entries.filter((entry) => where.id.in.includes(entry.id)).reverse(),
    );
    const unusedRead = vi.fn(() => {
      throw new Error("Unused detail evidence must not be read.");
    });
    const db = {
      learningItem: { findUnique: vi.fn().mockResolvedValue(root), findMany: query },
      dependency: {
        findMany: vi.fn().mockResolvedValue(entries.map((learningItem) => ({ learningItem }))),
      },
      kanjiComponent: { findMany: vi.fn().mockResolvedValue([]) },
      component: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            symbol: "一",
            displayNameRu: "один",
            displayNameEn: "one",
            shapeDescriptionRu: null,
            shapeDescriptionEn: null,
            meaningRu: "один",
            meaningEn: "one",
            sourceKind: "PROJECT_AUTHORED",
          }),
      },
      word: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            expression: "本",
            reading: "ほん",
            commonnessRank: null,
            jlptLevel: null,
            senses: [],
            jmdictEntryId: "unused-dictionary-source",
          }),
      },
      kanji: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            character: "本",
            readings: [],
            meanings: [],
            jlptLevel: null,
            legacyJlptLevel: null,
            kanjidicSourceId: "unused-source",
          }),
      },
      importedRecord: { findMany: unusedRead },
      $queryRaw: unusedRead,
    };
    const repository = new PrismaItemsRepository({ db } as never);
    const result = await repository.findItemById("root", { includeExamples: false });
    const words = result!.relationGroups.find((group) => group.kind === "vocabulary")!;
    const kanji = result!.relationGroups.find((group) => group.kind === "used-in-kanji")!;
    expect(words.total).toBe(61);
    expect(kanji.total).toBe(61);
    expect(words.items.map((item) => item.id)).toEqual(
      entries
        .filter((entry) => entry.kind === "WORD")
        .slice(0, 60)
        .map((entry) => entry.id),
    );
    expect(kanji.items.map((item) => item.id)).toEqual(
      entries
        .filter((entry) => entry.kind === "KANJI")
        .slice(0, 60)
        .map((entry) => entry.id),
    );
    expect(query.mock.calls.map(([args]) => args.where.id.in.length)).toEqual([100, 20]);
    expect(db.learningItem.findUnique).toHaveBeenCalledOnce();
    expect(db.dependency.findMany).toHaveBeenCalledOnce();
    expect(unusedRead).not.toHaveBeenCalled();
    for (const item of [...words.items, ...kanji.items]) {
      expect(item.relationGroups).toEqual([]);
      expect(item.userOverrides).toEqual([]);
      expect(item.attributions).toEqual([]);
    }
  });
});
