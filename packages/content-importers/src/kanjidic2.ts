import { calculateSha256 } from "./checksum";
import {
  extractAttributedElements,
  extractElements,
  extractOptionalElement,
  extractOptionalText,
  extractRequiredText,
} from "./xml";

export type KanjiDic2ReadingType = "ONYOMI" | "KUNYOMI" | "NANORI" | "OTHER";

export type KanjiDic2Header = {
  readonly fileVersion: string | null;
  readonly databaseVersion: string | null;
  readonly dateOfCreation: string | null;
};

export type KanjiDic2ReadingDto = {
  readonly reading: string;
  readonly readingType: KanjiDic2ReadingType;
  readonly sourceType: string;
  readonly priority: number;
};

export type KanjiDic2MeaningDto = {
  readonly locale: "en-US";
  readonly text: string;
  readonly isPrimary: boolean;
};

export type KanjiDic2CharacterDto = {
  readonly sourceRecordId: string;
  readonly character: string;
  readonly codepoint: string;
  readonly strokeCount: number | null;
  readonly grade: number | null;
  readonly jlptLevel: number | null;
  readonly frequencyRank: number | null;
  readonly readings: readonly KanjiDic2ReadingDto[];
  readonly meanings: readonly KanjiDic2MeaningDto[];
  readonly raw: Record<string, unknown>;
};

export type KanjiDic2ParseResult = {
  readonly header: KanjiDic2Header;
  readonly characters: readonly KanjiDic2CharacterDto[];
};

export type KanjiDic2ImportOptions = {
  readonly sourceFileName: string;
  readonly sourceVersion?: string | null;
  readonly checksumSha256?: string;
};

export type KanjiDic2ImportResult = {
  readonly licenseId: string;
  readonly dataSourceId: string;
  readonly importRunId: string;
  readonly checksumSha256: string;
  readonly status: "SUCCESS";
  readonly characterCount: number;
  readonly importedRecordCount: number;
};

