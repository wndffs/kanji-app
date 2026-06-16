import { describe, expect, it } from "vitest";

import { workspacePackages } from "../src";

describe("workspacePackages", () => {
  it("lists the required domain packages", () => {
    expect(workspacePackages.map((pkg) => pkg.name)).toEqual([
      "@kanji-srs/db",
      "@kanji-srs/srs",
      "@kanji-srs/japanese",
      "@kanji-srs/content-importers",
      "@kanji-srs/shared",
      "@kanji-srs/ui",
    ]);
  });
});
