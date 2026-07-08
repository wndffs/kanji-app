import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(currentDir, "..", "prisma", "schema.prisma"), "utf8");

describe("Prisma schema", () => {
  it("defines the required data-model layers", () => {
    const requiredModels = [
      "License",
      "DataSource",
      "ImportRun",
      "ImportedRecord",
      "Component",
      "Kanji",
      "KanjiStrokeGraphic",
      "KanjiReading",
      "KanjiMeaning",
      "KanjiComponent",
      "Word",
      "WordSense",
      "Sentence",
      "LearningItem",
      "LearningCard",
      "LearningAnswer",
      "BlockedAnswer",
      "Mnemonic",
      "Hint",
      "Dependency",
      "User",
      "UserSettings",
      "UserItemOverride",
      "UserMnemonic",
      "UserEnrollment",
      "Course",
      "CourseLevel",
      "CourseLevelItem",
      "Deck",
      "DeckItem",
      "SrsSystem",
      "SrsStage",
      "UserSrsState",
      "ReviewSession",
      "ReviewAnswer",
    ];

    for (const model of requiredModels) {
      expect(schema).toContain(`model ${model} `);
    }
  });

  it("keeps imported source records traceable and idempotent", () => {
    expect(schema).toContain("@@unique([dataSourceId, checksumSha256])");
    expect(schema).toContain("@@unique([importRunId, recordType, sourceRecordId])");
    expect(schema).toContain("@@index([sourceRecordId])");
    expect(schema).toContain("sourceDownloadedAt");
    expect(schema).toContain("kanjidicImportedRecordId");
    expect(schema).toContain("jmdictImportedRecordId");
    expect(schema).toContain('@relation("SentenceImportedRecord"');
  });

  it("stores KanjiVG stroke graphics linked to kanji", () => {
    expect(schema).toContain("model KanjiStrokeGraphic ");
    expect(schema).toMatch(/strokeGraphic\s+KanjiStrokeGraphic\?/u);
    expect(schema).toMatch(/sourceRecordId\s+String\s+@unique/u);
    expect(schema).toContain('@relation("StrokeGraphicImportedRecord"');
    expect(schema).toMatch(/strokesJson\s+Json/u);
  });

  it("keeps global card answers marked as curated content by default", () => {
    expect(schema).toMatch(/sourceKind\s+ContentSourceKind\s+@default\(PROJECT_AUTHORED\)/u);
    expect(schema).toContain("@@index([sourceKind])");
  });

  it("indexes due SRS state by user and availability", () => {
    expect(schema).toContain("@@unique([userId, learningCardId])");
    expect(schema).toContain("@@index([userId, availableAt])");
  });

  it("stores the user's translation display mode", () => {
    expect(schema).toContain('translationDisplayMode String   @default("ru")');
    expect(schema).toContain("@@index([translationDisplayMode])");
  });

  it("models structured course bands through N2", () => {
    expect(schema).toContain("enum CourseBand");
    for (const band of ["FOUNDATION", "N5", "N4", "N3", "N2"]) {
      expect(schema).toContain(`  ${band}`);
    }

    expect(schema).toMatch(/curriculumBand\s+CourseBand\?/u);
    expect(schema).toMatch(/band\s+CourseBand\s+@default\(FOUNDATION\)/u);
    expect(schema).toMatch(/meaningEn\s+String\s+@default\(""\)/u);
    expect(schema).toContain("@@index([curriculumBand])");
    expect(schema).toContain("@@index([band])");
    expect(schema).toContain("@@index([meaningEn])");
  });

  it("stores locales for private overrides and mnemonics", () => {
    expect(schema).toContain('locale         String           @default("ru-RU")');
    expect(schema).toContain(
      '@@unique([userId, learningCardId, overrideType, locale, normalizedText], map: "UserItemOverride_user_card_type_locale_text_key")',
    );
    expect(schema).toContain(
      '@@unique([userId, learningItemId, locale, mnemonicType], map: "UserMnemonic_user_item_locale_type_key")',
    );
  });
});
