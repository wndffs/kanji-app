import { parseKanjiDic2Xml } from "../packages/content-importers/src/kanjidic2";
import { normalizeJapaneseReading } from "@kanji-srs/japanese";
import { type LocalSource } from "./local-source-manifest.mts";
import { scanSourceXml, serializeNode, textOf } from "./local-source-xml.mts";

export type KanjiCandidate = {
  readonly character: string;
  readonly reading: {
    readonly primary: string;
    readonly source: string;
    readonly sourceType?: string;
  };
};
export async function inspectLocalKanji(
  source: LocalSource,
  candidates: readonly KanjiCandidate[],
) {
  const targets = new Set(candidates.map((candidate) => candidate.character));
  const matches = new Map<string, ReturnType<typeof parseKanjiDic2Xml>["characters"][number][]>();
  const scanned = await scanSourceXml(source, "kanjidic2", "character", (node) => {
    const literal = textOf(node, "literal")[0];
    if (!literal || !targets.has(literal)) return;
    const parsed = parseKanjiDic2Xml(`<kanjidic2>${serializeNode(node)}</kanjidic2>`)
      .characters[0]!;
    matches.set(literal, [...(matches.get(literal) ?? []), parsed]);
  });
  return {
    scanned,
    items: candidates.map((candidate) => {
      const records = matches.get(candidate.character) ?? [];
      const readingMatched =
        records.length === 1 &&
        records[0]!.readings.some(
          (reading) =>
            reading.sourceType === candidate.reading.sourceType &&
            reading.reading === candidate.reading.source &&
            normalizeJapaneseReading(reading.reading) === candidate.reading.primary,
        );
      return {
        character: candidate.character,
        sourceRecordId: records.length === 1 ? records[0]!.sourceRecordId : null,
        matches: records.length,
        readingMatched,
        status:
          records.length === 0
            ? "missing"
            : records.length > 1
              ? "ambiguous"
              : readingMatched
                ? "matched"
                : "reading-mismatch",
      };
    }),
  };
}
