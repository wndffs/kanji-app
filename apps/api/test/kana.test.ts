import { describe, expect, it } from "vitest";

import { findKana, type AdaptiveKanaExerciseKind } from "@kanji-srs/japanese";
import {
  type KanaPracticeAnswerRequest,
  type KanaPracticeExerciseDto,
  type KanaScript,
} from "@kanji-srs/shared";

import { KanaRepository } from "../src/kana/kana.repository";
import { KANA_MASTERY_STREAK, KanaService } from "../src/kana/kana.service";
import {
  type CreateKanaPracticeSessionInput,
  type KanaAttemptRecord,
  type KanaPracticeSessionRecord,
  type KanaProgressRecord,
  type RecordKanaAttemptInput,
  type RecordKanaPracticeAttemptInput,
  type RecordKanaPracticeAttemptResult,
} from "../src/kana/kana.types";

describe("KanaService", () => {
  it("keeps casual practice evidence separate from lesson mastery and preserves active size", async () => {
    const repo = new InMemoryKanaRepository(),
      service = new KanaService(repo);
    let session = await service.getPracticeSession("user-1", "hiragana", 6);
    expect(session.totalCount).toBe(6);
    expect((await service.getPracticeSession("user-1", "hiragana", 20)).id).toBe(session.id);
    for (let i = 0; i < 6; i++) {
      const exercise = session.exercise!;
      const response = await service.answerPractice("user-1", {
        sessionId: session.id,
        exerciseId: exercise.id,
        ...(["typing", "recognition-choice"].includes(exercise.exerciseKind)
          ? { answer: exercise.romaji }
          : { selectedCharacter: exercise.character }),
      });
      session = response.session;
    }
    const progress = await service.getProgress("user-1", "hiragana");
    expect(progress.masteredCount).toBe(0);
    expect(progress.attemptedCount).toBe(0);
    expect((await service.getLessonPath("user-1", "hiragana")).units[1]!.unlocked).toBe(false);
    expect(await repo.listAttempts("user-1", ["hiragana"])).toHaveLength(6);
    await expect(service.getPracticeSession("user-1", "hiragana", 999)).rejects.toThrow();
  });
  it("returns the complete hiragana track without exposing romaji before an answer", async () => {
    const service = new KanaService(new InMemoryKanaRepository());

    const progress = await service.getProgress("user-1", "hiragana");

    expect(progress).toMatchObject({
      script: "hiragana",
      masteryThreshold: KANA_MASTERY_STREAK,
      totalCount: 115,
      attemptedCount: 0,
      masteredCount: 0,
    });
    expect(progress.items).toHaveLength(115);
    expect(progress.items[0]).not.toHaveProperty("romaji");

    const katakanaProgress = await service.getProgress("user-1", "katakana");
    expect(katakanaProgress).toMatchObject({ totalCount: 113, attemptedCount: 0 });
    expect(katakanaProgress.items).toHaveLength(113);
  });

  it("builds a separate sequential lesson path with modified sounds", async () => {
    const repository = new InMemoryKanaRepository();
    const service = new KanaService(repository);

    const path = await service.getLessonPath("user-1", "hiragana");

    expect(path).toMatchObject({ totalCount: 115, masteredCount: 0 });
    expect(path.units).toHaveLength(28);
    expect(path.units.reduce((count, unit) => count + unit.totalCount, 0)).toBe(115);
    expect(path.units.every((unit) => unit.totalCount > 0)).toBe(true);
    expect(path.units[0]).toMatchObject({ id: "hiragana-vowels", unlocked: true, totalCount: 5 });
    expect(path.units[1]).toMatchObject({ id: "hiragana-k", unlocked: false });
    expect(path.units.at(-2)).toMatchObject({ id: "hiragana-sokuon", totalCount: 4 });
    expect(path.units.at(-1)).toMatchObject({ id: "hiragana-long-vowels", totalCount: 7 });
    expect(path.units.flatMap((unit) => unit.items)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ character: "ひ", romaji: "hi", variant: "basic" }),
        expect.objectContaining({ character: "び", romaji: "bi", variant: "dakuten" }),
        expect.objectContaining({ character: "ぴ", romaji: "pi", variant: "handakuten" }),
        expect.objectContaining({ character: "きゃ", romaji: "kya", variant: "yoon" }),
        expect.objectContaining({ character: "っか", romaji: "kka", variant: "sokuon" }),
        expect.objectContaining({ character: "おう", romaji: "ou", variant: "long-vowel" }),
      ]),
    );

    const katakanaPath = await service.getLessonPath("user-1", "katakana");
    expect(katakanaPath).toMatchObject({ totalCount: 113, masteredCount: 0 });
    expect(katakanaPath.units).toHaveLength(28);
    expect(katakanaPath.units.at(-1)).toMatchObject({
      id: "katakana-long-vowels",
      totalCount: 5,
    });

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

    await expect(
      service.answer("user-1", { character: "しゃ", answer: "sya" }),
    ).resolves.toMatchObject({ correct: true, expectedRomaji: "sha" });
    await expect(
      service.answer("user-1", { character: "ッカ", answer: "kka" }),
    ).resolves.toMatchObject({ correct: true, expectedRomaji: "kka" });
    await expect(
      service.answer("user-1", { character: "オー", answer: "ō" }),
    ).resolves.toMatchObject({ correct: true, expectedRomaji: "oo" });
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
    await expect(service.answer("user-1", { character: "きょう", answer: "kyou" })).rejects.toThrow(
      "один знак или сочетание кана",
    );
  });

  it("creates and resumes a mixed adaptive session from unlocked lesson units", async () => {
    const repository = new InMemoryKanaRepository();
    const service = new KanaService(repository);

    const first = await service.getPracticeSession("user-1", "mixed");
    const resumed = await service.getPracticeSession("user-1", "mixed");
    const session = repository.getSession(first.id);

    expect(resumed).toEqual(first);
    expect(first).toMatchObject({
      script: "mixed",
      currentIndex: 0,
      completedCount: 0,
      totalCount: 12,
    });
    expect(new Set(session?.items.map((item) => item.script))).toEqual(
      new Set(["hiragana", "katakana"]),
    );
    expect(session?.items.every((item) => findKana(item.character)?.row === "vowels")).toBe(true);
    expect(
      session?.items.every((item, index) => item.character !== session.items[index - 1]?.character),
    ).toBe(true);
  });

  it("persists detailed practice evidence and advances the stored session once", async () => {
    const repository = new InMemoryKanaRepository();
    const service = new KanaService(repository);
    const started = await service.getPracticeSession("user-1", "hiragana");
    const exercise = started.exercise!;
    const request = correctPracticeAnswer(started.id, exercise);

    const response = await service.answerPractice("user-1", request);
    const attempts = await repository.listAttempts("user-1", ["hiragana"]);

    expect(response).toMatchObject({
      correct: true,
      expectedCharacter: exercise.character,
      expectedRomaji: exercise.romaji,
      session: { id: started.id, currentIndex: 1, completedCount: 1 },
    });
    expect(attempts[0]).toMatchObject({
      expectedCharacter: exercise.character,
      script: exercise.script,
      exerciseKind: exercise.exerciseKind,
      correct: true,
    });
    expect(attempts[0]?.submittedAnswer ?? attempts[0]?.selectedCharacter).not.toBeNull();
    await expect(service.answerPractice("user-1", request)).rejects.toThrow(
      "Очередь практики уже перешла",
    );
  });

  it("stores a wrong selected kana separately from a romaji response", async () => {
    const repository = new InMemoryKanaRepository();
    const service = new KanaService(repository);
    let session = await service.getPracticeSession("user-1", "hiragana");

    while (session.exercise !== null && !usesCharacterChoice(session.exercise.exerciseKind)) {
      const response = await service.answerPractice(
        "user-1",
        correctPracticeAnswer(session.id, session.exercise),
      );
      session = response.session;
    }

    const exercise = session.exercise!;
    const wrongChoice = exercise.choices.find((choice) => choice.character !== exercise.character)!;
    const response = await service.answerPractice("user-1", {
      sessionId: session.id,
      exerciseId: exercise.id,
      selectedCharacter: wrongChoice.character,
    });
    const attempts = await repository.listAttempts("user-1", ["hiragana"]);

    expect(response).toMatchObject({
      correct: false,
      selectedCharacter: wrongChoice.character,
    });
    expect(response.confusionExplanation).not.toBeNull();
    expect(attempts[0]).toMatchObject({
      expectedCharacter: exercise.character,
      submittedAnswer: null,
      selectedCharacter: wrongChoice.character,
      correct: false,
    });
  });

  it("builds a mastery-based character hub section with adaptive weak symbols", async () => {
    const repository = new InMemoryKanaRepository();
    const service = new KanaService(repository);

    await service.answer("user-1", { character: "あ", answer: "o" });
    await service.answer("user-1", { character: "い", answer: "i" });

    const section = await service.getCharacterHubSection("user-1", "hiragana");

    expect(section).toMatchObject({
      progressModel: "mastery",
      script: "hiragana",
      totalCount: 115,
      attemptedCount: 2,
      masteredCount: 0,
      actions: {
        lessonsHref: "/kana?script=hiragana&mode=lessons",
        assessmentHref: "/kana?script=hiragana&mode=assessment",
        practiceHref: "/kana?script=hiragana&mode=practice",
      },
    });
    expect(section.units).toHaveLength(28);
    expect(section.weakSymbols[0]).toMatchObject({
      character: "あ",
      recentAccuracy: 0,
    });
  });
});

