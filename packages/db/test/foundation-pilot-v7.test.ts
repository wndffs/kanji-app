import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildFoundationPilotManifestV6,
  buildFoundationPilotManifestV7,
  planFoundationPilot,
  publishFoundationPilot,
} from "../src/foundation-pilot";
import { parseFoundationPilotArgs } from "../prisma/publish-foundation-pilot";
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

describe("finite everyday foundation V7", () => {
  it("preserves all V6 targets, sources, levels and policies, adding exactly 29 items", () => {
    const old = buildFoundationPilotManifestV6();
    const next = buildFoundationPilotManifestV7();
    expect(hash(old)).toBe("544528b1d3d0d191e2d3285e76092b9a7cc795b0645e7ce5f9b4cc7ff4bf7156");
    expect(hash(next)).toBe("9bb436abf5afce6373f1ed60c71fe8a06992ed6f5560cbdd1394e8813ad3c9f2");
    expect(next.counts).toEqual({ components: 92, kanji: 117, words: 180, items: 389, cards: 686 });
    expect(next.targets.filter((t) => old.targets.some((o) => o.key === t.key))).toEqual(
      old.targets,
    );
    expect(next.sources.filter((t) => old.sources.some((o) => o.id === t.id))).toEqual(old.sources);
    expect(next.levels.slice(0, 12)).toEqual(old.levels);
    expect(next.levels.slice(12).map((l) => l.passPolicyJson.itemKind)).toEqual([
      "COMPONENT",
      "KANJI",
      "WORD",
    ]);
    expect(next.targets.length - old.targets.length).toBe(29);
    expect(next.sources).toHaveLength(18);
    expect(parseFoundationPilotArgs(["--pilot", "v7"])).toEqual({ mode: "plan", pilot: "v7" });
  });
  it.each(["answer", "block", "source", "policy", "slot", "review", "reason"])(
    "rejects %s tampering before any DB access",
    async (kind) => {
      const manifest = structuredClone(buildFoundationPilotManifestV7());
      const target = manifest.targets.find((t) => t.key === "word:帰る:かえる")!;
      if (kind === "answer") target.answers = [];
      if (kind === "block") target.blockedAnswers = [];
      if (kind === "source") manifest.sources.at(-1)!.checksumSha256 = "0".repeat(64);
      if (kind === "policy")
        Object.assign(manifest.levels[14]!.passPolicyJson, { itemKind: "KANJI" });
      if (kind === "slot") target.sortOrder++;
      if (kind === "review") manifest.sources.at(-1)!.reviewedAt = null;
      if (kind === "reason") {
        const row = manifest.sources.at(-1)!.records[0]!.content as {
          meanings: { ru: { blocked: { reason: string }[] } };
        };
        row.meanings.ru.blocked[0]!.reason = "Changed reason";
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
