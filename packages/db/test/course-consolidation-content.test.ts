import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateAnswer } from "@kanji-srs/japanese";
import {
  CONSOLIDATION_KANJI_BATCH,
  CONSOLIDATION_PRIOR_WORD_ENDS,
  CONSOLIDATION_REINFORCEMENT,
  CONSOLIDATION_WORD_PREFIX,
  consolidationKanji,
  consolidationWords,
} from "../src/course-consolidation-content";
import { unpackDeepeningReinforcement } from "../src/course-deepening-builders";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
} from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  validateMainCourseWordBatches,
} from "../src/main-course-word-content";
import { beforeCourseBatch } from "./course-registry-fixture";

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const registeredKanji = buildMainCourseContentBatches();
const registeredWords = buildMainCourseWordBatches();
const priorKanji = beforeCourseBatch(registeredKanji, CONSOLIDATION_KANJI_BATCH);
const priorWords = beforeCourseBatch(registeredWords, `${CONSOLIDATION_WORD_PREFIX}01`);
const kanji = consolidationKanji(priorKanji);
const batches = consolidationWords([...priorKanji, kanji], priorWords);
const words = batches.flatMap((batch) => batch.words);

describe("reviewed course consolidation block", () => {
  it("registers only the sealed 200 kanji and 754 words and leaves prior course data intact", () => {
    expect(sha(priorKanji)).toBe(
      "d6c0aecbcbc22c86cd79a0369365c68e599e807277ba7a609a8d25c61c118c5e",
    );
    expect(sha(priorWords)).toBe(
      "3d209990e935484e309e481b21d9191eaf96a2cb7869bc64ca666785d15b82b5",
    );
    expect(sha([kanji, ...batches])).toBe(
      "c9e628fb69582ecbcdeb0c73965f3a10c41fb942844d3706bae21bfd423a859c",
    );
    expect(registeredKanji.find((item) => item.id === CONSOLIDATION_KANJI_BATCH)).toEqual(kanji);
    expect(registeredWords.filter((item) => item.id.startsWith(CONSOLIDATION_WORD_PREFIX))).toEqual(
      batches,
    );
    expect([kanji, ...batches].every((item) => item.reviewedAt === "2026-11-21")).toBe(true);
    expect(kanji.kanji).toHaveLength(200);
    expect(kanji.kanji.every((item) => item.requireStrokeData)).toBe(true);
    expect(batches).toHaveLength(32);
    expect(words).toHaveLength(754);
  });

  it("respects frozen occupied slots and all registered prerequisites", () => {
    const ends = new Map<number, number>();
    for (const batch of priorWords)
      for (const word of batch.words)
        ends.set(batch.levelNumber, Math.max(ends.get(batch.levelNumber) ?? 0, word.sortOrder));
    expect([...ends].sort(([a], [b]) => a - b)).toEqual(CONSOLIDATION_PRIOR_WORD_ENDS);
    expect(validateMainCourseContentBatches(registeredKanji)).toEqual([]);
    expect(validateMainCourseWordBatches(registeredWords)).toEqual([]);
  });

  it("shows a compound sound change without changing the kanji card's accepted reading", () => {
    const { bindings } = unpackDeepeningReinforcement(CONSOLIDATION_REINFORCEMENT);
    expect(bindings).toHaveLength(200);
    expect(bindings.find(([character]) => character === "窃")).toEqual([
      "窃",
      "せつ",
      "窃盗",
      "せっとう",
      0,
      0,
      "1386110",
      "tsu-sokuon",
    ]);
    expect(kanji.kanji.find((item) => item.character === "窃")?.reading.accepted).toEqual(["せつ"]);
    expect(words.find((item) => item.expression === "窃盗")?.reading).toBe("せっとう");
  });

  it.each([
    ["悼", "ru", "оплачивать"],
    ["思いつく", "ru", "передумывать"],
    ["思いなおす", "ru", "придумывать"],
    ["海峡", "ru", "морской прилив"],
    ["調停", "en", "medication"],
    ["普遍", "en", "university"],
  ] as const)("rejects the distinct meaning %s/%s/%s", (symbol, locale, answer) => {
    const item =
      kanji.kanji.find((item) => item.character === symbol) ??
      words.find((item) => item.expression === symbol);
    const terms = item!.meanings[locale];
    const verdict = validateAnswer({
      answerKind: "meaning",
      answer,
      acceptedAnswers: terms.accepted,
      blockedAnswers: terms.blocked?.map((item) => item.text),
    });
    expect(verdict).toMatchObject({ accepted: false, result: "blocked" });
  });
});
