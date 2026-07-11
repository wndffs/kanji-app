import { describe, expect, it } from "vitest";

import { KanaRepository } from "../src/kana/kana.repository";
import { KANA_MASTERY_STREAK, KanaService } from "../src/kana/kana.service";
import { type KanaProgressRecord, type RecordKanaAttemptInput } from "../src/kana/kana.types";

describe("KanaService", () => {
  it("returns 46 prompts without exposing romaji before an answer", async () => {
    const service = new KanaService(new InMemoryKanaRepository());

    const progress = await service.getProgress("user-1", "hiragana");

    expect(progress).toMatchObject({
      script: "hiragana",
      masteryThreshold: KANA_MASTERY_STREAK,
      totalCount: 46,
      attemptedCount: 0,
      masteredCount: 0,
    });
    expect(progress.items).toHaveLength(46);
    expect(progress.items[0]).not.toHaveProperty("romaji");
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

  it("resets the mastery streak after a wrong answer", async () => {
    const repository = new InMemoryKanaRepository();
    const service = new KanaService(repository);

    for (let index = 0; index < KANA_MASTERY_STREAK; index += 1) {
      await service.answer("user-1", { character: "ア", answer: "a" });
    }

    const response = await service.answer("user-1", { character: "ア", answer: "i" });

    expect(response).toMatchObject({
      correct: false,
      expectedRomaji: "a",
      masteredCount: 0,
      item: { currentStreak: 0, mastered: false },
    });
  });

  it("rejects unsupported characters and scripts", async () => {
    const service = new KanaService(new InMemoryKanaRepository());

    await expect(service.getProgress("user-1", "all")).rejects.toThrow(
      "script должен быть hiragana или katakana",
    );
    await expect(service.answer("user-1", { character: "一", answer: "ichi" })).rejects.toThrow(
      "Неизвестный базовый знак кана",
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
        currentStreak >= input.masteryThreshold ? (existing?.masteredAt ?? input.answeredAt) : null,
      lastAnsweredAt: input.answeredAt,
    };

    this.progress.set(key, next);
    return next;
  }
}
