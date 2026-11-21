import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateAnswer } from "@kanji-srs/japanese";
import { buildBroadeningKanji } from "../src/course-broadening-builders";
import {
  EXTENSION_COMPONENT_LEVEL,
  EXTENSION_KANJI_BATCH,
  EXTENSION_PRIOR_WORD_ENDS,
  EXTENSION_WORD_PREFIX,
  extensionKanji,
  extensionWords,
} from "../src/course-extension-content";
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
const priorKanji = beforeCourseBatch(registeredKanji, EXTENSION_KANJI_BATCH);
const priorWords = beforeCourseBatch(registeredWords, `${EXTENSION_WORD_PREFIX}01`);
const kanji = extensionKanji(priorKanji);
const batches = extensionWords([...priorKanji, kanji], priorWords);
const words = batches.flatMap((batch) => batch.words);

describe("reviewed course extension block", () => {
  it("adds 200 kanji, seven components and 770 words without rewriting earlier releases", () => {
    expect(sha(priorKanji)).toBe(
      "727aeec529d8275756ea196bcdb040dddbd5d33818749d54e0dd81b8b3682041",
    );
    expect(sha(priorWords)).toBe(
      "796a138bd71d70932ebdf0dc1d817b12ee96852a4c49e4b35c3086d48326c08e",
    );
    expect(sha([kanji, ...batches])).toBe(
      "310b49162266cde950908fbf1207a284359156d38a47b9ead8c1514c5a8712aa",
    );
    expect(registeredKanji.find((item) => item.id === EXTENSION_KANJI_BATCH)).toEqual(kanji);
    expect(registeredWords.filter((item) => item.id.startsWith(EXTENSION_WORD_PREFIX))).toEqual(
      batches,
    );
    expect([kanji, ...batches].every((item) => item.reviewedAt === "2026-11-21")).toBe(true);
    expect(kanji.kanji).toHaveLength(200);
    expect(kanji.components).toHaveLength(7);
    expect(words).toHaveLength(770);
    expect(validateMainCourseContentBatches(registeredKanji)).toEqual([]);
    expect(validateMainCourseWordBatches(registeredWords)).toEqual([]);
  });

  it("reserves the seven new placements after earlier material and requires each component first", () => {
    expect(kanji.componentLevelNumber).toBe(EXTENSION_COMPONENT_LEVEL);
    const ends = new Map<number, number>();
    for (const batch of priorWords)
      for (const word of batch.words)
        ends.set(batch.levelNumber, Math.max(ends.get(batch.levelNumber) ?? 0, word.sortOrder));
    expect([...ends].sort(([a], [b]) => a - b)).toEqual(EXTENSION_PRIOR_WORD_ENDS);
    const priorK = priorKanji.flatMap((batch) =>
      batch.kanji.filter((item) => item.levelNumber === EXTENSION_COMPONENT_LEVEL),
    );
    expect(kanji.componentSortOrderStart).toBe(
      1 +
        Math.max(ends.get(EXTENSION_COMPONENT_LEVEL) ?? 0, ...priorK.map((item) => item.sortOrder)),
    );
    for (const component of kanji.components) {
      const taught = kanji.kanji.filter((item) => item.componentKeys.includes(component.key));
      expect(taught.length).toBeGreaterThan(0);
      expect(taught.every((item) => item.levelNumber > EXTENSION_COMPONENT_LEVEL)).toBe(true);
    }
    const existing = priorKanji[0]!.components[0]!;
    const metadata = {
      authoredAt: "2026-11-21",
      reviewedAt: null,
      reviewNotes: "Test fixture.",
      sourceFile: "unused",
    };
    for (const cue of [existing, { ...existing, symbol: "㇀" }])
      expect(() =>
        buildBroadeningKanji(priorKanji, [], {
          id: "duplicate-component",
          metadata,
          priorWordSlots: EXTENSION_PRIOR_WORD_ENDS,
          newComponents: { levelNumber: EXTENSION_COMPONENT_LEVEL, items: [cue] },
        }),
      ).toThrow("Duplicate broadening component");
  });

  it("teaches standalone and alternate forms without accepting unrelated near-answers", () => {
    expect(words.find((word) => word.expression === "貼付")).toMatchObject({
      reading: "ちょうふ",
      acceptedReadings: ["てんぷ"],
    });
    expect(kanji.kanji.find((item) => item.character === "貼")?.reading.accepted).toEqual([
      "ちょう",
    ]);
    for (const entry of [
      kanji.kanji.find((item) => item.character === "某"),
      words.find((word) => word.expression === "某"),
    ]) {
      const { accepted, blocked } = entry!.meanings.en;
      expect(
        validateAnswer({
          answerKind: "meaning",
          answer: "ascertain",
          acceptedAnswers: accepted,
          blockedAnswers: blocked?.map((item) => item.text),
        }),
      ).toMatchObject({ accepted: false, result: "blocked" });
    }
  });
});
