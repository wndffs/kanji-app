import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const kanjivg = "b36579789775ea912d5e98356bf243f54fb953fa3b58a16c2d6995f252e2a3e2";
const original = Object.freeze({
  version: "2026-10-31",
  jmdict: "c09c402a69dbe2eb02cb8e9e7510e51bd512e53cb26e162901323cfaf3ed5eff",
  kanjidic2: "8e70bfa3a7a7df640e3ba254a80438201904d95df0fb23c9323476c2676d3346",
  kanjivg,
});
const refreshed = Object.freeze({
  version: "2026-11-22",
  jmdict: "fedf3314736c94e474ab3ce872d6c172b05c6cc0983f5a65b76b4cef49cea194",
  kanjidic2: "c5517ceca1de1bc43f59bd2ac9ce1fa6e6a6de0c34170137db027be82a29ad56",
  kanjivg,
});

// Only these manifests matched their previous bilingual lexical fingerprints.
// Reproduce the refresh evidence before adding any other manifest to this pin.
const refreshedDeepening = new Set(
  Array.from({ length: 29 }, (_, index) => index + 1)
    .filter((number) => ![15, 21, 24].includes(number))
    .map((number) => `full-course-vocabulary-deepening-${String(number).padStart(2, "0")}`),
);

export function selectReviewedSourcePin(values) {
  const ids = typeof values === "string" ? values.split(",") : [];
  if (
    ids.length === 0 ||
    ids.length > 40 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !/^[a-z][a-z0-9-]{0,79}$/u.test(id))
  )
    throw new Error("Invalid reviewed word selection for a source snapshot.");
  return ids.every((id) => refreshedDeepening.has(id)) ? refreshed : original;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) throw new Error("Unexpected source-pin arguments.");
    const pin = selectReviewedSourcePin(process.env.WORD_BATCH);
    for (const [key, value] of Object.entries(pin)) console.log(`${key}=${value}`);
  } catch {
    console.error("Invalid reviewed word selection for a source snapshot.");
    process.exitCode = 1;
  }
}
