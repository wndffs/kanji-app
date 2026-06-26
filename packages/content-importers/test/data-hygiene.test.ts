import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "..", "..", "..");
const rawDataDir = join(repoRoot, "data", "raw");

describe("raw dataset hygiene", () => {
  it("keeps full-size raw imports out of git-tracked data/raw", () => {
    expect(listUnexpectedRawDataFiles()).toEqual([]);
  });

  it("keeps raw imports out of git and Docker contexts", () => {
    expect(readFileSync(join(repoRoot, ".gitignore"), "utf8")).toContain("data/raw/**");
    expect(readFileSync(join(repoRoot, ".dockerignore"), "utf8")).toContain("data/raw");
  });
});

function listUnexpectedRawDataFiles(): readonly string[] {
  return readdirSync(rawDataDir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(rawDataDir, entry.name);
    const relativePath = relative(repoRoot, absolutePath).replace(/\\/gu, "/");

    if (entry.name === ".gitkeep") {
      return [];
    }

    if (entry.isDirectory()) {
      return listFilesRecursive(absolutePath);
    }

    return [relativePath];
  });
}

function listFilesRecursive(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((name) => {
    const absolutePath = join(directory, name);
    const relativePath = relative(repoRoot, absolutePath).replace(/\\/gu, "/");

    return statSync(absolutePath).isDirectory() ? listFilesRecursive(absolutePath) : [relativePath];
  });
}
