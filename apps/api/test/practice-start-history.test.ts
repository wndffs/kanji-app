import { describe, expect, it, vi } from "vitest";
import { PrismaReviewsRepository } from "../src/reviews/reviews.repository";

describe("owner-locked practice starts and private history", () => {
  it("resumes the winning session after waiting for the owner's transaction lock", async () => {
    let previous = Promise.resolve();
    let nextId = 0;
    const rows: Record<string, unknown>[] = [];
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { ...data, id: `session-${++nextId}`, finishedAt: null };
      rows.push(row);
      return row;
    });
    const findMany = vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      rows.filter((row) => row.userId === where.userId),
    );
    const query = vi.fn();
    const transaction = vi.fn(
      async (callback: (db: unknown) => Promise<unknown>, _options: unknown) => {
        let release!: () => void;
        const mine = new Promise<void>((resolve) => (release = resolve));
        const before = previous;
        previous = mine;
        const db = {
          reviewSession: { findMany, create },
          $queryRaw: async (...args: unknown[]) => {
            query(...args);
            await before;
            return [{ id: "owner" }];
          },
        };
        try {
          return await callback(db);
        } finally {
          release();
        }
      },
    );
    const repo = new PrismaReviewsRepository({ db: { $transaction: transaction } } as never);
    const input = {
      userId: "owner",
      source: "recent-mistakes" as const,
      now: new Date(),
      cardIds: ["reading"],
    };
    const results = await Promise.all([
      repo.createPracticeSession(input),
      repo.createPracticeSession({ ...input, cardIds: ["changed-queue"] }),
    ]);
    expect(results[0]?.id).toBe(results[1]?.id);
    expect(create).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(2);
    expect(transaction.mock.calls[0]?.[1]).toMatchObject({ isolationLevel: "ReadCommitted" });
  });
  it("bounds finished history to the authenticated owner and selected source", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaReviewsRepository({ db: { reviewSession: { findMany } } } as never);
    expect(await repo.listPracticeHistory("owner", "burned")).toEqual([]);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        userId: "owner",
        mode: "EXTRA_PRACTICE",
        finishedAt: { not: null },
        statsJson: { path: ["source"], equals: "burned" },
      },
      take: 20,
    });
  });
});
