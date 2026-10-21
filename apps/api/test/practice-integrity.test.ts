import { isDeepStrictEqual } from "node:util";

import { describe, expect, it, vi } from "vitest";

import { PrismaReviewsRepository } from "../src/reviews/reviews.repository";
import type { UpdatePracticeSessionProgressInput } from "../src/reviews/reviews.types";

const CORRECT_STEP: UpdatePracticeSessionProgressInput = {
  userId: "owner",
  sessionId: "practice-1",
  currentIndex: 1,
  progress: { answered: 1, accepted: 1, missed: 0 },
};

describe("PrismaReviewsRepository practice snapshot updates", () => {
  it.each(["recent-lessons", "recent-mistakes", "burned", "confusable-kanji"])(
    "rejects a delayed %s answer after newer answers have committed",
    async (source) => {
      const { repository, row } = createHarness({ source });
      await expect(repository.updatePracticeSessionProgress(CORRECT_STEP)).resolves.toMatchObject({
        currentIndex: 1,
      });
      await repository.updatePracticeSessionProgress({
        ...CORRECT_STEP,
        currentIndex: 2,
        progress: { answered: 2, accepted: 2, missed: 0 },
      });
      const before = structuredClone(row);

      await expect(
        repository.updatePracticeSessionProgress({
          ...CORRECT_STEP,
          progress: { answered: 1, accepted: 0, missed: 1 },
        }),
      ).resolves.toBeNull();

      expect(row).toEqual(before);
      expect(row.statsJson).toMatchObject({
        source,
        contextId: "pair-or-source-context",
        cardIds: ["card-0", "card-1", "card-2"],
        currentIndex: 2,
        progress: { answered: 2, accepted: 2, missed: 0 },
      });
    },
  );

  it("allows only one of two submissions that read the same persisted step", async () => {
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { repository, row, updateMany } = createHarness({
      readBarrier: async () => {
        if (++arrivals === 2) release();
        await gate;
      },
    });

    const outcomes = await Promise.all([
      repository.updatePracticeSessionProgress(CORRECT_STEP),
      repository.updatePracticeSessionProgress({
        ...CORRECT_STEP,
        progress: { answered: 1, accepted: 0, missed: 1 },
      }),
    ]);

    expect(outcomes.filter((outcome) => outcome !== null)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === null)).toHaveLength(1);
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(row.statsJson).toMatchObject({
      currentIndex: 1,
      progress: outcomes.find(Boolean)?.progress,
    });
  });

  it.each(["REVIEW", "LESSON_QUIZ"])(
    "cannot overwrite a %s session through practice updates",
    async (mode) => {
      const { repository, row, updateMany } = createHarness({ mode });
      const before = structuredClone(row);

      await expect(repository.updatePracticeSessionProgress(CORRECT_STEP)).resolves.toBeNull();
      expect(row).toEqual(before);
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ...CORRECT_STEP, currentIndex: 0 },
    { ...CORRECT_STEP, currentIndex: 2 },
    { ...CORRECT_STEP, progress: { answered: 2, accepted: 1, missed: 1 } },
    { ...CORRECT_STEP, progress: { answered: 1, accepted: 0, missed: 0 } },
    { ...CORRECT_STEP, progress: { answered: 1, accepted: 1, missed: 1 } },
    { ...CORRECT_STEP, userId: "other" },
  ])("rejects non-successor or foreign progress %#", async (input) => {
    const { repository, row, updateMany } = createHarness();
    const before = structuredClone(row);

    await expect(repository.updatePracticeSessionProgress(input)).resolves.toBeNull();
    expect(row).toEqual(before);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

function createHarness(
  options: { source?: string; mode?: string; readBarrier?: () => Promise<void> } = {},
) {
  const row = {
    id: "practice-1",
    userId: "owner",
    startedAt: new Date("2026-06-18T09:00:00.000Z"),
    finishedAt: null,
    mode: options.mode ?? "EXTRA_PRACTICE",
    statsJson: {
      source: options.source ?? "recent-lessons",
      contextId: "pair-or-source-context",
      cardIds: ["card-0", "card-1", "card-2"],
      currentIndex: 0,
      progress: { answered: 0, accepted: 0, missed: 0 },
      outcome: "active",
    },
  };
  const updateMany = vi.fn(
    async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
      const { statsJson, ...identity } = where;
      if (
        !matchesIdentity(identity) ||
        !isDeepStrictEqual((statsJson as { equals: unknown }).equals, row.statsJson)
      ) {
        return { count: 0 };
      }
      Object.assign(row, data);
      return { count: 1 };
    },
  );
  function matchesIdentity(where: Record<string, unknown>) {
    return Object.entries(where).every(
      ([key, value]) => (row as Record<string, unknown>)[key] === value,
    );
  }
  const repository = new PrismaReviewsRepository({
    db: {
      reviewSession: {
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          const snapshot = matchesIdentity(where) ? structuredClone(row) : null;
          await options.readBarrier?.();
          return snapshot;
        }),
        updateMany,
      },
    },
  } as never);

  return { repository, row, updateMany };
}
