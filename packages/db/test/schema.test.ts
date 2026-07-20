import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(currentDir, "..", "prisma", "schema.prisma"), "utf8");
const confusableMigration = readFileSync(
  join(
    currentDir,
    "..",
    "prisma",
    "migrations",
    "20260720230000_add_confusable_kanji_practice",
    "migration.sql",
  ),
  "utf8",
);

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
      "UserKanaProgress",
      "KanjiConfusablePair",
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

  it("keeps imported and curated kanji meanings as separate source layers", () => {
    expect(schema).toContain("@@unique([kanjiId, locale, meaning, sourceKind])");
  });

  it("indexes due SRS state by user and availability", () => {
    expect(schema).toContain("@@unique([userId, learningCardId])");
    expect(schema).toContain("@@index([userId, availableAt])");
  });

  it("stores the user's translation display mode", () => {
    expect(schema).toMatch(/translationDisplayMode\s+String\s+@default\("ru"\)/u);
    expect(schema).toContain("@@index([translationDisplayMode])");
  });

  it("stores the user's dashboard widget preferences as structured JSON", () => {
    expect(schema).toMatch(/dashboardWidgets\s+Json\s+@default\("\[\]"\)/u);
  });

  it("persists versioned level completion and idempotent unlock events", () => {
    expect(schema).toMatch(/passPolicyJson\s+Json\s+@default/u);
    expect(schema).toContain("model UserCourseLevelCompletion");
    expect(schema).toContain("@@unique([userId, courseLevelId])");
    expect(schema).toContain("model UserUnlockEvent");
    expect(schema).toContain("@@unique([userId, learningItemId])");
  });

  it("stores the user's lesson pacing and ordering preferences", () => {
    expect(schema).toMatch(/lessonBatchSize\s+Int\s+@default\(5\)/u);
    expect(schema).toMatch(/lessonOrderMode\s+String\s+@default\("course"\)/u);
  });

  it("stores the user's review ordering preference", () => {
    expect(schema).toMatch(/reviewOrderMode\s+String\s+@default\("shuffled"\)/u);
  });

  it("stores per-user kana lesson and assessment progress", () => {
    expect(schema).toContain("enum KanaScript");
    expect(schema).toContain("model UserKanaProgress");
    expect(schema).toContain("@@unique([userId, character])");
    expect(schema).toContain("@@index([userId, script, masteredAt])");
  });

  it("stores curated confusable kanji pairs with explicit approval", () => {
    expect(schema).toContain("model KanjiConfusablePair ");
    expect(schema).toMatch(/visual\s+Boolean\s+@default\(false\)/u);
    expect(schema).toMatch(/semantic\s+Boolean\s+@default\(false\)/u);
    expect(schema).toMatch(/sourceKind\s+ContentSourceKind\s+@default\(PROJECT_AUTHORED\)/u);
    expect(schema).toMatch(/approvedByUserId\s+String\?/u);
    expect(schema).toMatch(/approvedAt\s+DateTime\?/u);
    expect(schema).toContain("@@unique([leftKanjiId, rightKanjiId])");
    expect(schema).toContain("@@index([status, strength])");
    expect(confusableMigration).toContain('CHECK ("visual" OR "semantic")');
    expect(confusableMigration).toContain("CHECK (\"sourceKind\" = 'PROJECT_AUTHORED')");
    expect(confusableMigration).toContain("\"status\" <> 'PUBLISHED'");
    expect(confusableMigration).toContain('"approvedByUserId" IS NOT NULL');
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

  it("separates component names and shape descriptions from meanings", () => {
    expect(schema).toMatch(/displayNameRu\s+String/u);
    expect(schema).toMatch(/displayNameEn\s+String\s+@default\(""\)/u);
    expect(schema).toMatch(/shapeDescriptionRu\s+String\?/u);
    expect(schema).toMatch(/shapeDescriptionEn\s+String\?/u);
    expect(schema).toMatch(/meaningRu\s+String/u);
    expect(schema).toMatch(/meaningEn\s+String\s+@default\(""\)/u);
    expect(schema).toContain("@@index([displayNameEn])");
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
