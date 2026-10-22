import { createHash } from "node:crypto";
import { type PrismaClient } from "@prisma/client";
import { normalizeJapaneseReading, normalizeMeaning } from "@kanji-srs/japanese";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseFoundationPilotArgs } from "../prisma/publish-foundation-pilot";
import { loadContentQualityItems } from "../src/content-quality-report";
import { type QualityItem } from "../src/content-quality";
import {
  buildFoundationPilotManifest,
  buildFoundationPilotManifestV2,
  buildFoundationPilotManifestV3,
  buildFoundationPilotManifestV4,
  foundationPilotRecordId,
  FOUNDATION_PILOT_RECORD_ID,
  FOUNDATION_PILOT_V2_RECORD_ID,
  FOUNDATION_PILOT_V3_RECORD_ID,
  FOUNDATION_PILOT_V4_RECORD_ID,
  planFoundationPilot,
  publishFoundationPilot,
} from "../src/foundation-pilot";
import { buildMainCourseContentBatches } from "../src/main-course-content";
import { buildMainCourseBlueprint } from "../src/main-course";
import { buildMainCourseWordBatches, wordHanCharacters } from "../src/main-course-word-content";

vi.mock("../src/content-quality-report", () => ({ loadContentQualityItems: vi.fn() }));
beforeEach(() => {
  vi.mocked(loadContentQualityItems).mockReset();
});

const SOURCE_HASHES = [
  "34676566c590fd19d10349e6bb07c75d01471fc618872fa103db2e676fd138b8",
  "99268635c984603c30a1a53c2beb0bcd63a53316b9cb3a83b4e51c54e1c18714",
  "fe1998be5842a0ca2f233670318949c51d82c58d68068851c3859f8e3560af92",
  "5547b31673a20cffdfc817b0a95bd8b3e202108529c844f5090e0234fefa7850",
  "1ceeb2467961f707e57047ab0c46a91badaa048f036ac3299a5a7d0685f99daf",
  "0110505331b1066653f4b62ce20f4c8bbb98e94ccf701eafac26ecda9a0e6a4f",
  "ef7090a4cea8c4b74c04a3cebfe85dc9832d64e1b7d071e409232287e7cf2ff4",
];
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, value: unknown) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : value,
  );
}

