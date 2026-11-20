import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildMainCourseContentBatches,
  type MainCourseContentBatch,
} from "../packages/db/src/main-course-content";
import {
  buildMainCourseWordBatches,
  mainCourseWordReadingEntryId,
  type MainCourseWordBatch,
} from "../packages/db/src/main-course-word-content";
import { inspectLocalKanji } from "./local-kanji-evidence.mts";
import { inspectLocalStrokes } from "./local-stroke-evidence.mts";
import { inspectLocalWords } from "./local-word-evidence.mts";
import { verifyLocalSnapshot, type LocalSourceSnapshot } from "./local-source-manifest.mts";

export async function inspectLocalCourseSources(
  snapshot: LocalSourceSnapshot,
  kanjiBatches: readonly MainCourseContentBatch[],
  wordBatches: readonly MainCourseWordBatch[],
) {
  const source = (id: "jmdict" | "kanjidic2" | "kanjivg") => {
    const entry = snapshot.sources.find((source) => source.id === id);
    if (!entry) throw new Error(`Missing ${id} in local source snapshot.`);
    return entry;
  };
  const kanji = kanjiBatches.flatMap((batch) => batch.kanji);
  const words = wordBatches.flatMap((batch) => batch.words);
  if (kanji.length + words.length === 0) throw new Error("Select nonempty course manifests.");
  const requiredStrokes = kanji.filter((item) => item.requireStrokeData);
  const pairs = words.flatMap((word) =>
    [word.reading, ...(word.acceptedReadings ?? [])].map((reading) => ({
      expression: word.expression,
      reading,
      expectedId: mainCourseWordReadingEntryId(word, reading),
    })),
  );
  const readings = kanji.length
    ? (
        await inspectLocalKanji(
          source("kanjidic2"),
          kanji.map((item) => ({
            character: item.character,
            reading: { ...item.reading, sourceType: item.reading.sourceType ?? "ja_on" },
          })),
        )
      ).items
    : [];
  const strokes = requiredStrokes.length
    ? (
        await inspectLocalStrokes(
          source("kanjivg"),
          requiredStrokes.map((item) => item.character),
        )
      ).items
    : [];
  const matches = pairs.length ? (await inspectLocalWords(source("jmdict"), pairs)).items : [];
  const badReadings = readings.filter((item) => item.status !== "matched");
  const badStrokes = strokes.filter((item) => item.status !== "matched");
  const badWords = matches.filter(
    (item, index) =>
      item.status !== "matched" ||
      !item.bilingual ||
      item.sourceRecordId !== pairs[index]!.expectedId,
  );
  // This exact-pair check cannot attest the distinct sense-note proof path.
  const noteProofsRequired = words.reduce(
    (n, word) => n + (word.sourceNoteReadings?.length ?? 0),
    0,
  );
  return {
    snapshotVersion: snapshot.snapshotVersion,
    kanji: { checked: readings.length, failed: badReadings.length },
    strokes: { checked: strokes.length, failed: badStrokes.length },
    wordPairs: { checked: matches.length, failed: badWords.length },
    noteProofsRequired,
    sourceMatchesComplete:
      badReadings.length + badStrokes.length + badWords.length + noteProofsRequired === 0,
    independentReview: false,
    publicationApproved: false,
  };
}

export function parseLocalCourseEvidenceArgs(args: readonly string[]) {
  let directory: string | undefined;
  const kanjiBatchIds: string[] = [];
  const wordBatchIds: string[] = [];
  for (let index = 0; index < args.length; index += 2) {
    const [flag, value] = [args[index], args[index + 1]];
    if (!value || value.startsWith("--")) throw new Error("Missing local evidence argument.");
    if (flag === "--snapshot-dir" && directory === undefined && isAbsolute(value)) {
      directory = value;
      continue;
    }
    const ids =
      flag === "--kanji-batch" ? kanjiBatchIds : flag === "--word-batch" ? wordBatchIds : null;
    if (
      !ids ||
      !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(value) ||
      ids.includes(value) ||
      ids.length >= 40
    )
      throw new Error("Invalid or duplicate local evidence selection.");
    ids.push(value);
  }
  if (!directory || kanjiBatchIds.length + wordBatchIds.length === 0)
    throw new Error(
      "Use --snapshot-dir ABSOLUTE_DIR and explicit --kanji-batch / --word-batch IDs.",
    );
  return { directory, kanjiBatchIds, wordBatchIds };
}

function select<T extends { readonly id: string }>(registry: readonly T[], ids: readonly string[]) {
  return ids.map((id) => {
    const batch = registry.find((batch) => batch.id === id);
    if (!batch) throw new Error(`Unknown registered batch ${id}.`);
    return batch;
  });
}

async function main() {
  const options = parseLocalCourseEvidenceArgs(process.argv.slice(2));
  const kanji = select(buildMainCourseContentBatches(), options.kanjiBatchIds);
  const words = select(buildMainCourseWordBatches(), options.wordBatchIds);
  const result = await inspectLocalCourseSources(
    await verifyLocalSnapshot(options.directory),
    kanji,
    words,
  );
  console.log(JSON.stringify(result));
  process.exitCode = result.sourceMatchesComplete ? 0 : 2;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Local course source evidence failed.");
    process.exitCode = 1;
  });
