import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";
import type * as PrismaModule from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { parseFoundationPilotArgs } from "../prisma/publish-foundation-pilot";
import { buildFoundationPilotManifest, FOUNDATION_PILOT_RECORD_ID } from "../src/foundation-pilot";
import { buildMainCourseContentBatches } from "../src/main-course-content";
import { buildMainCourseWordBatch } from "../src/main-course-word-content";

vi.mock("@prisma/client", async (importOriginal) => ({
  ...(await importOriginal<typeof PrismaModule>()),
  PrismaClient: vi.fn(() => {
    throw new Error("CLI argument validation must not construct Prisma.");
  }),
}));

describe("foundation pilot CLI arguments before Prisma construction", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const modes = ["--plan", "--publish", "--validate-only"];

  it("defaults to a read-only plan and accepts exactly one explicit mode", () => {
    expect(parseFoundationPilotArgs([])).toEqual({ mode: "plan" });
    for (const flag of modes)
      expect(parseFoundationPilotArgs([flag])).toEqual({ mode: flag.slice(2) });
    expect(parseFoundationPilotArgs(["--enroll-user-id", userId])).toEqual({
      mode: "plan",
      enrollUserId: userId,
    });
    expect(parseFoundationPilotArgs(["--publish", "--enroll-user-id", userId])).toEqual({
      mode: "publish",
      enrollUserId: userId,
    });
    expect(PrismaClient).not.toHaveBeenCalled();
  });

  it.each(modes.flatMap((first) => modes.map((second) => ({ args: [first, second] }))))(
    "rejects duplicate or conflicting modes: $args",
    ({ args }) => {
      expect(() => parseFoundationPilotArgs(args)).toThrow("one publication mode");
      expect(PrismaClient).not.toHaveBeenCalled();
    },
  );

  it.each([
    { args: ["--enroll-user-id"] },
    { args: ["--enroll-user-id", "--publish"] },
    { args: ["--enroll-user-id", ""] },
    { args: ["--enroll-user-id", "all-users"] },
    { args: ["--enroll-user-id", `${userId} `] },
    { args: ["--enroll-user-id", userId.replace(/-/gu, "")] },
    { args: ["--enroll-user-id", userId, "--enroll-user-id", userId] },
    {
      args: [
        "--enroll-user-id",
        userId,
        "--enroll-user-id",
        "22222222-2222-4222-8222-222222222222",
      ],
    },
  ])("rejects malformed, missing or repeated enrollment UUIDs: $args", ({ args }) => {
    expect(() => parseFoundationPilotArgs(args)).toThrow("one explicit UUID");
    expect(PrismaClient).not.toHaveBeenCalled();
  });

  it("rejects enrollment ignored by database-free validation and extra UUID tokens", () => {
    expect(() => parseFoundationPilotArgs(["--validate-only", "--enroll-user-id", userId])).toThrow(
      "not --validate-only",
    );
    expect(() => parseFoundationPilotArgs(["--enroll-user-id", userId, userId])).toThrow(
      "Supported flags",
    );
    expect(PrismaClient).not.toHaveBeenCalled();
  });
});