describe("sealed finite pilot v2", () => {
  it("pins all seven approved sources, independent canonical hash, counts and publication identity", () => {
    const manifest = buildFoundationPilotManifestV2();
    expect(manifest.counts).toEqual({
      components: 53,
      kanji: 61,
      words: 60,
      items: 174,
      cards: 295,
    });
    expect(manifest.targets).toHaveLength(174);
    expect(manifest.levels).toHaveLength(5);
    expect(manifest.version).toBe("2");
    expect(manifest.slug).toBe("japanese-foundation-pilot-v2");
    expect(manifest.sources.map((source) => source.id)).toEqual([
      "task-118-foundation-kanji-01",
      "task-118-foundation-kanji-02",
      "task-118-foundation-kanji-03",
      "task-118-foundation-kanji-04",
      "task-127-foundation-words-01",
      "task-127-foundation-words-02",
      "task-127-foundation-words-03",
    ]);
    expect(manifest.sources.map((source) => source.checksumSha256)).toEqual(SOURCE_HASHES);
    expect(createHash("sha256").update(canonical(manifest)).digest("hex")).toBe(
      "4d2f3aab0b2b160774ab5a2ca19a675f28423c48561218abca4c8737c47d53e1",
    );
    expect(foundationPilotRecordId(manifest)).toBe("4c599bc8-e28c-4527-9d9b-a99a3a7c8779");
    expect(foundationPilotRecordId(buildFoundationPilotManifest())).toBe(
      FOUNDATION_PILOT_RECORD_ID,
    );
    expect(FOUNDATION_PILOT_V2_RECORD_ID).not.toBe(FOUNDATION_PILOT_RECORD_ID);
    const byKey = new Map(manifest.targets.map((target) => [target.key, target]));
    expect(
      new Set(manifest.targets.map((target) => `${target.levelNumber}:${target.sortOrder}`)).size,
    ).toBe(174);
    for (const target of manifest.targets)
      for (const key of target.prerequisiteKeys)
        expect(byKey.get(key)!.levelNumber).toBeLessThan(target.levelNumber);
    for (const batch of buildMainCourseWordBatches().filter((entry) =>
      manifest.sources.some((source) => source.id === entry.id),
    ))
      for (const word of batch.words)
        for (const character of wordHanCharacters(word.expression + word.example.japaneseText))
          expect(byKey.get(`kanji:${character}`)!.levelNumber).toBeLessThan(batch.levelNumber);
  });

  it("includes five verified alternate answers without extra cards or extra primaries", () => {
    const manifest = buildFoundationPilotManifestV2();
    const readings = new Map(
      manifest.targets
        .filter((target) => target.kind === "WORD")
        .map((target) => [
          target.expression,
          target.answers.filter((answer) => answer.promptType === "READING"),
        ]),
    );
    for (const [expression, primary, extra] of [
      ["日本", "にほん", "にっぽん"],
      ["一人", "ひとり", "いちにん"],
      ["二人", "ふたり", "ににん"],
      ["水田", "すいでん", "みずた"],
      ["左右", "さゆう", "そう"],
    ])
      expect(readings.get(expression!)).toEqual([
        { promptType: "READING", locale: "ru-RU", text: primary, isPrimary: true },
        { promptType: "READING", locale: "ru-RU", text: extra, isPrimary: false },
      ]);
    for (const answers of readings.values())
      expect(answers.filter((answer) => answer.isPrimary)).toHaveLength(1);
    expect([...readings.values()].flat()).toHaveLength(65);
  });

  it("does not automatically expand into future registry entries", () => {
    const kanji = buildMainCourseContentBatches();
    const words = buildMainCourseWordBatches();
    expect(() =>
      buildFoundationPilotManifestV2(
        [...kanji, { ...kanji[3]!, id: "future", components: [], kanji: [] }],
        words,
      ),
    ).toThrow("exactly the seven registered");
    expect(() =>
      buildFoundationPilotManifestV2(kanji, [...words, { ...words[2]!, id: "future" }]),
    ).toThrow("exactly the seven registered");
    expect(() => buildFoundationPilotManifestV2(kanji.slice(0, 3), words)).toThrow();
  });

  it.each([
    "counts",
    "target-order",
    "answer",
    "target-id",
    "source-id",
    "source-hash",
    "source-content",
    "pending",
    "schedule",
    "slug",
  ])("rejects injected %s before database reads", async (condition) => {
    const manifest = structuredClone(buildFoundationPilotManifestV2());
    if (condition === "counts") Object.assign(manifest.counts, { items: 175 });
    if (condition === "target-order") manifest.targets.reverse();
    if (condition === "answer") manifest.targets[0]!.answers = [];
    if (condition === "target-id") manifest.targets[0]!.key = "foreign";
    if (condition === "source-id") manifest.sources[0]!.id = "foreign";
    if (condition === "source-hash") manifest.sources[0]!.checksumSha256 = "a".repeat(64);
    if (condition === "source-content") manifest.sources[0]!.records[0]!.content = { forged: true };
    if (condition === "pending") manifest.sources[6]!.reviewedAt = null;
    if (condition === "schedule")
      Object.assign(manifest.levels[0]!.passPolicyJson, { passStageIndex: 1 });
    if (condition === "slug") Object.assign(manifest, { slug: "unrecognized" });
    const read = vi.fn(() => {
      throw new Error("No reads permitted");
    });
    const db = { course: { findUnique: read } } as never;
    await expect(planFoundationPilot(db, { manifest })).rejects.toThrow(
      "sealed independently reviewed",
    );
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects corrupted registered source payloads as well as injected manifest payloads", async () => {
    const batches = buildMainCourseContentBatches().slice(0, 4);
    const manifest = buildFoundationPilotManifestV2(
      batches.map((batch, index) => (index === 3 ? { ...batch, reviewedAt: null } : batch)),
    );
    await expect(planFoundationPilot({} as never, { manifest })).rejects.toThrow(
      "sealed independently reviewed",
    );
  });

  it("parses strict explicit pilot versions while preserving the legacy default object", () => {
    expect(parseFoundationPilotArgs([])).toEqual({ mode: "plan" });
    expect(parseFoundationPilotArgs(["--pilot", "v1"])).toEqual({ mode: "plan", pilot: "v1" });
    expect(parseFoundationPilotArgs(["--pilot", "v2", "--validate-only"])).toEqual({
      mode: "validate-only",
      pilot: "v2",
    });
    for (const args of [
      ["--pilot"],
      ["--pilot", "v5"],
      ["--pilot", "--publish"],
      ["--pilot", "v2", "--pilot", "v1"],
      ["--pilot", "v2", "--pilot", "v2"],
    ])
      expect(() => parseFoundationPilotArgs(args)).toThrow("--pilot once");
  });

  it("plans all 174 targets with take 175 and three bounded quality pages, without writes", async () => {
    const h = readFixture();
    const result = await planFoundationPilot(h.db, { manifest: h.manifest });
    expect(result.items).toHaveLength(174);
    expect(result.sourceChecksums).toHaveLength(7);
    expect(h.placementRead).toHaveBeenCalledWith(expect.objectContaining({ take: 175 }));
    expect(h.recordRead).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: FOUNDATION_PILOT_V2_RECORD_ID } }),
    );
    expect(loadContentQualityItems).toHaveBeenCalledTimes(3);
    expect(
      vi.mocked(loadContentQualityItems).mock.calls.map(([, options]) => options?.itemIds?.length),
    ).toEqual([100, 100, 74]);
    expect(
      vi.mocked(loadContentQualityItems).mock.calls.every(([, options]) => options?.limit === 100),
    ).toBe(true);
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it("rejects an alternate canonical Word row with a different JMdict identity", async () => {
    const h = readFixture();
    h.wordRows.find((row) => row.reading === "にっぽん")!.jmdictEntryId = "jmdict:0";
    await expect(planFoundationPilot(h.db, { manifest: h.manifest })).rejects.toThrow(
      "alternate word provenance",
    );
    expect(h.placementRead).not.toHaveBeenCalled();
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it.each([173, 175])(
    "rejects %i source placements without silently truncating the tail",
    async (count) => {
      const h = readFixture();
      h.placementRead.mockResolvedValue(
        Array.from({ length: count }, (_, index) => h.placements[index % 174]!),
      );
      await expect(planFoundationPilot(h.db, { manifest: h.manifest })).rejects.toThrow(
        "exactly 174",
      );
      expect(h.forbidden).not.toHaveBeenCalled();
    },
  );

  it("rejects missing last-scope quality evidence instead of accepting the first hundred items", async () => {
    const h = readFixture();
    const loader = vi.mocked(loadContentQualityItems).getMockImplementation()!;
    vi.mocked(loadContentQualityItems).mockImplementation((db, options) =>
      options?.itemIds?.length === 74 ? Promise.resolve([]) : loader(db, options),
    );
    await expect(planFoundationPilot(h.db, { manifest: h.manifest })).rejects.toThrow("all 174");
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it("publishes only the v2 metadata/placements with its distinct record ID and no enrollment discovery", async () => {
    const h = readFixture();
    const transaction = vi.spyOn(h.db, "$transaction");
    const result = await publishFoundationPilot(h.db, { manifest: h.manifest });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      maxWait: 10_000,
      timeout: 60_000,
    });
    expect(result).toMatchObject({
      slug: h.manifest.slug,
      manifestRecordId: FOUNDATION_PILOT_V2_RECORD_ID,
      enrolledUserId: null,
      counts: h.manifest.counts,
    });
    expect(h.createPlacements.mock.calls[0]![0].data).toHaveLength(174);
    expect(h.recordWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FOUNDATION_PILOT_V2_RECORD_ID },
        create: expect.objectContaining({ id: FOUNDATION_PILOT_V2_RECORD_ID }),
      }),
    );
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it("plans and publishes the bounded v3 expansion including the real level-six band", async () => {
    const h = readFixture(buildFoundationPilotManifestV3());
    const plan = await planFoundationPilot(h.db, { manifest: h.manifest });
    expect(plan.items).toHaveLength(244);
    expect(plan.sourceChecksums).toHaveLength(10);
    expect(h.placementRead).toHaveBeenCalledWith(expect.objectContaining({ take: 245 }));
    expect(
      vi.mocked(loadContentQualityItems).mock.calls.map(([, options]) => options?.itemIds?.length),
    ).toEqual([100, 100, 100, 100, 44]);
    const result = await publishFoundationPilot(h.db, { manifest: h.manifest });
    expect(result).toMatchObject({
      manifestRecordId: FOUNDATION_PILOT_V3_RECORD_ID,
      enrolledUserId: null,
      counts: { items: 244, cards: 425 },
    });
    expect(h.db.courseLevel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          levelNumber: 6,
          band: "N5",
          passPolicyJson: expect.objectContaining({ itemKind: "WORD" }),
        }),
      }),
    );
    expect(h.createPlacements.mock.calls[0]![0].data).toHaveLength(244);
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it("rejects a v3 level-six placement in the old Foundation band before publication writes", async () => {
    const h = readFixture(buildFoundationPilotManifestV3());
    Object.assign(
      h.placements.find((placement) => placement.courseLevel.levelNumber === 6)!.courseLevel,
      { band: "FOUNDATION" },
    );
    await expect(publishFoundationPilot(h.db, { manifest: h.manifest })).rejects.toThrow(
      "exact published main-course placement",
    );
    expect(h.createPlacements).not.toHaveBeenCalled();
    expect(h.recordWrite).not.toHaveBeenCalled();
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it("plans all 300 v4 targets using take 301 and three complete bounded quality scopes", async () => {
    const h = readFixture(buildFoundationPilotManifestV4());
    const plan = await planFoundationPilot(h.db, { manifest: h.manifest });
    expect(plan.items).toHaveLength(300);
    expect(plan.quality.items).toHaveLength(300);
    expect(plan.sourceChecksums).toHaveLength(12);
    expect(plan.manifestChecksum).toBe(
      "7353baf893c3bde9fb7279529bcf69d66d7e0b9ef81396a8fb96169c686e70fc",
    );
    expect(h.placementRead).toHaveBeenCalledWith(expect.objectContaining({ take: 301 }));
    expect(h.recordRead).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: FOUNDATION_PILOT_V4_RECORD_ID } }),
    );
    const calls = vi.mocked(loadContentQualityItems).mock.calls;
    expect(calls).toHaveLength(6);
    expect(calls.map(([, options]) => options?.itemIds?.length)).toEqual(Array(6).fill(100));
    expect(calls.map(([, options]) => options?.cursor !== undefined)).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(new Set(calls.flatMap(([, options]) => options!.itemIds!)).size).toBe(300);
    expect(calls.every(([, options]) => options?.limit === 100)).toBe(true);
    const runs = vi.mocked(h.db.importRun.findUnique).mock.calls;
    expect(runs).toHaveLength(12);
    for (const [index, source] of h.manifest.sources.entries())
      expect(runs[index]![0]).toMatchObject({
        include: { records: { take: source.records.length + 1 } },
      });
    expect(h.db.course.upsert).not.toHaveBeenCalled();
    expect(h.createPlacements).not.toHaveBeenCalled();
    expect(h.recordWrite).not.toHaveBeenCalled();
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it("synthetically publishes only v4's 300 exact placements and seven policies without enrollment", async () => {
    const h = readFixture(buildFoundationPilotManifestV4());
    const transaction = vi.spyOn(h.db, "$transaction");
    const result = await publishFoundationPilot(h.db, { manifest: h.manifest });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      maxWait: 10_000,
      timeout: 120_000,
    });
    expect(result).toMatchObject({
      slug: h.manifest.slug,
      manifestRecordId: FOUNDATION_PILOT_V4_RECORD_ID,
      enrolledUserId: null,
      counts: { components: 79, kanji: 101, words: 120, items: 300, cards: 521 },
    });
    const writes = h.createPlacements.mock.calls[0]![0].data;
    expect(writes).toEqual(
      h.placements.map((placement) => ({
        courseLevelId: `pilot-level-${placement.courseLevel.levelNumber}`,
        learningItemId: placement.learningItemId,
        sortOrder: placement.sortOrder,
        unlockPolicyJson: placement.unlockPolicyJson,
      })),
    );
    expect(h.db.courseLevel.upsert).toHaveBeenCalledTimes(7);
    for (const levelNumber of [5, 6, 7])
      expect(h.db.courseLevel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            levelNumber,
            band: levelNumber === 5 ? "FOUNDATION" : "N5",
            passPolicyJson: {
              version: 1,
              itemKind: levelNumber === 7 ? "KANJI" : "WORD",
              passStageIndex: 5,
              requiredPercentage: 90,
            },
          }),
        }),
      );
    expect(h.recordWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FOUNDATION_PILOT_V4_RECORD_ID },
        create: expect.objectContaining({ id: FOUNDATION_PILOT_V4_RECORD_ID }),
      }),
    );
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it.each([299, 301])("rejects %i source placements for v4", async (count) => {
    const h = readFixture(buildFoundationPilotManifestV4());
    h.placementRead.mockResolvedValue(
      Array.from({ length: count }, (_, index) => h.placements[index % 300]!),
    );
    await expect(planFoundationPilot(h.db, { manifest: h.manifest })).rejects.toThrow(
      "exactly 300",
    );
    expect(h.createPlacements).not.toHaveBeenCalled();
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it.each(["missing prerequisite", "wrong prerequisite stage", "moved component", "wrong band"])(
    "rejects v4 %s before publication writes",
    async (condition) => {
      const h = readFixture(buildFoundationPilotManifestV4());
      const lateKanji = h.placements.find((placement) => placement.courseLevel.levelNumber === 7)!;
      const lateComponent = h.placements.find(
        (placement) =>
          placement.courseLevel.levelNumber === 6 && placement.learningItem.kind === "COMPONENT",
      )!;
      if (condition === "missing prerequisite") lateKanji.learningItem.dependencies.pop();
      if (condition === "wrong prerequisite stage")
        lateKanji.learningItem.dependencies[0]!.requiredStage = 0;
      if (condition === "moved component") lateComponent.sortOrder++;
      if (condition === "wrong band") Object.assign(lateKanji.courseLevel, { band: "FOUNDATION" });
      await expect(publishFoundationPilot(h.db, { manifest: h.manifest })).rejects.toThrow();
      expect(h.createPlacements).not.toHaveBeenCalled();
      expect(h.recordWrite).not.toHaveBeenCalled();
      expect(h.forbidden).not.toHaveBeenCalled();
    },
  );

  it("rejects missing final-scope v4 quality evidence even when the first 200 items pass", async () => {
    const h = readFixture(buildFoundationPilotManifestV4());
    const loader = vi.mocked(loadContentQualityItems).getMockImplementation()!;
    const lastId = h.placements.at(-1)!.learningItemId;
    vi.mocked(loadContentQualityItems).mockImplementation((db, options) =>
      options?.itemIds?.includes(lastId) ? Promise.resolve([]) : loader(db, options),
    );
    await expect(publishFoundationPilot(h.db, { manifest: h.manifest })).rejects.toThrow("all 300");
    expect(h.createPlacements).not.toHaveBeenCalled();
    expect(h.recordWrite).not.toHaveBeenCalled();
    expect(h.forbidden).not.toHaveBeenCalled();
  });
});