class InMemoryKanaRepository extends KanaRepository {
  private readonly progress = new Map<string, KanaProgressRecord>();
  private readonly attempts: KanaAttemptRecord[] = [];
  private readonly sessions = new Map<string, KanaPracticeSessionRecord>();
  private nextAttemptId = 1;
  private nextSessionId = 1;

  async listProgress(
    userId: string,
    script: KanaProgressRecord["script"],
  ): Promise<readonly KanaProgressRecord[]> {
    return [...this.progress.entries()]
      .filter(([key, item]) => key.startsWith(`${userId}:`) && item.script === script)
      .map(([, item]) => item);
  }

  async listAttempts(
    userId: string,
    scripts: readonly KanaScript[],
  ): Promise<readonly KanaAttemptRecord[]> {
    return this.attempts.filter(
      (attempt) => attempt.id.startsWith(`${userId}:`) && scripts.includes(attempt.script),
    );
  }

  async findActivePracticeSession(
    userId: string,
    script: KanaPracticeSessionRecord["script"],
  ): Promise<KanaPracticeSessionRecord | null> {
    return (
      [...this.sessions.values()].find(
        (session) =>
          session.userId === userId && session.script === script && session.finishedAt === null,
      ) ?? null
    );
  }

  async findPracticeSession(
    userId: string,
    sessionId: string,
  ): Promise<KanaPracticeSessionRecord | null> {
    const session = this.sessions.get(sessionId);
    return session?.userId === userId ? session : null;
  }

