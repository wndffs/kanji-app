import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function selectStagingCuration(env = process.env) {
  const kanji = env.KANJI_BATCH ?? "";
  const words = env.WORD_BATCH ?? "";
  const wordIds = typeof words === "string" && words !== "" ? words.split(",") : [];
  const skipWords = env.SKIP_WORDS ?? "false";
  const mode = env.CURATION_MODE ?? "plan";
  const supplement = env.SUPPLEMENT_WORD_SOURCES ?? "false";
  if (
    typeof words !== "string" ||
    ![kanji, ...wordIds].every(
      (id) => typeof id === "string" && (id === "" || /^[a-z][a-z0-9-]{0,79}$/u.test(id)),
    ) ||
    wordIds.some((id) => id === "") ||
    wordIds.length > 20 ||
    new Set(wordIds).size !== wordIds.length ||
    !["true", "false"].includes(skipWords) ||
    !["plan", "apply"].includes(mode) ||
    !["true", "false"].includes(supplement) ||
    (supplement === "true" && skipWords === "true") ||
    (skipWords === "true" && (kanji === "" || words !== ""))
  )
    throw new Error("Invalid staging curation selection.");
  return {
    applyKanji: kanji !== "" || words === "",
    applyWords: skipWords !== "true",
    supplementWordSources: supplement === "true",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) throw new Error("Unexpected arguments.");
    const selection = selectStagingCuration();
    console.log(
      `apply_kanji=${selection.applyKanji}\napply_words=${selection.applyWords}\nsupplement_word_sources=${selection.supplementWordSources}`,
    );
  } catch {
    console.error("Invalid staging curation selection.");
    process.exitCode = 1;
  }
}
