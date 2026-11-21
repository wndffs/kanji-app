import { parseKanjiVgXml } from "../packages/content-importers/src/kanjivg";
import { type LocalSource } from "./local-source-manifest.mts";
import { scanSourceXml, serializeNode, type SourceNode } from "./local-source-xml.mts";

function strokeComponentLabels(record: SourceNode, character: string) {
  const labels = new Set<string>();
  const visit = (node: SourceNode, root: boolean): boolean => {
    let hasStroke = node.name === "path";
    for (const child of node.children) {
      hasStroke = visit(child, false) || hasStroke;
    }
    const label = node.attributes["kvg:element"];
    if (!root && hasStroke && node.name === "g" && label) labels.add(label);
    return hasStroke;
  };
  for (const root of record.children) {
    const hasStroke = visit(root, true);
    // An elementary sign may be taught first as its own whole-shape cue.
    if (
      hasStroke &&
      labels.size === 0 &&
      root.name === "g" &&
      root.attributes["kvg:element"] === character
    ) {
      labels.add(character);
    }
  }
  return labels;
}

export async function inspectLocalStrokes(
  source: LocalSource,
  characters: readonly string[],
  expectedComponents?: ReadonlyMap<string, readonly string[]>,
) {
  const targets = new Set(
    characters.map((character) => character.codePointAt(0)!.toString(16).padStart(5, "0")),
  );
  const matches = new Map<
    string,
    { sourceRecordId: string; strokeCount: number; componentLabels: Set<string> | undefined }[]
  >();
  const scanned = await scanSourceXml(source, "kanjivg", "kanji", (node) => {
    const codepoint = /^kvg:kanji_([a-f0-9]{5,6})$/u.exec(node.attributes.id ?? "")?.[1];
    if (!codepoint || !targets.has(codepoint)) return;
    const parsed = parseKanjiVgXml(`<kanjivg>${serializeNode(node)}</kanjivg>`).characters;
    if (parsed.length !== 1 || parsed[0]!.codepoint !== codepoint)
      throw new Error("Stroke character identity mismatch.");
    const paths = parsed[0]!.strokes;
    const validOrder = paths.every(
      (stroke, index) => stroke.id === `kvg:${codepoint}-s${index + 1}`,
    );
    if (!validOrder) throw new Error("Stroke IDs are not a complete primary sequence.");
    matches.set(codepoint, [
      ...(matches.get(codepoint) ?? []),
      {
        sourceRecordId: parsed[0]!.sourceRecordId,
        strokeCount: parsed[0]!.strokeCount,
        componentLabels: expectedComponents
          ? strokeComponentLabels(node, String.fromCodePoint(Number.parseInt(codepoint, 16)))
          : undefined,
      },
    ]);
  });
  return {
    scanned,
    items: characters.map((character) => {
      const records = matches.get(character.codePointAt(0)!.toString(16).padStart(5, "0")) ?? [];
      const record = records.length === 1 ? records[0] : undefined;
      return {
        character,
        matches: records.length,
        sourceRecordId: record?.sourceRecordId ?? null,
        strokeCount: record?.strokeCount ?? null,
        missingComponents: (expectedComponents?.get(character) ?? []).filter(
          (symbol) => !record?.componentLabels?.has(symbol),
        ),
        status: records.length === 0 ? "missing" : records.length > 1 ? "ambiguous" : "matched",
      };
    }),
  };
}
