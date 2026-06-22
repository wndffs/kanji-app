import { calculateSha256 } from "./checksum";
import { decodeXml, extractAttributedElements, extractElements, extractRequiredText } from "./xml";

export type JmDictGlossDto = {
  readonly locale: "en-US" | "ru-RU";
  readonly text: string;
  readonly sourceLanguage: string;
};

export type JmDictSenseDto = {
  readonly partOfSpeech: readonly string[];
  readonly glosses: readonly JmDictGlossDto[];
};

export type JmDictKanjiElementDto = {
  readonly expression: string;
  readonly priorities: readonly string[];
};

export type JmDictReadingElementDto = {
  readonly reading: string;
  readonly priorities: readonly string[];
  readonly restrictions: readonly string[];
};

export type JmDictWordSenseDto = {
  readonly locale: "en-US" | "ru-RU";
  readonly meaning: string;
  readonly partOfSpeech: string;
  readonly sourceKind: "IMPORTED";
};

export type JmDictWordDto = {
  readonly expression: string;
  readonly reading: string;
  readonly commonnessRank: number | null;
  readonly senses: readonly JmDictWordSenseDto[];
};

export type JmDictEntryDto = {
  readonly sourceRecordId: string;
  readonly sequence: string;
  readonly kanjiElements: readonly JmDictKanjiElementDto[];
  readonly readingElements: readonly JmDictReadingElementDto[];
  readonly senses: readonly JmDictSenseDto[];
  readonly words: readonly JmDictWordDto[];
  readonly raw: Record<string, unknown>;
};

export type JmDictParseResult = {
  readonly entries: readonly JmDictEntryDto[];
};

export type JmDictImportOptions = {
  readonly sourceFileName: string;
  readonly sourceVersion?: string | null;
  readonly checksumSha256?: string;
};

export type JmDictImportResult = {
  readonly licenseId: string;
  readonly dataSourceId: string;
  readonly importRunId: string;
  readonly checksumSha256: string;
  readonly status: "SUCCESS";
  readonly entryCount: number;
  readonly wordCount: number;
  readonly importedRecordCount: number;
};

