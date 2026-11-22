import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_WORD_BATCH_IDS = 40;

export function selectStagingCuration(env = process.env) {
  const kanji = env.KANJI_BATCH ?? "";
  const words = env.WORD_BATCH ?? "";
  const wordIds = typeof words === "string" && words !== "" ? words.split(",") : [];
  const skipWords = env.SKIP_WORDS ?? "false";
  const mode = env.CURATION_MODE ?? "plan";
  const supplement = env.SUPPLEMENT_WORD_SOURCES ?? "false";
  const sourcePairLimit = env.SOURCE_PAIR_LIMIT ?? "100";
  const stageWordPairs = env.STAGE_WORD_PAIRS ?? "false";
  const sourceOnly = mode === "plan_sources" || mode === "apply_sources";
  const receiptsOnly = mode === "receipts";
  if (
    typeof words !== "string" ||
    ![kanji, ...wordIds].every(
      (id) => typeof id === "string" && (id === "" || /^[a-z][a-z0-9-]{0,79}$/u.test(id)),
    ) ||
    wordIds.some((id) => id === "") ||
    wordIds.length > MAX_WORD_BATCH_IDS ||
    new Set(wordIds).size !== wordIds.length ||
    !["true", "false"].includes(skipWords) ||
    !["plan", "apply", "plan_sources", "apply_sources", "receipts"].includes(mode) ||
    !["true", "false"].includes(supplement) ||
    !["true", "false"].includes(stageWordPairs) ||
    (stageWordPairs === "true" &&
      (mode !== "apply" || kanji !== "" || words === "" || supplement !== "false")) ||
    typeof sourcePairLimit !== "string" ||
    !/^(?:[1-9][0-9]?|100)$/u.test(sourcePairLimit) ||
    (!sourceOnly && sourcePairLimit !== "100") ||
    (sourceOnly &&
      (kanji !== "" || words === "" || skipWords !== "false" || supplement !== "false")) ||
    (receiptsOnly &&
      ((kanji === "" && words === "") || skipWords !== "false" || supplement !== "false")) ||
    (supplement === "true" && words === "") ||
    // An empty vocabulary selection means all manifests in plan mode only.
    (mode === "apply" && words === "" && skipWords !== "true") ||
    (skipWords === "true" && (kanji === "" || words !== ""))
  )
    throw new Error("Invalid staging curation selection.");
  return {
    applyKanji: !sourceOnly && !receiptsOnly && (kanji !== "" || words === ""),
    applyWords: !sourceOnly && !receiptsOnly && skipWords !== "true",
    supplementWordSources: sourceOnly || supplement === "true",
    sourceOnly,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) throw new Error("Unexpected arguments.");
    const selection = selectStagingCuration();
    console.log(
      `apply_kanji=${selection.applyKanji}\napply_words=${selection.applyWords}\nsupplement_word_sources=${selection.supplementWordSources}\nsource_only=${selection.sourceOnly}`,
    );
  } catch {
    console.error("Invalid staging curation selection.");
    process.exitCode = 1;
  }
}
