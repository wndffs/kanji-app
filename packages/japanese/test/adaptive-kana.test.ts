import { describe, expect, it } from "vitest";

import {
  buildAdaptiveKanaSession,
  findKana,
  type AdaptiveKanaCandidate,
  type KanaAttemptEvidence,
} from "../src";

const NOW = new Date("2026-07-27T12:00:00.000Z");

describe("adaptive kana practice", () => {
  it("never offers homophones or overlapping romaji aliases as competing choices", () => {
    const characters = ["じ", "ぢ", "ず", "づ", "お", "を", "シ", "し", "あ", "い", "う", "え"];
    const candidates = characters.map((character) => candidate(character));
    for (let seed = 0; seed < 20; seed += 1) {
      const session = buildAdaptiveKanaSession({
        candidates,
        attempts: [evidence("じ", false, { selectedCharacter: "ぢ" })],
        script: "mixed",
        now: NOW,
        seed,
        size: 20,
      });
      for (const exercise of session) {
        const seen = new Set<string>();
        for (const choice of exercise.choices) {
          const kana = findKana(choice.character)!;
          expect(kana.acceptedRomaji.some((reading) => seen.has(reading))).toBe(false);
          kana.acceptedRomaji.forEach((reading) => seen.add(reading));
        }
      }
    }
  });
  it("uses typed recall when all remaining choices sound alike", () => {
    const exercises = buildAdaptiveKanaSession({
      candidates: [candidate("じ"), candidate("ぢ")],
      attempts: [],
      script: "hiragana",
      now: NOW,
      seed: "homophones",
      size: 12,
    });
    expect(
      exercises.every(
        (exercise) => exercise.exerciseKind === "typing" || exercise.exerciseKind === "tracing",
      ),
    ).toBe(true);
  });
  it("prioritizes repeatedly missed kana while retaining a small mastered review", () => {
    const candidates = [
      candidate("あ", { attemptCount: 8, correctCount: 1 }),
      candidate("い", { attemptCount: 4, correctCount: 3 }),
      candidate("う", { attemptCount: 3, correctCount: 3, mastered: true, currentStreak: 3 }),
      candidate("え", { attemptCount: 0 }),
    ];
    const attempts = Array.from({ length: 7 }, (_, index) =>
      evidence("あ", false, { answeredAt: new Date(NOW.getTime() - index * 60_000) }),
    );

    const session = buildAdaptiveKanaSession({
      candidates,
      attempts,
      script: "hiragana",
      now: NOW,
      seed: "weakness",
      size: 12,
    });
    const counts = countCharacters(session.map((exercise) => exercise.character));

    expect(counts.get("あ")).toBeGreaterThan(counts.get("う") ?? 0);
    expect(counts.get("う")).toBeGreaterThan(0);
    expect(
      session.every((exercise, index) => exercise.character !== session[index - 1]?.character),
    ).toBe(true);
    expect(
      session.every(
        (exercise, index) =>
          direction(exercise.exerciseKind) !== direction(session[index - 1]?.exerciseKind),
      ),
    ).toBe(true);
    expect(new Set(session.map((exercise) => exercise.exerciseKind)).size).toBeGreaterThan(3);
  });

  it("uses a frequently selected wrong character as a distractor", () => {
    const candidates = [candidate("あ"), candidate("お"), candidate("い"), candidate("う")];
    const attempts = [
      evidence("あ", false, { selectedCharacter: "お" }),
      evidence("あ", false, { selectedCharacter: "お" }),
      evidence("あ", false, { selectedCharacter: "い" }),
    ];

    const session = buildAdaptiveKanaSession({
      candidates,
      attempts,
      script: "hiragana",
      now: NOW,
      seed: "confusion",
      size: 8,
    });
    const target = session.find((exercise) => exercise.character === "あ");

    expect(target?.choices.map((choice) => choice.character)).toContain("お");
  });

  it("excludes locked units and supports deterministic mixed-script sessions", () => {
    const candidates = [
      candidate("あ"),
      candidate("い"),
      candidate("ア"),
      candidate("イ"),
      candidate("か", { unlocked: false }),
      candidate("カ", { unlocked: false }),
    ];
    const input = {
      candidates,
      attempts: [],
      script: "mixed" as const,
      now: NOW,
      seed: 114,
      size: 10,
    };

    const first = buildAdaptiveKanaSession(input);
    const second = buildAdaptiveKanaSession(input);

    expect(first).toEqual(second);
    expect(new Set(first.map((exercise) => exercise.script))).toEqual(
      new Set(["hiragana", "katakana"]),
    );
    expect(
      first.some((exercise) => exercise.character === "か" || exercise.character === "カ"),
    ).toBe(false);
    expect(
      first
        .filter((exercise) => exercise.exerciseKind === "recognition-choice")
        .every(
          (exercise) =>
            new Set(exercise.choices.map((choice) => choice.romaji)).size ===
            exercise.choices.length,
        ),
    ).toBe(true);
  });
});

function candidate(
  character: string,
  overrides: Partial<AdaptiveKanaCandidate> = {},
): AdaptiveKanaCandidate {
  const kana = findKana(character);

  if (kana === null) {
    throw new Error(`Unknown test kana: ${character}`);
  }

  return {
    ...kana,
    unlocked: true,
    attemptCount: 1,
    correctCount: 0,
    currentStreak: 0,
    mastered: false,
    lastAnsweredAt: new Date("2026-07-20T12:00:00.000Z"),
    ...overrides,
  };
}

function evidence(
  expectedCharacter: string,
  correct: boolean,
  overrides: Partial<KanaAttemptEvidence> = {},
): KanaAttemptEvidence {
  return {
    expectedCharacter,
    submittedAnswer: correct ? "a" : "o",
    selectedCharacter: null,
    exerciseKind: "typing",
    correct,
    answeredAt: NOW,
    ...overrides,
  };
}

function countCharacters(characters: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const character of characters) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }

  return counts;
}

function direction(
  kind: KanaAttemptEvidence["exerciseKind"] | undefined,
): "kana-to-sound" | "sound-to-kana" | "shape" | undefined {
  if (kind === undefined) {
    return undefined;
  }

  if (kind === "typing" || kind === "recognition-choice") {
    return "kana-to-sound";
  }

  return kind === "tracing" ? "shape" : "sound-to-kana";
}
