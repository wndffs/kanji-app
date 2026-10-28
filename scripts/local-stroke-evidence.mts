import { parseKanjiVgXml } from "../packages/content-importers/src/kanjivg";
import { type LocalSource } from "./local-source-manifest.mts";
import { scanSourceXml, serializeNode } from "./local-source-xml.mts";

export async function inspectLocalStrokes(source: LocalSource, characters: readonly string[]) {
  const targets = new Set(characters.map((character) => character.codePointAt(0)!.toString(16).padStart(5, "0")));
  const matches = new Map<string, { sourceRecordId: string; strokeCount: number }[]>();
  const scanned = await scanSourceXml(source, "kanjivg", "kanji", (node) => {
    const codepoint = /^kvg:kanji_([a-f0-9]{5,6})$/u.exec(node.attributes.id ?? "")?.[1];
    if (!codepoint || !targets.has(codepoint)) return;
    const parsed = parseKanjiVgXml(`<kanjivg>${serializeNode(node)}</kanjivg>`).characters;
    if (parsed.length !== 1 || parsed[0]!.codepoint !== codepoint) throw new Error("Stroke character identity mismatch.");
    const paths = parsed[0]!.strokes;
    const validOrder = paths.every((stroke, index) => stroke.id === `kvg:${codepoint}-s${index + 1}`);
    if (!validOrder) throw new Error("Stroke IDs are not a complete primary sequence.");
    matches.set(codepoint, [...(matches.get(codepoint) ?? []), { sourceRecordId: parsed[0]!.sourceRecordId, strokeCount: parsed[0]!.strokeCount }]);
  });
  return { scanned, items: characters.map((character) => {
    const records = matches.get(character.codePointAt(0)!.toString(16).padStart(5, "0")) ?? [];
    return { character, matches: records.length, sourceRecordId: records.length === 1 ? records[0]!.sourceRecordId : null, strokeCount: records.length === 1 ? records[0]!.strokeCount : null, status: records.length === 0 ? "missing" : records.length > 1 ? "ambiguous" : "matched" };
  }) };
}
