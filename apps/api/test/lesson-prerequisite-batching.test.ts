import { describe, expect, it, vi } from "vitest";

import { PrismaLessonsRepository } from "../src/lessons/lessons.repository";

const ids = (count: number) => Array.from({ length: count }, (_, index) => `item-${index}`);
type Query = { where: { learningItemId: { in: string[] } } };

function audio(learningItemId: string) {
  return {
    id: `audio-${learningItemId}`,
    learningItemId,
    mediaUrl: "https://example.test/audio.mp3",
    storageKey: null,
    checksumSha256: "a".repeat(64),
    durationMs: 1000,
    speakerName: null,
    voiceMetadataJson: null,
    locale: "ja-JP",
    attributionText: "Project recording",
    importRunId: null,
    status: "PUBLISHED",
    dataSource: { name: "Project", homepageUrl: null },
    license: { name: "CC0", url: null },
  };
}

function card(learningItemId: string, promptType = "MEANING", suffix = promptType) {
  return {
    id: `${learningItemId}-${suffix}`,
    learningItemId,
    promptType,
    learningItem: { kind: "WORD" },
    audioAsset: promptType === "LISTENING" ? audio(learningItemId) : null,
  };
}

function harness(rows: ReturnType<typeof card>[], failCall?: number) {
  const activity = { current: 0, maximum: 0, calls: 0 };
  const failure = new Error("later batch failed");
  const findMany = vi.fn(async ({ where }: Query) => {
    activity.current++;
    activity.calls++;
    activity.maximum = Math.max(activity.maximum, activity.current);
    try {
      await Promise.resolve();
      if (activity.calls === failCall) throw failure;
      return rows.filter((row) => where.learningItemId.in.includes(row.learningItemId)).reverse();
    } finally {
      activity.current--;
    }
  });
  const repository = new PrismaLessonsRepository({ db: { learningCard: { findMany } } } as never);
  return { repository, findMany, activity, failure };
}

describe("prerequisite card batching", () => {
  it.each([101, 201, 1001])(
    "loads every card for %i unique items with at most one in-flight query",
    async (count) => {
      const input = ids(count);
      const rows = input.flatMap((id) => [card(id), card(id, "READING"), card(id, "LISTENING")]);
      const fixture = harness(rows);
      const result = await fixture.repository.listPrerequisiteCardIds(input);
      expect(result.size).toBe(count);
      for (const id of input) {
        expect(result.get(id)).toEqual([`${id}-LISTENING`, `${id}-READING`, `${id}-MEANING`]);
      }
      expect(fixture.findMany).toHaveBeenCalledTimes(Math.ceil(count / 100));
      const queries = fixture.findMany.mock.calls.map(([query]) => query);
      expect(queries.map((query) => query.where.learningItemId.in.length)).toEqual(
        Array.from({ length: Math.ceil(count / 100) }, (_, index) =>
          Math.min(100, count - index * 100),
        ),
      );
      expect(queries.flatMap((query) => query.where.learningItemId.in)).toEqual(input);
      for (const query of queries) {
        expect(query).toEqual({
          where: {
            learningItemId: { in: expect.any(Array) },
            learningItem: { status: "PUBLISHED" },
            OR: [
              { promptType: { not: "LISTENING" } },
              {
                promptType: "LISTENING",
                learningItem: { kind: { in: ["WORD", "SENTENCE"] } },
                audioAsset: {
                  is: {
                    status: "PUBLISHED",
                    mediaUrl: { not: null, startsWith: "https://" },
                    durationMs: { gt: 0 },
                    attributionText: { not: "" },
                  },
                },
              },
            ],
          },
          select: {
            id: true,
            learningItemId: true,
            promptType: true,
            learningItem: { select: { kind: true } },
            audioAsset: { include: { dataSource: true, license: true } },
          },
        });
      }
      expect(fixture.activity).toMatchObject({ current: 0, maximum: 1 });
    },
  );

  it("deduplicates before chunking even when repeats straddle the boundary", async () => {
    const input = ids(101);
    const fixture = harness(input.map((id) => card(id)));
    const result = await fixture.repository.listPrerequisiteCardIds([
      ...input.slice(0, 100),
      input[0]!,
      input[99]!,
      input[100]!,
      ...input,
    ]);
    expect(fixture.findMany.mock.calls.map(([query]) => query.where.learningItemId.in)).toEqual([
      input.slice(0, 100),
      input.slice(100),
    ]);
    expect(result.size).toBe(101);
    for (const id of input) expect(result.get(id)).toEqual([`${id}-MEANING`]);
  });

  it("preserves meaning, reading and eligible word/sentence listening cards across batches", async () => {
    const input = ids(101);
    const valid = card(input[100]!, "LISTENING");
    const sentence = {
      ...card(input[100]!, "LISTENING", "sentence"),
      learningItem: { kind: "SENTENCE" },
    };
    const invalid = [
      { ...valid, audioAsset: null },
      { ...valid, learningItem: { kind: "KANJI" } },
      ...[
        { learningItemId: "other" },
        { status: "DRAFT" },
        { mediaUrl: "http://example.test/a" },
        { durationMs: 0 },
        { checksumSha256: "invalid" },
        { attributionText: " " },
        { dataSource: { name: " ", homepageUrl: null } },
        { license: { name: " ", url: null } },
      ].map((override) => ({ ...valid, audioAsset: { ...audio(input[100]!), ...override } })),
    ].map((row, index) => ({ ...row, id: `invalid-${index}` }));
    const fixture = harness([
      card(input[0]!),
      card(input[0]!, "READING"),
      card(input[100]!),
      card(input[100]!, "READING"),
      valid,
      sentence,
      ...invalid,
    ]);
    const result = await fixture.repository.listPrerequisiteCardIds(input);
    expect(result.get(input[0]!)).toEqual([`${input[0]}-READING`, `${input[0]}-MEANING`]);
    expect(result.get(input[100]!)).toEqual([
      `${input[100]}-sentence`,
      valid.id,
      `${input[100]}-READING`,
      `${input[100]}-MEANING`,
    ]);
    // Missing/unpublished items and items without eligible cards have no map entry;
    // the service's existing nonempty-card guard must keep those dependencies locked.
    expect(result.has(input[50]!)).toBe(false);
    expect(result.size).toBe(2);
  });

  it("does not turn missing items or ineligible-only cards into satisfied prerequisites", async () => {
    const input = ids(201);
    const fixture = harness([
      card(input[0]!),
      { ...card(input[100]!, "LISTENING"), audioAsset: null },
    ]);
    const result = await fixture.repository.listPrerequisiteCardIds(input);
    expect(result).toEqual(new Map([[input[0]!, [`${input[0]}-MEANING`]]]));
    expect(result.has(input[100]!)).toBe(false);
    expect(result.has(input[200]!)).toBe(false);
    expect(fixture.findMany).toHaveBeenCalledTimes(3);
  });

  it("rejects later batch failure without returning partial results or starting subsequent batches", async () => {
    const input = ids(201);
    const fixture = harness(
      input.map((id) => card(id)),
      2,
    );
    await expect(fixture.repository.listPrerequisiteCardIds(input)).rejects.toBe(fixture.failure);
    expect(fixture.findMany).toHaveBeenCalledTimes(2);
    expect(fixture.activity).toMatchObject({ current: 0, maximum: 1 });
  });

  it("does not query an empty input", async () => {
    const fixture = harness([]);
    await expect(fixture.repository.listPrerequisiteCardIds([])).resolves.toEqual(new Map());
    expect(fixture.findMany).not.toHaveBeenCalled();
  });
});
