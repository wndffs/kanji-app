import { verifySha256 } from "./import-metadata";
import { forEachConcurrent } from "./concurrency";
import { executeTrackedImport, findSuccessfulImportRun, type ImportRunLookup } from "./import-run";
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
  readonly sourceDownloadedAt?: Date | null;
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
          readonly recordType: "KANJIVG_CHARACTER";
          readonly sourceRecordId: string;
        };
      };
      readonly update: Record<string, unknown>;
      readonly create: Record<string, unknown>;
    }): Promise<{ readonly id: string }>;
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
const KANJIVG_DOWNLOAD_URL = "https://github.com/KanjiVG/kanjivg/releases";
const KANJIVG_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/3.0/";
const KANJIVG_LEGACY_VIEW_BOX = "0 0 109 109";
const IMPORT_WRITE_CONCURRENCY = 8;

export function parseKanjiVgXml(xml: string): KanjiVgParseResult {
  const viewBox =
    extractOpeningTagAttributes(xml, "svg")?.viewBox ??
    (extractOpeningTagAttributes(xml, "kanjivg") === null ? undefined : KANJIVG_LEGACY_VIEW_BOX);

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
  const checksumSha256 = verifySha256(xml, options.checksumSha256);
  const parsed = parseKanjiVgXml(xml);
  const sourceVersion = options.sourceVersion ?? "unknown";
  const statsJson = { characters: parsed.characters.length };

  const license = await db.license.upsert({
    where: { name: KANJIVG_LICENSE_NAME },
    update: {
      spdxLikeId: "CC-BY-SA-3.0",
      scope: "OPEN_DATA",
      url: KANJIVG_LICENSE_URL,
      requiresAttribution: true,
      requiresShareAlike: true,
      notes: "KanjiVG stroke order data. Store paths separately from curated learning content.",
    },
    create: {
      name: KANJIVG_LICENSE_NAME,
      spdxLikeId: "CC-BY-SA-3.0",
      scope: "OPEN_DATA",
      url: KANJIVG_LICENSE_URL,
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
      characterCount: parsed.characters.length,
      importedRecordCount: parsed.characters.length,
    };
  }

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
      sourceDownloadedAt: options.sourceDownloadedAt ?? null,
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
      sourceDownloadedAt: options.sourceDownloadedAt ?? null,
      checksumSha256,
      status: "PENDING",
      errorText: null,
    },
  });

  await executeTrackedImport(db.importRun, importRun.id, statsJson, async () => {
    await forEachConcurrent(parsed.characters, IMPORT_WRITE_CONCURRENCY, async (character) => {
      const importedRecord = await db.importedRecord.upsert({
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
          importedRecordId: importedRecord.id,
          viewBox: character.viewBox,
          strokesJson: character.strokes,
        },
        create: {
          kanjiId: kanji.id,
          sourceRecordId: character.sourceRecordId,
          importedRecordId: importedRecord.id,
          viewBox: character.viewBox,
          strokesJson: character.strokes,
        },
      });
    });
  });

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
  const pattern = /<(?:g|kanji)\b([^>]*)>/gu;
  const codepoints = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const attributes = parseXmlAttributes(match[1] ?? "");
    const groupId = attributes.id ?? "";
    const codepoint =
      groupId.match(/^kvg:StrokePaths_([0-9a-fA-F]+)$/u)?.[1] ??
      groupId.match(/^kvg:kanji_([0-9a-fA-F]+)$/u)?.[1];

    if (codepoint !== undefined) {
      codepoints.add(codepoint.toLowerCase());
    }
  }

  if (codepoints.size === 0) {
    throw new Error("KanjiVG XML does not contain a recognized character group.");
  }

  const paths = extractSelfClosingElements(xml, "path");
  const pathsByCodepoint = new Map<string, XmlElementWithAttributes[]>();

  for (const path of paths) {
    const codepoint = path.attributes.id?.match(/^kvg:([0-9a-fA-F]+)-s\d+$/u)?.[1]?.toLowerCase();

    if (codepoint === undefined || !codepoints.has(codepoint)) {
      continue;
    }

    const groupedPaths = pathsByCodepoint.get(codepoint) ?? [];
    groupedPaths.push(path);
    pathsByCodepoint.set(codepoint, groupedPaths);
  }

  return [...codepoints].map((codepoint) => ({
    codepoint,
    paths: pathsByCodepoint.get(codepoint) ?? [],
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
