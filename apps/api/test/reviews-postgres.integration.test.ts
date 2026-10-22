import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { ConflictException, NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@kanji-srs/db";
import { calculateNextReview, DEFAULT_SRS_STAGES } from "@kanji-srs/srs";

import { AppConfigService } from "../src/config/app-config.service";
import { PrismaService } from "../src/database/prisma.service";
import { PrismaReviewsRepository } from "../src/reviews/reviews.repository";
import { createScheduledReviewState } from "../src/reviews/review-session-state";
import {
  type RecordReviewAnswerInput,
  type ReviewSrsStateRecord,
  type ResumablePracticeSource,
} from "../src/reviews/reviews.types";

const NOW = new Date("2026-10-21T09:00:00.000Z");
const rawDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;
const databaseUrl = rawDatabaseUrl ? requireSafeDatabaseUrl(rawDatabaseUrl) : null;
const runId = randomUUID();
const writerNames = [`study-integrity-${runId}-a`, `study-integrity-${runId}-b`] as const;
const clients: PrismaService[] = [];
let control: PrismaService;
let writers: readonly [PrismaReviewsRepository, PrismaReviewsRepository];

const stateSelect = {
  id: true,
  userId: true,
  learningCardId: true,
  srsSystemId: true,
  stageIndex: true,
  availableAt: true,
  burnedAt: true,
  resurrectedAt: true,
  wrongCount: true,
  correctStreak: true,
  lastReviewedAt: true,
} satisfies Prisma.UserSrsStateSelect;

describe("PostgreSQL integration URL safety", () => {
  it.each(["localhost", "127.0.0.1", "[::1]"])("allows loopback host %s", (host) => {
    expect(
      requireSafeDatabaseUrl(`postgresql://test:test@${host}:5432/kanji_integration?schema=public`),
    ).toContain("/kanji_integration");
  });

  it.each([
    "postgresql://test:test@example.com/kanji_integration",
    "postgresql://test:test@localhost/kanji_srs",
    "postgresql://test:test@localhost/kanji_integration_other",
    "postgresql://test:test@localhost/kanji_integration/",
    "postgresql://test:test@localhost/kanji_integration?host=example.com",
    "postgresql://test:test@localhost/kanji_integration?options=-csearch_path%3Dother",
    "postgresql://test:test@localhost/kanji_integration?schema=other",
    "postgresql://test:test@localhost/kanji_integration?schema=public&schema=other",
    "postgresql://test:test@localhost/kanji_integration#other",
    "https://localhost/kanji_integration",
    "not-a-database-url",
  ])("rejects unsafe target %# before connecting", (url) => {
    expect(() => requireSafeDatabaseUrl(url)).toThrow("Unsafe INTEGRATION_DATABASE_URL");
  });
});

describe.skipIf(databaseUrl === null)("PrismaReviewsRepository on PostgreSQL 18", () => {
  beforeAll(async () => {
    if (databaseUrl === null) throw new Error("INTEGRATION_DATABASE_URL is required.");
    control = createClient(databaseUrl, `study-integrity-${runId}-control`, 4);
    const first = createClient(databaseUrl, writerNames[0], 1);
    const second = createClient(databaseUrl, writerNames[1], 1);
    writers = [new PrismaReviewsRepository(first), new PrismaReviewsRepository(second)];
    await Promise.all(clients.map((client) => client.db.$connect()));
    const [server] = await control.db.$queryRaw<{ database: string; version: number }[]>`
      SELECT current_database() AS database,
             current_setting('server_version_num')::int AS version
    `;
    expect(server?.database).toBe("kanji_integration");
    expect(server?.version).toBeGreaterThanOrEqual(180000);
    expect(server?.version).toBeLessThan(190000);
    for (const [index, client] of [first, second].entries()) {
      const [setting] = await client.db.$queryRaw<{ name: string }[]>`
        SELECT current_setting('application_name') AS name
      `;
      expect(setting?.name).toBe(writerNames[index]);
    }
  }, 20_000);

  afterAll(async () => {
    await Promise.all(clients.map((client) => client.onModuleDestroy()));
  });

  it.each([false, true])(
    "commits only one overlapping same-card answer (same session: %s)",
    async (sameSession) => {
      await withFixture(async (fixture) => {
        const inputs = [
          answerInput(fixture, fixture.sessionIds[0], "correct"),
          answerInput(fixture, fixture.sessionIds[sameSession ? 0 : 1], "wrong"),
        ];
        const outcomes = await overlap(
          "state",
          fixture.state.id,
          inputs.map((input, index) => () => writers[index]!.recordReviewAnswer(input)),
        );
        assertOneCommit(outcomes);
        const winner = inputs[outcomes.findIndex((outcome) => outcome.status === "fulfilled")]!;
        expect(await readState(fixture)).toMatchObject(winner.nextState);
        expect(await answers(fixture)).toMatchObject([
          {
            reviewSessionId: winner.sessionId,
            answerText: winner.answerText,
            previousStageIndex: winner.previousStageIndex,
            nextStageIndex: winner.nextStageIndex,
          },
        ]);
        expect(await answers(fixture)).toHaveLength(1);
      });
    },
  );

  it("rejects concurrent and replayed manual-ignore duplicates without rescheduling", async () => {
    await withFixture(async (fixture) => {
      const input = answerInput(fixture, fixture.sessionIds[0], "manual-ignore");
      assertOneCommit(
        await overlap("state", fixture.state.id, [
          () => writers[0].recordReviewAnswer(input),
          () => writers[1].recordReviewAnswer(input),
        ]),
      );
      expect(await readState(fixture)).toEqual(fixture.state);
      expect(await answers(fixture)).toHaveLength(1);
      await expect(writers[0].recordReviewAnswer(input)).rejects.toBeInstanceOf(ConflictException);
      expect(await readState(fixture)).toEqual(fixture.state);
      expect(await answers(fixture)).toHaveLength(1);
    });
  });

  it("rejects a stale schedule snapshot even when its stage is unchanged", async () => {
    await withFixture(async (fixture) => {
      const input = answerInput(fixture, fixture.sessionIds[0], "correct");
      await control.db.userSrsState.update({
        where: { id: fixture.state.id },
        data: { availableAt: new Date(NOW.getTime() + 60_000) },
      });
      const before = await readState(fixture);
      await expect(writers[0].recordReviewAnswer(input)).rejects.toBeInstanceOf(ConflictException);
      expect(await readState(fixture)).toEqual(before);
      expect(await answers(fixture)).toEqual([]);
    });
  });

  it("rolls back an in-flight answer when finishing the session wins the race", async () => {
    await withFixture(async (fixture) => {
      const input = answerInput(fixture, fixture.sessionIds[0], "correct");
      const outcomes = await overlap(
        "state",
        fixture.state.id,
        [() => writers[0].recordReviewAnswer(input)],
        async () => {
          const finished = await writers[1].finishReviewSession(
            fixture.userId,
            input.sessionId,
            NOW,
          );
          expect(finished?.summary.totalAnswers).toBe(0);
        },
      );
      expect(outcomes[0]?.status).toBe("rejected");
      if (outcomes[0]?.status === "rejected") {
        expect(outcomes[0].reason).toBeInstanceOf(ConflictException);
      }
      expect(await readState(fixture)).toEqual(fixture.state);
      expect(await answers(fixture)).toEqual([]);
      const session = await control.db.reviewSession.findUniqueOrThrow({
        where: { id: input.sessionId },
      });
      expect(session.finishedAt).toEqual(NOW);
      expect(session.statsJson).toMatchObject({ totalAnswers: 0 });
    });
  });

  it("includes committed answers when finishing, and rejects later submissions", async () => {
    await withFixture(async (fixture) => {
      const input = answerInput(fixture, fixture.sessionIds[0], "correct");
      const target = await writers[0].findAnswerTarget(
        fixture.userId,
        input.sessionId,
        input.cardId,
        NOW,
      );
      expect(target?.state).toEqual(fixture.state);
      await writers[0].recordReviewAnswer(input);
      const finished = await writers[1].finishReviewSession(fixture.userId, input.sessionId, NOW);
      expect(finished?.summary).toMatchObject({ totalAnswers: 1, correctAnswers: 1, advanced: 1 });
      const before = await readState(fixture);
      await expect(writers[0].recordReviewAnswer(input)).rejects.toBeInstanceOf(NotFoundException);
      expect(await readState(fixture)).toEqual(before);
      expect(await answers(fixture)).toHaveLength(1);
    });
  });

  it("rolls back the real SRS UPDATE when PostgreSQL rejects the answer INSERT", async () => {
    await withFixture(async (fixture) => {
      const input = answerInput(fixture, fixture.sessionIds[0], "correct");
      // PostgreSQL jsonb rejects U+0000; details are inserted only after the SRS UPDATE.
      await expect(
        writers[0].recordReviewAnswer({
          ...input,
          details: { rollbackProbe: "\u0000" },
        }),
      ).rejects.toThrow(/unsupported Unicode escape sequence|22P05|0x00/);
      expect(await readState(fixture)).toEqual(fixture.state);
      expect(await answers(fixture)).toEqual([]);
      await writers[0].recordReviewAnswer(input);
      expect(await readState(fixture)).toMatchObject(input.nextState);
      expect(await answers(fixture)).toHaveLength(1);
    });
  });

  it("serializes overlapping starts on the real owner row and reuses one snapshot", async () => {
    await withFixture(async (fixture) => {
      const outcomes = await overlap("owner", fixture.userId, [
        () => writers[0].startScheduledReviewSession(fixture.userId, NOW, [fixture.cardIds[0]]),
        () => writers[1].startScheduledReviewSession(fixture.userId, NOW, [fixture.cardIds[0]]),
      ]);
      expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
      const started = outcomes.map((outcome) => {
        if (outcome.status !== "fulfilled") throw outcome.reason;
        return outcome.value;
      });
      expect(started[0]!.session.id).toBe(started[1]!.session.id);
      expect(started.map((result) => result.resumed).sort()).toEqual([false, true]);
      expect(
        await control.db.reviewSession.count({
          where: {
            userId: fixture.userId,
            mode: "REVIEW",
            finishedAt: null,
            statsJson: { path: ["reviewVersion"], equals: 1 },
          },
        }),
      ).toBe(1);
      expect((await writers[1].findActiveReviewSession(fixture.userId))?.session.id).toBe(
        started[0]!.session.id,
      );
      expect(await readState(fixture)).toEqual(fixture.state);
      expect(await answers(fixture)).toEqual([]);
    });
  });

  it("resumes wrong/reveal originals, gates finish and preserves scheduling/history across idempotent correction replay", async () => {
    await withFixture(async (fixture) => {
      const state = createScheduledReviewState([fixture.cardIds[0]]);
      const started = await writers[0].startScheduledReviewSession(
        fixture.userId,
        NOW,
        state.scheduledCardIds,
      );
      await expect(
        writers[1].finishReviewSession(fixture.userId, started.session.id, NOW),
      ).rejects.toBeInstanceOf(ConflictException);
      const original = answerInput(fixture, started.session.id, "wrong");
      await writers[0].recordReviewAnswer({
        ...original,
        recordedResult: "reveal",
        responseResult: "reveal",
      });
      const scheduled = await readState(fixture);
      const history = await answers(fixture);
      expect(scheduled.availableAt!.getTime()).toBeGreaterThan(NOW.getTime());
      expect(await writers[1].findActiveReviewSession(fixture.userId)).toMatchObject({
        session: { id: started.session.id, reviewState: state },
        answers: [{ cardId: fixture.cardIds[0], result: "reveal" }],
      });
      expect(
        await writers[1].listPracticeCardsByIds(fixture.userId, [fixture.cardIds[0]]),
      ).toHaveLength(1);
      await expect(
        writers[1].finishReviewSession(fixture.userId, started.session.id, NOW),
      ).rejects.toBeInstanceOf(ConflictException);
      const input = {
        userId: fixture.userId,
        sessionId: started.session.id,
        cardId: fixture.cardIds[0],
        expectedState: state,
      };
      await writers[0].recordReviewCorrection(input);
      const finished = await writers[1].finishReviewSession(
        fixture.userId,
        started.session.id,
        NOW,
      );
      expect(finished?.summary).toMatchObject({
        totalAnswers: 1,
        incorrectAnswers: 1,
        accuracyPercent: 0,
      });
      const replayed = await writers[0].recordReviewCorrection(input);
      expect(replayed.session.finishedAt).toEqual(NOW);
      expect(replayed.session.reviewState?.correctedCardIds).toEqual([fixture.cardIds[0]]);
      expect(await writers[1].findActiveReviewSession(fixture.userId)).toBeNull();
      expect(await readState(fixture)).toEqual(scheduled);
      expect(await answers(fixture)).toEqual(history);
    });
  });

  it("rejects overlapping correction overwrites and preserves both corrections after a refreshed retry", async () => {
    await withFixture(async (fixture) => {
      const secondState = await control.db.userSrsState.create({
        data: {
          userId: fixture.userId,
          learningCardId: fixture.cardIds[1],
          srsSystemId: fixture.systemId,
          stageIndex: 4,
          availableAt: fixture.state.availableAt,
          wrongCount: 1,
          correctStreak: 2,
        },
        select: stateSelect,
      });
      const snapshot = createScheduledReviewState(fixture.cardIds.slice(0, 2));
      const started = await writers[0].startScheduledReviewSession(
        fixture.userId,
        NOW,
        snapshot.scheduledCardIds,
      );
      await writers[0].recordReviewAnswer(answerInput(fixture, started.session.id, "wrong"));
      await writers[1].recordReviewAnswer(
        answerInput(
          {
            ...fixture,
            state: secondState,
            cardIds: [fixture.cardIds[1], fixture.cardIds[0], fixture.cardIds[2]],
          },
          started.session.id,
          "wrong",
        ),
      );
      const readSchedules = () =>
        control.db.userSrsState.findMany({
          where: { userId: fixture.userId },
          orderBy: { id: "asc" },
        });
      const readHistory = () =>
        control.db.reviewAnswer.findMany({
          where: { reviewSessionId: started.session.id },
          orderBy: { id: "asc" },
        });
      const beforeSchedules = await readSchedules();
      const beforeHistory = await readHistory();
      const outcomes = await overlap(
        "session",
        started.session.id,
        snapshot.scheduledCardIds.map(
          (cardId, index) => () =>
            writers[index]!.recordReviewCorrection({
              userId: fixture.userId,
              sessionId: started.session.id,
              cardId,
              expectedState: snapshot,
            }),
        ),
      );
      assertOneCommit(outcomes);
      const reloaded = await writers[1].findReviewSessionProgress(
        fixture.userId,
        started.session.id,
      );
      const current = reloaded!.session.reviewState!;
      expect(current.correctedCardIds).toHaveLength(1);
      const remaining = snapshot.scheduledCardIds.find(
        (id) => !current.correctedCardIds.includes(id),
      )!;
      await writers[0].recordReviewCorrection({
        userId: fixture.userId,
        sessionId: started.session.id,
        cardId: remaining,
        expectedState: current,
      });
      expect(
        (await writers[1].finishReviewSession(fixture.userId, started.session.id, NOW))?.summary,
      ).toMatchObject({
        totalAnswers: 2,
        incorrectAnswers: 2,
        accuracyPercent: 0,
      });
      expect(await readSchedules()).toEqual(beforeSchedules);
      expect(await readHistory()).toEqual(beforeHistory);
    });
  });

  it("rejects foreign owners and non-review session modes without changing their rows", async () => {
    await withFixture(async (fixture) => {
      const input = answerInput(fixture, fixture.sessionIds[0], "correct");
      const foreign = await writers[0].createReviewSession(fixture.otherUserId, NOW);
      const correction = {
        userId: fixture.userId,
        sessionId: foreign.id,
        cardId: input.cardId,
        expectedState: createScheduledReviewState([input.cardId]),
      };
      await expect(writers[0].recordReviewCorrection(correction)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(await writers[0].findReviewSessionProgress(fixture.userId, foreign.id)).toBeNull();
      await expect(
        writers[0].recordReviewAnswer({ ...input, sessionId: foreign.id }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        writers[0].recordReviewAnswer({
          ...input,
          userId: fixture.otherUserId,
          sessionId: foreign.id,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        writers[0].findAnswerTarget(fixture.otherUserId, input.sessionId, input.cardId, NOW),
      ).resolves.toBeNull();
      await expect(
        writers[0].finishReviewSession(fixture.otherUserId, input.sessionId, NOW),
      ).resolves.toBeNull();

      for (const mode of ["LESSON_QUIZ", "EXTRA_PRACTICE"] as const) {
        const session = await control.db.reviewSession.create({
          data: {
            userId: fixture.userId,
            mode,
            statsJson: { untouched: mode },
          },
        });
        await expect(
          writers[0].findAnswerTarget(fixture.userId, session.id, input.cardId, NOW),
        ).resolves.toBeNull();
        await expect(
          writers[0].recordReviewAnswer({ ...input, sessionId: session.id }),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(
          writers[0].finishReviewSession(fixture.userId, session.id, NOW),
        ).resolves.toBeNull();
        await expect(
          writers[0].recordReviewCorrection({ ...correction, sessionId: session.id }),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(await writers[0].findReviewSessionProgress(fixture.userId, session.id)).toBeNull();
        expect(await control.db.reviewSession.findUnique({ where: { id: session.id } })).toEqual(
          session,
        );
      }
      expect(await readState(fixture)).toEqual(fixture.state);
      expect(await answers(fixture)).toEqual([]);
    });
  });

  it.each(["recent-lessons", "recent-mistakes", "burned", "confusable-kanji"] as const)(
    "allows one concurrent %s practice successor and rejects delayed progress",
    async (source) => {
      await withFixture(async (fixture) => {
        const session = await createPractice(fixture, source);
        const steps = [
          {
            userId: fixture.userId,
            sessionId: session.id,
            currentIndex: 1,
            progress: { answered: 1, accepted: 1, missed: 0 },
          },
          {
            userId: fixture.userId,
            sessionId: session.id,
            currentIndex: 1,
            progress: { answered: 1, accepted: 0, missed: 1 },
          },
        ];
        const outcomes = await overlap(
          "session",
          session.id,
          steps.map((step, index) => () => writers[index]!.updatePracticeSessionProgress(step)),
        );
        expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
        const values = outcomes.map((outcome) =>
          outcome.status === "fulfilled" ? outcome.value : null,
        );
        expect(values.filter((value) => value !== null)).toHaveLength(1);
        const winner = values.find((value) => value !== null)!;
        const second = await writers[0].updatePracticeSessionProgress({
          ...steps[0]!,
          currentIndex: 2,
          progress: {
            answered: 2,
            accepted: winner.progress.accepted + 1,
            missed: winner.progress.missed,
          },
        });
        expect(second?.currentIndex).toBe(2);
        const before = await control.db.reviewSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        await expect(writers[1].updatePracticeSessionProgress(steps[0]!)).resolves.toBeNull();
        expect(await control.db.reviewSession.findUnique({ where: { id: session.id } })).toEqual(
          before,
        );
        expect(before.statsJson).toMatchObject({
          source,
          contextId: fixture.itemId,
          cardIds: fixture.cardIds,
        });
        const completed = await writers[0].updatePracticeSessionProgress({
          ...steps[0]!,
          currentIndex: 3,
          progress: {
            answered: 3,
            accepted: winner.progress.accepted + 2,
            missed: winner.progress.missed,
          },
        });
        const finished = await writers[1].finishPracticeSession(fixture.userId, session.id, NOW);
        expect(finished?.finishedAt).toEqual(NOW);
        expect(finished?.progress).toEqual(completed?.progress);
        await expect(writers[0].updatePracticeSessionProgress(steps[0]!)).resolves.toBeNull();
        expect(await readState(fixture)).toEqual(fixture.state);
        expect(await answers(fixture)).toEqual([]);
      });
    },
  );

  it("guards practice ownership, mode, premature finish, and abandoned-session writes", async () => {
    await withFixture(async (fixture) => {
      const session = await createPractice(fixture, "recent-lessons");
      const step = {
        userId: fixture.userId,
        sessionId: session.id,
        currentIndex: 1,
        progress: { answered: 1, accepted: 1, missed: 0 },
      };
      const before = await control.db.reviewSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      await expect(
        writers[0].updatePracticeSessionProgress({ ...step, userId: fixture.otherUserId }),
      ).resolves.toBeNull();
      await expect(
        writers[0].finishPracticeSession(fixture.otherUserId, session.id, NOW),
      ).resolves.toBeNull();
      await expect(
        writers[0].abandonPracticeSession(fixture.otherUserId, session.id, NOW),
      ).resolves.toBeNull();
      await expect(
        writers[0].finishPracticeSession(fixture.userId, session.id, NOW),
      ).resolves.toBeNull();
      await expect(
        writers[0].updatePracticeSessionProgress({ ...step, sessionId: fixture.sessionIds[0] }),
      ).resolves.toBeNull();
      await expect(
        writers[0].updatePracticeSessionProgress({ ...step, currentIndex: 2 }),
      ).resolves.toBeNull();
      expect(await control.db.reviewSession.findUnique({ where: { id: session.id } })).toEqual(
        before,
      );
      await writers[0].abandonPracticeSession(fixture.userId, session.id, NOW);
      const abandoned = await control.db.reviewSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      await expect(writers[1].updatePracticeSessionProgress(step)).resolves.toBeNull();
      expect(await control.db.reviewSession.findUnique({ where: { id: session.id } })).toEqual(
        abandoned,
      );
      for (const mode of ["REVIEW", "LESSON_QUIZ"] as const) {
        const wrongMode = await createPractice(fixture, "recent-lessons");
        const stored = await control.db.reviewSession.update({
          where: { id: wrongMode.id },
          data: { mode },
        });
        await expect(
          writers[0].updatePracticeSessionProgress({ ...step, sessionId: wrongMode.id }),
        ).resolves.toBeNull();
        await expect(
          writers[0].abandonPracticeSession(fixture.userId, wrongMode.id, NOW),
        ).resolves.toBeNull();
        expect(await control.db.reviewSession.findUnique({ where: { id: wrongMode.id } })).toEqual(
          stored,
        );
      }
      expect(await readState(fixture)).toEqual(fixture.state);
      expect(await answers(fixture)).toEqual([]);
    });
  });
});

function requireSafeDatabaseUrl(value: string): string {
  const unsafe = () =>
    new Error(
      "Unsafe INTEGRATION_DATABASE_URL: require PostgreSQL on loopback, database kanji_integration, and only optional schema=public.",
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw unsafe();
  }
  if (
    value !== value.trim() ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/kanji_integration" ||
    url.hash !== "" ||
    [...url.searchParams].some(([key, entry]) => key !== "schema" || entry !== "public") ||
    url.searchParams.getAll("schema").length > 1
  )
    throw unsafe();
  return url.toString();
}

function createClient(
  baseUrl: string,
  applicationName: string,
  connections: number,
): PrismaService {
  const url = new URL(baseUrl);
  url.searchParams.set("application_name", applicationName);
  url.searchParams.set("connection_limit", String(connections));
  url.searchParams.set("connect_timeout", "5");
  const client = new PrismaService(
    new AppConfigService({
      NODE_ENV: "test",
      DATABASE_URL: url.toString(),
      AUTH_MODE: "dev",
      AUTH_TOKEN_SECRET: "integration-only-no-auth-service",
    }),
  );
  clients.push(client);
  return client;
}

type Fixture = {
  readonly userId: string;
  readonly otherUserId: string;
  readonly itemId: string;
  readonly componentId: string;
  readonly systemId: string;
  readonly cardIds: readonly [string, string, string];
  readonly sessionIds: readonly [string, string];
  readonly state: ReviewSrsStateRecord;
};

async function withFixture(run: (fixture: Fixture) => Promise<void>): Promise<void> {
  const ids = {
    userId: randomUUID(),
    otherUserId: randomUUID(),
    itemId: randomUUID(),
    componentId: randomUUID(),
    systemId: randomUUID(),
    cardIds: [randomUUID(), randomUUID(), randomUUID()] as const,
    sessionIds: [randomUUID(), randomUUID()] as const,
  };
  const state = await control.db.$transaction(async (tx) => {
    for (const id of [ids.userId, ids.otherUserId]) {
      await tx.user.create({
        data: {
          id,
          email: `study-integrity-${id}@example.test`,
          passwordHash: "test-only-no-authentication",
        },
      });
    }
    await tx.component.create({
      data: {
        id: ids.componentId,
        symbol: `test-${ids.componentId}`,
        displayNameRu: "Test component",
        meaningRu: "Test-only meaning",
        meaningEn: "Test-only meaning",
      },
    });
    await tx.srsSystem.create({
      data: {
        id: ids.systemId,
        slug: `study-integrity-${ids.systemId}`,
        title: "Integration fixture",
        stages: { create: DEFAULT_SRS_STAGES.map((stage) => ({ ...stage })) },
      },
    });
    await tx.learningItem.create({
      data: {
        id: ids.itemId,
        kind: "COMPONENT",
        targetType: "COMPONENT",
        targetId: ids.componentId,
        title: "Integration fixture",
        status: "PUBLISHED",
        cards: {
          create: ids.cardIds.map((id, index) => ({
            id,
            cardType: "REVIEW",
            promptType: (["MEANING", "RECALL", "RECOGNITION"] as const)[index]!,
            answerType: "MEANING",
            locale: "ru-RU",
            sortOrder: index,
          })),
        },
      },
    });
    for (const id of ids.sessionIds) {
      await tx.reviewSession.create({
        data: { id, userId: ids.userId, mode: "REVIEW", startedAt: NOW },
      });
    }
    return tx.userSrsState.create({
      data: {
        userId: ids.userId,
        learningCardId: ids.cardIds[0],
        srsSystemId: ids.systemId,
        stageIndex: 4,
        availableAt: new Date(NOW.getTime() - 60_000),
        wrongCount: 1,
        correctStreak: 2,
      },
      select: stateSelect,
    });
  });
  try {
    await run({ ...ids, state });
  } finally {
    // Cascade only from the exact fixture identities, never from table-wide resets.
    await control.db.$transaction([
      control.db.user.deleteMany({ where: { id: { in: [ids.userId, ids.otherUserId] } } }),
      control.db.learningItem.deleteMany({ where: { id: ids.itemId } }),
      control.db.component.deleteMany({ where: { id: ids.componentId } }),
      control.db.srsSystem.deleteMany({ where: { id: ids.systemId } }),
    ]);
  }
}

function answerInput(
  fixture: Fixture,
  sessionId: string,
  result: "correct" | "wrong" | "manual-ignore",
): RecordReviewAnswerInput {
  const scheduling = calculateNextReview({ state: fixture.state, result, now: NOW });
  return {
    userId: fixture.userId,
    sessionId,
    stateId: fixture.state.id,
    cardId: fixture.cardIds[0],
    answerText: result,
    normalizedAnswer: result,
    answeredAt: NOW,
    recordedResult: result,
    responseResult: result,
    previousStageIndex: fixture.state.stageIndex,
    nextStageIndex: scheduling.nextState.stageIndex,
    srsTransition: result === "correct" ? "advanced" : result === "wrong" ? "demoted" : "unchanged",
    expectedState: fixture.state,
    nextState: scheduling.nextState,
    details: { scheduling: { action: scheduling.details.action } },
  };
}

function readState(fixture: Fixture) {
  return control.db.userSrsState.findUniqueOrThrow({
    where: { id: fixture.state.id },
    select: stateSelect,
  });
}

function answers(fixture: Fixture) {
  return control.db.reviewAnswer.findMany({ where: { userSrsStateId: fixture.state.id } });
}

function createPractice(fixture: Fixture, source: ResumablePracticeSource) {
  return writers[0].createPracticeSession({
    userId: fixture.userId,
    now: NOW,
    source,
    contextId: fixture.itemId,
    cardIds: fixture.cardIds,
  });
}

function assertOneCommit<T>(outcomes: readonly PromiseSettledResult<T>[]): void {
  expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
  const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
  expect(rejected).toHaveLength(1);
  expect(rejected[0]?.reason).toBeInstanceOf(ConflictException);
}

async function overlap<T>(
  row: "state" | "session" | "owner",
  id: string,
  operations: readonly (() => Promise<T>)[],
  beforeRelease?: () => Promise<void>,
): Promise<PromiseSettledResult<T>[]> {
  const locked = deferred();
  const release = deferred();
  const blocker = control.db.$transaction(
    async (tx) => {
      if (row === "state") {
        await tx.$queryRaw`SELECT id FROM "UserSrsState" WHERE id = ${id}::uuid FOR UPDATE`;
      } else if (row === "session") {
        await tx.$queryRaw`SELECT id FROM "ReviewSession" WHERE id = ${id}::uuid FOR UPDATE`;
      } else {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
      }
      locked.resolve();
      await release.promise;
    },
    { maxWait: 5_000, timeout: 15_000 },
  );
  let pending: Promise<PromiseSettledResult<T>[]> | undefined;
  try {
    await Promise.race([
      locked.promise,
      blocker.then(() => {
        throw new Error("Row lock ended early.");
      }),
    ]);
    pending = Promise.allSettled(operations.map((operation) => operation()));
    // Verify both independent repository connections reached a real PostgreSQL lock wait.
    const deadline = Date.now() + 3_000;
    while (true) {
      const [waiters] = await control.db.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE datname = current_database()
          AND application_name IN (${Prisma.join(writerNames.slice(0, operations.length))})
          AND wait_event_type = 'Lock'
      `);
      if (waiters?.count === operations.length) break;
      if (Date.now() >= deadline)
        throw new Error("Repository calls did not overlap on PostgreSQL row locks.");
      await delay(20);
    }
    await beforeRelease?.();
  } finally {
    release.resolve();
    try {
      await blocker;
    } finally {
      await pending;
    }
  }
  return pending!;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
