import { describe, expect, it, vi } from "vitest";
import { PrismaKanaRepository } from "../src/kana/kana.repository";
import type { PrismaService } from "../src/database/prisma.service";

describe("kana practice persistence boundary", () => {
  it("writes session evidence but never lesson mastery or SRS state", async () => {
    const now = new Date("2026-10-30T00:00:00Z");
    const tx = {
      kanaPracticeSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({
            id: "session",
            userId: "owner",
            mode: "HIRAGANA",
            queueJson: [],
            currentIndex: 1,
            startedAt: now,
            finishedAt: now,
          }),
      },
      kanaAttempt: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    };
    const repository = new PrismaKanaRepository({
      db: { $transaction: async (run: (value: typeof tx) => unknown) => run(tx) },
    } as unknown as PrismaService);
    await repository.recordPracticeAttempt({
      userId: "owner",
      character: "あ",
      script: "hiragana",
      correct: true,
      submittedAnswer: "a",
      selectedCharacter: null,
      exerciseKind: "typing",
      masteryThreshold: 3,
      answeredAt: now,
      sessionId: "session",
      expectedSessionIndex: 0,
      sessionItemCount: 1,
    });
    expect(tx.kanaAttempt.create).toHaveBeenCalledOnce();
    expect(tx.kanaPracticeSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session", userId: "owner", currentIndex: 0, finishedAt: null },
      }),
    );
    // No mastery/card delegates are provided: reaching either is a test failure.
  });
});
