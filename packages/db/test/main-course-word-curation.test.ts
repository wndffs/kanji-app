import { type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  applyMainCourseWordBatch,
  applyMainCourseWordBatches,
  planMainCourseWordBatch,
  planMainCourseWordBatches,
} from "../prisma/curate-main-course-words";
import { buildMainCourseBlueprint } from "../src/main-course";
import { buildMainCourseContentBatches } from "../src/main-course-content";
import * as courseContent from "../src/main-course-content";
import {
  AUTHORED_WORD_PART_OF_SPEECH,
  buildMainCourseWordBatch,
  buildMainCourseWordBatches,
  wordHanCharacters,
  type MainCourseWordBatch,
  type MainCourseWordContent,
} from "../src/main-course-word-content";

describe("bounded vocabulary curation", () => {
  it.each(["verb", "i-adjective"] as const)("persists explicit %s metadata instead of noun", async (partOfSpeech) => {
    const batch = structuredClone(buildMainCourseWordBatch());
    Object.assign(batch.words[0]!, {partOfSpeech});
    const fixture = harness([batch]);
    await applyMainCourseWordBatch(fixture.db,batch);
    expect(fixture.db.wordSense.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({partOfSpeech:`${partOfSpeech} (course-authored)`}),
    }));
    expect(fixture.db.wordSense.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where:expect.objectContaining({partOfSpeech:`${partOfSpeech} (course-authored)`}),
    }));
  });
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
  it("reads one course and each distinct kanji once per registry plan, but never caches standalone plans", async () => {
    const batches = registryFixtureBatches();
    const fixture = harness(batches);
    const characters = (batch: MainCourseWordBatch) =>
      new Set(
        batch.words.flatMap((content) =>
          wordHanCharacters(content.expression + content.example.japaneseText),
        ),
      );
    const unique = new Set(batches.flatMap((batch) => [...characters(batch)])).size;
    const kanjiReads = vi.mocked(fixture.db.kanji.findUnique);
    const placedReads = () =>
      vi
        .mocked(fixture.db.learningItem.findUnique)
        .mock.calls.filter(([args]) => args.where.targetType_targetId?.targetType === "KANJI")
        .length;
    await planMainCourseWordBatches(fixture.db, batches);
    expect(fixture.readCourse).toHaveBeenCalledTimes(1);
    expect(kanjiReads).toHaveBeenCalledTimes(unique);
    expect(placedReads()).toBe(unique);
    expect(fixture.db.license.findUnique).toHaveBeenCalledTimes(batches.length);
    expect(fixture.db.dataSource.findUnique).toHaveBeenCalledTimes(batches.length);
    expect(fixture.readWord).toHaveBeenCalledTimes(
      batches.reduce(
        (count, batch) =>
          count +
          batch.words.reduce((sum, word) => sum + 1 + (word.acceptedReadings?.length ?? 0), 0),
        0,
      ),
    );
    await planMainCourseWordBatches(fixture.db, batches);
    expect(fixture.readCourse).toHaveBeenCalledTimes(2);
    expect(kanjiReads).toHaveBeenCalledTimes(unique * 2);
    await planMainCourseWordBatch(fixture.db, batches[0]!);
    await planMainCourseWordBatch(fixture.db, batches[0]!);
    expect(fixture.readCourse).toHaveBeenCalledTimes(4);
    expect(kanjiReads).toHaveBeenCalledTimes(unique * 2 + characters(batches[0]!).size * 2);
    expect(fixture.mutations).toEqual([]);
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
      expect(fixture.db.kanji.findUnique).toHaveBeenCalledTimes(expectedReads);
      expect(
        vi
          .mocked(fixture.db.learningItem.findUnique)
          .mock.calls.filter(([args]) => args.where.targetType_targetId?.targetType === "KANJI"),
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
        vi
          .mocked(fixture.db.kanji.findUnique)
          .mock.calls.filter(([args]) => args.where.character === common),
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

  it("freshly plans a selected write after the cached whole-registry preflight", async () => {
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
      const batch = { ...buildMainCourseWordBatch(), levelNumber };
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
    const result = await applyMainCourseWordBatches(fixture.db, { batches });
    expect(result).toMatchObject({
      preflightedBatchIds: batches.map((batch) => batch.id),
      skippedUnreviewedBatchIds: [batches[2]!.id],
      batches: [{ batchId: batches[0]!.id }, { batchId: batches[1]!.id }],
    });
    expect(fixture.state.cards.size).toBe(80);
    for (const word of batches[2]!.words)
      expect(
        [...fixture.state.items.values()].some(
          (item) => item.targetId === `word-${word.expression}`,
        ),
      ).toBe(false);
    expect(fixture.forbiddenMutation).not.toHaveBeenCalled();
  });

  it("does not bypass pending third-batch source failures when applying an approved selection", async () => {
    const batches = thirdPendingFixtureBatches();
    const fixture = harness(batches);
    fixture.state.words.get(batches[2]!.words.at(-1)!.expression)!.importedRecord.importRun.status =
      "FAILED";
    await expect(
      applyMainCourseWordBatches(fixture.db, {
        batches,
        batchId: batches[0]!.id,
      }),
    ).rejects.toThrow("provenance");
    expect(fixture.mutations).toEqual([]);
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it("preflights the whole registry, including an unselected last word, before any mutation", async () => {
    const batches = registryFixtureBatches();
    const fixture = harness(batches);
    fixture.state.words.get(batches[1]!.words.at(-1)!.expression)!.importedRecord.importRun.status =
      "FAILED";
    await expect(
      applyMainCourseWordBatches(fixture.db, { batches, batchId: batches[0]!.id }),
    ).rejects.toThrow("provenance");
    expect(fixture.readWord).toHaveBeenCalledTimes(45);
    expect(fixture.mutations).toEqual([]);
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
  it("blocks all reads and writes for an unreviewed manifest", async () => {
    const fixture = harness();
    await expect(
      applyMainCourseWordBatch(fixture.db, { ...buildMainCourseWordBatch(), reviewedAt: null }),
    ).rejects.toThrow("needs independent parent review");
    expect(fixture.readWord).not.toHaveBeenCalled();
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
    expect(fixture.readWord).toHaveBeenCalledTimes(20);
    expect(fixture.mutations).toEqual([]);
    expect(fixture.transaction).not.toHaveBeenCalled();
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
    "pair",
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
    if (condition === "pair") last.reading = "げつ";
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
    await expect(applyMainCourseWordBatch(fixture.db, fixture.batch)).rejects.toThrow();
    expect(fixture.readWord).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { expression_reading: { expression: "月", reading: "つき" } },
      }),
    );
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
  let publicationReads = 0;
  const forbiddenMutation = vi.fn(() => {
    throw new Error("Imported content/private state must not be mutated.");
  });
  const byId = (table: Map<string, Row>, id: unknown) =>
    [...table.values()].find((row) => row.id === id);
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
  const readCourse = vi.fn(async () => ({
    id: "main",
    levels: buildMainCourseBlueprint().levels.map((level) => ({
      ...level,
      id: `level-${level.levelNumber}`,
    })),
  }));
  const readWord = vi.fn(
    async ({
      where,
    }: {
      where: { expression_reading: { expression: string; reading: string } };
    }) => {
      const primary = state.words.get(where.expression_reading.expression);
      const word =
        primary?.reading === where.expression_reading.reading
          ? primary
          : state.words.get(
              `${where.expression_reading.expression}:${where.expression_reading.reading}`,
            );
      if (word === undefined || word.reading !== where.expression_reading.reading) return null;
      return {
        ...word,
        senses: [
          ...word.senses,
          ...[...state.senses.values()].filter((row) => row.wordId === word.id),
        ],
      };
    },
  );
  const readSentence = vi.fn(
    async ({
      where,
    }: {
      where: { id?: string; dataSourceId_sourceId?: { dataSourceId: string; sourceId: string } };
    }) => {
      const sentence =
        where.id === undefined
          ? state.sentences.get(key(where.dataSourceId_sourceId))
          : byId(state.sentences, where.id);
      if (sentence === undefined) return null;
      const source = byId(state.sources, sentence.dataSourceId)!;
      const license = byId(state.licenses, sentence.licenseId)!;
      const record = byId(state.records, sentence.importedRecordId)!;
      const run = byId(state.runs, record.importRunId)!;
      const result = {
        ...sentence,
        dataSource: source,
        license,
        importedRecord: { ...record, importRun: run },
      };
      if (where.id !== undefined && ++publicationReads === failedPublication)
        return { ...result, translationEn: null };
      return result;
    },
  );
  const delegates = {
    course: { findUnique: readCourse },
    word: {
      findUnique: readWord,
      upsert: forbiddenMutation,
      update: forbiddenMutation,
      deleteMany: forbiddenMutation,
    },
    kanji: {
      findUnique: vi.fn(async ({ where }: { where: { character: string } }) => ({
        id: `kanji-${where.character}`,
      })),
    },
    learningItem: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { targetType_targetId: { targetType: string; targetId: string } };
        }) => {
          const item = state.items.get(key(where.targetType_targetId));
          return item === undefined
            ? null
            : {
                ...item,
                courseLevelItems: [...state.placements.values()].filter(
                  (row) => row.learningItemId === item.id && row.courseId === "main",
                ),
                mnemonics: [...state.mnemonics.values()].filter(
                  (row) => row.learningItemId === item.id,
                ),
                hints: [...state.hints.values()].filter((row) => row.learningItemId === item.id),
              };
        },
      ),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        [...state.items.values()]
          .filter(
            (item) =>
              where.id.in.includes(item.id) && item.kind === "KANJI" && item.status === "PUBLISHED",
          )
          .map((item) => ({
            ...item,
            courseLevelItems: [...state.placements.values()].filter(
              (row) => row.learningItemId === item.id && row.courseId === "main",
            ),
          })),
      ),
      upsert: upsert("item", state.items, "targetType_targetId"),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          mutations.push("item.updateMany");
          let count = 0;
          for (const row of state.items.values())
            if (matches(row, where)) {
              Object.assign(row, data);
              count++;
            }
          return { count };
        },
      ),
    },
    courseLevelItem: {
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
      upsert: upsert("mnemonic", state.mnemonics, "learningItemId_locale_mnemonicType_version"),
    },
    hint: { upsert: upsert("hint", state.hints, "learningItemId_locale_hintType_version") },
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
      findUnique: readSentence,
      upsert: upsert("sentence", state.sentences, "dataSourceId_sourceId"),
    },
    wordExample: { upsert: upsert("example", state.examples, "wordId_sentenceId") },
    importedRecord: {
      upsert: upsert("record", state.records, "importRunId_recordType_sourceRecordId"),
    },
    importRun: {
      upsert: upsert("run", state.runs, "dataSourceId_checksumSha256"),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          mutations.push("run.update");
          events.push(`run:${String(data.status)}`);
          const row = byId(state.runs, where.id)!;
          Object.assign(row, data);
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
  const transaction = vi.fn(async (callback: (db: typeof delegates) => Promise<unknown>) => {
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
  });
  return {
    db: { ...delegates, $transaction: transaction } as unknown as PrismaClient,
    state,
    batch,
    mutations,
    events,
    readWord,
    readCourse,
    transaction,
    forbiddenMutation,
    privateRows,
    failWord: (expression: string | null) => {
      failedWord = expression;
    },
    failPublicationAt: (index: number | null) => {
      failedPublication = index;
      publicationReads = 0;
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

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([field, expected]) => {
    if (expected !== null && typeof expected === "object" && !Array.isArray(expected)) {
      const filter = expected as Record<string, unknown>;
      if (Array.isArray(filter.in)) return filter.in.includes(row[field]);
      if (Array.isArray(filter.notIn)) return !filter.notIn.includes(row[field]);
    }
    return row[field] === expected;
  });
}
