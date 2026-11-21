import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateAnswer } from "@kanji-srs/japanese";
import {
  FINALIZATION_KANJI_BATCH,
  FINALIZATION_PRIOR_WORD_ENDS,
  FINALIZATION_WORD_PREFIX,
  finalizationKanji,
  finalizationWords,
} from "../src/course-finalization-content";
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
const priorKanji = beforeCourseBatch(registeredKanji, FINALIZATION_KANJI_BATCH);
const priorWords = beforeCourseBatch(registeredWords, `${FINALIZATION_WORD_PREFIX}01`);
const kanji = finalizationKanji(priorKanji);
const words = finalizationWords([...priorKanji, kanji], priorWords);

describe("reviewed course finalization block", () => {
  it("appends 160 independently reviewed reading pairs without moving earlier content", () => {
    expect(sha(priorKanji)).toBe(
      "5393cc653cbc22457f7957fd039b117a6eb106211f422b5cacce9b0b091f275b",
    );
    expect(sha(priorWords)).toBe(
      "4c329030d3e236aac146da275ec996bb637f4f3cbe8b29207a70abc88ff4aa3d",
    );
    expect(sha([kanji, ...words])).toBe(
      "342325e43f375aa98f40e241bcfdc4547c0049483a3736195ab647740ddc06e4",
    );
    expect(registeredKanji.find((batch) => batch.id === FINALIZATION_KANJI_BATCH)).toEqual(kanji);
    expect(
      registeredWords.filter((batch) => batch.id.startsWith(FINALIZATION_WORD_PREFIX)),
    ).toEqual(words);
    expect([kanji, ...words].every((batch) => batch.reviewedAt === "2026-11-21")).toBe(true);
    expect(kanji.kanji).toHaveLength(160);
    expect(words).toHaveLength(10);
    expect(words.flatMap((batch) => batch.words)).toHaveLength(160);
    expect(validateMainCourseContentBatches(registeredKanji)).toEqual([]);
    expect(validateMainCourseWordBatches(registeredWords)).toEqual([]);
  });

  it("freezes earlier occupied word slots and catches cross-meaning Russian typos", () => {
    const ends = new Map<number, number>();
    for (const batch of priorWords)
      for (const word of batch.words)
        ends.set(batch.levelNumber, Math.max(ends.get(batch.levelNumber) ?? 0, word.sortOrder));
    expect([...ends].sort(([a], [b]) => a - b)).toEqual(FINALIZATION_PRIOR_WORD_ENDS);
    for (const [character, answer] of [
      ["克", "побуждать"],
      ["唆", "побеждать"],
    ] as const) {
      const terms = kanji.kanji.find((item) => item.character === character)!.meanings.ru;
      expect(
        validateAnswer({
          answerKind: "meaning",
          answer,
          acceptedAnswers: terms.accepted,
          blockedAnswers: terms.blocked?.map((item) => item.text),
        }),
      ).toMatchObject({ accepted: false, result: "blocked" });
    }
  });
});
