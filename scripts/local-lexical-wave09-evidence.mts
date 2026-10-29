import { WAVE09_CANDIDATES } from "../packages/db/src/lexical-wave09-candidates";
import { WAVE09_TEACHING } from "../packages/db/src/lexical-wave09-teaching";
import { buildMainCourseContentBatch09 } from "../packages/db/src/main-course-content-09";
import { verifyLocalSnapshot } from "./local-source-manifest.mts";
import { fingerprint, localSourceFingerprint } from "./local-draft-evidence.mts";
import { inspectLocalWords } from "./local-word-evidence.mts";
import { inspectLocalKanji } from "./local-kanji-evidence.mts";
import { inspectLocalStrokes } from "./local-stroke-evidence.mts";

export async function inspectLexicalWave09(directory: string) {
  const snapshot = await verifyLocalSnapshot(directory);
  const source = (id: string) => snapshot.sources.find(entry => entry.id === id)!;
  const batch = buildMainCourseContentBatch09();
  const words = await inspectLocalWords(source("jmdict"), WAVE09_CANDIDATES, { includeLexicalMetadata: true });
  const kanji = await inspectLocalKanji(source("kanjidic2"), batch.kanji);
  const strokes = await inspectLocalStrokes(source("kanjivg"), batch.kanji.map(x => x.character));
  return {
    scope: "local-lexical-wave09-evidence", snapshot,
    sourceFingerprint: localSourceFingerprint(snapshot), candidateFingerprint: fingerprint(WAVE09_CANDIDATES),
    words, kanji, strokes,
    summary: {
      words: words.items.length, matched: words.items.filter(x => x.status === "matched").length,
      bilingual: words.items.filter(x => x.bilingual).length,
      kanjiMatched: kanji.items.filter(x => x.status === "matched").length,
      strokesMatched: strokes.items.filter(x => x.status === "matched").length,
      selectedPairs: WAVE09_TEACHING.length,
      selectedExactIdentities: WAVE09_TEACHING.filter(candidate => words.items.some(item =>
        item.expression === candidate.expression && item.reading === candidate.reading &&
        item.status === "matched" && item.sourceRecordId === candidate.jmdictEntryId && item.bilingual)).length,
    },
    independentReview: false, publicationApproved: false, readyToPublish: false,
  };
}
