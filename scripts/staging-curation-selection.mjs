import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function selectStagingCuration(env = process.env) {
  const kanji = env.KANJI_BATCH ?? "";
  const words = env.WORD_BATCH ?? "";
  const skipWords = env.SKIP_WORDS ?? "false";
  const mode = env.CURATION_MODE ?? "plan";
  if (
    ![kanji, words].every(
      (id) => typeof id === "string" && (id === "" || /^[a-z][a-z0-9-]{0,79}$/u.test(id)),
    ) ||
    !["true", "false"].includes(skipWords) ||
    !["plan", "apply"].includes(mode) ||
    (skipWords === "true" && (kanji === "" || words !== ""))
  )
    throw new Error("Invalid staging curation selection.");
  return {
    applyKanji: kanji !== "" || words === "",
    applyWords: skipWords !== "true",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) throw new Error("Unexpected arguments.");
    const selection = selectStagingCuration();
    console.log(`apply_kanji=${selection.applyKanji}\napply_words=${selection.applyWords}`);
  } catch {
    console.error("Invalid staging curation selection.");
    process.exitCode = 1;
  }
}
