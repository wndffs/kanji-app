import { calculateSha256 } from "./checksum";
import { executeTrackedImport, findSuccessfulImportRun, type ImportRunLookup } from "./import-run";
import { createContentImportProgressTracker, type ContentImportProgressCallback } from "./progress";

export type TatoebaLanguage = "jpn" | "rus" | "eng";

export type TatoebaSentenceRowDto = {
  readonly sentenceId: string;
  readonly language: string;
  readonly text: string;
};

export type TatoebaLinkDto = {
  readonly fromId: string;
  readonly toId: string;
};

export type TatoebaTranslationDto = {
  readonly sentenceId: string;
  readonly language: "rus" | "eng";
  readonly text: string;
};

export type TatoebaLinkedSentenceDto = {
  readonly sourceRecordId: string;
  readonly sentenceId: string;
  readonly japaneseText: string;
  readonly translationRu: string | null;
  readonly translationEn: string | null;
  readonly translations: readonly TatoebaTranslationDto[];
  readonly links: readonly TatoebaLinkDto[];
  readonly raw: Record<string, unknown>;
};

export type TatoebaRejectedSentenceDto = {
  readonly sentenceId: string;
  readonly reason: "empty" | "too-long" | "missing-translation";
};

export type TatoebaParseOptions = {
  readonly maxTextLength?: number;
};

export type TatoebaParseResult = {
  readonly rows: readonly TatoebaSentenceRowDto[];
  readonly links: readonly TatoebaLinkDto[];
  readonly sentences: readonly TatoebaLinkedSentenceDto[];
  readonly rejected: readonly TatoebaRejectedSentenceDto[];
};

export type TatoebaImportOptions = TatoebaParseOptions & {
  readonly sourceFileName: string;
  readonly sourceVersion?: string | null;
  readonly checksumSha256?: string;
  readonly onProgress?: ContentImportProgressCallback;
};

export type TatoebaImportResult = {
  readonly licenseId: string;
  readonly dataSourceId: string;
  readonly importRunId: string;
  readonly checksumSha256: string;
  readonly status: "SUCCESS";
  readonly sentenceCount: number;
  readonly importedRecordCount: number;
  readonly rejectedCount: number;
};

