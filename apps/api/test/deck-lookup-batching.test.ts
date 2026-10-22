import { describe, expect, it, vi } from "vitest";
import { PrismaDecksRepository } from "../src/decks/decks.repository";

describe("text deck lookup boundaries", () => {
  it("bounds candidate and matched-ID reads independently without dropping alternate word targets", async () => {
    const expressions = Array.from({ length: 101 }, (_, index) => `語${String.fromCodePoint(0x4e00 + index)}`);
    const words = expressions.flatMap((expression, index) => ["ご", "ことば"].map((reading, variant) => ({ id: `word-${index}-${variant}`, expression, reading, commonnessRank: index + 1, jlptLevel: null, senses: [] })));
    const wordReads = vi.fn(async ({ where }: { where: { expression: { in: string[] } } }) => words.filter((word) => where.expression.in.includes(word.expression)).reverse());
    const itemReads = vi.fn(async ({ where }: { where: { targetId: { in: string[] } } }) => words.filter((word) => where.targetId.in.includes(word.id)).map((word) => ({ id: `item-${word.id}`, kind: "WORD", targetType: "WORD", targetId: word.id, title: word.expression, levelHint: 2 })));
    const repository = new PrismaDecksRepository({ db: { word: { findMany: wordReads }, learningItem: { findMany: itemReads } } } as never);
    const result = await repository.findTextMatches({ sourceText: expressions.join(" "), wordCandidates: [...expressions, expressions[0]!], kanjiCharacters: [] });
    expect(wordReads.mock.calls.map(([query]) => query.where.expression.in.length)).toEqual([100, 1]);
    expect(itemReads.mock.calls.map(([query]) => query.where.targetId.in.length)).toEqual([100, 100, 2]);
    expect(result).toHaveLength(202);
    expect(new Set(result.map((match) => match.item.id)).size).toBe(202);
    expect(result.every((match) => match.sourceIndex >= 0)).toBe(true);
    expect(result.filter((match) => match.matchedText === expressions[0]).map((match) => match.item.target.reading).sort()).toEqual(["ことば", "ご"]);
  });

  it("bounds prerequisite reads and hydrates a shared prerequisite once per call", async () => {
    const ids = Array.from({ length: 201 }, (_, index) => `item-${String(index).padStart(3, "0")}`);
    const prerequisite = { id: "shared", kind: "COMPONENT", targetType: "COMPONENT", targetId: "component", title: "一", levelHint: 1 };
    const reads = vi.fn(async ({ where }: { where: { learningItemId: { in: string[] } } }) => where.learningItemId.in.map((learningItemId) => ({ learningItemId, prerequisiteItem: prerequisite })));
    const component = vi.fn().mockResolvedValue({ symbol: "一", meaningRu: "один", meaningEn: "one", sourceKind: "PROJECT_AUTHORED" });
    const repository = new PrismaDecksRepository({ db: { dependency: { findMany: reads }, component: { findUnique: component } } } as never);
    const result = await repository.findPrerequisites([...ids, ids[0]!]);
    expect(reads.mock.calls.map(([query]) => query.where.learningItemId.in.length)).toEqual([100, 100, 1]);
    expect(result.map((record) => record.sourceItemId)).toEqual(ids);
    expect(component).toHaveBeenCalledOnce();
    await repository.findPrerequisites(ids.slice(0, 2));
    expect(component).toHaveBeenCalledTimes(2);
  });

  it("skips all target lookups for empty candidates", async () => {
    const repository = new PrismaDecksRepository({ db: {} } as never);
    expect(await repository.findTextMatches({ sourceText: "", wordCandidates: [], kanjiCharacters: [] })).toEqual([]);
    expect(await repository.findPrerequisites([])).toEqual([]);
  });
});
