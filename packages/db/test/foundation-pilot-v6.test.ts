import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildFoundationPilotManifestV5,
  buildFoundationPilotManifestV6,
  planFoundationPilot,
  publishFoundationPilot,
} from "../src/foundation-pilot";
import { parseFoundationPilotArgs } from "../prisma/publish-foundation-pilot";
import { WAVE08_REVIEW_DECISION } from "../src/lexical-wave08-review";
const hash = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, row: unknown) =>
        row !== null && typeof row === "object" && !Array.isArray(row)
          ? Object.fromEntries(Object.entries(row).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
          : row,
      ),
    )
    .digest("hex");
describe("finite lexical foundation V6", () => {
  it("preserves every V5 source target level and policy while adding only 21 items", () => {
    const old = buildFoundationPilotManifestV5();
    const next = buildFoundationPilotManifestV6();
    expect(hash(old)).toBe("2943f058d3590f190274bdcabf81e1270c1fa1274f5b6e2c02b0e9737eeca03a");
    expect(next.counts).toEqual({ components: 88, kanji: 112, words: 160, items: 360, cards: 632 });
    expect(hash(next)).toBe("544528b1d3d0d191e2d3285e76092b9a7cc795b0645e7ce5f9b4cc7ff4bf7156");
    expect(next.targets.filter((t) => old.targets.some((o) => o.key === t.key))).toEqual(
      old.targets,
    );
    expect(next.sources.filter((t) => old.sources.some((o) => o.id === t.id))).toEqual(old.sources);
    expect(next.levels.slice(0, 10)).toEqual(old.levels);
    expect(next.levels.slice(10).map((l) => l.passPolicyJson.itemKind)).toEqual(["KANJI", "WORD"]);
    expect(next.sources).toHaveLength(16);
    expect(parseFoundationPilotArgs(["--pilot", "v6"])).toEqual({ mode: "plan", pilot: "v6" });
    expect(WAVE08_REVIEW_DECISION.humanReviewed).toBe(false);
  });
  it.each(["answer", "block", "reason", "source", "policy", "slot", "review"])(
    "rejects %s tampering without DB access",
    async (kind) => {
      const manifest = structuredClone(buildFoundationPilotManifestV6());
      const target = manifest.targets.find((t) => t.key === "word:聞く:きく")!;
      if (kind === "answer") target.answers = [];
      if (kind === "block") target.blockedAnswers = [];
      if (kind === "source") manifest.sources.at(-1)!.checksumSha256 = "0".repeat(64);
      if (kind === "policy")
        Object.assign(manifest.levels[11]!.passPolicyJson, { itemKind: "KANJI" });
      if (kind === "slot") target.sortOrder++;
      if (kind === "review") manifest.sources.at(-1)!.reviewedAt = null;
      if (kind === "reason") {
        const content = manifest.sources.at(-1)!.records[0]!.content as {
          meanings: { ru: { blocked: { reason: string }[] } };
        };
        content.meanings.ru.blocked[0]!.reason = "Changed reason";
      }
      const access = vi.fn(() => {
        throw new Error("Unexpected DB access");
      });
      const db = new Proxy({}, { get: access }) as never;
      await expect(planFoundationPilot(db, { manifest })).rejects.toThrow();
      await expect(publishFoundationPilot(db, { manifest })).rejects.toThrow();
      expect(access).not.toHaveBeenCalled();
    },
  );
});
