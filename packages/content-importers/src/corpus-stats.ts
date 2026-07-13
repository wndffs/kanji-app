import { type Prisma } from "@kanji-srs/db";

export type CorpusStatsDatabase = {
  readonly kanji: CountModel;
  readonly kanjiStrokeGraphic: CountModel;
  readonly kanjiReading: CountModel;
  readonly kanjiMeaning: CountModel;
  readonly word: CountModel;
  readonly wordSense: CountModel;
  readonly learningItem: CountModel;
  readonly dataSource: {
    findMany(args: Record<string, unknown>): Promise<readonly CorpusDataSourceRow[]>;
  };
};

type CountModel = {
  count(args?: Record<string, unknown>): Promise<number>;
};

type CorpusDataSourceRow = {
  readonly name: string;
  readonly importRuns: readonly {
    readonly id: string;
    readonly sourceVersion: string | null;
    readonly sourceFileName: string;
    readonly checksumSha256: string;
    readonly finishedAt: Date | null;
    readonly statsJson: unknown;
  }[];
};

export type CorpusStats = {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly dictionary: {
    readonly kanji: number;
    readonly strokeGraphics: number;
    readonly kanjiReadings: number;
    readonly importedEnglishKanjiMeanings: number;
    readonly words: number;
    readonly bilingualWords: number;
    readonly englishWordSenses: number;
    readonly russianWordSenses: number;
  };
  readonly publishedCourse: {
    readonly kanji: number;
    readonly words: number;
  };
  readonly sources: readonly {
    readonly name: string;
    readonly latestSuccessfulRun: {
      readonly id: string;
      readonly sourceVersion: string | null;
      readonly sourceFileName: string;
      readonly checksumSha256: string;
      readonly finishedAt: string | null;
      readonly stats: unknown;
    } | null;
  }[];
};

export type CorpusMinimums = {
  readonly kanji: number;
  readonly strokeGraphics: number;
  readonly words: number;
  readonly bilingualWords: number;
};

export const FULL_CORPUS_MINIMUMS: CorpusMinimums = {
  kanji: 10_000,
  strokeGraphics: 10_000,
  words: 100_000,
  bilingualWords: 30_000,
};

const CORPUS_SOURCE_NAMES = ["KANJIDIC2", "KanjiVG", "JMdict"] as const;

export async function collectCorpusStats(
  db: CorpusStatsDatabase,
  now = new Date(),
): Promise<CorpusStats> {
  const [
    kanji,
    strokeGraphics,
    kanjiReadings,
    importedEnglishKanjiMeanings,
    words,
    bilingualWords,
    englishWordSenses,
    russianWordSenses,
    publishedKanji,
    publishedWords,
    dataSources,
  ] = await Promise.all([
    db.kanji.count({
      where: { kanjidicImportedRecordId: { not: null } },
    } satisfies Prisma.KanjiCountArgs),
    db.kanjiStrokeGraphic.count({
      where: { importedRecordId: { not: null } },
    } satisfies Prisma.KanjiStrokeGraphicCountArgs),
    db.kanjiReading.count({
      where: { kanji: { kanjidicImportedRecordId: { not: null } } },
    } satisfies Prisma.KanjiReadingCountArgs),
    db.kanjiMeaning.count({
      where: {
        locale: "en-US",
        sourceKind: "IMPORTED",
        kanji: { kanjidicImportedRecordId: { not: null } },
      },
    } satisfies Prisma.KanjiMeaningCountArgs),
    db.word.count({
      where: { jmdictImportedRecordId: { not: null } },
    } satisfies Prisma.WordCountArgs),
    db.word.count({
      where: {
        AND: [
          { jmdictImportedRecordId: { not: null } },
          { senses: { some: { locale: "ru-RU", sourceKind: "IMPORTED" } } },
          { senses: { some: { locale: "en-US", sourceKind: "IMPORTED" } } },
        ],
      },
    } satisfies Prisma.WordCountArgs),
    db.wordSense.count({
      where: {
        locale: "en-US",
        sourceKind: "IMPORTED",
        word: { jmdictImportedRecordId: { not: null } },
      },
    } satisfies Prisma.WordSenseCountArgs),
    db.wordSense.count({
      where: {
        locale: "ru-RU",
        sourceKind: "IMPORTED",
        word: { jmdictImportedRecordId: { not: null } },
      },
    } satisfies Prisma.WordSenseCountArgs),
    db.learningItem.count({
      where: {
        status: "PUBLISHED",
        targetType: "KANJI",
        courseLevelItems: { some: { courseLevel: { course: { status: "PUBLISHED" } } } },
      },
    } satisfies Prisma.LearningItemCountArgs),
    db.learningItem.count({
      where: {
        status: "PUBLISHED",
        targetType: "WORD",
        courseLevelItems: { some: { courseLevel: { course: { status: "PUBLISHED" } } } },
      },
    } satisfies Prisma.LearningItemCountArgs),
    db.dataSource.findMany({
      where: { name: { in: [...CORPUS_SOURCE_NAMES] } },
      orderBy: { name: "asc" },
      select: {
        name: true,
        importRuns: {
          where: { status: "SUCCESS" },
          orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            sourceVersion: true,
            sourceFileName: true,
            checksumSha256: true,
            finishedAt: true,
            statsJson: true,
          },
        },
      },
    } satisfies Prisma.DataSourceFindManyArgs),
  ]);

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    dictionary: {
      kanji,
      strokeGraphics,
      kanjiReadings,
      importedEnglishKanjiMeanings,
      words,
      bilingualWords,
      englishWordSenses,
      russianWordSenses,
    },
    publishedCourse: {
      kanji: publishedKanji,
      words: publishedWords,
    },
    sources: dataSources.map((source) => {
      const run = source.importRuns[0];

      return {
        name: source.name,
        latestSuccessfulRun:
          run === undefined
            ? null
            : {
                id: run.id,
                sourceVersion: run.sourceVersion,
                sourceFileName: run.sourceFileName,
                checksumSha256: run.checksumSha256,
                finishedAt: run.finishedAt?.toISOString() ?? null,
                stats: run.statsJson,
              },
      };
    }),
  };
}

export function validateCorpusMinimums(
  stats: CorpusStats,
  minimums: CorpusMinimums = FULL_CORPUS_MINIMUMS,
): readonly string[] {
  const issues: string[] = [];

  if (stats.dictionary.kanji < minimums.kanji) {
    issues.push(`kanji count ${stats.dictionary.kanji} is below ${minimums.kanji}`);
  }

  if (stats.dictionary.strokeGraphics < minimums.strokeGraphics) {
    issues.push(
      `stroke graphic count ${stats.dictionary.strokeGraphics} is below ${minimums.strokeGraphics}`,
    );
  }

  if (stats.dictionary.words < minimums.words) {
    issues.push(`word count ${stats.dictionary.words} is below ${minimums.words}`);
  }

  if (stats.dictionary.bilingualWords < minimums.bilingualWords) {
    issues.push(
      `bilingual word count ${stats.dictionary.bilingualWords} is below ${minimums.bilingualWords}`,
    );
  }

  for (const sourceName of CORPUS_SOURCE_NAMES) {
    const source = stats.sources.find((candidate) => candidate.name === sourceName);

    if (source?.latestSuccessfulRun === null || source === undefined) {
      issues.push(`${sourceName} has no successful import run`);
    }
  }

  return issues;
}