  async createPracticeSession(
    input: CreateKanaPracticeSessionInput,
  ): Promise<KanaPracticeSessionRecord> {
    const session: KanaPracticeSessionRecord = {
      id: `session-${this.nextSessionId++}`,
      userId: input.userId,
      script: input.script,
      items: input.items,
      currentIndex: 0,
      startedAt: input.startedAt,
      finishedAt: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async recordAttempt(input: RecordKanaAttemptInput): Promise<KanaProgressRecord> {
    this.addAttempt(input);
    return this.updateProgress(input);
  }

  async recordPracticeAttempt(
    input: RecordKanaPracticeAttemptInput,
  ): Promise<RecordKanaPracticeAttemptResult> {
    const session = this.sessions.get(input.sessionId);

    if (
      session === undefined ||
      session.userId !== input.userId ||
      session.finishedAt !== null ||
      session.currentIndex !== input.expectedSessionIndex
    ) {
      throw new Error("Kana practice session has already advanced.");
    }

    this.addAttempt(input);
    const nextIndex = session.currentIndex + 1;
    const updatedSession: KanaPracticeSessionRecord = {
      ...session,
      currentIndex: nextIndex,
      finishedAt: nextIndex >= input.sessionItemCount ? input.answeredAt : null,
    };
    this.sessions.set(session.id, updatedSession);

    return { session: updatedSession };
  }

  getSession(id: string): KanaPracticeSessionRecord | null {
    return this.sessions.get(id) ?? null;
  }

  private updateProgress(input: RecordKanaAttemptInput): KanaProgressRecord {
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

  private addAttempt(input: RecordKanaAttemptInput): void {
    this.attempts.unshift({
      id: `${input.userId}:attempt-${this.nextAttemptId++}`,
      expectedCharacter: input.character,
      script: input.script,
      submittedAnswer: input.submittedAnswer,
      selectedCharacter: input.selectedCharacter,
      exerciseKind: input.exerciseKind,
      correct: input.correct,
      answeredAt: input.answeredAt,
    });
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

function correctPracticeAnswer(
  sessionId: string,
  exercise: KanaPracticeExerciseDto,
): KanaPracticeAnswerRequest {
  return usesCharacterChoice(exercise.exerciseKind)
    ? {
        sessionId,
        exerciseId: exercise.id,
        selectedCharacter: exercise.character,
      }
    : {
        sessionId,
        exerciseId: exercise.id,
        answer: exercise.romaji,
      };
}

function usesCharacterChoice(kind: AdaptiveKanaExerciseKind): boolean {
  return (
    kind === "reverse-choice" ||
    kind === "matching" ||
    kind === "listening-choice" ||
    kind === "tracing"
  );
}
