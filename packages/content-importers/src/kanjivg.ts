import { calculateSha256 } from "./checksum";
import {
  extractOpeningTagAttributes,
  extractSelfClosingElements,
  parseXmlAttributes,
  type XmlElementWithAttributes,
} from "./xml";

export type KanjiVgStrokePathDto = {
  readonly id: string;
  readonly order: number;
  readonly path: string;
  readonly type: string | null;
};

export type KanjiVgCharacterDto = {
  readonly sourceRecordId: string;
  readonly character: string;
  readonly codepoint: string;
  readonly viewBox: string;
  readonly strokeCount: number;
  readonly strokes: readonly KanjiVgStrokePathDto[];
  readonly raw: Record<string, unknown>;
};

export type KanjiVgParseResult = {
  readonly characters: readonly KanjiVgCharacterDto[];
};

export type KanjiVgImportOptions = {
  readonly sourceFileName: string;
  readonly sourceVersion?: string | null;
  readonly checksumSha256?: string;
};

export type KanjiVgImportResult = {
  readonly licenseId: string;
  readonly dataSourceId: string;
  readonly importRunId: string;
  readonly checksumSha256: string;
  readonly status: "SUCCESS";
  readonly characterCount: number;
  readonly importedRecordCount: number;
};

export type KanjiVgImportDatabase = {
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
          readonly recordType: "KANJIVG_CHARACTER";
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
  readonly kanjiStrokeGraphic: {
    upsert(args: {
      readonly where: { readonly sourceRecordId: string };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<unknown>;
  };
};

const KANJIVG_LICENSE_NAME = "KanjiVG license";
const KANJIVG_SOURCE_NAME = "KanjiVG";
const KANJIVG_HOMEPAGE_URL = "https://kanjivg.tagaini.net/";
const KANJIVG_DOWNLOAD_URL = "https://github.com/KanjiVG/kanjivg";

export function parseKanjiVgXml(xml: string): KanjiVgParseResult {
  const viewBox = extractOpeningTagAttributes(xml, "svg")?.viewBox;

  if (viewBox === undefined || viewBox.trim() === "") {
    throw new Error("KanjiVG SVG is missing a viewBox attribute.");
  }

  const strokePathGroups = extractStrokePathGroups(xml);

  return {
    characters: strokePathGroups.map((group) => parseStrokePathGroup(group, viewBox)),
  };
}

export async function importKanjiVgXml(
  db: KanjiVgImportDatabase,
  xml: string,
  options: KanjiVgImportOptions,
): Promise<KanjiVgImportResult> {
  const parsed = parseKanjiVgXml(xml);
  const checksumSha256 = options.checksumSha256 ?? calculateSha256(xml);
  const sourceVersion = options.sourceVersion ?? "unknown";

  const license = await db.license.upsert({
    where: { name: KANJIVG_LICENSE_NAME },
    update: {
      spdxLikeId: "LicenseRef-KanjiVG",
      scope: "OPEN_DATA",
      url: KANJIVG_HOMEPAGE_URL,
      requiresAttribution: true,
      requiresShareAlike: true,
      notes: "KanjiVG stroke order data. Store paths separately from curated learning content.",
    },
    create: {
      name: KANJIVG_LICENSE_NAME,
      spdxLikeId: "LicenseRef-KanjiVG",
      scope: "OPEN_DATA",
      url: KANJIVG_HOMEPAGE_URL,
      requiresAttribution: true,
      requiresShareAlike: true,
      notes: "KanjiVG stroke order data. Store paths separately from curated learning content.",
    },
  });
  const dataSource = await db.dataSource.upsert({
    where: { name: KANJIVG_SOURCE_NAME },
    update: {
      homepageUrl: KANJIVG_HOMEPAGE_URL,
      downloadUrl: KANJIVG_DOWNLOAD_URL,
      licenseId: license.id,
      attributionText: "Stroke order data is derived from KanjiVG.",
      notes: "Kanji stroke path source. Component grouping remains source-attributed data.",
    },
    create: {
      name: KANJIVG_SOURCE_NAME,
      homepageUrl: KANJIVG_HOMEPAGE_URL,
      downloadUrl: KANJIVG_DOWNLOAD_URL,
      licenseId: license.id,
      attributionText: "Stroke order data is derived from KanjiVG.",
      notes: "Kanji stroke path source. Component grouping remains source-attributed data.",
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
          recordType: "KANJIVG_CHARACTER",
          sourceRecordId: character.sourceRecordId,
        },
      },
      update: {
        rawJson: character.raw,
      },
      create: {
        importRunId: importRun.id,
        recordType: "KANJIVG_CHARACTER",
        sourceRecordId: character.sourceRecordId,
        rawJson: character.raw,
      },
    });

    const kanji = await db.kanji.upsert({
      where: { character: character.character },
      update: {},
      create: {
        character: character.character,
        strokeCount: character.strokeCount,
      },
    });

    await db.kanjiStrokeGraphic.upsert({
      where: { sourceRecordId: character.sourceRecordId },
      update: {
        kanjiId: kanji.id,
        viewBox: character.viewBox,
        strokesJson: character.strokes,
      },
      create: {
        kanjiId: kanji.id,
        sourceRecordId: character.sourceRecordId,
        viewBox: character.viewBox,
        strokesJson: character.strokes,
      },
    });
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

type StrokePathGroup = {
  readonly codepoint: string;
  readonly paths: readonly XmlElementWithAttributes[];
};

function extractStrokePathGroups(xml: string): readonly StrokePathGroup[] {
  const pattern = /<g\b([^>]*)>/gu;
  const codepoints = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const attributes = parseXmlAttributes(match[1] ?? "");
    const groupId = attributes.id ?? "";
    const codepoint = groupId.match(/^kvg:StrokePaths_([0-9a-fA-F]+)$/u)?.[1];

    if (codepoint !== undefined) {
      codepoints.add(codepoint.toLowerCase());
    }
  }

  if (codepoints.size === 0) {
    throw new Error("KanjiVG SVG does not contain a kvg:StrokePaths group.");
  }

  const paths = extractSelfClosingElements(xml, "path");

  return [...codepoints].map((codepoint) => ({
    codepoint,
    paths: paths.filter((path) => path.attributes.id?.startsWith(`kvg:${codepoint}-s`) ?? false),
  }));
}

function parseStrokePathGroup(group: StrokePathGroup, viewBox: string): KanjiVgCharacterDto {
  const codepointNumber = Number.parseInt(group.codepoint, 16);

  if (!Number.isFinite(codepointNumber)) {
    throw new Error(`KanjiVG codepoint is invalid: ${group.codepoint}`);
  }

  const character = String.fromCodePoint(codepointNumber);
  const strokes = group.paths.map((path, index) => {
    const id = path.attributes.id;
    const d = path.attributes.d;

    if (id === undefined || id.trim() === "") {
      throw new Error(`KanjiVG ${group.codepoint} path ${index + 1} is missing id.`);
    }

    if (d === undefined || d.trim() === "") {
      throw new Error(`KanjiVG ${group.codepoint} path ${id} is missing d.`);
    }

    return {
      id,
      order: index + 1,
      path: d,
      type: path.attributes["kvg:type"] ?? path.attributes.type ?? null,
    };
  });

  if (strokes.length === 0) {
    throw new Error(`KanjiVG ${group.codepoint} does not contain stroke paths.`);
  }

  return {
    sourceRecordId: `kanjivg:${group.codepoint}`,
    character,
    codepoint: group.codepoint,
    viewBox,
    strokeCount: strokes.length,
    strokes,
    raw: {
      character,
      codepoint: group.codepoint,
      viewBox,
      strokeCount: strokes.length,
      strokes,
    },
  };
}
