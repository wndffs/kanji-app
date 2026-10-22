import { describe, expect, it, vi } from "vitest";

import { containsOnlyNonRuntimeChanges, ignoredBuildExitCode } from "./ignore-web-build.mjs";

const SHA = "a".repeat(40);

describe("deployment build selection", () => {
  it("skips only known documentation and test trees", () => {
    expect(
      containsOnlyNonRuntimeChanges([
        "docs/READINESS.md",
        "prompts/MASTER_PROMPT.md",
        ".github/workflows/ci.yml",
        "AGENTS.md",
        "README.md",
        "apps/web/e2e/reviews.spec.ts",
        "apps/api/test/items.test.ts",
        "packages/db/test/main-course.test.ts",
        "scripts/ignore-web-build.test.ts",
      ]),
    ).toBe(true);
  });

  it.each([
    "apps/web/src/app/page.tsx",
    "apps/web/public/example.md",
    "apps/web/next.config.ts",
    "apps/api/src/main.ts",
    "packages/db/prisma/schema.prisma",
    "packages/shared/src/index.ts",
    "packages/ui/src/Button.tsx",
    "package.json",
    "package-lock.json",
    "vercel.json",
    "render.yaml",
    "scripts/ignore-web-build.mjs",
    "new-package/src/index.ts",
    "docs/../package.json",
    "docs\\READINESS.md",
    "/docs/READINESS.md",
    "docs/line\nbreak",
    "",
  ])("builds when a known or unknown runtime path changes: %s", (path) => {
    expect(containsOnlyNonRuntimeChanges(["docs/READINESS.md", path])).toBe(false);
  });

  it("builds an empty diff so a manual same-commit redeployment is not suppressed", () => {
    expect(containsOnlyNonRuntimeChanges([])).toBe(false);
    const git = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0, stdout: "" });
    expect(ignoredBuildExitCode({ env: { VERCEL_GIT_PREVIOUS_SHA: SHA }, git })).toBe(1);
  });

  it("compares the last successful deployment, not just the immediate parent commit", () => {
    const git = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({
        status: 0,
        stdout: "docs/READINESS.md\0packages/shared/src/index.ts\0",
      });
    expect(ignoredBuildExitCode({ env: { VERCEL_GIT_PREVIOUS_SHA: SHA }, git })).toBe(1);
    expect(git.mock.calls[1]?.[1]).toEqual([
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      SHA,
      "HEAD",
      "--",
    ]);
    expect(git.mock.calls[1]?.[2]).toMatchObject({ shell: false, timeout: 10_000 });
  });

  it("returns Vercel's zero-to-ignore exit code only for a proven non-runtime diff", () => {
    const git = vi
      .fn()
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({
        status: 0,
        stdout: "docs/READINESS.md\0apps/web/e2e/reviews.spec.ts\0",
      });
    expect(ignoredBuildExitCode({ env: { VERCEL_GIT_PREVIOUS_SHA: SHA }, git })).toBe(0);
  });

  it.each([
    {},
    { VERCEL_GIT_PREVIOUS_SHA: "HEAD^; echo unsafe" },
    { VERCEL_GIT_PREVIOUS_SHA: SHA, KANJI_FORCE_DEPLOY: "1" },
  ])("builds without trusted history or when explicitly forced", (env) => {
    const git = vi.fn();
    expect(ignoredBuildExitCode({ env, git })).toBe(1);
    expect(git).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: 1 }],
    [{ status: 0 }, { status: 1, stdout: "docs/example.md\0" }],
    [{ status: 0 }, { status: 0, stdout: "docs/incomplete.md" }],
    [{ status: 0 }, { status: null, error: new Error("timeout") }],
  ])("builds when history or diff output is unreliable", (...responses) => {
    const git = vi.fn();
    for (const response of responses) git.mockReturnValueOnce(response);
    expect(ignoredBuildExitCode({ env: { VERCEL_GIT_PREVIOUS_SHA: SHA }, git })).toBe(1);
  });

  it("builds on unexpected git failures", () => {
    expect(
      ignoredBuildExitCode({
        env: { VERCEL_GIT_PREVIOUS_SHA: SHA },
        git: () => {
          throw new Error("unavailable");
        },
      }),
    ).toBe(1);
  });
});
