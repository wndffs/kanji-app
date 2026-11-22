import { type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  applyMainCourseWordBatch,
  applyMainCourseWordBatches,
  planMainCourseWordBatch,
  planMainCourseWordBatches,
  parseMainCourseWordCurationArgs,
} from "../prisma/curate-main-course-words";
import { buildMainCourseBlueprint } from "../src/main-course";
import { buildMainCourseContentBatches } from "../src/main-course-content";
import * as courseContent from "../src/main-course-content";
import {
  readingNoteProofData,
  readingNoteProofChecksum,
  type JmdictReadingNote,
} from "../src/jmdict-reading-note-proof";
import {
  AUTHORED_WORD_PART_OF_SPEECH,
  buildMainCourseWordBatch,
  buildMainCourseWordBatches,
  wordHanCharacters,
  type MainCourseWordBatch,
  type MainCourseWordContent,
} from "../src/main-course-word-content";

describe("bounded vocabulary curation", () => {
  it("preflights an exact repeated-kanji entry using only the real kanji prerequisite", async () => {
    const base = buildMainCourseWordBatch();
    const [original, ...rest] = base.words;
    const repeated: MainCourseWordContent = {
      ...original!,
      expression: "山々",
      reading: "やまやま",
      example: {
        japaneseText: "山々が見えた。",
        readingText: "やまやまがみえた。",
        translationRu: "Были видны горы.",
        translationEn: "The mountains were visible.",
      },
    };
    const batch = { ...base, words: [repeated, ...rest] };
    const fixture = harness([batch]);
    expect(
      (await planMainCourseWordBatch(fixture.db, batch)).words[0]?.prerequisiteItemIds,
    ).toEqual(["kanji-item-山"]);
    const broken = {
      ...repeated,
      expression: "々山",
      example: { ...repeated.example, japaneseText: "々山が見えた。" },
    };
    await expect(
      planMainCourseWordBatch(fixture.db, { ...batch, words: [broken, ...rest] }),
    ).rejects.toThrow("Invalid exact word identity");
    expect(wordHanCharacters("山々の𠮷")).toEqual(["山", "𠮷"]);
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it.each([22, 40])(
    "parses %s distinct registered manifests without broadening their scope",
    (count) => {
      const ids = buildMainCourseWordBatches()
        .slice(0, count)
        .map((batch) => batch.id);
      expect(
        parseMainCourseWordCurationArgs([
          "--validate-only",
          ...ids.flatMap((id) => ["--batch", id]),
        ]),
      ).toEqual({ mode: "validate-only", batchIds: ids });
      const tooMany = buildMainCourseWordBatches()
        .slice(0, 41)
        .map((batch) => batch.id);
      expect(() =>
        parseMainCourseWordCurationArgs([
          "--validate-only",
          ...tooMany.flatMap((id) => ["--batch", id]),
        ]),
      ).toThrow("maximum 40");
    },
  );
  it.each([20, 98])(
    "batches atomic finalization for %s words without extending item transactions",
    async (count) => {
      const batch = largePublicationFixture(count);
      const fixture = harness([batch]);
      const result = await applyMainCourseWordBatch(fixture.db, batch);
      expect(result.words).toBe(count);
      expect(fixture.transaction.mock.calls).toHaveLength(count + 2);
      expect(
        fixture.transaction.mock.calls.slice(0, -1).every((call) => call[1]?.timeout === 30_000),
      ).toBe(true);
      expect(fixture.transaction.mock.calls.at(-1)?.[1]).toEqual({
        maxWait: 10_000,
        timeout: Math.max(30_000, count * 1_500),
      });
      expect(fixture.db.sentence.findMany).toHaveBeenCalledTimes(1);
      expect(fixture.db.wordExample.updateMany).toHaveBeenCalledTimes(1);
      expect(fixture.db.wordExample.upsert).toHaveBeenCalledTimes(count);
      expect(fixture.db.learningItem.updateMany).toHaveBeenCalledTimes(1);
      expect([...fixture.state.examples.values()].every((row) => row.status === "PUBLISHED")).toBe(
        true,
      );
      expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
    },
  );
  it("rolls back all 98 published links and items when the last example fails final validation", async () => {
    const batch = largePublicationFixture(98);
    const fixture = harness([batch]);
    const privateBefore = structuredClone(fixture.privateRows);
    fixture.failPublicationAt(98);
    await expect(applyMainCourseWordBatch(fixture.db, batch)).rejects.toThrow(
      "Cannot publish a word example",
    );
    expect(fixture.db.wordExample.updateMany).not.toHaveBeenCalled();
    expect([...fixture.state.runs.values()].every((row) => row.status === "FAILED")).toBe(true);
    expect([...fixture.state.examples.values()].every((row) => row.status === "DRAFT")).toBe(true);
    for (const word of batch.words)
      expect(
        fixture.state.items.get(key({ targetType: "WORD", targetId: `word-${word.expression}` }))
          ?.status,
      ).toBe("DRAFT");
    expect(fixture.privateRows).toEqual(privateBefore);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });
  it.each(["missing sentence", "different successful run"])(
    "refuses to publish when the staged example has a %s",
    async (change) => {
      const fixture = harness();
      fixture.beforePublication(() => {
        if (change === "missing sentence") {
          fixture.state.sentences.delete([...fixture.state.sentences.keys()].at(-1)!);
        } else {
          const original = [...fixture.state.runs.values()][0]!;
          const other = { ...original, id: "other-run", checksumSha256: "a".repeat(64) };
          fixture.state.runs.set(other.id, other);
          [...fixture.state.records.values()].at(-1)!.importRunId = other.id;
        }
      });
      await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
        "Cannot publish a word example",
      );
      expect(fixture.db.wordExample.updateMany).not.toHaveBeenCalled();
      expect([...fixture.state.runs.values()][0]?.status).toBe("FAILED");
    },
  );
  it.each(["missing", "crossed pairs", "replacement ID", "non-draft", "wrong sort order"])(
    "rolls back the bulk update when staged links are %s",
    async (change) => {
      const fixture = harness();
      fixture.beforePublication(() => {
        const links = [...fixture.state.examples.entries()];
        const [identity, first] = links[0]!;
        const [, second] = links[1]!;
        if (change === "missing") fixture.state.examples.delete(identity);
        else if (change === "crossed pairs")
          [first.sentenceId, second.sentenceId] = [second.sentenceId, first.sentenceId];
        else if (change === "replacement ID") first.id = "replacement-link";
        else if (change === "non-draft") first.status = "ARCHIVED";
        else first.sortOrder = 1;
      });
      await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
        "Staged word example links changed",
      );
      expect(fixture.db.wordExample.updateMany).toHaveBeenCalledTimes(1);
      expect(fixture.db.wordExample.upsert).toHaveBeenCalledTimes(fixture.batch.words.length);
      expect(fixture.db.learningItem.updateMany).not.toHaveBeenCalled();
      expect([...fixture.state.runs.values()][0]?.status).toBe("FAILED");
      expect([...fixture.state.examples.values()].map((row) => row.status)).toEqual(
        Array(fixture.batch.words.length).fill("DRAFT"),
      );
    },
  );
  it("rolls back eligible example links when a learning item no longer targets its staged word", async () => {
    const fixture = harness();
    fixture.beforePublication(() => {
      const item = [...fixture.state.items.values()].at(-1)!;
      item.targetId = "unexpected-word";
    });
    await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
      "Word publication changed",
    );
    expect(fixture.db.wordExample.updateMany).toHaveBeenCalledTimes(1);
    expect(fixture.db.learningItem.updateMany).toHaveBeenCalledTimes(1);
    expect([...fixture.state.runs.values()][0]?.status).toBe("FAILED");
    expect([...fixture.state.examples.values()].map((row) => row.status)).toEqual(
      Array(fixture.batch.words.length).fill("DRAFT"),
    );
    expect([...fixture.state.items.values()].filter((row) => row.status === "DRAFT")).toHaveLength(
      fixture.batch.words.length - 1,
    );
  });
  it("parses distinct explicit batches while rejecting duplicate, unknown and excessive selections", () => {
    const batches = registryFixtureBatches();
    expect(
      parseMainCourseWordCurationArgs(
        ["--batch", batches[0]!.id, "--batch", batches[1]!.id, "--validate-only"],
        batches,
      ),
    ).toEqual({ mode: "validate-only", batchIds: batches.map((batch) => batch.id) });
    expect(() =>
      parseMainCourseWordCurationArgs(
        ["--batch", batches[0]!.id, "--batch", batches[0]!.id],
        batches,
      ),
    ).toThrow();
    expect(() =>
      parseMainCourseWordCurationArgs(["--batch", batches[0]!.id, "--batch", "unknown"], batches),
    ).toThrow("Unknown registered");
  });
  it("rejects every invalid multi-selection before database reads", async () => {
    const batches = registryFixtureBatches();
    for (const options of [
      { batchIds: [] },
      { batchIds: [batches[0]!.id, "unknown"] },
      { batchIds: [batches[0]!.id, batches[0]!.id] },
      { batchId: batches[0]!.id, batchIds: [batches[1]!.id] },
      { batchIds: Array.from({ length: 41 }, (_, i) => `fixture-${i}`) },
      { stagePairs: true },
    ]) {
      const fixture = harness(batches);
      await expect(
        applyMainCourseWordBatches(fixture.db, { batches, ...options }),
      ).rejects.toThrow();
      expect(fixture.readCourse).not.toHaveBeenCalled();
      expect(fixture.mutations).toEqual([]);
    }
  });
  it("rejects paired staging unless explicitly applying named word manifests", () => {
    const [batch] = registryFixtureBatches();
    const args = ["--batch", batch!.id, "--stage-pairs"];
    expect(parseMainCourseWordCurationArgs(args, [batch!])).toEqual({
      mode: "apply",
      batchId: batch!.id,
      stagePairs: true,
    });
    for (const bad of [
      ["--stage-pairs"],
      [...args, "--preflight-only"],
      [...args, "--stage-pairs"],
    ])
      expect(() => parseMainCourseWordCurationArgs(bad, [batch!])).toThrow(
        "explicit apply selection",
      );
  });
  it("stages at most two distinct new items at once and leaves existing words sequential", async () => {
    const fixture = harness();
    const transaction = fixture.transaction.getMockImplementation()!;
    let active = 0;
    let peak = 0;
    let started = 0;
    const inFlight: number[] = [];
    fixture.transaction.mockImplementation(async (...args) => {
      started++;
      active++;
      peak = Math.max(peak, active);
      inFlight.push(active);
      try {
        return await transaction(...args);
      } finally {
        active--;
      }
    });
    const result = await applyMainCourseWordBatch(fixture.db, fixture.batch, true);
    expect(result.words).toBe(fixture.batch.words.length);
    expect(inFlight.slice(0, 4)).toEqual([1, 1, 1, 2]);
    expect(inFlight.at(-1)).toBe(1);
    expect(peak).toBe(2);
    expect(active).toBe(0);
    expect(started).toBe(fixture.batch.words.length + 2);
    expect([...fixture.state.examples.values()].every((row) => row.status === "PUBLISHED")).toBe(
      true,
    );
  });
  it("drains a pending peer before a failed pair stops the manifest without publishing it", async () => {
    const fixture = harness();
    fixture.failWord("川");
    const transaction = fixture.transaction.getMockImplementation()!;
    let releasePeer!: () => void;
    const peer = new Promise<void>((resolve) => {
      releasePeer = resolve;
    });
    let signalFailure!: () => void;
    const failure = new Promise<void>((resolve) => {
      signalFailure = resolve;
    });
    let started = 0;
    fixture.transaction.mockImplementation(async (...args) => {
      const index = ++started;
      if (index === 4) await peer;
      try {
        return await transaction(...args);
      } finally {
        if (index === 3) signalFailure();
      }
    });
    const result = expect(
      applyMainCourseWordBatch(fixture.db, fixture.batch, true),
    ).rejects.toThrow("test word interruption");
    await failure;
    expect(started).toBe(4);
    expect([...fixture.state.runs.values()][0]?.status).toBe("PENDING");
    releasePeer();
    await result;
    expect(started).toBe(4);
    expect([...fixture.state.runs.values()][0]?.status).toBe("FAILED");
    expect(fixture.state.items.has(key({ targetType: "WORD", targetId: "word-川" }))).toBe(false);
    expect([...fixture.state.examples.values()].map((row) => row.status)).toEqual([
      "DRAFT",
      "DRAFT",
    ]);
    expect(fixture.db.learningItem.updateMany).not.toHaveBeenCalled();
  });
  it("retains a committed peer when its partner rolls back, then resumes without duplicates", async () => {
    const fixture = harness();
    fixture.failWord("川");
    const transaction = fixture.transaction.getMockImplementation()!;
    let peerCommitted!: () => void;
    const peer = new Promise<void>((resolve) => {
      peerCommitted = resolve;
    });
    let started = 0;
    fixture.transaction.mockImplementation(async (...args) => {
      const index = ++started;
      if (index === 3) await peer;
      try {
        return await transaction(...args);
      } finally {
        if (index === 4) peerCommitted();
      }
    });
    await expect(applyMainCourseWordBatch(fixture.db, fixture.batch, true)).rejects.toThrow(
      "test word interruption",
    );
    expect([...fixture.state.runs.values()][0]?.status).toBe("FAILED");
    const examples = [...fixture.state.examples.values()];
    expect(examples.map(({ status }) => status)).toEqual(["DRAFT", "DRAFT"]);
    const committedIds = examples.map(({ id }) => id);
    fixture.failWord(null);
    await applyMainCourseWordBatch(fixture.db, fixture.batch, true);
    expect(fixture.state.examples.size).toBe(fixture.batch.words.length);
    expect(
      committedIds.every((id) =>
        [...fixture.state.examples.values()].some(
          (example) => example.id === id && example.status === "PUBLISHED",
        ),
      ),
    ).toBe(true);
  });
  it("refuses a successful exact receipt in paired mode without touching live examples", async () => {
    const fixture = harness();
    await applyMainCourseWordBatch(fixture.db, fixture.batch);
    const before = structuredClone(fixture.state);
    fixture.mutations.length = 0;
    await expect(
      applyMainCourseWordBatches(fixture.db, {
        batches: [fixture.batch],
        batchId: fixture.batch.id,
        stagePairs: true,
      }),
    ).rejects.toThrow("successful word receipt");
    await expect(applyMainCourseWordBatch(fixture.db, fixture.batch, true)).rejects.toThrow(
      "successful word receipt",
    );
    expect(fixture.mutations).toEqual([]);
    expect(fixture.state).toEqual(before);
  });
  it("preflights and applies only explicitly selected additions in registry order", async () => {
    const batches = thirdPendingFixtureBatches().map((batch) => ({
      ...batch,
      reviewedAt: "2026-10-31",
    }));
    const fixture = harness(batches);
    await applyMainCourseWordBatch(fixture.db, batches[0]!);
    const before = structuredClone(fixture.state);
    const privateBefore = structuredClone(fixture.privateRows);
    const result = await applyMainCourseWordBatches(fixture.db, {
      batches,
      batchIds: [batches[2]!.id, batches[1]!.id],
    });
    expect(result.preflightedBatchIds).toEqual([batches[1]!.id, batches[2]!.id]);
    expect(result.batches.map((batch) => batch.batchId)).toEqual([batches[1]!.id, batches[2]!.id]);
    for (const name of Object.keys(before) as (keyof typeof before)[]) {
      for (const [identity, row] of before[name])
        expect(fixture.state[name].get(identity), `${name}:${identity}`).toEqual(row);
    }
    expect(fixture.privateRows).toEqual(privateBefore);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "bounds independent alternate source reads to four and drains them on failure: %s",
    async (fail) => {
      const base = buildMainCourseWordBatch();
      const batch = {
        ...base,
        words: base.words.map((word) => ({ ...word, acceptedReadings: ["ぬ"] })),
      };
      const fixture = harness([batch]);
      const original = fixture.readWord.getMockImplementation()!;
      let active = 0;
      let peak = 0;
      fixture.readWord.mockImplementation(async (...args) => {
        active++;
        peak = Math.max(peak, active);
        try {
          await Promise.resolve();
          if (fail && args[0].where.expression_reading.expression === batch.words[1]!.expression)
            throw new Error("source failed");
          return await original(...args);
        } finally {
          active--;
        }
      });
      if (fail)
        await expect(planMainCourseWordBatch(fixture.db, batch)).rejects.toThrow("source failed");
      else await planMainCourseWordBatch(fixture.db, batch);
      expect(peak).toBe(4);
      expect(active).toBe(0);
      expect(fixture.mutations).toEqual([]);
    },
  );
  it.each(["verb", "i-adjective"] as const)(
    "persists explicit %s metadata instead of noun",
    async (partOfSpeech) => {
      const batch = structuredClone(buildMainCourseWordBatch());
      Object.assign(batch.words[0]!, { partOfSpeech });
      const fixture = harness([batch]);
      await applyMainCourseWordBatch(fixture.db, batch);
      expect(fixture.db.wordSense.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ partOfSpeech: `${partOfSpeech} (course-authored)` }),
        }),
      );
      expect(fixture.db.wordSense.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ partOfSpeech: `${partOfSpeech} (course-authored)` }),
        }),
      );
    },
  );
  it("persists reviewed semantic blocks on meaning cards without changing the answer validator", async () => {
    const batch = structuredClone(buildMainCourseWordBatch());
    Object.assign(batch.words[0]!.meanings.en, {
      blocked: [{ text: "wrong semantic answer", reason: "Another meaning." }],
    });
    const fixture = harness([batch]);
    await applyMainCourseWordBatch(fixture.db, batch);
    expect(fixture.db.blockedAnswer.createMany).toHaveBeenCalledOnce();
    expect(fixture.db.blockedAnswer.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          text: "wrong semantic answer",
          normalizedText: "wrong semantic answer",
          reason: "Another meaning.",
          sourceKind: "PROJECT_AUTHORED",
        }),
      ],
    });
  });

  it("writes both authored cards' answers together without replacing non-authored rows", async () => {
    const fixture = harness();
    const imported = {
      id: "imported-meaning-answer",
      learningCardId: "existing-MEANING-card",
      sourceKind: "IMPORTED",
      text: "imported answer",
    };
    fixture.state.answers.set(imported.id, imported);
    const obsolete = { ...imported, id: "obsolete-authored", sourceKind: "PROJECT_AUTHORED" };
    fixture.state.answers.set(obsolete.id, obsolete);

    await applyMainCourseWordBatch(fixture.db, fixture.batch);

    expect(fixture.db.wordSense.deleteMany).toHaveBeenCalledTimes(fixture.batch.words.length);
    expect(fixture.db.learningAnswer.deleteMany).toHaveBeenCalledOnce();
    expect(fixture.db.blockedAnswer.deleteMany).toHaveBeenCalledOnce();
    expect(fixture.db.learningAnswer.createMany).toHaveBeenCalledTimes(fixture.batch.words.length);
    expect(fixture.db.learningAnswer.deleteMany).toHaveBeenCalledWith({
      where: {
        learningCardId: { in: ["existing-MEANING-card", "existing-READING-card"] },
        sourceKind: "PROJECT_AUTHORED",
      },
    });
    expect(fixture.db.learningAnswer.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ learningCardId: "existing-MEANING-card", locale: "ru-RU" }),
        expect.objectContaining({ learningCardId: "existing-MEANING-card", locale: "en-US" }),
        expect.objectContaining({ learningCardId: "existing-READING-card", answerKind: "READING" }),
      ]),
    });
    expect(fixture.state.answers.get(imported.id)).toEqual(imported);
    expect(fixture.state.answers.has(obsolete.id)).toBe(false);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });
  it("batches uncached kanji and placement reads while never caching standalone plans", async () => {
    const batches = registryFixtureBatches();
    const fixture = harness(batches);
    const characters = (batch: MainCourseWordBatch) =>
      new Set(
        batch.words.flatMap((content) =>
          wordHanCharacters(content.expression + content.example.japaneseText),
        ),
      );
    const unique = new Set(batches.flatMap((batch) => [...characters(batch)])).size;
    const kanjiReads = () =>
      fixture.readKanji.mock.calls.flatMap(([args]) => args.where.character.in);
    const placedReads = () =>
      fixture.readKanjiItems.mock.calls.flatMap(([args]) => args.where.targetId.in);
    await planMainCourseWordBatches(fixture.db, batches);
    expect(fixture.readCourse).toHaveBeenCalledTimes(1);
    expect(kanjiReads()).toHaveLength(unique);
    expect(placedReads()).toHaveLength(unique);
    expect(fixture.readKanji.mock.calls.length).toBeLessThanOrEqual(batches.length);
    expect(fixture.readKanjiItems.mock.calls.length).toBeLessThanOrEqual(batches.length);
    expect(fixture.db.license.findUnique).toHaveBeenCalledTimes(batches.length);
    expect(fixture.db.dataSource.findUnique).toHaveBeenCalledTimes(batches.length);
    expect(fixture.readPrimaryWords).toHaveBeenCalledTimes(batches.length);
    expect(fixture.readWord).toHaveBeenCalledTimes(
      batches.reduce(
        (count, batch) =>
          count + batch.words.reduce((sum, word) => sum + (word.acceptedReadings?.length ?? 0), 0),
        0,
      ),
    );
    await planMainCourseWordBatches(fixture.db, batches);
    expect(fixture.readCourse).toHaveBeenCalledTimes(2);
    expect(kanjiReads()).toHaveLength(unique * 2);
    await planMainCourseWordBatch(fixture.db, batches[0]!);
    await planMainCourseWordBatch(fixture.db, batches[0]!);
    expect(fixture.readCourse).toHaveBeenCalledTimes(4);
    expect(fixture.readPrimaryWords).toHaveBeenCalledTimes(batches.length * 2 + 2);
    expect(kanjiReads()).toHaveLength(unique * 2 + characters(batches[0]!).size * 2);
    expect(fixture.mutations).toEqual([]);
  });

  it("reads exact word, slot and example conflicts in groups while rechecking every write", async () => {
    const fixture = harness();
    const { batch, db } = fixture;
    await applyMainCourseWordBatch(db, batch);
    vi.clearAllMocks();
    const plan = await planMainCourseWordBatch(db, batch);
    expect(plan.words.map(({ content }) => content.expression)).toEqual(
      batch.words.map(({ expression }) => expression),
    );
    expect(db.learningItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { targetType: "WORD", targetId: { in: plan.words.map(({ wordId }) => wordId) } },
      }),
    );
    expect(db.courseLevelItem.findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: {
          courseLevelId: plan.courseLevelId,
          sortOrder: { in: batch.words.map(({ sortOrder }) => sortOrder) },
        },
      }),
    );
    expect(db.sentence.findMany).toHaveBeenCalledTimes(1);
    expect(db.learningItem.findUnique).not.toHaveBeenCalled();
    expect(db.courseLevelItem.findUnique).not.toHaveBeenCalled();
    expect(db.sentence.findUnique).not.toHaveBeenCalled();

    await applyMainCourseWordBatch(db, batch);
    expect(db.learningItem.findUnique).toHaveBeenCalledTimes(batch.words.length);
    expect(db.courseLevelItem.findUnique).toHaveBeenCalledTimes(batch.words.length);
    expect(db.sentence.findUnique).toHaveBeenCalledTimes(batch.words.length);
  });

  it("bounds retained kanji entries to 512 and rereads overflow instead of dropping checks", async () => {
    const registry = buildMainCourseContentBatches();
    const existing = new Set(
      registry.flatMap((batch) => batch.kanji.map((kanji) => kanji.character)),
    );
    const extra: string[] = [];
    for (let point = 0x7000; extra.length < 513; point++) {
      const character = String.fromCodePoint(point);
      if (!existing.has(character)) extra.push(character);
    }
    const synthetic = registry.map((batch, index) =>
      index !== 0
        ? batch
        : {
            ...batch,
            kanji: [
              ...batch.kanji,
              ...extra.map((character, index) => ({
                ...batch.kanji[0]!,
                character,
                levelNumber: 2,
                sortOrder: 1000 + index,
              })),
            ],
          },
    );
    const spy = vi.spyOn(courseContent, "buildMainCourseContentBatches").mockReturnValue(synthetic);
    try {
      const batches = registryFixtureBatches().map((batch) => ({
        ...batch,
        words: batch.words.map((word, index) =>
          index !== 0
            ? word
            : {
                ...word,
                example: {
                  ...word.example,
                  japaneseText: word.example.japaneseText + extra.join(""),
                },
              },
        ),
      }));
      const fixture = harness(batches);
      const retained = new Set<string>();
      let expectedReads = 0;
      const allCharacters = new Set<string>();
      for (const batch of batches)
        for (const character of new Set(
          batch.words.flatMap((word) =>
            wordHanCharacters(word.expression + word.example.japaneseText),
          ),
        )) {
          allCharacters.add(character);
          if (!retained.has(character)) {
            expectedReads++;
            if (retained.size < 512) retained.add(character);
          }
        }
      await planMainCourseWordBatches(fixture.db, batches);
      expect(expectedReads).toBeGreaterThan(allCharacters.size);
      const chunks = fixture.readKanji.mock.calls.map(([args]) => args.where.character.in);
      expect(chunks.flat()).toHaveLength(expectedReads);
      expect(Math.max(...chunks.map((chunk) => chunk.length))).toBe(256);
      expect(
        fixture.readKanjiItems.mock.calls.flatMap(([args]) => args.where.targetId.in),
      ).toHaveLength(expectedReads);
      expect(fixture.readCourse).toHaveBeenCalledTimes(1);
      expect(fixture.mutations).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it("rechecks each batch's exact registered placement even for a cached common kanji", async () => {
    const batches = registryFixtureBatches();
    const fixture = harness(batches);
    const first = new Set(
      batches[0]!.words.flatMap((word) =>
        wordHanCharacters(word.expression + word.example.japaneseText),
      ),
    );
    const common = batches[1]!.words
      .flatMap((word) => wordHanCharacters(word.expression + word.example.japaneseText))
      .find((character) => first.has(character))!;
    expect(common).toBeDefined();
    const registry = buildMainCourseContentBatches();
    const spy = vi
      .spyOn(courseContent, "buildMainCourseContentBatches")
      .mockReturnValueOnce(registry)
      .mockReturnValueOnce(
        registry.map((batch) => ({
          ...batch,
          kanji: batch.kanji.map((kanji) =>
            kanji.character === common ? { ...kanji, sortOrder: 1000 } : kanji,
          ),
        })),
      );
    try {
      await expect(planMainCourseWordBatches(fixture.db, batches)).rejects.toThrow(
        "registered earlier",
      );
      expect(
        fixture.readKanji.mock.calls.filter(([args]) => args.where.character.in.includes(common)),
      ).toHaveLength(1);
      expect(fixture.mutations).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it.each(["source", "placement"])(
    "does not retain %s reads from a previous registry plan",
    async (condition) => {
      const batches = registryFixtureBatches();
      const fixture = harness(batches);
      await planMainCourseWordBatches(fixture.db, batches);
      if (condition === "source")
        fixture.state.words.get(batches[0]!.words[0]!.expression)!.importedRecord.importRun.status =
          "FAILED";
      else
        [...fixture.state.placements.values()].find(
          (row) => row.learningItemId === "kanji-item-山",
        )!.sortOrder = 999;
      await expect(
        applyMainCourseWordBatches(fixture.db, { batches, batchId: batches[0]!.id }),
      ).rejects.toThrow(condition === "source" ? "provenance" : "registered earlier");
      expect(fixture.transaction).not.toHaveBeenCalled();
      expect(fixture.mutations).toEqual([]);
    },
  );

  it("freshly plans a selected write after the cached selection preflight", async () => {
    const batches = registryFixtureBatches();
    const fixture = harness(batches);
    const readCourse = fixture.readCourse.getMockImplementation()!;
    fixture.readCourse.mockImplementationOnce(readCourse).mockImplementationOnce(async () => {
      [...fixture.state.placements.values()].find(
        (row) => row.learningItemId === "kanji-item-山",
      )!.sortOrder = 999;
      return readCourse();
    });
    await expect(
      applyMainCourseWordBatches(fixture.db, { batches, batchId: batches[0]!.id }),
    ).rejects.toThrow("registered earlier");
    expect(fixture.readCourse).toHaveBeenCalledTimes(2);
    expect(fixture.transaction).not.toHaveBeenCalled();
    expect(fixture.mutations).toEqual([]);
  });

  it.each(["source", "placement"])(
    "rereads %s inside applyWord after both preflights",
    async (condition) => {
      const batches = registryFixtureBatches();
      const fixture = harness(batches);
      const transact = fixture.transaction.getMockImplementation()!;
      fixture.transaction
        .mockImplementationOnce(transact)
        .mockImplementationOnce(async (action) => {
          if (condition === "source")
            fixture.state.words.get(
              batches[0]!.words[0]!.expression,
            )!.importedRecord.importRun.status = "FAILED";
          else
            [...fixture.state.placements.values()].find(
              (row) => row.learningItemId === "kanji-item-山",
            )!.sortOrder = 999;
          return transact(action);
        });
      await expect(
        applyMainCourseWordBatches(fixture.db, { batches, batchId: batches[0]!.id }),
      ).rejects.toThrow(condition === "source" ? "provenance" : "changed after preflight");
      expect(fixture.readCourse).toHaveBeenCalledTimes(2);
      expect(fixture.readPrimaryWords).toHaveBeenCalledTimes(2);
      expect(fixture.readPrimaryWords.mock.calls.at(-1)).toEqual(
        fixture.readPrimaryWords.mock.calls[0],
      );
      const { expression, reading } = batches[0]!.words[0]!;
      expect(fixture.readWord).toHaveBeenLastCalledWith({
        where: { expression_reading: { expression, reading } },
        select: fixture.readPrimaryWords.mock.calls[0]![0].select,
      });
      expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
      expect([...fixture.state.runs.values()].every((run) => run.status === "FAILED")).toBe(true);
    },
  );

  it.each([
    [6, "N5"],
    [16, "N4"],
    [28, "N3"],
    [44, "N2"],
    [60, "N2"],
  ] as const)(
    "curates a reviewed batch at registered level %i with its %s band",
    async (levelNumber, band) => {
      const original = buildMainCourseWordBatch();
      const sortOrderStart =
        1 +
        Math.max(
          0,
          ...buildMainCourseContentBatches()
            .flatMap((entry) => entry.kanji)
            .filter((item) => item.levelNumber === levelNumber)
            .map((item) => item.sortOrder),
          ...buildMainCourseWordBatches()
            .filter((entry) => entry.levelNumber === levelNumber)
            .flatMap((entry) => entry.words.map((item) => item.sortOrder)),
        );
      const batch = {
        ...original,
        levelNumber,
        sortOrderStart,
        words: original.words.map((word, index) => ({
          ...word,
          sortOrder: sortOrderStart + index,
        })),
      };
      const fixture = harness([batch]);
      expect(await planMainCourseWordBatch(fixture.db, batch)).toMatchObject({
        courseLevelId: `level-${levelNumber}`,
        curriculumBand: band,
      });
      await applyMainCourseWordBatch(fixture.db, batch);
      const items = [...fixture.state.items.values()].filter((item) => item.kind === "WORD");
      expect(items).toHaveLength(20);
      expect(
        items.every((item) => item.curriculumBand === band && item.levelHint === levelNumber),
      ).toBe(true);
      const before = structuredClone(fixture.state.cards);
      const privateBefore = structuredClone(fixture.privateRows);
      await applyMainCourseWordBatch(fixture.db, batch);
      expect(fixture.state.cards).toEqual(before);
      expect(fixture.privateRows).toEqual(privateBefore);
    },
  );

  it("rejects a destination band's drift before source reads or writes", async () => {
    const batch = { ...buildMainCourseWordBatch(), levelNumber: 6 };
    const fixture = harness([batch]);
    fixture.readCourse.mockResolvedValueOnce({
      id: "main",
      levels: buildMainCourseBlueprint().levels.map((level) => ({
        ...level,
        id: `level-${level.levelNumber}`,
        band: level.levelNumber === 6 ? "FOUNDATION" : level.band,
      })),
    });
    await expect(applyMainCourseWordBatch(fixture.db, batch)).rejects.toThrow(
      "registered curriculum band",
    );
    expect(fixture.readWord).not.toHaveBeenCalled();
    expect(fixture.readPrimaryWords).not.toHaveBeenCalled();
    expect(fixture.mutations).toEqual([]);
  });

  it("still refuses same-level kanji when placing words outside Foundation", async () => {
    const batch = { ...buildMainCourseWordBatch(), levelNumber: 3 };
    const fixture = harness([batch]);
    // The batch includes reviewed level-3 prerequisites such as 上.
    await expect(applyMainCourseWordBatch(fixture.db, batch)).rejects.toThrow("earlier kanji");
    expect(fixture.mutations).toEqual([]);
  });

  it("blocks an unreviewed third batch before any database read or write", async () => {
    const batches = thirdPendingFixtureBatches();
    const fixture = harness(batches);
    await expect(
      applyMainCourseWordBatches(fixture.db, {
        batches,
        batchId: batches[2]!.id,
      }),
    ).rejects.toThrow("needs independent parent review");
    await expect(applyMainCourseWordBatch(fixture.db, batches[2]!)).rejects.toThrow(
      "needs independent parent review",
    );
    expect(fixture.readCourse).not.toHaveBeenCalled();
    expect(fixture.readWord).not.toHaveBeenCalled();
    expect(fixture.readPrimaryWords).not.toHaveBeenCalled();
    expect(fixture.transaction).not.toHaveBeenCalled();
    expect(fixture.mutations).toEqual([]);
  });

  it("preflights all three batches with synthetic evidence and skips pending third-batch writes", async () => {
    const batches = thirdPendingFixtureBatches();
    // Synthetic database fixtures are not live source evidence.
    const fixture = harness(batches);
    const plans = await planMainCourseWordBatches(fixture.db, batches);
    expect(plans.map((entry) => entry.plan.words.length)).toEqual([20, 20, 20]);
    expect(fixture.mutations).toEqual([]);
    const onProgress = vi.fn();
    const result = await applyMainCourseWordBatches(fixture.db, { batches, onProgress });
    expect(result).toMatchObject({
      preflightedBatchIds: batches.map((batch) => batch.id),
      skippedUnreviewedBatchIds: [batches[2]!.id],
      batches: [{ batchId: batches[0]!.id }, { batchId: batches[1]!.id }],
    });
    expect(fixture.state.cards.size).toBe(80);
    expect(onProgress.mock.calls.flat()).toEqual(
      batches.slice(0, 2).map((batch, index) => ({
        phase: "word-manifests-published",
        batchId: batch.id,
        completed: index + 1,
        total: 2,
      })),
    );
    for (const word of batches[2]!.words)
      expect(
        [...fixture.state.items.values()].some(
          (item) => item.targetId === `word-${word.expression}`,
        ),
      ).toBe(false);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });

  it("ignores missing future evidence for an explicit release but reports it for a full plan", async () => {
    const batches = thirdPendingFixtureBatches();
    const fixture = harness(batches);
    fixture.state.words.get(batches[2]!.words.at(-1)!.expression)!.importedRecord.importRun.status =
      "FAILED";
    await expect(planMainCourseWordBatches(fixture.db, batches)).rejects.toThrow("provenance");
    await expect(
      planMainCourseWordBatches(fixture.db, batches, { batchId: batches[0]!.id }),
    ).resolves.toMatchObject([{ batchId: batches[0]!.id }]);
    expect(fixture.transaction).not.toHaveBeenCalled();
    await expect(
      applyMainCourseWordBatches(fixture.db, {
        batches,
        batchId: batches[0]!.id,
      }),
    ).resolves.toMatchObject({
      preflightedBatchIds: [batches[0]!.id],
      skippedUnreviewedBatchIds: [batches[2]!.id],
      batches: [{ batchId: batches[0]!.id }],
    });
  });

  it("preflights the last word of every selected batch before any mutation", async () => {
    const batches = registryFixtureBatches();
    const fixture = harness(batches);
    fixture.state.words.get(batches[1]!.words.at(-1)!.expression)!.importedRecord.importRun.status =
      "FAILED";
    await expect(
      applyMainCourseWordBatches(fixture.db, { batches, batchIds: batches.map(({ id }) => id) }),
    ).rejects.toThrow("provenance");
    expect(fixture.readPrimaryWords).toHaveBeenCalledTimes(batches.length);
    expect(fixture.mutations).toEqual([]);
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it("rejects duplicate registry identities outside the explicit selection before reads", async () => {
    const [first, second] = registryFixtureBatches();
    const batches = [first!, { ...second!, id: first!.id }];
    const fixture = harness();
    const selection = { batchId: first!.id };
    await expect(planMainCourseWordBatches(fixture.db, batches, selection)).rejects.toThrow(
      "Invalid word batch registry",
    );
    await expect(applyMainCourseWordBatches(fixture.db, { batches, ...selection })).rejects.toThrow(
      "Invalid word batch registry",
    );
    expect(fixture.readCourse).not.toHaveBeenCalled();
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it("preflights pending registry entries read-only and applies only reviewed batches by default", async () => {
    const batches = registryFixtureBatches().map((batch, index) =>
      index === 1 ? { ...batch, reviewedAt: null } : batch,
    );
    const fixture = harness(batches);
    expect(
      (await planMainCourseWordBatches(fixture.db, batches)).map(
        (entry) => entry.plan.words.length,
      ),
    ).toEqual([20, 20]);
    expect(fixture.mutations).toEqual([]);
    const result = await applyMainCourseWordBatches(fixture.db, { batches });
    expect(result).toMatchObject({
      preflightedBatchIds: batches.map((batch) => batch.id),
      skippedUnreviewedBatchIds: [batches[1]!.id],
      batches: [{ batchId: batches[0]!.id, words: 20 }],
    });
    expect(fixture.state.cards.size).toBe(40);
    expect([...fixture.state.items.values()].filter((item) => item.kind === "WORD")).toHaveLength(
      20,
    );
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
    expect(buildMainCourseWordBatches()[1]!.reviewedAt).toBe("2026-10-22");
  });

  it("blocks unknown, conflicting and explicitly selected pending batches before database reads", async () => {
    const batches = registryFixtureBatches().map((batch, index) =>
      index === 1 ? { ...batch, reviewedAt: null } : batch,
    );
    for (const options of [
      { batches, batchId: "unknown" },
      { batches, batchId: batches[1]!.id },
      { batches: [batches[0]!, { ...batches[1]!, id: batches[0]!.id }] },
    ]) {
      const fixture = harness(batches);
      await expect(applyMainCourseWordBatches(fixture.db, options)).rejects.toThrow();
      expect(fixture.readCourse).not.toHaveBeenCalled();
      expect(fixture.mutations).toEqual([]);
    }
    expect(buildMainCourseWordBatches()[1]!.reviewedAt).toBe("2026-10-22");
  });

  it("applies only a selected new batch without recreating first-batch answers or touching private progress", async () => {
    const batches = registryFixtureBatches().map((batch) => ({
      ...batch,
      reviewedAt: "2026-10-22",
    }));
    const fixture = harness(batches);
    await applyMainCourseWordBatch(fixture.db, batches[0]);
    const protectedBefore = structuredClone(fixture.state);
    const privateBefore = structuredClone(fixture.privateRows);
    const result = await applyMainCourseWordBatches(fixture.db, {
      batches,
      batchId: batches[1]!.id,
    });
    expect(result.batches.map((batch) => batch.batchId)).toEqual([batches[1]!.id]);
    expect(fixture.state.cards.size).toBe(80);
    expect(fixture.state.mnemonics.size).toBe(160);
    expect(fixture.state.hints.size).toBe(160);
    for (const name of Object.keys(protectedBefore) as (keyof typeof protectedBefore)[]) {
      for (const [identity, row] of protectedBefore[name])
        expect(fixture.state[name].get(identity), `${name}:${identity}`).toEqual(row);
    }
    expect(fixture.privateRows).toEqual(privateBefore);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
    const identities = fixture.identities();
    await applyMainCourseWordBatches(fixture.db, { batches, batchId: batches[1]!.id });
    expect(fixture.identities()).toEqual(identities);
    for (const [identity, answer] of protectedBefore.answers)
      expect(fixture.state.answers.get(identity)).toEqual(answer);
  });

  it.each(["unknown", "other-entry", "missing-en", "other-locale", "other-record"])(
    "rejects %s alternative reading on the last word before any mutation",
    async (condition) => {
      const fixture = alternativeReadingFixture();
      if (condition === "unknown") fixture.state.words.delete("日本:にっぽん");
      if (condition === "other-entry") fixture.alternative.jmdictEntryId = "jmdict:0";
      if (condition === "missing-en")
        fixture.alternative.senses = fixture.alternative.senses.filter(
          (sense) => sense.locale !== "en-US",
        );
      if (condition === "other-locale")
        fixture.alternative.senses = fixture.alternative.senses.map((sense) =>
          sense.locale === "en-US" ? { ...sense, locale: "de-DE" } : sense,
        );
      if (condition === "other-record") {
        fixture.alternative.importedRecord = structuredClone(fixture.alternative.importedRecord);
        fixture.alternative.importedRecord.id = "other-record";
        fixture.alternative.jmdictImportedRecordId = "other-record";
      }
      await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow();
      expect(fixture.mutations).toEqual([]);
      expect(fixture.transaction).not.toHaveBeenCalled();
    },
  );

  it("accepts source-verified primary and alternate readings on the same two cards with only the primary marked primary", async () => {
    const fixture = alternativeReadingFixture();
    const result = await applyMainCourseWordBatch(fixture.db, fixture.batch);
    expect(result).toMatchObject({ words: 20, cards: 40, examples: 20 });
    const item = fixture.state.items.get(key({ targetType: "WORD", targetId: "word-日本" }))!;
    const cards = [...fixture.state.cards.values()].filter(
      (card) => card.learningItemId === item.id,
    );
    expect(cards).toHaveLength(2);
    const reading = cards.find((card) => card.promptType === "READING")!;
    expect(
      [...fixture.state.answers.values()]
        .filter((answer) => answer.learningCardId === reading.id)
        .map((answer) => [answer.text, answer.isPrimary]),
    ).toEqual([
      ["にほん", true],
      ["にっぽん", false],
    ]);
    expect(
      [...fixture.state.items.values()].some(
        (candidate) => candidate.targetId === fixture.alternative.id,
      ),
    ).toBe(false);
    expect(fixture.state.cards.size).toBe(40);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });
  it("accepts a separately bound exact bilingual entry without changing the primary target", async () => {
    const fixture = alternativeReadingFixture();
    const word = fixture.batch.words.at(-1)!;
    Object.assign(word, { acceptedReadingEntryIds: { にっぽん: "jmdict:9999" } });
    Object.assign(fixture.alternative, {
      jmdictEntryId: "jmdict:9999",
      jmdictImportedRecordId: "separate-record",
      importedRecord: {
        ...structuredClone(fixture.alternative.importedRecord),
        id: "separate-record",
        sourceRecordId: "jmdict:9999",
        rawJson: { ...fixture.alternative.importedRecord.rawJson, sequence: "9999" },
      },
    });
    await applyMainCourseWordBatch(fixture.db, fixture.batch);
    expect([...fixture.state.answers.values()].some((a) => a.text === "にっぽん")).toBe(true);
    expect(
      [...fixture.state.items.values()].some((i) => i.targetId === fixture.alternative.id),
    ).toBe(false);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });
  it.each(["missing", "pending", "version", "checksum", "body", "license"])(
    "refuses %s sense-note proof before any mutation",
    async (condition) => {
      const fixture = readingNoteFixture();
      if (condition === "missing") fixture.readProof.mockResolvedValue(null);
      if (condition === "pending") fixture.proof.importRun.status = "PENDING";
      if (condition === "version") fixture.proof.importRun.sourceVersion = "different";
      if (condition === "checksum") fixture.proof.importRun.checksumSha256 = "f".repeat(64);
      if (condition === "body") fixture.proof.rawJson.note = "A different note";
      if (condition === "license")
        fixture.proof.importRun.dataSource.license.scope = "PROJECT_AUTHORED";
      await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
        "sense-note proof",
      );
      expect(fixture.mutations).toEqual([]);
      expect(fixture.transaction).not.toHaveBeenCalled();
    },
  );
  it("accepts a verified entry note without fabricating an exact alternate Word row", async () => {
    const fixture = readingNoteFixture();
    await applyMainCourseWordBatch(fixture.db, fixture.batch);
    expect(
      [...fixture.state.answers.values()].some((a) => a.text === "さん" && a.isPrimary === false),
    ).toBe(true);
    expect(
      [...fixture.state.records.values()].some((r) =>
        JSON.stringify(r.rawJson).includes("noteEvidence"),
      ),
    ).toBe(true);
    expect(fixture.state.words.has("山:さん")).toBe(false);
    expect(fixture.readProof).toHaveBeenCalledTimes(2);
    expect(fixture.privateRows).toEqual(fixture.privateBefore);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });
  it("rechecks note proofs inside the teaching transaction after preflight", async () => {
    const fixture = readingNoteFixture();
    const before = structuredClone(fixture.state.items);
    fixture.readProof.mockResolvedValueOnce(fixture.proof).mockResolvedValue(null);
    await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
      "sense-note proof",
    );
    expect(fixture.state.items).toEqual(before);
    expect(fixture.state.answers.size).toBe(0);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });
  it("blocks all reads and writes for an unreviewed manifest", async () => {
    const fixture = harness();
    await expect(
      applyMainCourseWordBatch(fixture.db, { ...buildMainCourseWordBatch(), reviewedAt: null }),
    ).rejects.toThrow("needs independent parent review");
    expect(fixture.readWord).not.toHaveBeenCalled();
    expect(fixture.readPrimaryWords).not.toHaveBeenCalled();
    expect(fixture.readCourse).not.toHaveBeenCalled();
    expect(fixture.mutations).toEqual([]);
  });

  it("plans all twenty exact source pairs and registered earlier prerequisites without mutations", async () => {
    const fixture = harness();
    const plan = await planMainCourseWordBatch(fixture.db);
    expect(plan.words).toHaveLength(20);
    expect(plan.words[0]).toMatchObject({
      wordId: "word-山",
      prerequisiteItemIds: ["kanji-item-山"],
      sourceEvidence: {
        sourceRecordId: "jmdict:1302680",
        sourceVersion: "fixture-v1",
        checksumSha256: "f".repeat(64),
      },
    });
    expect(fixture.readPrimaryWords).toHaveBeenCalledExactlyOnceWith({
      where: {
        OR: fixture.batch.words.map(({ expression, reading }) => ({ expression, reading })),
      },
      select: expect.objectContaining({
        senses: expect.anything(),
        importedRecord: expect.anything(),
      }),
    });
    expect(plan.words.map(({ content, wordId }) => [content, wordId])).toEqual(
      fixture.batch.words.map((content) => [content, `word-${content.expression}`]),
    );
    expect(fixture.readWord).not.toHaveBeenCalled();
    expect(fixture.mutations).toEqual([]);
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it("loads a 200-word manifest in one primary query and rejects oversized manifests before reading", async () => {
    const base = buildMainCourseWordBatch();
    const template = base.words[0]!;
    const sortOrderStart = 10_000;
    const words = Array.from({ length: 201 }, (_, index) => {
      const expression = `${template.expression}${index}`;
      return {
        ...template,
        expression,
        sortOrder: sortOrderStart + index,
        example: { ...template.example, japaneseText: expression },
      };
    });
    const batch = { ...base, wordCount: 200, sortOrderStart, words: words.slice(0, 200) };
    const fixture = harness([batch]);
    expect((await planMainCourseWordBatch(fixture.db, batch)).words).toHaveLength(200);
    expect(fixture.readPrimaryWords).toHaveBeenCalledOnce();
    expect(fixture.readPrimaryWords.mock.calls[0]![0].where.OR).toHaveLength(200);
    expect(fixture.readWord).not.toHaveBeenCalled();

    await expect(
      planMainCourseWordBatch(fixture.db, { ...batch, wordCount: words.length, words }),
    ).rejects.toThrow("Word batch size must be a safe integer from 1 to 200");
    expect(fixture.readPrimaryWords).toHaveBeenCalledOnce();
    expect(fixture.mutations).toEqual([]);
  });

  it("accepts the real bounded-import compact provenance with exact canonical word and RU/EN senses", async () => {
    const fixture = harness();
    for (const word of fixture.state.words.values()) {
      Object.assign(word.importedRecord, {
        rawJson: {
          sequence: word.jmdictEntryId.slice(7),
          importedWordCount: 1,
          retainedLocales: ["en-US", "ru-RU"],
        },
      });
    }
    expect((await planMainCourseWordBatch(fixture.db)).words).toHaveLength(20);
    await applyMainCourseWordBatch(fixture.db, fixture.batch);
    expect(fixture.readPrimaryWords).toHaveBeenCalledTimes(2);
    const { select } = fixture.readPrimaryWords.mock.calls[0]![0];
    expect(fixture.readWord.mock.calls).toEqual(
      fixture.batch.words.map(({ expression, reading }) => [
        { where: { expression_reading: { expression, reading } }, select },
      ]),
    );
    expect(fixture.mutations.length).toBeGreaterThan(0);
  });

  it.each([
    "missing-ru",
    "other-locale",
    "no-words",
    "fractional-count",
    "wrong-sequence",
    "mixed-full",
    "missing-canonical-ru",
  ])("rejects malformed compact provenance: %s", async (condition) => {
    const fixture = harness();
    const last = fixture.state.words.get("月")!;
    const raw: Record<string, unknown> = {
      sequence: last.jmdictEntryId.slice(7),
      importedWordCount: 1,
      retainedLocales: ["en-US", "ru-RU"],
    };
    if (condition === "missing-ru") raw.retainedLocales = ["en-US"];
    if (condition === "other-locale") raw.retainedLocales = ["en-US", "ru-RU", "de-DE"];
    if (condition === "no-words") raw.importedWordCount = 0;
    if (condition === "fractional-count") raw.importedWordCount = 1.5;
    if (condition === "wrong-sequence") raw.sequence = "0";
    if (condition === "mixed-full") raw.readingElements = [{ reading: "げつ" }];
    if (condition === "missing-canonical-ru")
      last.senses = last.senses.filter((sense) => sense.locale !== "ru-RU");
    Object.assign(last.importedRecord, { rawJson: raw });
    await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow();
    expect(fixture.mutations).toEqual([]);
  });

  it.each([
    "missing",
    "pair",
    "ambiguous",
    "entry",
    "record",
    "status",
    "version",
    "unknown-version",
    "checksum",
    "license",
    "source-url",
    "raw-reading",
    "restriction",
    "raw-ru",
    "canonical-en",
  ])("rejects bad %s evidence on the last word before any mutation", async (condition) => {
    const fixture = harness();
    const last = fixture.state.words.get("月")!;
    const run = last.importedRecord.importRun;
    if (condition === "missing") fixture.state.words.delete(last.expression);
    if (condition === "pair" || condition === "ambiguous") {
      const read = fixture.readPrimaryWords.getMockImplementation()!;
      fixture.readPrimaryWords.mockImplementationOnce(async (...args) => {
        const rows = await read(...args);
        return condition === "pair"
          ? rows.map((row) => (row.id === last.id ? { ...row, reading: "げつ" } : row))
          : [...rows, { ...last, id: "duplicate" }];
      });
    }
    if (condition === "entry") last.jmdictEntryId = "jmdict:0";
    if (condition === "record") last.importedRecord.sourceRecordId = "jmdict:0";
    if (condition === "status") run.status = "FAILED";
    if (condition === "version") run.sourceVersion = null;
    if (condition === "unknown-version") run.sourceVersion = " UNKNOWN ";
    if (condition === "checksum") run.checksumSha256 = "invalid";
    if (condition === "license") run.dataSource.license.scope = "USER_PRIVATE";
    if (condition === "source-url") run.dataSource.homepageUrl = "https://";
    if (condition === "raw-reading")
      last.importedRecord.rawJson.readingElements[0]!.reading = "げつ";
    if (condition === "restriction")
      last.importedRecord.rawJson.readingElements[0]!.restrictions = ["other-expression"];
    if (condition === "raw-ru")
      last.importedRecord.rawJson.senses[0]!.glosses =
        last.importedRecord.rawJson.senses[0]!.glosses.filter((gloss) => gloss.locale !== "ru-RU");
    if (condition === "canonical-en")
      last.senses = last.senses.filter((sense) => sense.locale !== "en-US");
    await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
      "Word 月/つき",
    );
    expect(fixture.readPrimaryWords).toHaveBeenCalledOnce();
    expect(fixture.readWord).not.toHaveBeenCalled();
    expect(fixture.mutations).toEqual([]);
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it.each(["unpublished", "wrong-kind", "unplaced", "other-course", "moved"])(
    "does not waive a %s registered kanji prerequisite",
    async (condition) => {
      const fixture = harness();
      const item = fixture.state.items.get(key({ targetType: "KANJI", targetId: "kanji-山" }))!;
      if (condition === "unpublished") item.status = "DRAFT";
      if (condition === "wrong-kind") item.kind = "WORD";
      const placement = [...fixture.state.placements.values()].find(
        (row) => row.learningItemId === item.id,
      )!;
      if (condition === "unplaced")
        fixture.state.placements.delete(
          key({ courseLevelId: placement.courseLevelId, learningItemId: item.id }),
        );
      if (condition === "other-course") placement.courseId = "another-course";
      if (condition === "moved") placement.sortOrder = 99;
      await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
        "not published at its registered earlier",
      );
      expect(fixture.mutations).toEqual([]);
    },
  );

  it("rejects a registered prerequisite missing from the batched raw kanji response", async () => {
    const fixture = harness();
    const readKanji = fixture.readKanji.getMockImplementation()!;
    fixture.readKanji.mockImplementationOnce(async (args) =>
      (await readKanji(args)).filter(({ character }) => character !== "山"),
    );
    await expect(planMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
      "Missing registered kanji 山",
    );
    expect(fixture.mutations).toEqual([]);
  });

  it("rejects unregistered kanji in an example rather than using a globally published fallback", async () => {
    const fixture = harness();
    const first = fixture.batch.words[0]!;
    const batch = {
      ...fixture.batch,
      words: [
        { ...first, example: { ...first.example, japaneseText: "山から龍をみます。" } },
        ...fixture.batch.words.slice(1),
      ],
    };
    await expect(applyMainCourseWordBatch(fixture.db, batch)).rejects.toThrow(
      "Unregistered earlier kanji prerequisite 龍",
    );
    expect(fixture.mutations).toEqual([]);
    expect(fixture.readWord).not.toHaveBeenCalled();
    expect(fixture.readPrimaryWords).not.toHaveBeenCalled();
  });

  it("blocks a last-slot collision, an existing moved word and imported sense collisions", async () => {
    const occupied = harness();
    occupied.state.placements.set("unrelated", {
      id: "unrelated",
      courseId: "main",
      courseLevelId: "level-5",
      sortOrder: 20,
      learningItemId: "unrelated",
    });
    await expect(applyMainCourseWordBatch(occupied.db, occupied.batch)).rejects.toThrow(
      "is occupied",
    );
    expect(occupied.mutations).toEqual([]);

    const moved = harness();
    moved.state.placements.set("moved-word", {
      id: "moved-word",
      courseId: "main",
      courseLevelId: "level-4",
      sortOrder: 99,
      learningItemId: "existing-word-item",
    });
    await expect(applyMainCourseWordBatch(moved.db, moved.batch)).rejects.toThrow(
      "Refusing to move",
    );
    expect(moved.mutations).toEqual([]);

    const senses = harness();
    senses.state.words.get("山")!.senses.push({
      locale: "ru-RU",
      meaning: "гора",
      partOfSpeech: AUTHORED_WORD_PART_OF_SPEECH,
      sourceKind: "IMPORTED",
    });
    await expect(applyMainCourseWordBatch(senses.db, senses.batch)).rejects.toThrow(
      "Authored sense collision",
    );
    expect(senses.mutations).toEqual([]);
  });

  it("protects imported meaning/reading text while leaving unrelated imported stories alone", async () => {
    const fixture = harness();
    const importedHint = {
      id: "imported-hint",
      learningItemId: "existing-word-item",
      locale: "ru-RU",
      version: 1,
      hintType: "READING",
      sourceKind: "IMPORTED",
      body: "source hint",
    };
    fixture.state.hints.set("imported-hint", importedHint);
    await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
      "Non-project teaching text",
    );
    expect(fixture.mutations).toEqual([]);
    fixture.state.hints.clear();
    const story = {
      id: "imported-story",
      learningItemId: "existing-word-item",
      locale: "en-US",
      version: 1,
      mnemonicType: "STORY",
      sourceKind: "IMPORTED",
      body: "source story",
    };
    fixture.state.mnemonics.set("imported-story", story);
    await applyMainCourseWordBatch(fixture.db, fixture.batch);
    expect(fixture.state.mnemonics.get("imported-story")).toEqual(story);
  });

  it.each(["license", "source", "example"])(
    "blocks conflicting existing %s ownership before retry mutations",
    async (condition) => {
      const fixture = harness();
      await applyMainCourseWordBatch(fixture.db, fixture.batch);
      if (condition === "license") [...fixture.state.licenses.values()][0]!.scope = "OPEN_DATA";
      if (condition === "source")
        [...fixture.state.sources.values()][0]!.homepageUrl = "https://foreign.invalid/";
      if (condition === "example")
        [...fixture.state.records.values()][0]!.recordType = "TATOEBA_SENTENCE";
      fixture.mutations.length = 0;
      await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
        "Conflicting",
      );
      expect(fixture.mutations).toEqual([]);
    },
  );

  it("creates forty stable cards, stage-two prerequisites and twenty traced examples without sentence learning items", async () => {
    const fixture = harness();
    const importedBefore = structuredClone(fixture.state.words);
    const result = await applyMainCourseWordBatch(fixture.db, fixture.batch);
    expect(result).toMatchObject({ words: 20, cards: 40, examples: 20 });
    expect(fixture.state.words).toEqual(importedBefore);
    expect(fixture.state.cards.size).toBe(40);
    expect(fixture.db.learningCard.createManyAndReturn).toHaveBeenCalledTimes(19);
    expect(fixture.db.learningCard.upsert).toHaveBeenCalledTimes(2);
    expect(fixture.db.mnemonic.createMany).toHaveBeenCalledTimes(19);
    expect(fixture.db.mnemonic.upsert).toHaveBeenCalledTimes(4);
    expect(fixture.db.hint.createMany).toHaveBeenCalledTimes(19);
    expect(fixture.db.hint.upsert).toHaveBeenCalledTimes(4);
    expect(fixture.state.mnemonics.size).toBe(80);
    expect(fixture.state.hints.size).toBe(80);
    expect(fixture.state.sentences.size).toBe(20);
    expect(fixture.state.examples.size).toBe(20);
    expect([...fixture.state.examples.values()].every((row) => row.status === "PUBLISHED")).toBe(
      true,
    );
    expect([...fixture.state.dependencies.values()].every((row) => row.requiredStage === 2)).toBe(
      true,
    );
    expect(fixture.state.dependencies.size).toBe(20);
    expect(
      [...fixture.state.items.values()].filter(
        (item) => item.targetType === "WORD" && item.status === "PUBLISHED",
      ),
    ).toHaveLength(20);
    expect([...fixture.state.items.values()].some((item) => item.targetType === "SENTENCE")).toBe(
      false,
    );
    const mountainReading = [...fixture.state.cards.values()].find(
      (card) => card.learningItemId === "existing-word-item" && card.promptType === "READING",
    )!;
    expect(
      [...fixture.state.answers.values()]
        .filter((answer) => answer.learningCardId === mountainReading.id)
        .map((answer) => answer.text),
    ).toEqual(["やま"]);
    const river = fixture.state.items.get(key({ targetType: "WORD", targetId: "word-川" }))!;
    const riverReading = [...fixture.state.cards.values()].find(
      (card) => card.learningItemId === river.id && card.promptType === "READING",
    )!;
    expect(
      [...fixture.state.answers.values()]
        .filter(({ learningCardId }) => learningCardId === riverReading.id)
        .map(({ text }) => text),
    ).toEqual(["かわ"]);
    const firstSuccess = fixture.events.indexOf("run:SUCCESS");
    expect(
      fixture.events.slice(0, firstSuccess).filter((event) => event === "example:DRAFT"),
    ).toHaveLength(20);
    expect(fixture.events.slice(0, firstSuccess)).not.toContain("example:PUBLISHED");
    expect(fixture.events.filter((event) => event === "example:PUBLISHED")).toHaveLength(20);
    expect(
      [...fixture.state.records.values()].every(
        (record) =>
          record.recordType === "PROJECT_AUTHORED" && record.importRunId === result.importRunId,
      ),
    ).toBe(true);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });

  it("reapplies without changing imported rows, existing card IDs, example IDs or private progress", async () => {
    const fixture = harness();
    const privateBefore = structuredClone(fixture.privateRows);
    const importedBefore = structuredClone(fixture.state.words);
    const initialCardIds = [...fixture.state.cards.values()].map((row) => row.id);
    await applyMainCourseWordBatch(fixture.db, fixture.batch);
    const identities = fixture.identities();
    await applyMainCourseWordBatch(fixture.db, fixture.batch);
    expect(fixture.identities()).toEqual(identities);
    expect(fixture.state.words).toEqual(importedBefore);
    expect(fixture.privateRows).toEqual(privateBefore);
    expect(
      initialCardIds.every((id) => [...fixture.state.cards.values()].some((row) => row.id === id)),
    ).toBe(true);
    expect(fixture.state.runs.size).toBe(1);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });

  it("retains earlier draft work, rolls back an interrupted word and resumes without duplicates", async () => {
    const fixture = harness();
    fixture.failWord("川");
    await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
      "test word interruption",
    );
    expect([...fixture.state.runs.values()][0]?.status).toBe("FAILED");
    expect([...fixture.state.examples.values()].map((row) => row.status)).toEqual(["DRAFT"]);
    expect(fixture.state.items.has(key({ targetType: "WORD", targetId: "word-川" }))).toBe(false);
    expect(fixture.state.senses.size).toBe(2);
    expect(fixture.events).not.toContain("run:SUCCESS");
    const firstSentenceId = [...fixture.state.sentences.values()][0]!.id;
    fixture.failWord(null);
    await applyMainCourseWordBatch(fixture.db, fixture.batch);
    expect([...fixture.state.sentences.values()][0]!.id).toBe(firstSentenceId);
    expect(fixture.state.sentences.size).toBe(20);
    expect(fixture.state.cards.size).toBe(40);
    expect([...fixture.state.examples.values()].every((row) => row.status === "PUBLISHED")).toBe(
      true,
    );
  });

  it("rolls back premature SUCCESS and all publication when the fourth real helper validation fails", async () => {
    const fixture = harness();
    fixture.failPublicationAt(4);
    await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow(
      "Cannot publish a word example",
    );
    expect([...fixture.state.runs.values()][0]?.status).toBe("FAILED");
    expect([...fixture.state.examples.values()].every((row) => row.status === "DRAFT")).toBe(true);
    expect(
      [...fixture.state.items.values()].filter(
        (row) => row.targetType === "WORD" && row.status === "PUBLISHED",
      ),
    ).toHaveLength(1);
    const identities = fixture.identities();
    fixture.failPublicationAt(null);
    await applyMainCourseWordBatch(fixture.db, fixture.batch);
    expect(fixture.identities()).toEqual(identities);
    expect([...fixture.state.runs.values()][0]?.status).toBe("SUCCESS");
    expect([...fixture.state.examples.values()].every((row) => row.status === "PUBLISHED")).toBe(
      true,
    );
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });
});

type Row = Record<string, unknown> & { id: string };
type UpsertArgs = {
  where: Record<string, unknown>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};
function key(value: unknown): string {
  return JSON.stringify(value);
}

function wordSource(content: MainCourseWordContent) {
  return {
    id: `word-${content.expression}`,
    expression: content.expression,
    reading: content.reading,
    jmdictEntryId: content.jmdictEntryId,
    jmdictImportedRecordId: `raw-${content.expression}`,
    senses: [
      {
        locale: "ru-RU",
        meaning: "исходное словарное значение",
        partOfSpeech: "noun",
        sourceKind: "IMPORTED",
      },
      {
        locale: "en-US",
        meaning: "source dictionary meaning",
        partOfSpeech: "noun",
        sourceKind: "IMPORTED",
      },
    ],
    importedRecord: {
      id: `raw-${content.expression}`,
      recordType: "JMDICT_ENTRY",
      sourceRecordId: content.jmdictEntryId,
      rawJson: {
        sequence: content.jmdictEntryId.slice(7),
        kanjiElements: [{ expression: content.expression }],
        readingElements: [{ reading: content.reading, restrictions: [] as string[] }],
        senses: [
          {
            glosses: [
              { locale: "ru-RU", text: "исходное значение" },
              { locale: "en-US", text: "source meaning" },
            ],
          },
        ],
      },
      importRun: {
        id: "jmdict-run",
        dataSourceId: "jmdict-source",
        status: "SUCCESS",
        sourceVersion: "fixture-v1" as string | null,
        checksumSha256: "f".repeat(64),
        dataSource: {
          id: "jmdict-source",
          name: "JMdict",
          licenseId: "jmdict-license",
          homepageUrl: "https://www.edrdg.org/",
          attributionText: "Synthetic JMdict metadata fixture, not imported educational content.",
          license: {
            id: "jmdict-license",
            name: "EDRDG JMdict license",
            scope: "OPEN_DATA",
            spdxLikeId: "LicenseRef-JMdict-Multilingual",
            url: "https://www.edrdg.org/edrdg/licence.html",
            requiresAttribution: true,
          },
        },
      },
    },
  };
}

function thirdPendingFixtureBatches(): readonly MainCourseWordBatch[] {
  return buildMainCourseWordBatches()
    .slice(0, 3)
    .map((batch, index) => (index === 2 ? { ...batch, reviewedAt: null } : batch));
}

function registryFixtureBatches(): readonly MainCourseWordBatch[] {
  // Preserve the approved two-batch scenarios independently of pending additions.
  return buildMainCourseWordBatches().slice(0, 2);
}

function alternativeReadingFixture() {
  const first = buildMainCourseWordBatch();
  const japan = buildMainCourseWordBatches()[1]!.words.find(
    (content) => content.expression === "日本",
  )!;
  const batch = { ...first, words: [...first.words.slice(0, -1), { ...japan, sortOrder: 20 }] };
  const fixture = harness([batch]);
  const alternative = fixture.state.words.get("日本:にっぽん")!;
  return { ...fixture, alternative };
}

function readingNoteFixture() {
  const base = buildMainCourseWordBatch();
  const word = base.words[0]!;
  const note: JmdictReadingNote = {
    reading: "さん",
    sourceRecordId: word.jmdictEntryId,
    sourceVersion: "2026-10-31",
    sourceDocumentSha256: "a".repeat(64),
    note: "also さん (all senses)",
  };
  const content = { ...word, sourceNoteReadings: [note] };
  const batch = { ...base, words: [content, ...base.words.slice(1)] };
  const fixture = harness([batch]);
  const primary = fixture.state.words.get(word.expression)!;
  const proof = {
    ...structuredClone(primary.importedRecord),
    id: "note-proof-record",
    rawJson: readingNoteProofData(content, note),
    importRun: {
      ...structuredClone(primary.importedRecord.importRun),
      id: "note-proof-run",
      sourceVersion: note.sourceVersion,
      checksumSha256: readingNoteProofChecksum(content, note),
    },
  };
  const readProof = vi.fn(async () => proof as typeof proof | null);
  Object.assign(fixture.db.importedRecord, { findFirst: readProof });
  return { ...fixture, proof, readProof, privateBefore: structuredClone(fixture.privateRows) };
}

function largePublicationFixture(count: number): MainCourseWordBatch {
  const batch = structuredClone(
    count === 20
      ? buildMainCourseWordBatch()
      : buildMainCourseWordBatches().find((batch) => batch.words.length === count)!,
  );
  // Synthetic dictionary rows isolate finalization; explicit real-source proofs
  // are exercised by their own provenance and rollback tests above.
  return {
    ...batch,
    words: batch.words.map((word) => ({
      ...word,
      sourceNoteReadings: undefined,
      acceptedReadingEntryIds: undefined,
    })),
  };
}

function harness(batches: readonly MainCourseWordBatch[] = [buildMainCourseWordBatch()]) {
  const batch = { ...batches[0]!, reviewedAt: "2026-10-22" };
  const words = new Map<string, ReturnType<typeof wordSource>>();
  for (const content of batches.flatMap((entry) => entry.words)) {
    const primary = wordSource(content);
    primary.importedRecord.rawJson.readingElements = [
      content.reading,
      ...(content.acceptedReadings ?? []),
    ].map((reading) => ({ reading, restrictions: [] }));
    words.set(content.expression, primary);
    for (const reading of content.acceptedReadings ?? [])
      words.set(`${content.expression}:${reading}`, {
        ...primary,
        id: `${primary.id}:${reading}`,
        reading,
        senses: [...primary.senses],
      });
  }
  const state = {
    words,
    items: new Map<string, Row>(),
    placements: new Map<string, Row>(),
    cards: new Map<string, Row>(),
    answers: new Map<string, Row>(),
    senses: new Map<string, Row>(),
    mnemonics: new Map<string, Row>(),
    hints: new Map<string, Row>(),
    dependencies: new Map<string, Row>(),
    licenses: new Map<string, Row>(),
    sources: new Map<string, Row>(),
    runs: new Map<string, Row>(),
    records: new Map<string, Row>(),
    sentences: new Map<string, Row>(),
    examples: new Map<string, Row>(),
  };
  for (const content of buildMainCourseContentBatches().flatMap((entry) => entry.kanji)) {
    const item = {
      id: `kanji-item-${content.character}`,
      targetId: `kanji-${content.character}`,
      targetType: "KANJI",
      kind: "KANJI",
      status: "PUBLISHED",
    };
    state.items.set(key({ targetType: "KANJI", targetId: item.targetId }), item);
    state.placements.set(
      key({ courseLevelId: `level-${content.levelNumber}`, learningItemId: item.id }),
      {
        id: `kanji-slot-${content.character}`,
        courseId: "main",
        courseLevelId: `level-${content.levelNumber}`,
        learningItemId: item.id,
        sortOrder: content.sortOrder,
      },
    );
  }
  state.items.set(key({ targetType: "WORD", targetId: "word-山" }), {
    id: "existing-word-item",
    targetId: "word-山",
    targetType: "WORD",
    kind: "WORD",
    status: "PUBLISHED",
  });
  for (const promptType of ["MEANING", "READING"]) {
    const identity = {
      learningItemId: "existing-word-item",
      promptType,
      answerType: promptType,
      locale: "ru-RU",
    };
    state.cards.set(key(identity), { id: `existing-${promptType}-card`, ...identity });
  }
  const privateRows = {
    srs: { learningCardId: "existing-MEANING-card", stageIndex: 5, dueAt: "2026-12-01" },
    override: { learningCardId: "existing-MEANING-card", text: "мой ответ" },
    mnemonic: { learningItemId: "existing-word-item", body: "личная заметка" },
  };
  const mutations: string[] = [];
  const events: string[] = [];
  let sequence = 0;
  let failedWord: string | null = null;
  let failedPublication: number | null = null;
  let beforePublication: (() => void) | undefined;
  const forbiddenMutation = vi.fn(() => {
    throw new Error("Imported content/private state must not be mutated.");
  });
  const byId = (table: Map<string, Row>, id: unknown) =>
    [...table.values()].find((row) => row.id === id);
  const insert = (
    table: Map<string, Row>,
    identity: Record<string, unknown>,
    data: Record<string, unknown>,
  ) => {
    const pair = key(identity);
    if (table.has(pair)) throw new Error("Test fixture cannot insert duplicate row.");
    const row = { ...data, id: `new-${++sequence}` };
    table.set(pair, row);
    return row;
  };
  const createTeachingText = (
    label: "mnemonic" | "hint",
    table: Map<string, Row>,
    promptKey: "mnemonicType" | "hintType",
  ) =>
    vi.fn(({ data }: { data: Record<string, unknown>[] }) => {
      mutations.push(`${label}.createMany`);
      for (const entry of data) {
        if (
          label === "hint" &&
          failedWord !== null &&
          byId(state.items, entry.learningItemId)?.targetId === `word-${failedWord}`
        )
          throw new Error("test word interruption");
        insert(
          table,
          {
            learningItemId: entry.learningItemId,
            locale: entry.locale,
            [promptKey]: entry[promptKey],
            version: entry.version,
          },
          entry,
        );
      }
      return { count: data.length };
    });
  const upsert = (label: string, table: Map<string, Row>, unique: string | null) =>
    vi.fn((args: UpsertArgs) => {
      mutations.push(label);
      const identity = key(unique === null ? args.where : args.where[unique]);
      const existing = table.get(identity);
      const data = existing === undefined ? args.create : args.update;
      if (
        label === "hint" &&
        failedWord !== null &&
        byId(state.items, data.learningItemId)?.targetId === `word-${failedWord}`
      )
        throw new Error("test word interruption");
      const row = {
        ...(existing ?? args.create),
        ...data,
        id: existing?.id ?? `new-${++sequence}`,
      } as Row;
      table.set(identity, row);
      if (label === "example") events.push(`example:${String(row.status)}`);
      if (label === "run") events.push(`run:${String(row.status)}`);
      return row;
    });
  const deleteMany = (label: string, table: Map<string, Row>) =>
    vi.fn(({ where }: { where: Record<string, unknown> }) => {
      mutations.push(label);
      for (const [identity, row] of table) if (matches(row, where)) table.delete(identity);
    });
  const updateMany = (label: string, table: Map<string, Row>) =>
    vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        mutations.push(label);
        let count = 0;
        for (const row of table.values()) {
          if (!matches(row, where)) continue;
          Object.assign(row, data);
          if (label === "example.updateMany") events.push(`example:${String(row.status)}`);
          count++;
        }
        return { count };
      },
    );
  const readCourse = vi.fn(async () => ({
    id: "main",
    levels: buildMainCourseBlueprint().levels.map((level) => ({
      ...level,
      id: `level-${level.levelNumber}`,
    })),
  }));
  type WordPair = { expression: string; reading: string };
  const wordWithSenses = (word: ReturnType<typeof wordSource>) => ({
    ...word,
    senses: [...word.senses, ...[...state.senses.values()].filter((row) => row.wordId === word.id)],
  });
  const readPrimaryWords = vi.fn(
    async ({ where }: { where: { OR: WordPair[] }; select: Record<string, unknown> }) =>
      [...state.words.values()]
        .filter((row) =>
          where.OR.some(
            ({ expression, reading }) => row.expression === expression && row.reading === reading,
          ),
        )
        .reverse()
        .map(wordWithSenses),
  );
  const readWord = vi.fn(async ({ where }: { where: { expression_reading: WordPair } }) => {
    const primary = state.words.get(where.expression_reading.expression);
    const word =
      primary?.reading === where.expression_reading.reading
        ? primary
        : state.words.get(
            `${where.expression_reading.expression}:${where.expression_reading.reading}`,
          );
    if (word === undefined || word.reading !== where.expression_reading.reading) return null;
    return wordWithSenses(word);
  });
  const sentenceWithProvenance = (sentence: Row) => {
    const record = byId(state.records, sentence.importedRecordId);
    return {
      ...sentence,
      dataSource: byId(state.sources, sentence.dataSourceId),
      license: byId(state.licenses, sentence.licenseId),
      importedRecord: record && { ...record, importRun: byId(state.runs, record.importRunId) },
    };
  };
  const readKanji = vi.fn(async ({ where }: { where: { character: { in: string[] } } }) =>
    where.character.in.map((character) => ({ id: `kanji-${character}`, character })),
  );
  const withKanjiPlacements = (item: Row) => ({
    ...item,
    courseLevelItems: [...state.placements.values()].filter(
      (row) => row.learningItemId === item.id && row.courseId === "main",
    ),
  });
  const withWordTeaching = (item: Row) => ({
    ...withKanjiPlacements(item),
    mnemonics: [...state.mnemonics.values()].filter((row) => row.learningItemId === item.id),
    hints: [...state.hints.values()].filter((row) => row.learningItemId === item.id),
  });
  const readKanjiItems = vi.fn(
    async ({ where }: { where: { targetType: string; targetId: { in: string[] } } }) =>
      [...state.items.values()]
        .filter(
          (item) =>
            item.targetType === where.targetType &&
            where.targetId.in.includes(String(item.targetId)),
        )
        .map(withKanjiPlacements),
  );
  const delegates = {
    course: { findUnique: readCourse },
    word: {
      findMany: readPrimaryWords,
      findUnique: readWord,
      upsert: forbiddenMutation,
      update: forbiddenMutation,
      deleteMany: forbiddenMutation,
    },
    kanji: {
      findMany: readKanji,
    },
    learningItem: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { targetType_targetId: { targetType: string; targetId: string } };
        }) => {
          const item = state.items.get(key(where.targetType_targetId));
          return item === undefined ? null : withWordTeaching(item);
        },
      ),
      findMany: vi.fn(
        async (args: {
          where: { id: { in: string[] } } | { targetType: string; targetId: { in: string[] } };
        }) => {
          const { where } = args;
          if ("targetId" in where) {
            if (where.targetType === "KANJI") return readKanjiItems({ where });
            return [...state.items.values()]
              .filter(
                (item) =>
                  item.targetType === where.targetType &&
                  where.targetId.in.includes(String(item.targetId)),
              )
              .map(withWordTeaching)
              .reverse();
          }
          return [...state.items.values()]
            .filter(
              (item) =>
                where.id.in.includes(item.id) &&
                item.kind === "KANJI" &&
                item.status === "PUBLISHED",
            )
            .map(withKanjiPlacements);
        },
      ),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        mutations.push("item.create");
        return insert(state.items, { targetType: data.targetType, targetId: data.targetId }, data);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        mutations.push("item.update");
        return Object.assign(byId(state.items, where.id)!, data);
      }),
      updateMany: updateMany("item.updateMany", state.items),
    },
    courseLevelItem: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        [...state.placements.values()].filter((row) => matches(row, where)).reverse(),
      ),
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { courseLevelId_sortOrder: { courseLevelId: string; sortOrder: number } };
        }) =>
          [...state.placements.values()].find(
            (row) =>
              row.courseLevelId === where.courseLevelId_sortOrder.courseLevelId &&
              row.sortOrder === where.courseLevelId_sortOrder.sortOrder,
          ) ?? null,
      ),
      upsert: vi.fn((args: UpsertArgs) => {
        const row = upsert("placement", state.placements, "courseLevelId_learningItemId")(args);
        row.courseId = "main";
        return row;
      }),
    },
    license: {
      findUnique: vi.fn(
        async ({ where }: { where: { name: string } }) => state.licenses.get(key(where)) ?? null,
      ),
      upsert: upsert("license", state.licenses, null),
    },
    dataSource: {
      findUnique: vi.fn(async ({ where }: { where: { name: string } }) => {
        const source = state.sources.get(key(where));
        return source === undefined
          ? null
          : { ...source, license: byId(state.licenses, source.licenseId) };
      }),
      upsert: upsert("source", state.sources, null),
    },
    learningCard: {
      createManyAndReturn: vi.fn(({ data }: { data: Record<string, unknown>[] }) => {
        mutations.push("card.createManyAndReturn");
        return data
          .map((entry) =>
            insert(
              state.cards,
              {
                learningItemId: entry.learningItemId,
                promptType: entry.promptType,
                answerType: entry.answerType,
                locale: entry.locale,
              },
              entry,
            ),
          )
          .reverse();
      }),
      upsert: upsert("card", state.cards, "learningItemId_promptType_answerType_locale"),
    },
    learningAnswer: {
      deleteMany: deleteMany("answer.deleteMany", state.answers),
      createMany: vi.fn(({ data }: { data: Record<string, unknown>[] }) => {
        mutations.push("answer.createMany");
        for (const entry of data) {
          const id = `new-${++sequence}`;
          state.answers.set(id, { ...entry, id });
        }
      }),
    },
    blockedAnswer: {
      deleteMany: vi.fn(() => {
        mutations.push("blocked.deleteMany");
      }),
      createMany: vi.fn(() => {
        mutations.push("blocked.createMany");
        return { count: 1 };
      }),
    },
    wordSense: {
      deleteMany: deleteMany("sense.deleteMany", state.senses),
      upsert: upsert("sense", state.senses, "wordId_locale_meaning_partOfSpeech"),
    },
    mnemonic: {
      createMany: createTeachingText("mnemonic", state.mnemonics, "mnemonicType"),
      upsert: upsert("mnemonic", state.mnemonics, "learningItemId_locale_mnemonicType_version"),
    },
    hint: {
      createMany: createTeachingText("hint", state.hints, "hintType"),
      upsert: upsert("hint", state.hints, "learningItemId_locale_hintType_version"),
    },
    dependency: {
      deleteMany: deleteMany("dependency.deleteMany", state.dependencies),
      createMany: vi.fn(({ data }: { data: Record<string, unknown>[] }) => {
        mutations.push("dependency.createMany");
        for (const entry of data)
          state.dependencies.set(
            key({
              learningItemId: entry.learningItemId,
              prerequisiteItemId: entry.prerequisiteItemId,
            }),
            { ...entry, id: key(entry) },
          );
      }),
    },
    sentence: {
      findUnique: vi.fn(async ({ where }: { where: { dataSourceId_sourceId: unknown } }) => {
        const sentence = state.sentences.get(key(where.dataSourceId_sourceId));
        return sentence === undefined ? null : sentenceWithProvenance(sentence);
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        [...state.sentences.values()]
          .map(sentenceWithProvenance)
          .filter((sentence) => matches(sentence, where))
          .map((sentence, index) =>
            index + 1 === failedPublication ? { ...sentence, translationEn: null } : sentence,
          )
          .reverse(),
      ),
      upsert: upsert("sentence", state.sentences, "dataSourceId_sourceId"),
    },
    wordExample: {
      upsert: upsert("example", state.examples, "wordId_sentenceId"),
      updateMany: updateMany("example.updateMany", state.examples),
    },
    importedRecord: {
      upsert: upsert("record", state.records, "importRunId_recordType_sourceRecordId"),
    },
    importRun: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { dataSource: { name: string }; checksumSha256: { in: string[] }; status: string };
        }) =>
          [...state.runs.values()].find(
            (row) =>
              row.status === where.status &&
              where.checksumSha256.in.includes(String(row.checksumSha256)) &&
              byId(state.sources, row.dataSourceId)?.name === where.dataSource.name,
          ) ?? null,
      ),
      upsert: upsert("run", state.runs, "dataSourceId_checksumSha256"),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          mutations.push("run.update");
          events.push(`run:${String(data.status)}`);
          const row = byId(state.runs, where.id)!;
          Object.assign(row, data);
          if (data.status === "SUCCESS") beforePublication?.();
          return row;
        },
      ),
    },
    userSrsState: {
      upsert: forbiddenMutation,
      update: forbiddenMutation,
      updateMany: forbiddenMutation,
      deleteMany: forbiddenMutation,
    },
    userItemOverride: {
      upsert: forbiddenMutation,
      update: forbiddenMutation,
      deleteMany: forbiddenMutation,
    },
    userMnemonic: {
      upsert: forbiddenMutation,
      update: forbiddenMutation,
      deleteMany: forbiddenMutation,
    },
  };
  const transaction = vi.fn(
    async (
      callback: (db: typeof delegates) => Promise<unknown>,
      _options?: { maxWait?: number; timeout?: number },
    ) => {
      const before = structuredClone(state);
      try {
        return await callback(delegates);
      } catch (error) {
        restoreMap(state.words, before.words);
        for (const name of [
          "items",
          "placements",
          "cards",
          "answers",
          "senses",
          "mnemonics",
          "hints",
          "dependencies",
          "licenses",
          "sources",
          "runs",
          "records",
          "sentences",
          "examples",
        ] as const)
          restoreMap(state[name], before[name]);
        throw error;
      }
    },
  );
  return {
    db: { ...delegates, $transaction: transaction } as unknown as PrismaClient,
    state,
    batch,
    mutations,
    events,
    readPrimaryWords,
    readWord,
    readCourse,
    readKanji,
    readKanjiItems,
    transaction,
    forbiddenMutation,
    privateRows,
    failWord: (expression: string | null) => {
      failedWord = expression;
    },
    failPublicationAt: (index: number | null) => {
      failedPublication = index;
    },
    beforePublication: (change: () => void) => {
      beforePublication = change;
    },
    identities: () =>
      Object.fromEntries(
        (["items", "cards", "sentences", "examples", "runs", "records"] as const).map((name) => [
          name,
          [...state[name].values()].map((row) => row.id),
        ]),
      ),
  };
}

function restoreMap<K, V>(destination: Map<K, V>, snapshot: Map<K, V>): void {
  destination.clear();
  for (const [key, value] of snapshot) destination.set(key, value);
}

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([field, expected]) => {
    if (field === "OR")
      return Array.isArray(expected) && expected.some((branch) => matches(row, branch));
    if (expected !== null && typeof expected === "object" && !Array.isArray(expected)) {
      const filter = expected as Record<string, unknown>;
      if (Array.isArray(filter.in)) return filter.in.includes(row[field]);
      if (Array.isArray(filter.notIn)) return !filter.notIn.includes(row[field]);
      const value = row[field];
      return value !== null && typeof value === "object" && matches(value as Row, filter);
    }
    return row[field] === expected;
  });
}