// A narrow read-only projection plus write spies: no simulated Prisma persistence/transactions.
function readFixture(manifest = buildFoundationPilotManifestV2()) {
  const band = (levelNumber: number) =>
    buildMainCourseBlueprint().levels.find((level) => level.levelNumber === levelNumber)!.band;
  const itemId = (key: string) =>
    `00000000-0000-4000-8000-${String(manifest.targets.findIndex((target) => target.key === key) + 1).padStart(12, "0")}`;
  const targetId = (key: string) => `target-${key}`;
  const evidence = (key: string, entryId: string) => ({
    importedRecordId: `raw-${key}`,
    sourceRecordId: entryId,
    importRunId: "raw-run",
    sourceVersion: "fixture",
    checksumSha256: "f".repeat(64),
    licenseId: "raw-license",
  });
  const wordRows = manifest.targets
    .filter((target) => target.kind === "WORD")
    .flatMap((target) =>
      target.answers
        .filter((answer) => answer.promptType === "READING")
        .map((answer) => ({
          id: answer.isPrimary ? targetId(target.key) : `${targetId(target.key)}:${answer.text}`,
          expression: target.expression,
          reading: answer.text,
          jmdictEntryId: target.jmdictEntryId!,
          jmdictImportedRecordId: `raw-${target.key}`,
          importedRecord: {
            id: `raw-${target.key}`,
            sourceRecordId: target.jmdictEntryId!,
            importRun: {
              id: "raw-run",
              sourceVersion: "fixture",
              checksumSha256: "f".repeat(64),
              dataSource: { licenseId: "raw-license" },
            },
          },
        })),
    );
  const placements = manifest.targets.map((target) => ({
    learningItemId: itemId(target.key),
    sortOrder: target.sortOrder,
    unlockPolicyJson: { policy: "level-order" },
    courseLevel: {
      id: `level-${target.levelNumber}`,
      levelNumber: target.levelNumber,
      band: band(target.levelNumber),
    },
    learningItem: {
      id: itemId(target.key),
      kind: target.kind,
      targetType: target.kind,
      targetId: targetId(target.key),
      status: "PUBLISHED",
      hints: [],
      dependencies: target.prerequisiteKeys.map((key) => ({
        prerequisiteItemId: itemId(key),
        requiredStage: target.requiredStage,
      })),
    },
  }));
  const quality: QualityItem[] = manifest.targets
    .map((target) => ({
      id: itemId(target.key),
      kind: target.kind,
      targetType: target.kind,
      band: band(target.levelNumber),
      targetExists: true,
      targetMeaningsValid: true,
      source:
        target.kind === "COMPONENT"
          ? null
          : {
              sourceRecordId: "fixture",
              checksumSha256: "f".repeat(64),
              status: "SUCCESS",
              sourceVersion: "fixture",
              sourceUrl: "https://example.test",
              licenseName: "Synthetic fixture",
              attributionText: "Synthetic fixture",
            },
      sourceReadings: target.answers
        .filter((answer) => answer.promptType === "READING")
        .map((answer) => answer.text),
      requiresImportedSource: target.kind !== "COMPONENT",
      hasStrokes: true,
      hasPartOfSpeech: true,
      hasExample: true,
      hasPrerequisiteCycle: false,
      validStageIndices: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      cards: (target.kind === "COMPONENT" ? ["MEANING"] : ["MEANING", "READING"]).map(
        (promptType) => ({
          id: `card-${itemId(target.key)}-${promptType}`,
          promptType,
          answerType: promptType,
          locale: "ru-RU",
          blockedAnswers: [],
          answers: target.answers
            .filter((answer) => answer.promptType === promptType)
            .map((answer) => ({
              ...answer,
              sourceKind: "PROJECT_AUTHORED",
              normalizedText:
                promptType === "READING"
                  ? normalizeJapaneseReading(answer.text)
                  : normalizeMeaning(answer.text, answer.locale === "en-US" ? "en-US" : "ru-RU"),
            })),
        }),
      ),
      mnemonics: [
        { locale: "ru-RU", body: "Объяснение.", sourceKind: "PROJECT_AUTHORED" },
        { locale: "en-US", body: "Explanation.", sourceKind: "PROJECT_AUTHORED" },
      ],
      placements: [
        {
          levelNumber: target.levelNumber,
          sortOrder: target.sortOrder,
          band: band(target.levelNumber),
        },
      ],
      requiredPrerequisiteTargetIds: target.prerequisiteKeys.map(targetId),
      dependencies: target.prerequisiteKeys.map((key) => {
        const required = manifest.targets.find((target) => target.key === key)!;
        return {
          id: itemId(key),
          targetId: targetId(key),
          kind: required.kind,
          status: "PUBLISHED",
          requiredStage: target.requiredStage,
          placements: [
            {
              levelNumber: required.levelNumber,
              sortOrder: required.sortOrder,
              band: band(required.levelNumber),
            },
          ],
        };
      }),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  vi.mocked(loadContentQualityItems).mockImplementation(async (_db, options) =>
    quality
      .filter(
        (item) =>
          options!.itemIds!.includes(item.id) &&
          (options?.cursor === undefined || item.id > options.cursor),
      )
      .slice(0, options!.limit),
  );
  const forbidden = vi.fn(() => {
    throw new Error("No global/private/enrollment access");
  });
  const placementRead = vi.fn(async () => placements);
  const recordRead = vi.fn(async () => null);
  const recordWrite = vi.fn(async (_args: unknown) => ({}));
  const createPlacements = vi.fn(async (_args: { data: unknown[] }) => ({}));
  const db = {
    course: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) =>
        where.slug === "japanese-ru-n2"
          ? { id: "main", slug: where.slug, status: "DRAFT", courseType: "STRUCTURED", levels: [] }
          : null,
      ),
      upsert: vi.fn(async () => ({ id: "pilot-v2" })),
      update: vi.fn(async () => ({})),
    },
    component: {
      findMany: vi.fn(async () =>
        manifest.targets
          .filter((target) => target.kind === "COMPONENT")
          .map((target) => ({ id: targetId(target.key), symbol: target.expression })),
      ),
    },
    kanji: {
      findMany: vi.fn(async () =>
        manifest.targets
          .filter((target) => target.kind === "KANJI")
          .map((target) => ({ id: targetId(target.key), character: target.expression })),
      ),
    },
    word: { findMany: vi.fn(async () => wordRows) },
    courseLevelItem: { findMany: placementRead, createMany: createPlacements },
    courseLevel: {
      upsert: vi.fn(async ({ create }: { create: { levelNumber: number } }) => ({
        id: `pilot-level-${create.levelNumber}`,
      })),
    },
    importedRecord: { findUnique: recordRead, upsert: recordWrite },
    license: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({ id: "publication-license" })),
    },
    dataSource: {
      findUnique: vi.fn(async ({ where }: { where: { name: string } }) =>
        where.name === "Kanji SRS foundation pilot publication"
          ? null
          : { id: where.name, license: { scope: "PROJECT_AUTHORED" } },
      ),
      upsert: vi.fn(async () => ({ id: "publication-source" })),
    },
    importRun: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { dataSourceId_checksumSha256: { checksumSha256: string } };
        }) => {
          const source = manifest.sources.find(
            (source) => source.checksumSha256 === where.dataSourceId_checksumSha256.checksumSha256,
          )!;
          return {
            id: `run-${source.id}`,
            status: "SUCCESS",
            checksumSha256: source.checksumSha256,
            sourceVersion: source.version,
            sourceFileName: source.sourceFile,
            statsJson: { batchId: source.id, reviewedAt: source.reviewedAt },
            records: source.records.map((record) => {
              const target = manifest.targets.find((target) => target.key === record.wordKey);
              return {
                recordType: "PROJECT_AUTHORED",
                sourceRecordId: record.sourceRecordId,
                rawJson:
                  record.wordKey === undefined
                    ? record.content
                    : {
                        word: record.content,
                        batchId: source.id,
                        sourceEvidence: evidence(target!.key, target!.jmdictEntryId!),
                        ...(target!.answers.some(
                          (answer) => answer.promptType === "READING" && !answer.isPrimary,
                        )
                          ? {
                              acceptedReadingEvidence: target!.answers
                                .filter(
                                  (answer) => answer.promptType === "READING" && !answer.isPrimary,
                                )
                                .map((answer) => ({
                                  reading: answer.text,
                                  wordId: `${targetId(target!.key)}:${answer.text}`,
                                  sourceEvidence: evidence(target!.key, target!.jmdictEntryId!),
                                })),
                            }
                          : {}),
                      },
              };
            }),
          };
        },
      ),
      upsert: vi.fn(async () => ({ id: "publication-run" })),
    },
    user: { findUnique: forbidden, findMany: forbidden },
    userEnrollment: { upsert: forbidden },
    userSettings: { upsert: forbidden, updateMany: forbidden },
    learningItem: { upsert: forbidden },
    learningCard: { upsert: forbidden },
    userSrsState: { updateMany: forbidden },
  };
  return {
    db: {
      ...db,
      $transaction: async (action: (db: unknown) => Promise<unknown>) => action(db),
    } as unknown as PrismaClient,
    manifest,
    placements,
    placementRead,
    recordRead,
    recordWrite,
    createPlacements,
    forbidden,
    wordRows,
  };
}