export type KanjiDic2ImportDatabase = {
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
          readonly recordType: "KANJIDIC2_CHARACTER";
          readonly sourceRecordId: string;
        };
      };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<unknown>;
  };
  readonly kanji: {
    upsert(args: {
      readonly where: { readonly character: string };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<{ readonly id: string }>;
  };
  readonly kanjiReading: {
    upsert(args: {
      readonly where: {
        readonly kanjiId_reading_readingType: {
          readonly kanjiId: string;
          readonly reading: string;
          readonly readingType: "ONYOMI" | "KUNYOMI" | "NANORI" | "OTHER";
        };
      };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<unknown>;
  };
  readonly kanjiMeaning: {
    upsert(args: {
      readonly where: {
        readonly kanjiId_locale_meaning: {
          readonly kanjiId: string;
          readonly locale: "en-US";
          readonly meaning: string;
        };
      };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<unknown>;
  };
};

const KANJIDIC2_LICENSE_NAME = "EDRDG KANJIDIC2 license";
const KANJIDIC2_SOURCE_NAME = "KANJIDIC2";
const KANJIDIC2_HOMEPAGE_URL = "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project";
const KANJIDIC2_DOWNLOAD_URL = "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz";
const EDRDG_LICENSE_URL = "https://www.edrdg.org/edrdg/licence.html";

export function parseKanjiDic2Xml(xml: string): KanjiDic2ParseResult {
  const headerBlock = extractOptionalElement(xml, "header") ?? "";
  const characterBlocks = extractElements(xml, "character");

  return {
    header: {
      fileVersion: extractOptionalText(headerBlock, "file_version"),
      databaseVersion: extractOptionalText(headerBlock, "database_version"),
      dateOfCreation: extractOptionalText(headerBlock, "date_of_creation"),
    },
    characters: characterBlocks.map(parseCharacterBlock),
  };
}

export async function importKanjiDic2Xml(
  db: KanjiDic2ImportDatabase,
  xml: string,
  options: KanjiDic2ImportOptions,
): Promise<KanjiDic2ImportResult> {
  const parsed = parseKanjiDic2Xml(xml);
  const checksumSha256 = options.checksumSha256 ?? calculateSha256(xml);
  const sourceVersion =
    options.sourceVersion ??
    parsed.header.databaseVersion ??
    parsed.header.dateOfCreation ??
    parsed.header.fileVersion ??
    "unknown";

  const license = await db.license.upsert({
    where: { name: KANJIDIC2_LICENSE_NAME },
    update: {
      spdxLikeId: "CC-BY-SA-4.0",
      scope: "OPEN_DATA",
      url: EDRDG_LICENSE_URL,
      requiresAttribution: true,
      requiresShareAlike: true,
      notes:
        "KANJIDIC2 data from EDRDG is distributed under CC BY-SA 4.0. Keep imported rows separate from curated learning content.",
    },
    create: {
      name: KANJIDIC2_LICENSE_NAME,
      spdxLikeId: "CC-BY-SA-4.0",
      scope: "OPEN_DATA",
      url: EDRDG_LICENSE_URL,
      requiresAttribution: true,
      requiresShareAlike: true,
      notes:
        "KANJIDIC2 data from EDRDG is distributed under CC BY-SA 4.0. Keep imported rows separate from curated learning content.",
    },
  });
  const dataSource = await db.dataSource.upsert({
    where: { name: KANJIDIC2_SOURCE_NAME },
    update: {
      homepageUrl: KANJIDIC2_HOMEPAGE_URL,
      downloadUrl: KANJIDIC2_DOWNLOAD_URL,
      licenseId: license.id,
      attributionText:
        "KANJIDIC2 dictionary data is provided by the Electronic Dictionary Research and Development Group.",
      notes: "Kanji metadata source. Raw imported meanings are not curated lesson copy.",
    },
    create: {
      name: KANJIDIC2_SOURCE_NAME,
      homepageUrl: KANJIDIC2_HOMEPAGE_URL,
      downloadUrl: KANJIDIC2_DOWNLOAD_URL,
      licenseId: license.id,
      attributionText:
        "KANJIDIC2 dictionary data is provided by the Electronic Dictionary Research and Development Group.",
      notes: "Kanji metadata source. Raw imported meanings are not curated lesson copy.",
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
      statsJson: { characters: parsed.characters.length },
      errorText: null,
    },
    create: {
      dataSourceId: dataSource.id,
      sourceVersion,
      sourceFileName: options.sourceFileName,
      checksumSha256,
      finishedAt: new Date(),
      status: "SUCCESS",
      statsJson: { characters: parsed.characters.length },
      errorText: null,
    },
  });

  for (const character of parsed.characters) {
    await db.importedRecord.upsert({
      where: {
        importRunId_recordType_sourceRecordId: {
          importRunId: importRun.id,
          recordType: "KANJIDIC2_CHARACTER",
          sourceRecordId: character.sourceRecordId,
        },
      },
      update: {
        rawJson: character.raw,
      },
      create: {
        importRunId: importRun.id,
        recordType: "KANJIDIC2_CHARACTER",
        sourceRecordId: character.sourceRecordId,
        rawJson: character.raw,
      },
    });

    const kanji = await db.kanji.upsert({
      where: { character: character.character },
      update: {
        strokeCount: character.strokeCount,
        grade: character.grade,
        jlptLevel: character.jlptLevel,
        frequencyRank: character.frequencyRank,
        kanjidicSourceId: character.sourceRecordId,
      },
      create: {
        character: character.character,
        strokeCount: character.strokeCount,
        grade: character.grade,
        jlptLevel: character.jlptLevel,
        frequencyRank: character.frequencyRank,
        kanjidicSourceId: character.sourceRecordId,
      },
    });

    for (const reading of character.readings) {
      await db.kanjiReading.upsert({
        where: {
          kanjiId_reading_readingType: {
            kanjiId: kanji.id,
            reading: reading.reading,
            readingType: reading.readingType,
          },
        },
        update: {
          priority: reading.priority,
        },
        create: {
          kanjiId: kanji.id,
          reading: reading.reading,
          readingType: reading.readingType,
          priority: reading.priority,
        },
      });
    }

    for (const meaning of character.meanings) {
      await db.kanjiMeaning.upsert({
        where: {
          kanjiId_locale_meaning: {
            kanjiId: kanji.id,
            locale: meaning.locale,
            meaning: meaning.text,
          },
        },
        update: {
          isPrimary: meaning.isPrimary,
          sourceKind: "IMPORTED",
        },
        create: {
          kanjiId: kanji.id,
          locale: meaning.locale,
          meaning: meaning.text,
          isPrimary: meaning.isPrimary,
          sourceKind: "IMPORTED",
        },
      });
    }
  }

  return {
    licenseId: license.id,
    dataSourceId: dataSource.id,
    importRunId: importRun.id,
    checksumSha256,
    status: "SUCCESS",
    characterCount: parsed.characters.length,
    importedRecordCount: parsed.characters.length,
  };
}

function parseCharacterBlock(block: string): KanjiDic2CharacterDto {
  const character = extractRequiredText(block, "literal");
  const codepoint = extractCodepoint(block) ?? character.codePointAt(0)?.toString(16);

  if (codepoint === undefined) {
    throw new Error(`KANJIDIC2 character ${character} is missing a usable codepoint.`);
  }

  const miscBlock = extractOptionalElement(block, "misc") ?? "";
  const readingElements = extractAttributedElements(block, "reading");
  const meaningElements = extractAttributedElements(block, "meaning");
  const selectedReadings = readingElements
    .map((reading) => ({
      reading: reading.text,
      sourceType: reading.attributes.r_type ?? "unknown",
    }))
    .filter((reading) => isJapaneseReadingSourceType(reading.sourceType));
  const selectedMeanings = meaningElements
    .map((meaning) => ({
      text: meaning.text,
      sourceLanguage: meaning.attributes.m_lang ?? "en",
    }))
    .filter((meaning) => meaning.sourceLanguage.trim().toLowerCase() === "en");
  const readings = selectedReadings.map((reading, index) => ({
    ...reading,
    readingType: toReadingType(reading.sourceType),
    priority: index + 1,
  }));
  const meanings = selectedMeanings.map((meaning, index) => ({
    locale: "en-US" as const,
    text: meaning.text,
    isPrimary: index === 0,
  }));

  return {
    sourceRecordId: `kanjidic2:${codepoint.toLowerCase()}`,
    character,
    codepoint: codepoint.toLowerCase(),
    strokeCount: parseOptionalInteger(extractOptionalText(miscBlock, "stroke_count")),
    grade: parseOptionalInteger(extractOptionalText(miscBlock, "grade")),
    jlptLevel: parseOptionalInteger(extractOptionalText(miscBlock, "jlpt")),
    frequencyRank: parseOptionalInteger(extractOptionalText(miscBlock, "freq")),
    readings,
    meanings,
    raw: {
      literal: character,
      codepoint: codepoint.toLowerCase(),
      misc: {
        strokeCount: parseOptionalInteger(extractOptionalText(miscBlock, "stroke_count")),
        grade: parseOptionalInteger(extractOptionalText(miscBlock, "grade")),
        jlptLevel: parseOptionalInteger(extractOptionalText(miscBlock, "jlpt")),
        frequencyRank: parseOptionalInteger(extractOptionalText(miscBlock, "freq")),
      },
      readings: selectedReadings,
      meanings: selectedMeanings,
    },
  };
}

function extractCodepoint(block: string): string | null {
  const codepoints = extractAttributedElements(block, "cp_value");
  const ucs = codepoints.find((codepoint) => codepoint.attributes.cp_type === "ucs");

  return ucs?.text ?? null;
}

function parseOptionalInteger(value: string | null): number | null {
  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`KANJIDIC2 integer field is invalid: ${value}`);
  }

  return parsed;
}

function toReadingType(sourceType: string): KanjiDic2ReadingType {
  switch (sourceType) {
    case "ja_on":
      return "ONYOMI";
    case "ja_kun":
      return "KUNYOMI";
    case "nanori":
      return "NANORI";
    default:
      return "OTHER";
  }
}

function isJapaneseReadingSourceType(sourceType: string): boolean {
  return sourceType === "ja_on" || sourceType === "ja_kun";
}
