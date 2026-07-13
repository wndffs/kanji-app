import { describe, expect, it } from "vitest";

import {
  collectCorpusStats,
  type CorpusStats,
  type CorpusStatsDatabase,
  validateCorpusMinimums,
} from "../src/corpus-stats";

const NOW = new Date("2026-07-13T10:00:00.000Z");

describe("corpus stats", () => {
  it("separates imported dictionary volume from published course volume", async () => {
    const stats = await collectCorpusStats(createDatabase(), NOW);

    expect(stats).toMatchObject({
      schemaVersion: 1,
      generatedAt: NOW.toISOString(),
      dictionary: {
        kanji: 13_108,
        strokeGraphics: 12_500,
        kanjiReadings: 29_400,
        importedEnglishKanjiMeanings: 48_000,
        words: 205_000,
        bilingualWords: 75_000,
        englishWordSenses: 240_000,
        russianWordSenses: 82_000,
      },
      publishedCourse: { kanji: 2, words: 2 },
      sources: expect.arrayContaining([
        expect.objectContaining({
          name: "JMdict",
          latestSuccessfulRun: expect.objectContaining({
            checksumSha256: "jmdict-checksum",
            finishedAt: "2026-07-13T09:45:00.000Z",
          }),
        }),
      ]),
    });
    expect(validateCorpusMinimums(stats)).toEqual([]);
  });

  it("reports every missing full-corpus requirement", () => {
    const stats: CorpusStats = {
      schemaVersion: 1,
      generatedAt: NOW.toISOString(),
      dictionary: {
        kanji: 3,
        strokeGraphics: 1,
        kanjiReadings: 5,
        importedEnglishKanjiMeanings: 4,
        words: 10,
        bilingualWords: 1,
        englishWordSenses: 10,
        russianWordSenses: 1,
      },
      publishedCourse: { kanji: 2, words: 2 },
      sources: [],
    };

    expect(validateCorpusMinimums(stats)).toEqual([
      "kanji count 3 is below 10000",
      "stroke graphic count 1 is below 10000",
      "word count 10 is below 100000",
      "bilingual word count 1 is below 30000",
      "KANJIDIC2 has no successful import run",
      "KanjiVG has no successful import run",
      "JMdict has no successful import run",
    ]);
  });
});

function createDatabase(): CorpusStatsDatabase {
  return {
    kanji: countModel(13_108),
    kanjiStrokeGraphic: countModel(12_500),
    kanjiReading: countModel(29_400),
    kanjiMeaning: countModel(48_000),
    word: countModel(205_000, 75_000),
    wordSense: countModel(240_000, 82_000),
    learningItem: countModel(2, 2),
    dataSource: {
      findMany: async () => [
        source("JMdict", "jmdict-checksum"),
        source("KANJIDIC2", "kanjidic2-checksum"),
        source("KanjiVG", "kanjivg-checksum"),
      ],
    },
  };
}

function countModel(...counts: readonly number[]) {
  let index = 0;

  return {
    count: async () => counts[index++] ?? counts.at(-1) ?? 0,
  };
}

function source(name: string, checksumSha256: string) {
  return {
    name,
    importRuns: [
      {
        id: `${name}-run`,
        sourceVersion: "2026-07-13",
        sourceFileName: `${name}.xml`,
        checksumSha256,
        finishedAt: new Date("2026-07-13T09:45:00.000Z"),
        statsJson: { imported: true },
      },
    ],
  };
}
