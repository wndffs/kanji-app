import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildFoundationPilotManifestV4,
  buildFoundationPilotManifestV5,
  foundationPilotRecordId,
  FOUNDATION_PILOT_V5_RECORD_ID,
  planFoundationPilot,
  publishFoundationPilot,
} from "../src/foundation-pilot";
import { parseFoundationPilotArgs } from "../prisma/publish-foundation-pilot";
import { FOUNDATION_WAVE07_LEVELS } from "../src/foundation-wave07-policy";
const canonicalHash = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, row: unknown) =>
        row !== null && typeof row === "object" && !Array.isArray(row)
          ? Object.fromEntries(Object.entries(row).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
          : row,
      ),
    )
    .digest("hex");

describe("sealed finite foundation V5", () => {
  it("preserves V4 and adds exactly nine components, ten kanji and twenty words", () => {
    const old = buildFoundationPilotManifestV4();
    const next = buildFoundationPilotManifestV5();
    expect(canonicalHash(old)).toBe(
      "7353baf893c3bde9fb7279529bcf69d66d7e0b9ef81396a8fb96169c686e70fc",
    );
    expect(canonicalHash(next)).toBe(
      "2943f058d3590f190274bdcabf81e1270c1fa1274f5b6e2c02b0e9737eeca03a",
    );
    expect(next.counts).toEqual({ components: 88, kanji: 111, words: 140, items: 339, cards: 590 });
    expect(next.sources).toHaveLength(14);
    expect(
      next.sources.filter((source) => old.sources.some((previous) => previous.id === source.id)),
    ).toEqual(old.sources);
    expect(
      next.targets.filter((target) => old.targets.some((previous) => previous.key === target.key)),
    ).toEqual(old.targets);
    expect(next.levels.slice(7).map((level) => level.passPolicyJson)).toEqual(
      FOUNDATION_WAVE07_LEVELS.map((level) => level.passPolicyJson),
    );
    expect(next.targets.filter((target) => target.blockedAnswers)).toHaveLength(9);
    expect(foundationPilotRecordId(next)).toBe(FOUNDATION_PILOT_V5_RECORD_ID);
    expect(parseFoundationPilotArgs(["--pilot", "v5"])).toEqual({ mode: "plan", pilot: "v5" });
  });
  it.each(["answer", "block", "source", "policy", "slot", "review"])(
    "rejects %s tampering before any DB access",
    async (kind) => {
      const manifest = structuredClone(buildFoundationPilotManifestV5());
      const target = manifest.targets.find((item) => item.blockedAnswers)!;
      if (kind === "answer") target.answers = [];
      if (kind === "block") target.blockedAnswers = [];
      if (kind === "source") manifest.sources.at(-1)!.checksumSha256 = "0".repeat(64);
      if (kind === "policy")
        Object.assign(manifest.levels[7]!.passPolicyJson, { itemKind: "WORD" });
      if (kind === "slot") manifest.targets.at(-1)!.sortOrder++;
      if (kind === "review") manifest.sources.at(-1)!.reviewedAt = null;
      const access = vi.fn(() => {
        throw new Error("Unexpected DB access");
      });
      const db = new Proxy({}, { get: access }) as never;
      await expect(planFoundationPilot(db, { manifest })).rejects.toThrow(
        "sealed independently reviewed",
      );
      await expect(publishFoundationPilot(db, { manifest })).rejects.toThrow(
        "sealed independently reviewed",
      );
      expect(access).not.toHaveBeenCalled();
    },
  );
});
