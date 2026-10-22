import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../prisma/migrations/20261022160000_separate_legacy_kanji_jlpt/migration.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const schema = readFileSync(
  fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url)),
  "utf8",
);

describe("JLPT edition migration contract", () => {
  it("keeps modern and historical nullable metadata separate and indexed", () => {
    const kanji = schema.match(/model Kanji \{([\s\S]*?)\n\}/u)?.[1];
    expect(kanji).toMatch(/\bjlptLevel\s+Int\?/u);
    expect(kanji).toMatch(/\blegacyJlptLevel\s+Int\?/u);
    expect(kanji).toContain("@@index([jlptLevel])");
    expect(kanji).toContain("@@index([legacyJlptLevel])");
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "legacyJlptLevel"');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS "Kanji_legacyJlptLevel_idx"');
    expect(migration).toContain('kanji."legacyJlptLevel" IS NULL');
    expect(migration).toContain('"updatedAt" = CURRENT_TIMESTAMP');
    expect(migration).not.toMatch(
      /(?:UPDATE|DELETE FROM|INSERT INTO)\s+"(?:ImportedRecord|ImportRun|DataSource)"/iu,
    );
  });
});
