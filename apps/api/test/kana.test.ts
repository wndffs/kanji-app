import { describe, expect, it } from "vitest";

import { KanaRepository } from "../src/kana/kana.repository";
import { KANA_MASTERY_STREAK, KanaService } from "../src/kana/kana.service";
import { type KanaProgressRecord, type RecordKanaAttemptInput } from "../src/kana/kana.types";

describe("KanaService", () => {
  it("returns 71 prompts without exposing romaji before an answer", async () => {
    const service = new KanaService(new InMemoryKanaRepository());

    const progress = await service.getProgress("user-1", "hiragana");

    expect(progress).toMatchObject({
      script: "hiragana",
      masteryThreshold: KANA_MASTERY_STREAK,
      totalCount: 71,
      attemptedCount: 0,
      masteredCount: 0,
    });
    expect(progress.items).toHaveLength(71);
    expect(progress.items[0]).not.toHaveProperty("romaji");
  });

  it("builds a separate sequential lesson path with modified sounds", async () => {
    const repository = new InMemoryKanaRepository();
    const service = new KanaService(repository);

    const path = await service.getLessonPath("user-1", "hiragana");

    expect(path).toMatchObject({ totalCount: 71, masteredCount: 0 });
    expect(path.units).toHaveLength(15);
    expect(path.units[0]).toMatchObject({ id: "hiragana-vowels", unlocked: true, totalCount: 5 });
    expect(path.units[1]).toMatchObject({ id: "hiragana-k", unlocked: false });
    expect(path.units.at(-1)).toMatchObject({ id: "hiragana-p", totalCount: 5 });
    expect(path.units.flatMap((unit) => unit.items)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ character: "ひ", romaji: "hi", variant: "basic" }),
        expect.objectContaining({ character: "び", romaji: "bi", variant: "dakuten" }),
        expect.objectContaining({ character: "ぴ", romaji: "pi", variant: "handakuten" }),
      ]),
    );

    for (const character of ["あ", "い", "う", "え", "お"]) {
      for (let attempt = 0; attempt < KANA_MASTERY_STREAK; attempt += 1) {
        await service.answer("user-1", { character, answer: findAnswer(character) });
      }
    }

    const unlockedPath = await service.getLessonPath("user-1", "hiragana");
    expect(unlockedPath.units[0]).toMatchObject({ complete: true, masteredCount: 5 });
    expect(unlockedPath.units[1]).toMatchObject({ unlocked: true, complete: false });
  });

  it("accepts alternative romaji and masters a kana after three correct answers", async () => {
    const repository = new InMemoryKanaRepository();
    const service = new KanaService(repository);

    await service.answer("user-1", { character: "し", answer: "si" });
    await service.answer("user-1", { character: "し", answer: "shi" });
    const response = await service.answer("user-1", { character: "し", answer: "SHI" });

    expect(response).toMatchObject({
      correct: true,
      normalizedAnswer: "shi",
      expectedRomaji: "shi",
      attemptedCount: 1,
      masteredCount: 1,
      item: {
        character: "し",
        currentStreak: 3,
        mastered: true,
      },
    });
  });

  it("resets the streak without taking away a completed lesson", async () => {
    const repository = new InMemoryKanaRepository();
    const service = new KanaService(repository);

    for (let index = 0; index < KANA_MASTERY_STREAK; index += 1) {
      await service.answer("user-1", { character: "ア", answer: "a" });
    }

    const response = await service.answer("user-1", { character: "ア", answer: "i" });

    expect(response).toMatchObject({
      correct: false,
      expectedRomaji: "a",
      masteredCount: 1,
      item: { currentStreak: 0, mastered: true },
    });
  });

  it("rejects unsupported characters and scripts", async () => {
    const service = new KanaService(new InMemoryKanaRepository());

    await expect(service.getProgress("user-1", "all")).rejects.toThrow(
      "script должен быть hiragana или katakana",
    );
    await expect(service.answer("user-1", { character: "一", answer: "ichi" })).rejects.toThrow(
      "Неизвестный знак кана",
    );
  });
});

class InMemoryKanaRepository extends KanaRepository {
  private readonly progress = new Map<string, KanaProgressRecord>();

  async listProgress(
    userId: string,
    script: KanaProgressRecord["script"],
  ): Promise<readonly KanaProgressRecord[]> {
    return [...this.progress.entries()]
      .filter(([key, item]) => key.startsWith(`${userId}:`) && item.script === script)
      .map(([, item]) => item);
  }

  async recordAttempt(input: RecordKanaAttemptInput): Promise<KanaProgressRecord> {
    const key = `${input.userId}:${input.character}`;
    const existing = this.progress.get(key);
    const currentStreak = input.correct ? (existing?.currentStreak ?? 0) + 1 : 0;
    const next: KanaProgressRecord = {
      character: input.character,
      script: input.script,
      attemptCount: (existing?.attemptCount ?? 0) + 1,
      correctCount: (existing?.correctCount ?? 0) + (input.correct ? 1 : 0),
      currentStreak,
      masteredAt:
        existing?.masteredAt ?? (currentStreak >= input.masteryThreshold ? input.answeredAt : null),
      lastAnsweredAt: input.answeredAt,
    };

    this.progress.set(key, next);
    return next;
  }
}

function findAnswer(character: string): string {
  return new Map([
    ["あ", "a"],
    ["い", "i"],
    ["う", "u"],
    ["え", "e"],
    ["お", "o"],
  ]).get(character)!;
}
