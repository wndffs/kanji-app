import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const migration = source(
  "../prisma/migrations/20261022190000_reconcile_starter_word_source_id/migration.sql",
);

describe("starter word source repair boundaries", () => {
  it("repairs only the exact legacy word with successful bilingual source evidence", () => {
    for (const guard of [
      `word."expression" = '口'`,
      `word."reading" = 'くち'`,
      `word."jmdictEntryId" = 'starter:word:word-kuchi'`,
      `record."sourceRecordId" = 'jmdict:1275640'`,
      `word."jmdictImportedRecordId" = record."id"`,
      `run."status" = 'SUCCESS'`,
      `license."spdxLikeId" = 'LicenseRef-JMdict-Multilingual'`,
      `sense."locale" = 'ru-RU'`,
      `sense."locale" = 'en-US'`,
    ])
      expect(migration).toContain(guard);
    expect(migration).not.toMatch(/(?:DELETE FROM|INSERT INTO|ALTER TABLE)/iu);
    expect(migration.match(/UPDATE\s+"\w+"/gu)).toEqual(['UPDATE "Word"']);
  });

  it("never replaces imported source identities when reseeding an existing word", () => {
    const seed = source("../prisma/seed.ts");
    const wordUpsert = seed.slice(seed.indexOf("async function upsertWord("));
    const update = wordUpsert.match(/update: \{([\s\S]*?)\},\s*create:/u)?.[1];
    expect(update).toBeDefined();
    expect(update).not.toContain("jmdictEntryId");
    expect(wordUpsert).toContain("jmdictEntryId: sourceRecordIdFor(item)");
  });
});