export type JmDictImportDatabase = {
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
  readonly importRun: {
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
  };
  readonly importedRecord: {
    upsert(args: {
      readonly where: {
        readonly importRunId_recordType_sourceRecordId: {
          readonly importRunId: string;
          readonly recordType: "JMDICT_ENTRY";
          readonly sourceRecordId: string;
        };
      };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<unknown>;
  };
  readonly word: {
    upsert(args: {
      readonly where: {
        readonly expression_reading: {
          readonly expression: string;
          readonly reading: string;
        };
      };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<{ readonly id: string }>;
  };
  readonly wordSense: {
    upsert(args: {
      readonly where: {
        readonly wordId_locale_meaning_partOfSpeech: {
          readonly wordId: string;
          readonly locale: "en-US" | "ru-RU";
          readonly meaning: string;
          readonly partOfSpeech: string;
        };
      };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<unknown>;
  };
};

const JMDICT_LICENSE_NAME = "EDRDG JMdict license";
const JMDICT_SOURCE_NAME = "JMdict";
const JMDICT_HOMEPAGE_URL = "https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project";
const JMDICT_DOWNLOAD_URL = "https://www.edrdg.org/jmdict/edict_doc.html";

export function parseJmDictXml(xml: string): JmDictParseResult {
  return {
    entries: extractElements(stripDoctype(xml), "entry").map(parseEntryBlock),
  };
}

export async function importJmDictXml(
  db: JmDictImportDatabase,
  xml: string,
  options: JmDictImportOptions,
): Promise<JmDictImportResult> {
  const parsed = parseJmDictXml(xml);
  const checksumSha256 = options.checksumSha256 ?? calculateSha256(xml);
  const sourceVersion = options.sourceVersion ?? "unknown";
  const wordCount = parsed.entries.reduce((count, entry) => count + entry.words.length, 0);

  const license = await db.license.upsert({
    where: { name: JMDICT_LICENSE_NAME },
    update: {
      spdxLikeId: "LicenseRef-EDRDG",
      scope: "OPEN_DATA",
      url: JMDICT_HOMEPAGE_URL,
      requiresAttribution: true,
      requiresShareAlike: false,
      notes:
        "JMdict data from EDRDG. Imported glosses are dictionary data, not curated learning copy.",
    },
    create: {
      name: JMDICT_LICENSE_NAME,
      spdxLikeId: "LicenseRef-EDRDG",
      scope: "OPEN_DATA",
      url: JMDICT_HOMEPAGE_URL,
      requiresAttribution: true,
      requiresShareAlike: false,
      notes:
        "JMdict data from EDRDG. Imported glosses are dictionary data, not curated learning copy.",
    },
  });
  const dataSource = await db.dataSource.upsert({
    where: { name: JMDICT_SOURCE_NAME },
    update: {
      homepageUrl: JMDICT_HOMEPAGE_URL,
      downloadUrl: JMDICT_DOWNLOAD_URL,
      licenseId: license.id,
      attributionText:
        "JMdict dictionary data is provided by the Electronic Dictionary Research and Development Group.",
      notes: "Japanese word dictionary source. Raw glosses stay in the imported layer.",
    },
    create: {
      name: JMDICT_SOURCE_NAME,
      homepageUrl: JMDICT_HOMEPAGE_URL,
      downloadUrl: JMDICT_DOWNLOAD_URL,
      licenseId: license.id,
      attributionText:
        "JMdict dictionary data is provided by the Electronic Dictionary Research and Development Group.",
      notes: "Japanese word dictionary source. Raw glosses stay in the imported layer.",
    },
  });
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
      finishedAt: new Date(),
      status: "SUCCESS",
      statsJson: { entries: parsed.entries.length, words: wordCount },
      errorText: null,
    },
    create: {
      dataSourceId: dataSource.id,
      sourceVersion,
      sourceFileName: options.sourceFileName,
      checksumSha256,
      finishedAt: new Date(),
      status: "SUCCESS",
      statsJson: { entries: parsed.entries.length, words: wordCount },
      errorText: null,
    },
  });

  for (const entry of parsed.entries) {
    await db.importedRecord.upsert({
      where: {
        importRunId_recordType_sourceRecordId: {
          importRunId: importRun.id,
          recordType: "JMDICT_ENTRY",
          sourceRecordId: entry.sourceRecordId,
        },
      },
      update: {
        rawJson: entry.raw,
      },
      create: {
        importRunId: importRun.id,
        recordType: "JMDICT_ENTRY",
        sourceRecordId: entry.sourceRecordId,
        rawJson: entry.raw,
      },
    });

    for (const word of entry.words) {
      const wordRow = await db.word.upsert({
        where: {
          expression_reading: {
            expression: word.expression,
            reading: word.reading,
          },
        },
        update: {
          commonnessRank: word.commonnessRank,
          jmdictEntryId: entry.sourceRecordId,
        },
        create: {
          expression: word.expression,
          reading: word.reading,
          commonnessRank: word.commonnessRank,
          jmdictEntryId: entry.sourceRecordId,
        },
      });

      for (const sense of word.senses) {
        await db.wordSense.upsert({
          where: {
            wordId_locale_meaning_partOfSpeech: {
              wordId: wordRow.id,
              locale: sense.locale,
              meaning: sense.meaning,
              partOfSpeech: sense.partOfSpeech,
            },
          },
          update: {
            sourceKind: sense.sourceKind,
          },
          create: {
            wordId: wordRow.id,
            locale: sense.locale,
            meaning: sense.meaning,
            partOfSpeech: sense.partOfSpeech,
            sourceKind: sense.sourceKind,
          },
        });
      }
    }
  }

  return {
    licenseId: license.id,
    dataSourceId: dataSource.id,
    importRunId: importRun.id,
    checksumSha256,
    status: "SUCCESS",
    entryCount: parsed.entries.length,
    wordCount,
    importedRecordCount: parsed.entries.length,
  };
}

function parseEntryBlock(block: string): JmDictEntryDto {
  const sequence = extractRequiredText(block, "ent_seq");
  const kanjiElements = extractElements(block, "k_ele").map(parseKanjiElement);
  const readingElements = extractElements(block, "r_ele").map(parseReadingElement);
  const senses = extractElements(block, "sense").map(parseSense);
  const words = buildWords(kanjiElements, readingElements, senses);

  return {
    sourceRecordId: `jmdict:${sequence}`,
    sequence,
    kanjiElements,
    readingElements,
    senses,
    words,
    raw: {
      sequence,
      kanjiElements,
      readingElements,
      senses,
    },
  };
}

function parseKanjiElement(block: string): JmDictKanjiElementDto {
  return {
    expression: extractRequiredText(block, "keb"),
    priorities: extractElements(block, "ke_pri").map((value) => decodeXml(value.trim())),
  };
}

function parseReadingElement(block: string): JmDictReadingElementDto {
  return {
    reading: extractRequiredText(block, "reb"),
    priorities: extractElements(block, "re_pri").map((value) => decodeXml(value.trim())),
    restrictions: extractElements(block, "re_restr").map((value) => decodeXml(value.trim())),
  };
}

function parseSense(block: string): JmDictSenseDto {
  const partOfSpeech = extractElements(block, "pos").map((value) =>
    decodeJmDictEntity(decodeXml(value.trim())),
  );

  return {
    partOfSpeech: partOfSpeech.length === 0 ? ["unknown"] : partOfSpeech,
    glosses: extractAttributedElements(block, "gloss").map((gloss) => {
      const sourceLanguage = gloss.attributes["xml:lang"] ?? gloss.attributes.lang ?? "eng";

      return {
        locale: toGlossLocale(sourceLanguage),
        text: gloss.text,
        sourceLanguage,
      };
    }),
  };
}

function buildWords(
  kanjiElements: readonly JmDictKanjiElementDto[],
  readingElements: readonly JmDictReadingElementDto[],
  senses: readonly JmDictSenseDto[],
): readonly JmDictWordDto[] {
  const senseRows = senses.flatMap((sense) =>
    sense.glosses.map((gloss) => ({
      locale: gloss.locale,
      meaning: gloss.text,
      partOfSpeech: sense.partOfSpeech.join("; "),
      sourceKind: "IMPORTED" as const,
    })),
  );
  const expressions =
    kanjiElements.length === 0
      ? readingElements.map((reading) => ({
          expression: reading.reading,
          priorities: reading.priorities,
        }))
      : kanjiElements;
  const words: JmDictWordDto[] = [];

  for (const expression of expressions) {
    for (const reading of readingElements) {
      if (
        reading.restrictions.length > 0 &&
        !reading.restrictions.includes(expression.expression)
      ) {
        continue;
      }

      words.push({
        expression: expression.expression,
        reading: reading.reading,
        commonnessRank: pickCommonnessRank([...expression.priorities, ...reading.priorities]),
        senses: senseRows,
      });
    }
  }

  return words;
}

function pickCommonnessRank(priorities: readonly string[]): number | null {
  const ranks = priorities.flatMap((priority) => {
    const match = /(\d+)$/u.exec(priority);

    return match === null ? [] : [Number(match[1])];
  });

  return ranks.length === 0 ? null : Math.min(...ranks);
}

function toGlossLocale(sourceLanguage: string): "en-US" | "ru-RU" {
  return sourceLanguage === "rus" || sourceLanguage === "ru" ? "ru-RU" : "en-US";
}

function decodeJmDictEntity(value: string): string {
  switch (value) {
    case "&n;":
      return "noun";
    case "&adv;":
      return "adverb";
    case "&int;":
      return "interjection";
    case "&v1;":
      return "Ichidan verb";
    default:
      return value;
  }
}

function stripDoctype(xml: string): string {
  return xml.replace(/<!DOCTYPE[\s\S]*?\]>/u, "");
}
