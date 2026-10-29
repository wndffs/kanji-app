import { WAVE08_CANDIDATES } from "../packages/db/src/lexical-wave08-candidates";
import { verifyLocalSnapshot } from "./local-source-manifest.mts";
import { fingerprint, localSourceFingerprint } from "./local-draft-evidence.mts";
import { inspectLocalWords } from "./local-word-evidence.mts";
import { inspectLocalKanji } from "./local-kanji-evidence.mts";
import { inspectLocalStrokes } from "./local-stroke-evidence.mts";

export async function inspectLexicalWave08(directory: string) {
  const snapshot = await verifyLocalSnapshot(directory);
  const source = (id: string) => snapshot.sources.find((entry) => entry.id === id)!;
  const words = await inspectLocalWords(source("jmdict"), WAVE08_CANDIDATES, {includeLexicalMetadata:true});
  const kanji = await inspectLocalKanji(source("kanjidic2"), [{character:"前",reading:{source:"ゼン",sourceType:"ja_on",primary:"ぜん"}}]);
  const strokes = await inspectLocalStrokes(source("kanjivg"), ["前"]);
  return {
    scope:"local-lexical-wave08-evidence", snapshot, sourceFingerprint:localSourceFingerprint(snapshot),
    candidateFingerprint:fingerprint(WAVE08_CANDIDATES), words, kanji, strokes,
    summary: {
      words:words.items.length, matched:words.items.filter(x=>x.status==='matched').length,
      bilingual:words.items.filter(x=>x.bilingual).length,
      kanjiMatched:kanji.items.filter(x=>x.status==='matched').length,
      strokesMatched:strokes.items.filter(x=>x.status==='matched').length,
    },
    independentReview:false, publicationApproved:false, readyToPublish:false,
  };
}
