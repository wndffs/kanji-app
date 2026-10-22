import { type PrismaClient } from "@prisma/client";
import { normalizeJapaneseReading, normalizeMeaning } from "@kanji-srs/japanese";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadContentQualityItems } from "../src/content-quality-report";
import { validateQualityItem, type QualityItem } from "../src/content-quality";
import {
  buildFoundationPilotManifest,
  FOUNDATION_PILOT_RECORD_ID,
  FOUNDATION_PILOT_SLUG,
  planFoundationPilot,
  publishFoundationPilot,
} from "../src/foundation-pilot";

vi.mock("../src/content-quality-report", () => ({ loadContentQualityItems: vi.fn() }));
vi.mock("../src/content-quality", async (importOriginal) => {
  const original = await importOriginal<{ validateQualityItem: typeof validateQualityItem }>();
  return { ...original, validateQualityItem: vi.fn(original.validateQualityItem) };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadContentQualityItems).mockReset();
});

describe("finite pilot publication", () => {
  it("plans read-only, checks all 100 items and reads the terminal bounded quality page", async () => {
    const fixture = harness();
    const plan = await planFoundationPilot(fixture.db, { manifest: fixture.manifest });
    // Canonical approval dates replace the old synthetic date override; persistence IDs remain synthetic.
    expect(plan.contentVersion).toBe(
      "65fa9382cdb2970bf3a6ed26a908b67d569df768f04a0f75b1e19c768853d5f4",
    );
    expect(plan.items).toHaveLength(100);
    expect(plan.sourceChecksums).toHaveLength(3);
    expect(plan.contentVersion).toMatch(/^[a-f0-9]{64}$/u);
    expect(fixture.mutations).toEqual([]);
    expect(loadContentQualityItems).toHaveBeenCalledTimes(2);
    expect(loadContentQualityItems).toHaveBeenNthCalledWith(1, fixture.db, {
      courseSlug: "japanese-ru-n2",
      limit: 100,
      itemIds: plan.items.map((item) => item.learningItemId),
    });
    expect(loadContentQualityItems).toHaveBeenNthCalledWith(2, fixture.db, {
      courseSlug: "japanese-ru-n2",
      limit: 100,
      itemIds: plan.items.map((item) => item.learningItemId),
      cursor: fixture.quality.at(-1)!.id,
    });
    expect(vi.mocked(fixture.db.courseLevelItem.findMany).mock.calls[0]?.[0]).toMatchObject({
      where: {
        courseLevel: { courseId: "main" },
        learningItem: {
          OR: (["COMPONENT", "KANJI", "WORD"] as const).map((targetType) => ({
            targetType,
            targetId: {
              in: plan.items
                .filter((item) => item.kind === targetType)
                .map((item) => item.targetId),
            },
          })),
        },
      },
      take: 101,
    });
  });

  it.each(["before publication", "after publication", "during preflight"])(
    "ignores unrelated main expansion %s without changing the frozen version or membership",
    async (when) => {
      const fixture = harness();
      const baseline = await planFoundationPilot(fixture.db, { manifest: fixture.manifest });
      const first =
        when === "after publication"
          ? await publishFoundationPilot(fixture.db, { manifest: fixture.manifest })
          : null;
      const identities = fixture.identities();
      if (when === "during preflight")
        fixture.beforeTransaction = () => addUnrelatedMainItems(fixture);
      else addUnrelatedMainItems(fixture);
      const result = await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
      expect(result.contentVersion).toBe(baseline.contentVersion);
      expect(result.counts).toEqual({
        components: 40,
        kanji: 40,
        words: 20,
        items: 100,
        cards: 160,
      });
      expect(fixture.pilotPlacements("main")).toHaveLength(120);
      expect(
        new Set(fixture.pilotPlacements(result.courseId).map((row) => row.learningItemId)),
      ).toEqual(new Set(baseline.items.map((item) => item.learningItemId)));
      expect(
        [...fixture.state.levels.values()].filter((level) => level.courseId === result.courseId),
      ).toHaveLength(5);
      if (first !== null) {
        expect(result).toEqual(first);
        expect(fixture.identities().courses).toEqual(identities.courses);
        expect(fixture.identities().levels).toEqual(identities.levels);
        expect(fixture.identities().records).toEqual(identities.records);
        expect(fixture.identities().runs).toEqual(identities.runs);
      }
      for (const [, options] of vi.mocked(loadContentQualityItems).mock.calls) {
        expect(options?.itemIds).toEqual(baseline.items.map((item) => item.learningItemId));
        expect(options?.limit).toBe(100);
      }
      expect(fixture.forbidden).not.toHaveBeenCalled();
    },
  );

  it.each([0, 1, 2])(
    "blocks unreviewed source %i before reading or mutating the database",
    async (index) => {
      const fixture = harness();
      fixture.manifest.sources[index]!.reviewedAt = null;
      await expect(
        publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
      ).rejects.toThrow("independently reviewed");
      expect(fixture.readCourse).not.toHaveBeenCalled();
      expect(fixture.mutations).toEqual([]);
    },
  );

  it.each(["status", "checksum", "record", "review-date"])(
    "rejects mismatched source %s before publication",
    async (condition) => {
      const fixture = harness();
      const run = [...fixture.state.runs.values()][0]!;
      if (condition === "status") run.status = "PENDING";
      if (condition === "checksum") run.checksumSha256 = "0".repeat(64);
      if (condition === "record")
        fixture.state.records.get((run.recordIds as string[])[0]!)!.rawJson = { altered: true };
      if (condition === "review-date") (run.statsJson as Record<string, unknown>).reviewedAt = null;
      await expect(
        publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
      ).rejects.toThrow();
      expect(fixture.mutations).toEqual([]);
    },
  );

  it("compares persisted records independently of PostgreSQL JSONB property ordering", async () => {
    const fixture = harness();
    const record = [...fixture.state.records.values()][0]!;
    record.rawJson = Object.fromEntries(
      Object.entries(record.rawJson as Record<string, unknown>).reverse(),
    );
    await expect(
      planFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).resolves.toMatchObject({ items: expect.any(Array) });
    expect(fixture.mutations).toEqual([]);
  });

  it("rejects a word record whose dictionary evidence no longer matches its exact source target", async () => {
    const fixture = harness();
    const record = [...fixture.state.records.values()].find((record) =>
      String(record.sourceRecordId).includes(":example:"),
    )!;
    const raw = record.rawJson as { sourceEvidence: { checksumSha256: string } };
    raw.sourceEvidence.checksumSha256 = "0".repeat(64);
    await expect(
      publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).rejects.toThrow("record does not match");
    expect(fixture.mutations).toEqual([]);
  });

  it.each(["missing", "duplicate", "duplicate-and-missing", "draft", "wrong-slot", "wrong-level"])(
    "rejects %s main-course placements",
    async (condition) => {
      const fixture = harness();
      const first = [...fixture.state.placements.values()][0]!;
      if (condition === "missing") fixture.state.placements.delete(first.id);
      if (condition === "duplicate" || condition === "duplicate-and-missing")
        fixture.state.placements.set("extra", {
          ...first,
          id: "extra",
          courseLevelId: "main-level-60",
        });
      if (condition === "duplicate-and-missing")
        fixture.state.placements.delete([...fixture.state.placements.keys()][1]!);
      if (condition === "draft")
        fixture.state.items.get(String(first.learningItemId))!.status = "DRAFT";
      if (condition === "wrong-slot") first.sortOrder = 99;
      if (condition === "wrong-level") first.courseLevelId = "main-level-60";
      await expect(
        publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
      ).rejects.toThrow();
      expect(fixture.mutations).toEqual([]);
    },
  );

  it.each(["missing", "external", "stage"])(
    "rejects %s prerequisite closure without repairing global data",
    async (condition) => {
      const fixture = harness();
      const item = [...fixture.state.items.values()].find((item) => item.kind === "WORD")!;
      const dependencies = item.dependencies as {
        prerequisiteItemId: string;
        requiredStage: number;
      }[];
      if (condition === "missing") dependencies.length = 0;
      if (condition === "external") dependencies[0]!.prerequisiteItemId = "outside-the-pilot";
      if (condition === "stage") dependencies[0]!.requiredStage = 1;
      await expect(
        publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
      ).rejects.toThrow("prerequisite");
      expect(fixture.mutations).toEqual([]);
    },
  );

  it("rejects actual quality blockers, warnings and omissions", async () => {
    const bad = harness();
    bad.quality[99] = { ...bad.quality[99]!, hasExample: false };
    await expect(publishFoundationPilot(bad.db, { manifest: bad.manifest })).rejects.toThrow(
      "zero blockers and warnings",
    );
    expect(bad.mutations).toEqual([]);

    const warning = harness();
    vi.mocked(validateQualityItem).mockImplementationOnce((item) => [
      {
        learningItemId: item.id,
        cardId: null,
        code: "missing-example",
        severity: "warning",
        message: "test policy warning",
        remediation: "review",
      },
    ]);
    await expect(
      publishFoundationPilot(warning.db, { manifest: warning.manifest }),
    ).rejects.toThrow("zero blockers and warnings");
    expect(warning.mutations).toEqual([]);

    const missing = harness();
    missing.quality.pop();
    await expect(
      publishFoundationPilot(missing.db, { manifest: missing.manifest }),
    ).rejects.toThrow("cover all 100");
    expect(missing.mutations).toEqual([]);
  });

  it("does not stop after 100 quality rows when a later page contains unexpected content", async () => {
    const fixture = harness();
    fixture.extraQuality = true;
    await expect(
      publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).rejects.toThrow("unexpected");
    expect(loadContentQualityItems).toHaveBeenCalledTimes(2);
    expect(fixture.mutations).toEqual([]);
  });

  it("rejects an oversized scoped quality page without publication writes", async () => {
    const fixture = harness();
    vi.mocked(loadContentQualityItems).mockResolvedValueOnce([
      ...fixture.quality,
      fixture.quality[0]!,
    ]);
    await expect(
      publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).rejects.toThrow("exceeded bounded page size");
    expect(fixture.mutations).toEqual([]);
  });

  it("rejects an otherwise quality-valid answer that is absent from the approved manifest", async () => {
    const fixture = harness();
    const answer = fixture.quality[0]!.cards[0]!.answers[0]!;
    Object.assign(answer, { text: "другое значение", normalizedText: "другое значение" });
    await expect(
      publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).rejects.toThrow("answers differ");
    expect(fixture.mutations).toEqual([]);
  });

  it("publishes only a new five-level pilot, reusing all item/card IDs and preserving private progress", async () => {
    const fixture = harness();
    const protectedBefore = structuredClone({
      items: fixture.state.items,
      cards: fixture.cards,
      privateRows: fixture.privateRows,
      main: fixture.state.courses.get("main"),
    });
    const result = await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
    expect(result).toMatchObject({
      status: "published",
      slug: FOUNDATION_PILOT_SLUG,
      counts: { items: 100, cards: 160 },
      enrolledUserId: null,
    });
    const pilot = fixture.state.courses.get(result.courseId)!;
    expect(pilot.status).toBe("PUBLISHED");
    expect(fixture.state.courses.get("main")!.status).toBe("DRAFT");
    const pilotLevels = [...fixture.state.levels.values()].filter(
      (level) => level.courseId === result.courseId,
    );
    expect(pilotLevels).toHaveLength(5);
    const pilotPlacements = fixture.pilotPlacements(result.courseId);
    expect(pilotPlacements).toHaveLength(100);
    expect(fixture.db.courseLevelItem.createMany).toHaveBeenCalledTimes(1);
    expect(fixture.db.courseLevelItem.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: expect.any(Array),
    });
    expect(vi.mocked(fixture.db.courseLevelItem.createMany).mock.calls[0]?.[0]?.data).toHaveLength(
      100,
    );
    expect(fixture.db.courseLevelItem.upsert).not.toHaveBeenCalled();
    expect(new Set(pilotPlacements.map((row) => row.learningItemId))).toEqual(
      new Set(fixture.state.items.keys()),
    );
    expect({
      items: fixture.state.items,
      cards: fixture.cards,
      privateRows: fixture.privateRows,
      main: fixture.state.courses.get("main"),
    }).toEqual(protectedBefore);
    expect(fixture.state.enrollments.size).toBe(0);
    expect(fixture.state.settings.size).toBe(0);
    expect(fixture.forbidden).not.toHaveBeenCalled();
    expect(fixture.transaction.mock.calls[0]?.[1]).toMatchObject({
      isolationLevel: "Serializable",
      maxWait: 10_000,
      timeout: 60_000,
    });
    const record = fixture.state.records.get(FOUNDATION_PILOT_RECORD_ID)!;
    expect(record.rawJson).toMatchObject({
      courseId: result.courseId,
      contentVersion: result.contentVersion,
      sourceChecksums: expect.any(Array),
      counts: { items: 100, cards: 160 },
    });
    expect(loadContentQualityItems).toHaveBeenCalledTimes(8);
  });

  it("reapplies with the same course/level/placement IDs and stable publication metadata", async () => {
    const fixture = harness();
    const first = await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
    const identities = fixture.identities();
    const second = await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
    expect(second).toEqual(first);
    expect(fixture.identities()).toEqual(identities);
    expect(fixture.forbidden).not.toHaveBeenCalled();
  });

  it("reapplies unchanged semantics after ORM order and incidental row IDs change, including inside the transaction", async () => {
    const fixture = unorderedContentFixture();
    const loader = vi.mocked(loadContentQualityItems).getMockImplementation()!;
    vi.mocked(loadContentQualityItems).mockImplementation(async (db, options) => {
      if (options?.courseSlug === FOUNDATION_PILOT_SLUG) fixture.reorder();
      return loader(db, options);
    });
    expect(fixture.quality.some((item) => item.dependencies.length > 1)).toBe(true);
    const first = await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
    const identities = fixture.identities();
    const privateBefore = structuredClone(fixture.privateRows);
    fixture.reorder();
    fixture.beforeTransaction = fixture.reorder;
    const second = await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
    expect(second).toEqual(first);
    expect(fixture.identities()).toEqual(identities);
    expect(fixture.privateRows).toEqual(privateBefore);
    const plan = await planFoundationPilot(fixture.db, { manifest: fixture.manifest });
    expect(JSON.stringify([plan.items, plan.quality])).not.toContain("incidental-row");
    expect(fixture.forbidden).not.toHaveBeenCalled();
  });

  it.each([
    "mnemonic",
    "blocked-answer",
    "hint",
    "hint-version",
    "source-reading",
    "prerequisite-stage",
    "card-id",
    "example-fingerprint",
  ])("still rejects a real %s change after publication without writing", async (condition) => {
    const fixture = unorderedContentFixture();
    await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
    const first = fixture.quality[0]!;
    const row = fixture.state.items.get(first.id)!;
    if (condition === "mnemonic")
      Object.assign(first.mnemonics[0]!, { body: "Изменённое объяснение." });
    if (condition === "blocked-answer")
      Object.assign(first.cards[0]!.blockedAnswers[0]!, {
        text: "другая ошибка",
        normalizedText: "другая ошибка",
      });
    if (condition === "hint" || condition === "hint-version")
      Object.assign(
        (row.hints as object[])[0]!,
        condition === "hint" ? { body: "Изменённая подсказка." } : { version: 2 },
      );
    if (condition === "source-reading")
      fixture.quality[0] = { ...first, sourceReadings: [...first.sourceReadings, "べつ"] };
    if (condition === "prerequisite-stage")
      Object.assign(
        fixture.quality.find((item) => item.dependencies.length > 0)!.dependencies[0]!,
        {
          requiredStage: 3,
        },
      );
    if (condition === "card-id") Object.assign(first.cards[0]!, { id: "replacement-card-id" });
    if (condition === "example-fingerprint") {
      const index = fixture.quality.findIndex((item) => item.kind === "WORD");
      fixture.quality[index] = {
        ...fixture.quality[index]!,
        exampleEvidence: { hasExample: true, invalidExampleCount: 0, fingerprint: "changed" },
      };
    }
    fixture.mutations.length = 0;
    await expect(
      publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).rejects.toThrow("provenance changed");
    expect(fixture.mutations).toEqual([]);
    expect(fixture.forbidden).not.toHaveBeenCalled();
  });

  it("rejects replacement LearningItem IDs even when target, cards and prerequisites remain equivalent", async () => {
    const fixture = harness();
    await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
    addUnrelatedMainItems(fixture);
    const originalId = fixture.quality[0]!.id;
    const replacementId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const original = fixture.state.items.get(originalId)!;
    fixture.state.items.delete(originalId);
    fixture.state.items.set(replacementId, { ...original, id: replacementId });
    for (const row of fixture.state.placements.values())
      if (row.learningItemId === originalId) row.learningItemId = replacementId;
    for (const row of fixture.state.items.values())
      for (const dependency of row.dependencies as { prerequisiteItemId: string }[])
        if (dependency.prerequisiteItemId === originalId)
          dependency.prerequisiteItemId = replacementId;
    for (let index = 0; index < fixture.quality.length; index++) {
      const item = fixture.quality[index]!;
      fixture.quality[index] = {
        ...item,
        id: item.id === originalId ? replacementId : item.id,
        dependencies: item.dependencies.map((dependency) => ({
          ...dependency,
          id: dependency.id === originalId ? replacementId : dependency.id,
        })),
      };
    }
    fixture.quality.sort((a, b) => a.id.localeCompare(b.id));
    fixture.mutations.length = 0;
    await expect(
      publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).rejects.toThrow("provenance changed");
    expect(fixture.mutations).toEqual([]);
  });

  it("does not take over an existing pilot with a missing stable manifest record", async () => {
    const fixture = harness();
    await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
    fixture.state.records.delete(FOUNDATION_PILOT_RECORD_ID);
    fixture.mutations.length = 0;
    await expect(
      publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).rejects.toThrow("provenance changed");
    expect(fixture.mutations).toEqual([]);
  });

  it("rejects an orphan matching publication run rather than attaching misleading old metadata", async () => {
    const fixture = harness();
    const result = await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
    fixture.state.records.delete(FOUNDATION_PILOT_RECORD_ID);
    fixture.state.courses.delete(result.courseId);
    fixture.mutations.length = 0;
    await expect(
      publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).rejects.toThrow("Orphan pilot publication run");
    expect(fixture.mutations).toEqual([]);
  });

  it.each(["extra", "move", "missing", "hash"])(
    "rejects existing pilot %s changes instead of deleting or relocating them",
    async (condition) => {
      const fixture = harness();
      const published = await publishFoundationPilot(fixture.db, { manifest: fixture.manifest });
      const placement = fixture.pilotPlacements(published.courseId)[0]!;
      if (condition === "extra") {
        addUnrelatedMainItems(fixture);
        fixture.state.placements.set("extra", {
          ...placement,
          id: "extra",
          learningItemId: "10000000-0000-4000-8000-000000000001",
        });
      }
      if (condition === "move") placement.sortOrder = 99;
      if (condition === "missing") fixture.state.placements.delete(placement.id);
      if (condition === "hash")
        (
          fixture.state.records.get(FOUNDATION_PILOT_RECORD_ID)!.rawJson as Record<string, unknown>
        ).contentVersion = "changed";
      fixture.mutations.length = 0;
      await expect(
        publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
      ).rejects.toThrow();
      expect(fixture.mutations).toEqual([]);
    },
  );

  it("rolls back all pilot writes if the final pilot quality scan changes inside the transaction", async () => {
    const fixture = harness();
    fixture.changePilotQuality = true;
    await expect(
      publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).rejects.toThrow("checksum changed");
    expect(fixture.state.courses.size).toBe(1);
    expect(fixture.state.levels.size).toBe(60);
    expect(fixture.state.placements.size).toBe(100);
    expect(fixture.state.records.has(FOUNDATION_PILOT_RECORD_ID)).toBe(false);
    expect(fixture.forbidden).not.toHaveBeenCalled();
  });

  it("aborts before writes if the read-only plan's content changes before transaction checks", async () => {
    const fixture = harness();
    fixture.beforeTransaction = () => {
      fixture.quality[0] = {
        ...fixture.quality[0]!,
        mnemonics: [
          {
            locale: "ru-RU",
            sourceKind: "PROJECT_AUTHORED",
            body: "Другое проверенное объяснение.",
          },
          fixture.quality[0]!.mnemonics[1]!,
        ],
      };
    };
    await expect(
      publishFoundationPilot(fixture.db, { manifest: fixture.manifest }),
    ).rejects.toThrow("changed after read-only preflight");
    expect(fixture.mutations).toEqual([]);
  });

  it("enrolls only an explicit UUID, preserves paused enrollment and never replaces another current course", async () => {
    const fixture = harness();
    const userId = "11111111-1111-4111-8111-111111111111";
    fixture.state.users.set(userId, { id: userId });
    fixture.state.settings.set(userId, {
      id: "settings",
      userId,
      currentCourseId: "main",
      locale: "ru-RU",
    });
    const published = await publishFoundationPilot(fixture.db, {
      manifest: fixture.manifest,
      enrollUserId: userId,
    });
    expect(fixture.state.enrollments.size).toBe(1);
    expect([...fixture.state.enrollments.values()][0]).toMatchObject({
      userId,
      courseId: published.courseId,
      status: "ACTIVE",
    });
    expect(fixture.state.settings.get(userId)!.currentCourseId).toBe("main");
    [...fixture.state.enrollments.values()][0]!.status = "PAUSED";
    fixture.state.settings.get(userId)!.currentCourseId = null;
    await publishFoundationPilot(fixture.db, { manifest: fixture.manifest, enrollUserId: userId });
    expect([...fixture.state.enrollments.values()][0]!.status).toBe("PAUSED");
    expect(fixture.state.settings.get(userId)!.currentCourseId).toBe(published.courseId);
    expect(fixture.forbidden).not.toHaveBeenCalled();
  });

  it("rejects invalid or nonexistent explicit users without discovering other users or writing", async () => {
    const invalid = harness();
    await expect(
      publishFoundationPilot(invalid.db, { manifest: invalid.manifest, enrollUserId: "all-users" }),
    ).rejects.toThrow("explicit UUID");
    expect(invalid.readCourse).not.toHaveBeenCalled();
    const absent = harness();
    await expect(
      publishFoundationPilot(absent.db, {
        manifest: absent.manifest,
        enrollUserId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("does not exist");
    expect(absent.mutations).toEqual([]);
  });

  it("creates missing settings only for the one explicitly named existing user", async () => {
    const fixture = harness();
    const named = "11111111-1111-4111-8111-111111111111";
    const untouched = "22222222-2222-4222-8222-222222222222";
    fixture.state.users.set(named, { id: named });
    fixture.state.users.set(untouched, { id: untouched });
    const result = await publishFoundationPilot(fixture.db, {
      manifest: fixture.manifest,
      enrollUserId: named,
    });
    expect(fixture.state.settings.get(named)!.currentCourseId).toBe(result.courseId);
    expect(fixture.state.settings.has(untouched)).toBe(false);
    expect([...fixture.state.enrollments.values()].map((row) => row.userId)).toEqual([named]);
    expect(fixture.forbidden).not.toHaveBeenCalled();
  });
});

type Row = Record<string, unknown> & { id: string };
function addUnrelatedMainItems(fixture: ReturnType<typeof harness>) {
  const component = [...fixture.state.items.values()].find((item) => item.kind === "COMPONENT")!;
  for (let index = 0; index < 20; index++) {
    const id = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    fixture.state.items.set(id, {
      id,
      kind: "WORD",
      targetType: "WORD",
      // A different target type with the same UUID must not match the component target set.
      targetId: index === 0 ? component.targetId : `unrelated-word-${index}`,
      status: "PUBLISHED",
      dependencies: [],
      hints: [],
    });
    fixture.state.placements.set(`a-extra-main-${index}`, {
      id: `a-extra-main-${index}`,
      learningItemId: id,
      courseLevelId: "main-level-5",
      sortOrder: 21 + index,
      unlockPolicyJson: null,
    });
    fixture.quality.push({
      ...fixture.quality[0]!,
      id,
      kind: "WORD",
      targetType: "WORD",
      cards: [],
      hasExample: false,
    });
  }
  fixture.quality.sort((a, b) => a.id.localeCompare(b.id));
}

function unorderedContentFixture() {
  const fixture = harness();
  for (let index = 0; index < fixture.quality.length; index++) {
    const item = fixture.quality[index]!;
    fixture.quality[index] = {
      ...item,
      sourceReadings:
        item.kind === "KANJI" ? [...item.sourceReadings, "べつ"] : item.sourceReadings,
      cards: item.cards.map((card) => ({
        ...card,
        blockedAnswers:
          card.answerType === "READING"
            ? []
            : [
                { text: "неверный ответ", normalizedText: "неверный ответ" },
                { text: "чужой ответ", normalizedText: "чужой ответ" },
              ],
      })),
    };
  }
  for (const item of fixture.state.items.values())
    item.hints = [
      {
        locale: "ru-RU",
        hintType: "MEANING",
        body: "Подсказка.",
        sourceKind: "PROJECT_AUTHORED",
        version: 1,
      },
      {
        locale: "en-US",
        hintType: "MEANING",
        body: "A hint.",
        sourceKind: "PROJECT_AUTHORED",
        version: 1,
      },
    ];
  let revision = 0;
  const reorder = () => {
    revision++;
    let sequence = 0;
    const recreate = <T extends object>(rows: readonly T[]) =>
      [...rows].reverse().map((row) => ({
        ...row,
        id: `incidental-row-${revision}-${++sequence}`,
        createdAt: new Date(revision),
        updatedAt: new Date(revision),
      }));
    for (const item of fixture.state.items.values()) {
      item.hints = recreate(item.hints as object[]);
      (item.dependencies as object[]).reverse();
    }
    for (let index = 0; index < fixture.quality.length; index++) {
      const item = fixture.quality[index]!;
      fixture.quality[index] = {
        ...item,
        sourceReadings: [...item.sourceReadings].reverse(),
        validStageIndices: [...item.validStageIndices!].reverse(),
        cards: [...item.cards].reverse().map((card) => ({
          ...card,
          answers: recreate(card.answers),
          blockedAnswers: recreate(card.blockedAnswers),
        })),
        mnemonics: recreate(item.mnemonics),
        placements: [...item.placements].reverse(),
        requiredPrerequisiteTargetIds: [...item.requiredPrerequisiteTargetIds].reverse(),
        dependencies: [...item.dependencies].reverse().map((dependency) => ({
          ...dependency,
          placements: [...dependency.placements].reverse(),
        })),
      };
    }
  };
  reorder();
  return Object.assign(fixture, { reorder });
}

function harness() {
  // Keep the approved seal intact; only the database persistence is synthetic.
  const manifest = structuredClone(buildFoundationPilotManifest());
  const state = {
    courses: new Map<string, Row>(),
    levels: new Map<string, Row>(),
    placements: new Map<string, Row>(),
    items: new Map<string, Row>(),
    sources: new Map<string, Row>(),
    licenses: new Map<string, Row>(),
    runs: new Map<string, Row>(),
    records: new Map<string, Row>(),
    users: new Map<string, Row>(),
    enrollments: new Map<string, Row>(),
    settings: new Map<string, Row>(),
  };
  state.courses.set("main", {
    id: "main",
    slug: "japanese-ru-n2",
    titleRu: "Main 2300/8000",
    descriptionRu: "Main unchanged",
    status: "DRAFT",
    band: "FOUNDATION",
    courseType: "STRUCTURED",
    targetLevel: "JLPT N2",
  });
  for (let number = 1; number <= 60; number++)
    state.levels.set(`main-level-${number}`, {
      id: `main-level-${number}`,
      courseId: "main",
      levelNumber: number,
      band: number <= 5 ? "FOUNDATION" : "N5",
      titleRu: "Main level",
      descriptionRu: "Main unchanged",
      passPolicyJson: { version: 1, itemKind: "KANJI", passStageIndex: 5, requiredPercentage: 90 },
    });
  const ids = new Map(
    manifest.targets.map((target, index) => [
      target.key,
      `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ]),
  );
  const targetIds = new Map(manifest.targets.map((target) => [target.key, `target-${target.key}`]));
  const wordEvidence = (target: (typeof manifest.targets)[number]) => ({
    importedRecordId: `raw-${target.key}`,
    sourceRecordId: target.jmdictEntryId,
    importRunId: "jmdict-run",
    sourceVersion: "fixture-v1",
    checksumSha256: "f".repeat(64),
    licenseId: "jmdict-license",
  });
  for (const target of manifest.targets) {
    const id = ids.get(target.key)!;
    const dependencies = target.prerequisiteKeys.map((key) => ({
      prerequisiteItemId: ids.get(key)!,
      requiredStage: target.requiredStage,
    }));
    state.items.set(id, {
      id,
      kind: target.kind,
      targetType: target.kind,
      targetId: targetIds.get(target.key),
      status: "PUBLISHED",
      dependencies,
      hints: [],
    });
    state.placements.set(`main-slot-${id}`, {
      id: `main-slot-${id}`,
      courseLevelId: `main-level-${target.levelNumber}`,
      learningItemId: id,
      sortOrder: target.sortOrder,
      unlockPolicyJson: { policy: "level-order" },
    });
  }
  for (const [index, source] of manifest.sources.entries()) {
    const sourceId = `source-${source.dataSourceName}`;
    const licenseId = `license-${source.dataSourceName}`;
    state.licenses.set(licenseId, {
      id: licenseId,
      name: `Original ${source.dataSourceName}`,
      scope: "PROJECT_AUTHORED",
      spdxLikeId: "LicenseRef-Project-Authored",
    });
    state.sources.set(sourceId, { id: sourceId, name: source.dataSourceName, licenseId });
    const runId = `source-run-${index}`;
    const recordIds: string[] = [];
    for (const [recordIndex, expected] of source.records.entries()) {
      const recordId = `curation-record-${index}-${recordIndex}`;
      recordIds.push(recordId);
      const target = manifest.targets.find((target) => target.key === expected.wordKey);
      const rawJson =
        expected.wordKey === undefined
          ? structuredClone(expected.content)
          : {
              batchId: source.id,
              word: structuredClone(expected.content),
              sourceEvidence: wordEvidence(target!),
            };
      state.records.set(recordId, {
        id: recordId,
        importRunId: runId,
        sourceRecordId: expected.sourceRecordId,
        recordType: "PROJECT_AUTHORED",
        rawJson,
      });
    }
    state.runs.set(runId, {
      id: runId,
      dataSourceId: sourceId,
      checksumSha256: source.checksumSha256,
      sourceVersion: source.version,
      sourceFileName: source.sourceFile,
      status: "SUCCESS",
      statsJson: { batchId: source.id, reviewedAt: source.reviewedAt },
      recordIds,
    });
  }
  const quality = manifest.targets
    .map((target): QualityItem => {
      const id = ids.get(target.key)!;
      const kinds = target.kind === "COMPONENT" ? ["MEANING"] : ["MEANING", "READING"];
      return {
        id,
        kind: target.kind,
        targetType: target.kind,
        band: "FOUNDATION",
        targetExists: true,
        targetMeaningsValid: true,
        source:
          target.kind === "COMPONENT"
            ? null
            : {
                sourceRecordId: `fixture:${target.key}`,
                checksumSha256: "f".repeat(64),
                sourceVersion: "fixture-v1",
                status: "SUCCESS",
                sourceUrl: "https://fixture.invalid/source",
                licenseName: "Synthetic fixture license",
                attributionText: "Synthetic source fixture, no imported text.",
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
        cards: kinds.map((kind) => ({
          id: `card-${id}-${kind}`,
          promptType: kind,
          answerType: kind,
          locale: "ru-RU",
          blockedAnswers: [],
          answers: target.answers
            .filter((answer) => answer.promptType === kind)
            .map(({ text, locale, isPrimary }) => ({
              text,
              locale,
              isPrimary,
              sourceKind: "PROJECT_AUTHORED",
              normalizedText:
                kind === "READING"
                  ? normalizeJapaneseReading(text)
                  : normalizeMeaning(text, locale === "en-US" ? "en-US" : "ru-RU"),
            })),
        })),
        mnemonics: [
          { locale: "ru-RU", body: "Проверенное объяснение.", sourceKind: "PROJECT_AUTHORED" },
          { locale: "en-US", body: "Reviewed explanation.", sourceKind: "PROJECT_AUTHORED" },
        ],
        placements: [
          { levelNumber: target.levelNumber, sortOrder: target.sortOrder, band: "FOUNDATION" },
        ],
        requiredPrerequisiteTargetIds: target.prerequisiteKeys.map((key) => targetIds.get(key)!),
        dependencies: target.prerequisiteKeys.map((key) => {
          const required = manifest.targets.find((target) => target.key === key)!;
          return {
            id: ids.get(key)!,
            targetId: targetIds.get(key)!,
            kind: required.kind,
            status: "PUBLISHED",
            requiredStage: target.requiredStage,
            placements: [
              {
                levelNumber: required.levelNumber,
                sortOrder: required.sortOrder,
                band: "FOUNDATION",
              },
            ],
          };
        }),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const cards = quality.flatMap((item) => item.cards.map((card) => card.id));
  const privateRows = {
    srs: { learningCardId: cards[0], stageIndex: 5, dueAt: "2026-12-01" },
    synonym: { learningCardId: cards[0], text: "мой ответ" },
    mnemonic: { learningItemId: quality[0]!.id, body: "личная запись" },
  };
  const mutations: string[] = [];
  let sequence = 0;
  const forbidden = vi.fn(() => {
    throw new Error(
      "No global learning item/card/SRS/private mutations or user discovery permitted.",
    );
  });
  const byId = (table: Map<string, Row>, id: unknown) => table.get(String(id));
  const readCourse = vi.fn(async ({ where }: { where: { slug: string } }) => {
    const course = [...state.courses.values()].find((course) => course.slug === where.slug);
    return course === undefined
      ? null
      : {
          ...course,
          levels: [...state.levels.values()]
            .filter((level) => level.courseId === course.id)
            .sort((a, b) => Number(a.levelNumber) - Number(b.levelNumber)),
        };
  });
  const upsert = (
    name: string,
    table: Map<string, Row>,
    identity: (args: UpsertArgs) => (row: Row) => boolean,
  ) =>
    vi.fn((args: UpsertArgs) => {
      mutations.push(name);
      const existing = [...table.values()].find(identity(args));
      const row = {
        ...(existing ?? args.create),
        ...(existing === undefined ? {} : args.update),
        id:
          existing?.id ??
          (typeof args.create.id === "string" ? args.create.id : `new-${++sequence}`),
      } as Row;
      table.set(row.id, row);
      return row;
    });
  const fixture = {
    manifest,
    state,
    quality,
    cards,
    privateRows,
    mutations,
    forbidden,
    readCourse,
    extraQuality: false,
    changePilotQuality: false,
    beforeTransaction: undefined as (() => void) | undefined,
    pilotPlacements: (courseId: string) =>
      [...state.placements.values()].filter(
        (row) => state.levels.get(String(row.courseLevelId))?.courseId === courseId,
      ),
    identities: () => ({
      courses: [...state.courses.keys()],
      levels: [...state.levels.keys()],
      placements: [...state.placements.keys()],
      records: [...state.records.keys()],
      runs: [...state.runs.keys()],
    }),
  };
  vi.mocked(loadContentQualityItems).mockImplementation(async (_db, options) => {
    const rows = quality.filter(
      (item) =>
        (options?.itemIds === undefined || options.itemIds.includes(item.id)) &&
        (options?.cursor === undefined || item.id > options.cursor),
    );
    if (options?.cursor !== undefined && fixture.extraQuality)
      return [{ ...quality[0]!, id: "ffffffff-ffff-4fff-8fff-ffffffffffff" }];
    const page = rows.slice(0, options?.limit ?? 50);
    if (options?.courseSlug === FOUNDATION_PILOT_SLUG && fixture.changePilotQuality) {
      const changed = structuredClone(page);
      if (changed[0])
        changed[0] = {
          ...changed[0],
          mnemonics: [
            { locale: "ru-RU", body: "Иное объяснение.", sourceKind: "PROJECT_AUTHORED" },
            { locale: "en-US", body: "A different explanation.", sourceKind: "PROJECT_AUTHORED" },
          ],
        };
      return changed;
    }
    return page;
  });
  const delegates = {
    course: {
      findUnique: readCourse,
      upsert: upsert(
        "course.upsert",
        state.courses,
        (args) => (row) => row.slug === args.where.slug,
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        mutations.push("course.update");
        const row = state.courses.get(where.id)!;
        if (row.slug !== FOUNDATION_PILOT_SLUG) throw new Error("Cannot publish main course");
        Object.assign(row, data);
        return row;
      }),
    },
    courseLevel: {
      upsert: upsert(
        "level.upsert",
        state.levels,
        (args) => (row) => matches(row, args.where.courseId_levelNumber),
      ),
    },
    courseLevelItem: {
      findMany: vi.fn(
        async ({
          where,
          take,
        }: {
          where: {
            courseLevel: { courseId: string };
            learningItem?: {
              OR: readonly { targetType: string; targetId: { in: readonly string[] } }[];
            };
          };
          take: number;
        }) =>
          fixture
            .pilotPlacements(where.courseLevel.courseId)
            .filter((row) => {
              if (where.learningItem === undefined) return true;
              const item = state.items.get(String(row.learningItemId));
              return (
                item !== undefined &&
                where.learningItem.OR.some(
                  (filter) =>
                    item.targetType === filter.targetType &&
                    filter.targetId.in.includes(String(item.targetId)),
                )
              );
            })
            .sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, take)
            .map((row) => ({
              ...row,
              courseLevel: state.levels.get(String(row.courseLevelId)),
              learningItem: state.items.get(String(row.learningItemId)),
            })),
      ),
      upsert: forbidden,
      createMany: vi.fn(({ data, skipDuplicates }: { data: Row[]; skipDuplicates: boolean }) => {
        expect(skipDuplicates).toBe(true);
        mutations.push("placement.createMany");
        let count = 0;
        for (const input of data) {
          const existing = [...state.placements.values()].some(
            (row) =>
              row.courseLevelId === input.courseLevelId &&
              row.learningItemId === input.learningItemId,
          );
          if (existing) continue;
          const row = { ...input, id: `new-${++sequence}` };
          state.placements.set(row.id, row);
          count++;
        }
        return { count };
      }),
    },
    component: {
      findMany: vi.fn(async () =>
        manifest.targets
          .filter((target) => target.kind === "COMPONENT")
          .map((target) => ({ id: targetIds.get(target.key), symbol: target.expression })),
      ),
    },
    kanji: {
      findMany: vi.fn(async () =>
        manifest.targets
          .filter((target) => target.kind === "KANJI")
          .map((target) => ({ id: targetIds.get(target.key), character: target.expression })),
      ),
    },
    word: {
      findMany: vi.fn(async () =>
        manifest.targets
          .filter((target) => target.kind === "WORD")
          .map((target) => {
            const evidence = wordEvidence(target);
            return {
              id: targetIds.get(target.key),
              expression: target.expression,
              reading: target.reading,
              jmdictEntryId: target.jmdictEntryId,
              jmdictImportedRecordId: evidence.importedRecordId,
              importedRecord: {
                id: evidence.importedRecordId,
                sourceRecordId: evidence.sourceRecordId,
                importRun: {
                  id: evidence.importRunId,
                  sourceVersion: evidence.sourceVersion,
                  checksumSha256: evidence.checksumSha256,
                  dataSource: { licenseId: evidence.licenseId },
                },
              },
            };
          }),
      ),
    },
    dataSource: {
      findUnique: vi.fn(async ({ where }: { where: { name: string } }) => {
        const source = [...state.sources.values()].find((source) => source.name === where.name);
        return source === undefined
          ? null
          : { ...source, license: byId(state.licenses, source.licenseId) };
      }),
      upsert: upsert(
        "source.upsert",
        state.sources,
        (args) => (row) => row.name === args.where.name,
      ),
    },
    license: {
      findUnique: vi.fn(
        async ({ where }: { where: { name: string } }) =>
          [...state.licenses.values()].find((row) => row.name === where.name) ?? null,
      ),
      upsert: upsert(
        "license.upsert",
        state.licenses,
        (args) => (row) => row.name === args.where.name,
      ),
    },
    importRun: {
      findUnique: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { dataSourceId_checksumSha256: Record<string, unknown> };
          include?: { records?: unknown };
        }) => {
          const run = [...state.runs.values()].find((row) =>
            matches(row, where.dataSourceId_checksumSha256),
          );
          return run === undefined
            ? null
            : include?.records === undefined
              ? run
              : { ...run, records: (run.recordIds as string[]).map((id) => state.records.get(id)) };
        },
      ),
      upsert: upsert(
        "run.upsert",
        state.runs,
        (args) => (row) => matches(row, args.where.dataSourceId_checksumSha256),
      ),
    },
    importedRecord: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const record = state.records.get(where.id);
        if (record === undefined) return null;
        const run = byId(state.runs, record.importRunId)!;
        const source = byId(state.sources, run.dataSourceId)!;
        return {
          ...record,
          importRun: {
            ...run,
            dataSource: { ...source, license: byId(state.licenses, source.licenseId) },
          },
        };
      }),
      upsert: upsert("record.upsert", state.records, (args) => (row) => row.id === args.where.id),
    },
    user: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) => state.users.get(where.id) ?? null,
      ),
      findMany: forbidden,
    },
    userEnrollment: {
      upsert: upsert(
        "enrollment.upsert",
        state.enrollments,
        (args) => (row) => matches(row, args.where.userId_courseId),
      ),
    },
    userSettings: {
      upsert: vi.fn((args: UpsertArgs) => {
        mutations.push("settings.upsert");
        const userId = String(args.where.userId);
        const existing = state.settings.get(userId);
        const row = {
          ...(existing ?? { currentCourseId: null, ...args.create }),
          ...(existing === undefined ? {} : args.update),
          id: existing?.id ?? `new-${++sequence}`,
        } as Row;
        state.settings.set(userId, row);
        return row;
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          mutations.push("settings.updateMany");
          for (const row of state.settings.values())
            if (matches(row, where)) Object.assign(row, data);
          return { count: 1 };
        },
      ),
    },
    learningItem: { update: forbidden, updateMany: forbidden, upsert: forbidden },
    learningCard: { update: forbidden, updateMany: forbidden, upsert: forbidden },
    dependency: { update: forbidden, deleteMany: forbidden, createMany: forbidden },
    userSrsState: {
      update: forbidden,
      updateMany: forbidden,
      upsert: forbidden,
      deleteMany: forbidden,
    },
    userItemOverride: { update: forbidden, upsert: forbidden, deleteMany: forbidden },
    userMnemonic: { update: forbidden, upsert: forbidden, deleteMany: forbidden },
  };
  const transaction = vi.fn(
    async (callback: (db: typeof delegates) => Promise<unknown>, _options?: unknown) => {
      fixture.beforeTransaction?.();
      const before = structuredClone(state);
      try {
        return await callback(delegates);
      } catch (error) {
        for (const name of Object.keys(state) as (keyof typeof state)[]) {
          state[name].clear();
          for (const [id, row] of before[name]) state[name].set(id, row);
        }
        throw error;
      }
    },
  );
  return Object.assign(fixture, {
    db: { ...delegates, $transaction: transaction } as unknown as PrismaClient,
    transaction,
  });
}
type UpsertArgs = {
  where: Record<string, unknown>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};
function matches(row: Row, expected: unknown): boolean {
  return (
    expected !== null &&
    typeof expected === "object" &&
    Object.entries(expected).every(([key, value]) => row[key] === value)
  );
}