describe("finite Foundation pilot manifest", () => {
  it("defines only the separate five-level 40/40/20 pilot without changing source manifests", () => {
    const before = JSON.stringify([buildMainCourseContentBatches(), buildMainCourseWordBatch()]);
    const manifest = buildFoundationPilotManifest();
    expect(manifest.slug).toBe("japanese-foundation-pilot-v1");
    expect(manifest.sourceCourseSlug).toBe("japanese-ru-n2");
    expect(manifest.titleRu).toContain("40 компонентов, 40 кандзи и 20 слов");
    expect(manifest.counts).toEqual({
      components: 40,
      kanji: 40,
      words: 20,
      items: 100,
      cards: 160,
    });
    expect(manifest.targets).toHaveLength(100);
    expect(manifest.sources).toHaveLength(3);
    expect(
      manifest.levels.map((level) => [
        level.levelNumber,
        level.passPolicyJson.itemKind,
        level.passPolicyJson.passStageIndex,
        level.passPolicyJson.requiredPercentage,
      ]),
    ).toEqual([
      [1, "COMPONENT", 5, 90],
      [2, "KANJI", 5, 90],
      [3, "KANJI", 5, 90],
      [4, "KANJI", 5, 90],
      [5, "WORD", 5, 90],
    ]);
    expect(JSON.stringify([buildMainCourseContentBatches(), buildMainCourseWordBatch()])).toBe(
      before,
    );
    expect(FOUNDATION_PILOT_RECORD_ID).toMatch(/^[a-f0-9-]{36}$/u);
  });

  it("keeps the exact source placement slots and earlier prerequisite closure", () => {
    const manifest = buildFoundationPilotManifest();
    const byKey = new Map(manifest.targets.map((target) => [target.key, target]));
    expect(
      new Set(manifest.targets.map((target) => `${target.levelNumber}:${target.sortOrder}`)).size,
    ).toBe(100);
    expect(
      manifest.targets
        .filter((target) => target.kind === "COMPONENT")
        .map((target) => target.sortOrder)
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 40 }, (_, index) => index + 1));
    expect(
      manifest.targets
        .filter((target) => target.kind === "WORD")
        .map((target) => [target.levelNumber, target.sortOrder]),
    ).toEqual(Array.from({ length: 20 }, (_, index) => [5, index + 1]));
    for (const target of manifest.targets) {
      expect(
        target.answers
          .filter((answer) => answer.promptType === "MEANING")
          .some((answer) => answer.locale === "ru-RU"),
      ).toBe(true);
      expect(
        target.prerequisiteKeys.every((key) => byKey.get(key)!.levelNumber < target.levelNumber),
      ).toBe(true);
    }
  });

  it("rejects automatic expansion into an extra batch or a different main-course identity", () => {
    const batches = buildMainCourseContentBatches();
    expect(() =>
      buildFoundationPilotManifest([
        ...batches,
        { ...batches[0]!, id: "future", components: [], kanji: [] },
      ]),
    ).toThrow("exactly the three registered");
    expect(() =>
      buildFoundationPilotManifest(batches, {
        ...buildMainCourseWordBatch(),
        courseSlug: "another-course",
      }),
    ).toThrow("exactly the three registered");
  });

  it("dry-validates the CLI without a database URL or client connection", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const output = execFileSync(
      process.execPath,
      [
        join(root, "node_modules/tsx/dist/cli.mjs"),
        join(root, "packages/db/prisma/publish-foundation-pilot.ts"),
        "--validate-only",
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
    );
    expect(JSON.parse(output)).toMatchObject({
      status: "valid-finite-manifest",
      slug: "japanese-foundation-pilot-v1",
      levels: 5,
      counts: { items: 100, cards: 160 },
      manifestRecordId: FOUNDATION_PILOT_RECORD_ID,
    });
  });

  it.each([
    { args: ["--publish", "--unknown"], error: "Supported flags:" },
    { args: ["--unknown", "--publish"], error: "Supported flags:" },
    { args: ["--plan", "--validate-only"], error: "one publication mode" },
    { args: ["--publish", "--enroll-user-id", "all-users"], error: "one explicit UUID" },
  ])("rejects invalid CLI arguments before database setup: $args", ({ args, error }) => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const result = spawnSync(
      process.execPath,
      [
        join(root, "node_modules/tsx/dist/cli.mjs"),
        join(root, "packages/db/prisma/publish-foundation-pilot.ts"),
        ...args,
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(error);
    expect(result.stderr).not.toContain("DATABASE_URL is required");
    expect(result.stderr).not.toContain("All three source batches require");
    expect(result.stdout).toBe("");
  });
});
