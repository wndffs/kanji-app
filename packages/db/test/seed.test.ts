import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const seed = readFileSync(join(currentDir, "..", "prisma", "seed.ts"), "utf8");

describe("Prisma seed", () => {
  it("keeps the demo user development-only with a real password hash", () => {
    expect(seed).toContain("if (shouldSeedDevelopmentUser())");
    expect(seed).toContain('return process.env.NODE_ENV !== "production";');
    expect(seed).toContain("const DEV_USER_PASSWORD_HASH =");
    expect(seed).toContain('"scrypt$v1$16384$8$1$');
    expect(seed).not.toContain("dev-only-placeholder-hash");
  });
});
