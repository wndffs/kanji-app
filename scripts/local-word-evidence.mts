import { parseJmDictXml } from "../packages/content-importers/src/jmdict";
import { type LocalSource } from "./local-source-manifest.mts";
import {
  children,
  scanSourceXml,
  serializeNode,
  textOf,
  type SourceNode,
} from "./local-source-xml.mts";

export type WordCandidate = { readonly expression: string; readonly reading: string };
const key = (candidate: WordCandidate) => JSON.stringify([candidate.expression, candidate.reading]);
function permitsPair(node: SourceNode, candidate: WordCandidate): boolean {
  const spellings = children(node, "k_ele").flatMap((element) => textOf(element, "keb"));
  return children(node, "r_ele").some((element) => {
    if (!textOf(element, "reb").includes(candidate.reading)) return false;
    const restrictions = textOf(element, "re_restr");
    if (children(element, "re_nokanji").length > 0 || spellings.length === 0)
      return candidate.expression === candidate.reading;
    return (
      spellings.includes(candidate.expression) &&
      (restrictions.length === 0 || restrictions.includes(candidate.expression))
    );
  });
}
function pairLocales(node: SourceNode, candidate: WordCandidate) {
  const locales = new Set<string>();
  for (const sense of children(node, "sense")) {
    const spellings = textOf(sense, "stagk");
    const readings = textOf(sense, "stagr");
    if (
      (spellings.length && !spellings.includes(candidate.expression)) ||
      (readings.length && !readings.includes(candidate.reading))
    )
      continue;
    for (const gloss of children(sense, "gloss")) {
      if (!gloss.text.trim()) continue;
      const lang = gloss.attributes["xml:lang"] ?? gloss.attributes.lang ?? "eng";
      if (["eng", "en"].includes(lang)) locales.add("en-US");
      if (["rus", "ru"].includes(lang)) locales.add("ru-RU");
    }
  }
  return [...locales].sort();
}
export async function inspectLocalWords(source: LocalSource, candidates: readonly WordCandidate[]) {
  const expressions = new Set(candidates.map((candidate) => candidate.expression));
  const matches = new Map<
    string,
    { sourceRecordId: string; sequence: string; locales: string[] }[]
  >();
  const scanned = await scanSourceXml(source, "JMdict", "entry", (node) => {
    const spellings = children(node, "k_ele").flatMap((element) => textOf(element, "keb"));
    const kana = children(node, "r_ele").flatMap((element) => textOf(element, "reb"));
    if (![...spellings, ...kana].some((expression) => expressions.has(expression))) return;
    const parsed = parseJmDictXml(`<JMdict>${serializeNode(node)}</JMdict>`).entries[0]!;
    for (const candidate of candidates) {
      if (!permitsPair(node, candidate)) continue;
      const existing = matches.get(key(candidate)) ?? [];
      existing.push({
        sourceRecordId: parsed.sourceRecordId,
        sequence: parsed.sequence,
        locales: pairLocales(node, candidate),
      });
      if (existing.length > 64) throw new Error("Too many ambiguous dictionary matches.");
      matches.set(key(candidate), existing);
    }
  });
  return {
    scanned,
    items: candidates.map((candidate) => {
      const records = matches.get(key(candidate)) ?? [];
      return {
        ...candidate,
        matches: records.length,
        sourceRecordId: records.length === 1 ? records[0]!.sourceRecordId : null,
        sequence: records.length === 1 ? records[0]!.sequence : null,
        bilingual:
          records.length === 1 &&
          records[0]!.locales.includes("ru-RU") &&
          records[0]!.locales.includes("en-US"),
        status: records.length === 0 ? "missing" : records.length > 1 ? "ambiguous" : "matched",
      };
    }),
  };
}