export type TatoebaImportDatabase = {
  readonly license: {
    upsert(args: {
      readonly where: { readonly name: string };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<{ readonly id: string }>;
  };
  readonly dataSource: {
    upsert(args: {
      readonly where: { readonly name: string };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<{ readonly id: string }>;
  };
  readonly importRun: ImportRunLookup & {
    upsert(args: {
      readonly where: {
        readonly dataSourceId_checksumSha256: {
          readonly dataSourceId: string;
          readonly checksumSha256: string;
        };
      };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<{ readonly id: string }>;
    update(args: {
      readonly where: { readonly id: string };
      readonly data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  readonly importedRecord: {
    upsert(args: {
      readonly where: {
        readonly importRunId_recordType_sourceRecordId: {
          readonly importRunId: string;
          readonly recordType: "TATOEBA_SENTENCE";
          readonly sourceRecordId: string;
        };
      };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<unknown>;
  };
  readonly sentence: {
    upsert(args: {
      readonly where: {
        readonly dataSourceId_sourceId: {
          readonly dataSourceId: string;
          readonly sourceId: string;
        };
      };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<unknown>;
  };
};

const TATOEBA_LICENSE_NAME = "Tatoeba sentence license";
const TATOEBA_SOURCE_NAME = "Tatoeba";
const TATOEBA_HOMEPAGE_URL = "https://tatoeba.org/";
const TATOEBA_DOWNLOAD_URL = "https://downloads.tatoeba.org/exports/";
const DEFAULT_MAX_TEXT_LENGTH = 120;

export function parseTatoebaFiles(
  sentencesTsv: string,
  linksTsv: string,
  options: TatoebaParseOptions = {},
): TatoebaParseResult {
  const rows = parseSentenceRows(sentencesTsv);
  const links = parseLinks(linksTsv);
  const maxTextLength = options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;
  const rowById = new Map(rows.map((row) => [row.sentenceId, row]));
  const linkedIdsBySourceId = buildUndirectedLinkMap(links);
  const sentences: TatoebaLinkedSentenceDto[] = [];
  const rejected: TatoebaRejectedSentenceDto[] = [];

  for (const source of rows.filter((row) => row.language === "jpn")) {
    const text = source.text.trim();

    if (text.length === 0) {
      rejected.push({ sentenceId: source.sentenceId, reason: "empty" });
      continue;
    }

    if (text.length > maxTextLength) {
      rejected.push({ sentenceId: source.sentenceId, reason: "too-long" });
      continue;
    }

    const sourceLinks = links.filter(
      (link) => link.fromId === source.sentenceId || link.toId === source.sentenceId,
    );
    const translations = [...(linkedIdsBySourceId.get(source.sentenceId) ?? [])]
      .map((id) => rowById.get(id))
      .filter((row): row is TatoebaSentenceRowDto => row !== undefined)
      .flatMap((row) => toTranslation(row, maxTextLength));

    if (translations.length === 0) {
      rejected.push({ sentenceId: source.sentenceId, reason: "missing-translation" });
      continue;
    }

    const translationRu = translations.find((translation) => translation.language === "rus");
    const translationEn = translations.find((translation) => translation.language === "eng");

    sentences.push({
      sourceRecordId: `tatoeba:${source.sentenceId}`,
      sentenceId: source.sentenceId,
      japaneseText: text,
      translationRu: translationRu?.text ?? null,
      translationEn: translationEn?.text ?? null,
      translations,
      links: sourceLinks,
      raw: {
        sentenceId: source.sentenceId,
        language: source.language,
        text,
        translations,
        links: sourceLinks,
      },
    });
  }

  return { rows, links, sentences, rejected };
}

export async function importTatoebaFiles(
  db: TatoebaImportDatabase,
  sentencesTsv: string,
  linksTsv: string,
  options: TatoebaImportOptions,
): Promise<TatoebaImportResult> {
  const parsed = parseTatoebaFiles(sentencesTsv, linksTsv, options);
  const checksumSha256 = options.checksumSha256 ?? calculateSha256(`${sentencesTsv}\n${linksTsv}`);
  const sourceVersion = options.sourceVersion ?? "unknown";

  const license = await db.license.upsert({
    where: { name: TATOEBA_LICENSE_NAME },
    update: {
      spdxLikeId: "LicenseRef-Tatoeba-CC-BY",
      scope: "OPEN_DATA",
      url: TATOEBA_HOMEPAGE_URL,
      requiresAttribution: true,
      requiresShareAlike: false,
      notes:
        "Tatoeba sentence data. This importer does not import audio and keeps linked translations in raw JSON.",
    },
    create: {
      name: TATOEBA_LICENSE_NAME,
      spdxLikeId: "LicenseRef-Tatoeba-CC-BY",
      scope: "OPEN_DATA",
      url: TATOEBA_HOMEPAGE_URL,
      requiresAttribution: true,
      requiresShareAlike: false,
      notes:
        "Tatoeba sentence data. This importer does not import audio and keeps linked translations in raw JSON.",
    },
  });
  const dataSource = await db.dataSource.upsert({
    where: { name: TATOEBA_SOURCE_NAME },
    update: {
      homepageUrl: TATOEBA_HOMEPAGE_URL,
      downloadUrl: TATOEBA_DOWNLOAD_URL,
      licenseId: license.id,
      attributionText: "Example sentence data is derived from Tatoeba.",
      notes: "Sentence and translation-link source. Audio is intentionally excluded.",
    },
    create: {
      name: TATOEBA_SOURCE_NAME,
      homepageUrl: TATOEBA_HOMEPAGE_URL,
      downloadUrl: TATOEBA_DOWNLOAD_URL,
      licenseId: license.id,
      attributionText: "Example sentence data is derived from Tatoeba.",
      notes: "Sentence and translation-link source. Audio is intentionally excluded.",
    },
  });
  const completedImportRun = await findSuccessfulImportRun(
    db.importRun,
    dataSource.id,
    checksumSha256,
  );

  if (completedImportRun !== null) {
    return {
      licenseId: license.id,
      dataSourceId: dataSource.id,
      importRunId: completedImportRun.id,
      checksumSha256,
      status: "SUCCESS",
      sentenceCount: parsed.sentences.length,
      importedRecordCount: parsed.sentences.length,
      rejectedCount: parsed.rejected.length,
    };
  }

  const statsJson = {
    sentences: parsed.sentences.length,
    rejected: parsed.rejected.length,
  };
  const importRun = await db.importRun.upsert({
    where: {
      dataSourceId_checksumSha256: {
        dataSourceId: dataSource.id,
        checksumSha256,
      },
    },
    update: {
      sourceVersion,
      sourceFileName: options.sourceFileName,
      startedAt: new Date(),
      finishedAt: null,
      status: "PENDING",
      statsJson: null,
      errorText: null,
    },
    create: {
      dataSourceId: dataSource.id,
      sourceVersion,
      sourceFileName: options.sourceFileName,
      checksumSha256,
      status: "PENDING",
      errorText: null,
    },
  });
  await executeTrackedImport(db.importRun, importRun.id, statsJson, async () => {
    const progress = createContentImportProgressTracker(
      "Tatoeba",
      parsed.sentences.length,
      options.onProgress,
    );

    for (const sentence of parsed.sentences) {
      await db.importedRecord.upsert({
        where: {
          importRunId_recordType_sourceRecordId: {
            importRunId: importRun.id,
            recordType: "TATOEBA_SENTENCE",
            sourceRecordId: sentence.sourceRecordId,
          },
        },
        update: {
          rawJson: sentence.raw,
        },
        create: {
          importRunId: importRun.id,
          recordType: "TATOEBA_SENTENCE",
          sourceRecordId: sentence.sourceRecordId,
          rawJson: sentence.raw,
        },
      });

      await db.sentence.upsert({
        where: {
          dataSourceId_sourceId: {
            dataSourceId: dataSource.id,
            sourceId: sentence.sourceRecordId,
          },
        },
        update: {
          japaneseText: sentence.japaneseText,
          readingText: null,
          translationRu: sentence.translationRu,
          translationEn: sentence.translationEn,
          dataSourceId: dataSource.id,
          licenseId: license.id,
        },
        create: {
          japaneseText: sentence.japaneseText,
          readingText: null,
          translationRu: sentence.translationRu,
          translationEn: sentence.translationEn,
          difficulty: null,
          sourceId: sentence.sourceRecordId,
          dataSourceId: dataSource.id,
          licenseId: license.id,
        },
      });
      progress.advance();

      // TODO: Link imported sentences to known words after a tokenizer/matcher API exists.
    }
  });

  return {
    licenseId: license.id,
    dataSourceId: dataSource.id,
    importRunId: importRun.id,
    checksumSha256,
    status: "SUCCESS",
    sentenceCount: parsed.sentences.length,
    importedRecordCount: parsed.sentences.length,
    rejectedCount: parsed.rejected.length,
  };
}

function parseSentenceRows(input: string): readonly TatoebaSentenceRowDto[] {
  return splitTsvLines(input).map((line) => {
    const [sentenceId = "", language = "", ...textParts] = line.split("\t");

    return {
      sentenceId: sentenceId.trim(),
      language: language.trim(),
      text: textParts.join("\t").trim(),
    };
  });
}

function parseLinks(input: string): readonly TatoebaLinkDto[] {
  return splitTsvLines(input).flatMap((line) => {
    const [fromId = "", toId = ""] = line.split("\t").map((part) => part.trim());

    return fromId === "" || toId === "" ? [] : [{ fromId, toId }];
  });
}

function splitTsvLines(input: string): readonly string[] {
  return input
    .replace(/\r\n/gu, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
}

function buildUndirectedLinkMap(links: readonly TatoebaLinkDto[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const link of links) {
    addLinkedId(map, link.fromId, link.toId);
    addLinkedId(map, link.toId, link.fromId);
  }

  return map;
}

function addLinkedId(map: Map<string, Set<string>>, sourceId: string, linkedId: string): void {
  const links = map.get(sourceId) ?? new Set<string>();

  links.add(linkedId);
  map.set(sourceId, links);
}

function toTranslation(
  row: TatoebaSentenceRowDto,
  maxTextLength: number,
): readonly TatoebaTranslationDto[] {
  if (row.language !== "rus" && row.language !== "eng") {
    return [];
  }

  const text = row.text.trim();

  if (text.length === 0 || text.length > maxTextLength) {
    return [];
  }

  return [
    {
      sentenceId: row.sentenceId,
      language: row.language === "rus" ? "rus" : "eng",
      text,
    },
  ];
}
