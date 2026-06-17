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
  });

  it("indexes due SRS state by user and availability", () => {
    expect(schema).toContain("@@unique([userId, learningCardId])");
    expect(schema).toContain("@@index([userId, availableAt])");
  });

  it("stores the user's translation display mode", () => {
    expect(schema).toContain('translationDisplayMode String   @default("ru")');
    expect(schema).toContain("@@index([translationDisplayMode])");
  });
});
