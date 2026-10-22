import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { ConflictException, NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  Prisma,
  getContentQualityPage,
  loadItemExampleSentences,
  loadWordExampleQuality,
  writeWordExample,
  buildMainCourseContentBatches,
  type ExampleItemRef,
  type PrismaClient,
} from "@kanji-srs/db";
import { calculateNextReview, DEFAULT_SRS_STAGES } from "@kanji-srs/srs";
import {
  buildMainCourseWordBatch,
  wordHanCharacters,
  type MainCourseWordBatch,
} from "../../../packages/db/src/main-course-word-content";

import { AppConfigService } from "../src/config/app-config.service";
import { PrismaService } from "../src/database/prisma.service";
import { PrismaItemsRepository } from "../src/items/items.repository";
import { PrismaLessonsRepository } from "../src/lessons/lessons.repository";
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
type WordCuratorModule = {
  planMainCourseWordBatch(
    db: PrismaClient,
    batch: MainCourseWordBatch,
  ): Promise<{ words: { wordId: string }[] }>;
  applyMainCourseWordBatch(
    db: PrismaClient,
    batch: MainCourseWordBatch,
  ): Promise<{ words: number; cards: number; examples: number }>;
};
let wordCurator: WordCuratorModule;

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
    // Keep the ESM CLI's import.meta outside the API's CommonJS compilation graph.
    const curatorModulePath = "../../../packages/db/prisma/curate-main-course-words.ts";
    wordCurator = (await import(curatorModulePath)) as WordCuratorModule;
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

  it("reads direct authored examples without a sentence LearningItem and really upserts duplicate links without SRS writes", async () => {
    await withFixture(async (base) =>
      withWordExamplesFixture(base, 2, async (fixture) => {
        const input = {
          wordId: fixture.items[0]!.targetId,
          sentenceId: fixture.sentenceIds[0]!,
          status: "PUBLISHED" as const,
        };
        const schedules = await readState(base);
        const originalAnswers = await answers(base);
        const spelling = await control.db.word.findUniqueOrThrow({
          where: { id: input.wordId },
          select: { expression: true },
        });
        await control.db.word.update({
          where: { id: fixture.items[1]!.targetId },
          data: { expression: spelling.expression, reading: "もと" },
        });
        const [first, simultaneous] = await Promise.all([
          writeWordExample(control.db, input),
          writeWordExample(control.db, input),
        ]);
        expect(simultaneous.id).toBe(first.id);
        expect((await writeWordExample(control.db, input)).id).toBe(first.id);
        expect(await control.db.wordExample.count({ where: { wordId: input.wordId } })).toBe(1);
        await expect(control.db.wordExample.create({ data: input })).rejects.toMatchObject({
          code: "P2002",
        });
        const item = await new PrismaItemsRepository(control).findItemById(
          fixture.items[0]!.id,
          {},
        );
        expect(item?.exampleSentences).toHaveLength(1);
        expect(item?.exampleSentences[0]?.attribution).toMatchObject({
          licenseName: fixture.licenseName,
          attributionText: "Independent integration fixture authors.",
          sourceName: expect.stringContaining("авторский пример проекта"),
        });
        const lessons = await new PrismaLessonsRepository(control).listCourseLessonItems(
          base.userId,
        );
        expect(lessons[0]?.item.exampleSentences).toHaveLength(1);
        expect(lessons[1]?.item.target.reading).toBe("もと");
        expect(lessons[1]?.item.exampleSentences).toEqual([]);
        expect(
          await control.db.learningItem.count({
            where: { targetType: "SENTENCE", targetId: { in: fixture.sentenceIds } },
          }),
        ).toBe(0);
        expect(
          await control.db.learningCard.count({
            where: { learningItemId: { in: fixture.items.map((item) => item.id) } },
          }),
        ).toBe(2);
        expect(
          await control.db.dependency.count({
            where: { prerequisiteItemId: fixture.items[0]!.id },
          }),
        ).toBe(0);
        expect(
          await control.db.userSrsState.count({
            where: { learningCard: { learningItemId: fixture.items[0]!.id } },
          }),
        ).toBe(0);
        expect(await readState(base)).toEqual(schedules);
        expect(await answers(base)).toEqual(originalAnswers);
      }),
    );
  });

  it("uses real lateral 3/5 per-word limits across 101 words and consecutive quality pages", async () => {
    await withFixture(async (base) =>
      withWordExamplesFixture(base, 101, async (fixture) => {
        await control.db.wordExample.createMany({
          data: fixture.items.flatMap((item) =>
            fixture.sentenceIds.map((sentenceId, sortOrder) => ({
              wordId: item.targetId,
              sentenceId,
              sortOrder,
              status: "PUBLISHED" as const,
            })),
          ),
        });
        const three = await loadItemExampleSentences(control.db, fixture.items, 3);
        const five = await loadItemExampleSentences(control.db, fixture.items, 5);
        expect(three.size).toBe(101);
        expect(five.size).toBe(101);
        for (const item of fixture.items) {
          expect(three.get(item.id)?.map((sentence) => sentence.id)).toEqual(
            fixture.sentenceIds.slice(0, 3),
          );
          expect(five.get(item.id)?.map((sentence) => sentence.id)).toEqual(
            fixture.sentenceIds.slice(0, 5),
          );
        }
        const first = await getContentQualityPage(control.db, {
          courseSlug: fixture.courseSlug,
          code: "missing-example",
          limit: 100,
        });
        expect(first.scannedItems).toBe(100);
        expect(first.issues).toEqual([]);
        expect(first.nextCursor).not.toBeNull();
        const second = await getContentQualityPage(control.db, {
          courseSlug: fixture.courseSlug,
          code: "missing-example",
          cursor: first.nextCursor!,
          limit: 100,
        });
        expect(second.scannedItems).toBe(1);
        expect(second.issues).toEqual([]);
        expect(second.nextCursor).toBeNull();
      }),
    );
  });

  it("omits real draft links, preserves strict legacy/non-word fallback and does not resurrect a draft through legacy relations", async () => {
    await withFixture(async (base) =>
      withWordExamplesFixture(base, 1, async (fixture) => {
        const item = fixture.items[0]!;
        const sentenceId = fixture.sentenceIds[0]!;
        const legacyId = randomUUID();
        fixture.extraItemIds.push(legacyId);
        await control.db.learningItem.create({
          data: {
            id: legacyId,
            kind: "SENTENCE",
            targetType: "SENTENCE",
            targetId: sentenceId,
            title: "Legacy example fixture",
            status: "PUBLISHED",
            dependencies: {
              create: [item.id, base.itemId].map((prerequisiteItemId) => ({
                prerequisiteItemId,
                dependencyType: "PREREQUISITE",
              })),
            },
          },
        });
        expect((await loadItemExampleSentences(control.db, [item], 3)).get(item.id)).toHaveLength(
          1,
        );
        await writeWordExample(control.db, { wordId: item.targetId, sentenceId, status: "DRAFT" });
        expect(
          (await loadItemExampleSentences(control.db, [item], 3)).get(item.id),
        ).toBeUndefined();
        const component = { id: base.itemId, targetType: "COMPONENT", targetId: base.componentId };
        expect(
          (await loadItemExampleSentences(control.db, [component], 3)).get(component.id),
        ).toHaveLength(1);
        await writeWordExample(control.db, {
          wordId: item.targetId,
          sentenceId,
          status: "PUBLISHED",
        });
        expect((await loadItemExampleSentences(control.db, [item], 3)).get(item.id)).toHaveLength(
          1,
        );
        await control.db.dataSource.update({
          where: { id: fixture.dataSourceId },
          data: { attributionText: "" },
        });
        expect(
          (await loadItemExampleSentences(control.db, [component], 3)).get(component.id),
        ).toBeUndefined();
        expect((await loadWordExampleQuality(control.db, [item])).get(item.id)).toMatchObject({
          hasExample: false,
          invalidExampleCount: 1,
        });
      }),
    );
  });

  it("blocks a bad published license beyond the display cap even with other good examples", async () => {
    await withFixture(async (base) =>
      withWordExamplesFixture(base, 1, async (fixture) => {
        const item = fixture.items[0]!;
        await control.db.wordExample.createMany({
          data: fixture.sentenceIds.map((sentenceId, sortOrder) => ({
            wordId: item.targetId,
            sentenceId,
            sortOrder,
            status: "PUBLISHED",
          })),
        });
        const badLicense = await control.db.license.create({
          data: { name: `private-example-${randomUUID()}`, scope: "USER_PRIVATE" },
        });
        fixture.licenseIds.push(badLicense.id);
        await control.db.sentence.update({
          where: { id: fixture.sentenceIds.at(-1)! },
          data: { licenseId: badLicense.id },
        });
        expect((await loadItemExampleSentences(control.db, [item], 5)).get(item.id)).toHaveLength(
          5,
        );
        expect((await loadWordExampleQuality(control.db, [item])).get(item.id)).toMatchObject({
          hasExample: true,
          invalidExampleCount: 1,
        });
        const page = await getContentQualityPage(control.db, {
          courseSlug: fixture.courseSlug,
          code: "invalid-source",
        });
        expect(page.issues).toContainEqual(
          expect.objectContaining({
            learningItemId: item.id,
            severity: "blocker",
            message: expect.stringContaining("пример"),
          }),
        );
      }),
    );
  });

  it("requires successful versioned imported-sentence provenance in real SQL", async () => {
    await withFixture(async (base) =>
      withWordExamplesFixture(base, 1, async (fixture) => {
        const item = fixture.items[0]!;
        const sentenceId = fixture.sentenceIds[0]!;
        const license = await control.db.license.create({
          data: { name: `open-example-${randomUUID()}`, scope: "OPEN_DATA" },
        });
        fixture.licenseIds.push(license.id);
        await control.db.dataSource.update({
          where: { id: fixture.dataSourceId },
          data: { licenseId: license.id },
        });
        const run = await control.db.importRun.create({
          data: {
            dataSourceId: fixture.dataSourceId,
            sourceFileName: "integration-only.tsv",
            sourceVersion: "fixture-v1",
            checksumSha256: "a".repeat(64),
            status: "SUCCESS",
            finishedAt: NOW,
          },
        });
        const record = await control.db.importedRecord.create({
          data: {
            importRunId: run.id,
            sourceRecordId: "example-1",
            recordType: "TATOEBA_SENTENCE",
            rawJson: {},
          },
        });
        await control.db.sentence.update({
          where: { id: sentenceId },
          data: {
            licenseId: license.id,
            importedRecordId: record.id,
            sourceId: record.sourceRecordId,
          },
        });
        await writeWordExample(control.db, {
          wordId: item.targetId,
          sentenceId,
          status: "PUBLISHED",
        });
        expect((await loadItemExampleSentences(control.db, [item], 3)).get(item.id)).toHaveLength(
          1,
        );
        await control.db.importRun.update({ where: { id: run.id }, data: { status: "FAILED" } });
        expect(
          (await loadItemExampleSentences(control.db, [item], 3)).get(item.id),
        ).toBeUndefined();
        await control.db.importRun.update({
          where: { id: run.id },
          data: { status: "SUCCESS", sourceVersion: "" },
        });
        expect((await loadWordExampleQuality(control.db, [item])).get(item.id)).toMatchObject({
          hasExample: false,
          invalidExampleCount: 1,
        });
        await control.db.importRun.update({
          where: { id: run.id },
          data: { sourceVersion: "fixture-v1", checksumSha256: "invalid" },
        });
        expect(
          (await loadItemExampleSentences(control.db, [item], 3)).get(item.id),
        ).toBeUndefined();
      }),
    );
  });

  it("curates twenty compact-JMdict words into forty stable cards and twenty examples, preserving private progress on rerun", async () => {
    await withFixture(async (base) =>
      withWordCurationFixture(async (fixture) => {
        const importedBefore = await wordCurationImportedRows(fixture);
        const kanjiBefore = await control.db.courseLevelItem.findMany({
          where: { learningItemId: { in: fixture.kanjiItemIds } },
          orderBy: { id: "asc" },
        });
        const plan = await wordCurator.planMainCourseWordBatch(control.db, fixture.batch);
        expect(plan.words).toHaveLength(20);
        expect(plan.words.map((entry) => entry.wordId)).toEqual(fixture.wordIds);
        expect((await wordCurationRows(fixture)).items).toEqual([]);
        expect(await ownedWordCurationRuns(fixture)).toEqual([]);
        const result = await wordCurator.applyMainCourseWordBatch(control.db, fixture.batch);
        expect(result).toMatchObject({ words: 20, cards: 40, examples: 20 });
        const first = await wordCurationRows(fixture);
        expect(first.items).toHaveLength(20);
        expect(first.items.every((item) => item.status === "PUBLISHED")).toBe(true);
        expect(first.cards).toHaveLength(40);
        expect(first.examples).toHaveLength(20);
        expect(first.examples.every((example) => example.status === "PUBLISHED")).toBe(true);
        expect(
          await control.db.learningItem.count({
            where: {
              targetType: "SENTENCE",
              targetId: { in: first.examples.map((example) => example.sentenceId) },
            },
          }),
        ).toBe(0);
        expect(
          await control.db.userSrsState.count({
            where: { learningCardId: { in: first.cards.map((card) => card.id) } },
          }),
        ).toBe(0);
        const dependencies = await control.db.dependency.findMany({
          where: { learningItemId: { in: first.items.map((item) => item.id) } },
        });
        expect(dependencies).toHaveLength(20);
        expect(
          dependencies.every(
            (dependency) =>
              dependency.requiredStage === 2 &&
              fixture.kanjiItemIds.includes(dependency.prerequisiteItemId),
          ),
        ).toBe(true);
        const placements = await control.db.courseLevelItem.findMany({
          where: { learningItemId: { in: first.items.map((item) => item.id) } },
          orderBy: { sortOrder: "asc" },
          include: { courseLevel: true },
        });
        expect(placements.map((placement) => placement.sortOrder)).toEqual(
          Array.from({ length: 20 }, (_, index) => index + 1),
        );
        expect(placements.every((placement) => placement.courseLevel.levelNumber === 5)).toBe(true);
        expect(await wordCurationImportedRows(fixture)).toEqual(importedBefore);
        const card = first.cards.find((card) => card.promptType === "MEANING")!;
        const state = await control.db.userSrsState.create({
          data: {
            userId: base.userId,
            learningCardId: card.id,
            srsSystemId: base.systemId,
            stageIndex: 5,
            availableAt: new Date("2026-12-01T09:00:00Z"),
            wrongCount: 3,
            correctStreak: 2,
            lastReviewedAt: NOW,
          },
        });
        const override = await control.db.userItemOverride.create({
          data: {
            userId: base.userId,
            learningCardId: card.id,
            overrideType: "ACCEPTED_MEANING",
            locale: "ru-RU",
            text: "личный ответ",
            normalizedText: "личный ответ",
          },
        });
        const mnemonic = await control.db.userMnemonic.create({
          data: {
            userId: base.userId,
            learningItemId: card.learningItemId,
            locale: "ru-RU",
            mnemonicType: "MEANING",
            body: "Личная мнемоника не меняется.",
          },
        });
        await wordCurator.applyMainCourseWordBatch(control.db, fixture.batch);
        expect(await wordCurationRows(fixture)).toEqual(first);
        expect(await wordCurationImportedRows(fixture)).toEqual(importedBefore);
        expect(await control.db.userSrsState.findUnique({ where: { id: state.id } })).toEqual(
          state,
        );
        expect(
          await control.db.userItemOverride.findUnique({ where: { id: override.id } }),
        ).toEqual(override);
        expect(await control.db.userMnemonic.findUnique({ where: { id: mnemonic.id } })).toEqual(
          mnemonic,
        );
        expect(
          await control.db.courseLevelItem.findMany({
            where: { learningItemId: { in: fixture.kanjiItemIds } },
            orderBy: { id: "asc" },
          }),
        ).toEqual(kanjiBefore);
        expect(await readState(base)).toEqual(base.state);
        expect(await answers(base)).toEqual([]);
      }),
    );
  }, 45_000);

  it("rejects the last word's invalid compact source before creating any curation rows", async () => {
    await withWordCurationFixture(async (fixture) => {
      const last = fixture.batch.words.at(-1)!;
      await control.db.importedRecord.update({
        where: { id: fixture.recordIds.at(-1)! },
        data: {
          rawJson: {
            sequence: last.jmdictEntryId.slice(7),
            importedWordCount: 1,
            retainedLocales: ["en-US"],
          },
        },
      });
      const before = await wordCurationImportedRows(fixture);
      await expect(wordCurator.applyMainCourseWordBatch(control.db, fixture.batch)).rejects.toThrow(
        `${last.expression}/${last.reading}`,
      );
      expect(await wordCurationRows(fixture)).toEqual({ items: [], cards: [], examples: [] });
      expect(
        await control.db.wordSense.count({
          where: { wordId: { in: fixture.wordIds }, sourceKind: "PROJECT_AUTHORED" },
        }),
      ).toBe(0);
      expect(await ownedWordCurationRuns(fixture)).toEqual([]);
      expect(
        await control.db.dataSource.count({ where: { name: WORD_CURATION_SOURCE_NAME } }),
      ).toBe(0);
      expect(await control.db.license.count({ where: { name: WORD_CURATION_LICENSE_NAME } })).toBe(
        0,
      );
      expect(await wordCurationImportedRows(fixture)).toEqual(before);
    });
  }, 20_000);

  it("rolls back the final word's real failed transaction, leaves drafts unpublished, and recovers the same staged identities", async () => {
    await withWordCurationFixture(async (fixture) => {
      const last = fixture.batch.words.at(-1)!;
      // A PostgreSQL text value cannot contain U+0000; this fails inside applyWord after earlier writes.
      const interrupted: MainCourseWordBatch = {
        ...fixture.batch,
        words: [
          ...fixture.batch.words.slice(0, -1),
          { ...last, meaningHint: { ...last.meaningHint, ru: "rollback\u0000fixture" } },
        ],
      };
      await expect(wordCurator.applyMainCourseWordBatch(control.db, interrupted)).rejects.toThrow();
      const staged = await wordCurationRows(fixture);
      expect(staged.items).toHaveLength(19);
      expect(staged.cards).toHaveLength(38);
      expect(staged.examples).toHaveLength(19);
      expect(staged.items.every((item) => item.status === "DRAFT")).toBe(true);
      expect(staged.examples.every((example) => example.status === "DRAFT")).toBe(true);
      expect(
        await control.db.learningItem.findUnique({
          where: { targetType_targetId: { targetType: "WORD", targetId: fixture.wordIds.at(-1)! } },
        }),
      ).toBeNull();
      expect(
        await control.db.wordSense.count({
          where: { wordId: fixture.wordIds.at(-1)!, sourceKind: "PROJECT_AUTHORED" },
        }),
      ).toBe(0);
      expect((await ownedWordCurationRuns(fixture)).map((run) => run.status)).toEqual(["FAILED"]);
      await wordCurator.applyMainCourseWordBatch(control.db, fixture.batch);
      const recovered = await wordCurationRows(fixture);
      expect(recovered.items).toHaveLength(20);
      expect(recovered.cards).toHaveLength(40);
      expect(recovered.examples).toHaveLength(20);
      expect(recovered.items.every((item) => item.status === "PUBLISHED")).toBe(true);
      expect(recovered.examples.every((example) => example.status === "PUBLISHED")).toBe(true);
      expect(recovered.items.map((item) => item.id)).toEqual(
        expect.arrayContaining(staged.items.map((item) => item.id)),
      );
      expect(recovered.cards.map((card) => card.id)).toEqual(
        expect.arrayContaining(staged.cards.map((card) => card.id)),
      );
      expect(recovered.examples.map((example) => example.id)).toEqual(
        expect.arrayContaining(staged.examples.map((example) => example.id)),
      );
      expect((await ownedWordCurationRuns(fixture)).map((run) => run.status).sort()).toEqual([
        "FAILED",
        "SUCCESS",
      ]);
      const loaded = await loadItemExampleSentences(
        control.db,
        recovered.items.map((item) => ({ ...item, targetType: "WORD" })),
        3,
      );
      expect(loaded.size).toBe(20);
      expect(
        await control.db.userSrsState.count({
          where: { learningCardId: { in: recovered.cards.map((card) => card.id) } },
        }),
      ).toBe(0);
    });
  }, 45_000);
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

type WordExamplesFixture = {
  readonly items: readonly ExampleItemRef[];
  readonly sentenceIds: string[];
  readonly dataSourceId: string;
  readonly licenseName: string;
  readonly licenseIds: string[];
  readonly extraItemIds: string[];
  readonly courseSlug: string;
};

const WORD_CURATION_SOURCE_NAME = "Kanji SRS main-course word curation";
const WORD_CURATION_LICENSE_NAME = "Project-authored main-course word content";
type WordCurationFixture = {
  readonly batch: MainCourseWordBatch;
  readonly courseId: string;
  readonly wordIds: string[];
  readonly recordIds: string[];
  readonly kanjiItemIds: string[];
};

async function withWordCurationFixture(run: (fixture: WordCurationFixture) => Promise<void>) {
  const suffix = randomUUID();
  // Approval is scoped to this fixture, never to the shipped editorial manifest.
  const batch: MainCourseWordBatch = {
    ...buildMainCourseWordBatch(),
    id: `word-curation-pg-${suffix}`,
    reviewedAt: "2026-10-22",
    reviewNotes:
      "Test-only approval of the full twenty-word fixture; not production editorial approval.",
    sourceFile: `integration-word-curation-${suffix}.ts`,
  };
  const registered = buildMainCourseContentBatches()
    .filter((entry) => entry.courseSlug === batch.courseSlug)
    .flatMap((entry) => entry.kanji)
    .filter((content) => content.levelNumber < batch.levelNumber);
  expect(registered).toHaveLength(40);
  const requiredHan = new Set(
    batch.words.flatMap((content) =>
      wordHanCharacters(content.expression + content.example.japaneseText),
    ),
  );
  expect(requiredHan.has("見")).toBe(true);
  expect(requiredHan.has("百")).toBe(true);
  expect(
    [...requiredHan].every((character) =>
      registered.some((content) => content.character === character),
    ),
  ).toBe(true);
  // Fixed registry/source names are required by the curator. Refuse to reuse any pre-existing ownership.
  expect(await control.db.course.count({ where: { slug: batch.courseSlug } })).toBe(0);
  expect(
    await control.db.dataSource.count({
      where: { name: { in: ["JMdict", WORD_CURATION_SOURCE_NAME] } },
    }),
  ).toBe(0);
  expect(await control.db.license.count({ where: { name: WORD_CURATION_LICENSE_NAME } })).toBe(0);
  expect(
    await control.db.kanji.count({
      where: { character: { in: registered.map((content) => content.character) } },
    }),
  ).toBe(0);
  expect(
    await control.db.word.count({
      where: {
        OR: batch.words.map((content) => ({
          expression: content.expression,
          reading: content.reading,
        })),
      },
    }),
  ).toBe(0);
  const courseId = randomUUID();
  const levelIds = Array.from({ length: 5 }, () => randomUUID());
  const kanjiIds = registered.map(() => randomUUID());
  const kanjiItemIds = registered.map(() => randomUUID());
  const wordIds = batch.words.map(() => randomUUID());
  const recordIds = batch.words.map(() => randomUUID());
  const licenseId = randomUUID();
  const sourceId = randomUUID();
  const importRunId = randomUUID();
  const fixture: WordCurationFixture = { batch, courseId, wordIds, recordIds, kanjiItemIds };
  await control.db.$transaction(
    async (tx) => {
      await tx.course.create({
        data: {
          id: courseId,
          slug: batch.courseSlug,
          titleRu: `Integration curation ${suffix}`,
          status: "PUBLISHED",
        },
      });
      await tx.courseLevel.createMany({
        data: levelIds.map((id, index) => ({
          id,
          courseId,
          levelNumber: index + 1,
          titleRu: `Fixture ${index + 1}`,
          band: "FOUNDATION",
        })),
      });
      await tx.kanji.createMany({
        data: registered.map((content, index) => ({
          id: kanjiIds[index]!,
          character: content.character,
        })),
      });
      await tx.learningItem.createMany({
        data: registered.map((content, index) => ({
          id: kanjiItemIds[index]!,
          targetId: kanjiIds[index]!,
          targetType: "KANJI",
          kind: "KANJI",
          title: `Fixture ${content.character}`,
          status: "PUBLISHED",
          levelHint: content.levelNumber,
          curriculumBand: "FOUNDATION",
        })),
      });
      await tx.courseLevelItem.createMany({
        data: registered.map((content, index) => ({
          courseLevelId: levelIds[content.levelNumber - 1]!,
          learningItemId: kanjiItemIds[index]!,
          sortOrder: content.sortOrder,
        })),
      });
      await tx.license.create({
        data: {
          id: licenseId,
          name: `JMdict metadata fixture ${suffix}`,
          scope: "OPEN_DATA",
          spdxLikeId: "LicenseRef-JMdict-Multilingual",
          url: "https://www.edrdg.org/edrdg/licence.html",
          requiresAttribution: true,
        },
      });
      await tx.dataSource.create({
        data: {
          id: sourceId,
          name: "JMdict",
          licenseId,
          homepageUrl: "https://www.edrdg.org/",
          attributionText: `Synthetic integration source metadata ${suffix}; not a dictionary import.`,
        },
      });
      await tx.importRun.create({
        data: {
          id: importRunId,
          dataSourceId: sourceId,
          sourceVersion: `fixture-${suffix}`,
          sourceFileName: `fixture-${suffix}.xml`,
          checksumSha256: "f".repeat(64),
          status: "SUCCESS",
          finishedAt: NOW,
        },
      });
      await tx.importedRecord.createMany({
        data: batch.words.map((content, index) => ({
          id: recordIds[index]!,
          importRunId,
          sourceRecordId: content.jmdictEntryId,
          recordType: "JMDICT_ENTRY",
          rawJson: {
            sequence: content.jmdictEntryId.slice(7),
            importedWordCount: 1,
            retainedLocales: ["en-US", "ru-RU"],
          },
        })),
      });
      await tx.word.createMany({
        data: batch.words.map((content, index) => ({
          id: wordIds[index]!,
          expression: content.expression,
          reading: content.reading,
          jmdictEntryId: content.jmdictEntryId,
          jmdictImportedRecordId: recordIds[index]!,
        })),
      });
      await tx.wordSense.createMany({
        data: batch.words.flatMap((content, index) => [
          {
            wordId: wordIds[index]!,
            locale: "ru-RU",
            meaning: content.meanings.ru.primary,
            partOfSpeech: "noun",
            sourceKind: "IMPORTED" as const,
          },
          {
            wordId: wordIds[index]!,
            locale: "en-US",
            meaning: content.meanings.en.primary,
            partOfSpeech: "noun",
            sourceKind: "IMPORTED" as const,
          },
        ]),
      });
    },
    { timeout: 15_000 },
  );
  try {
    await run(fixture);
  } finally {
    const ownedRuns = await ownedWordCurationRuns(fixture);
    const authoredSourceIds = [...new Set(ownedRuns.map((run) => run.dataSourceId))];
    const authoredLicenseIds = [...new Set(ownedRuns.map((run) => run.dataSource.licenseId))];
    await control.db.$transaction([
      control.db.learningItem.deleteMany({
        where: {
          OR: [{ id: { in: kanjiItemIds } }, { targetType: "WORD", targetId: { in: wordIds } }],
        },
      }),
      control.db.course.deleteMany({ where: { id: courseId } }),
      control.db.word.deleteMany({ where: { id: { in: wordIds } } }),
      control.db.kanji.deleteMany({ where: { id: { in: kanjiIds } } }),
      control.db.sentence.deleteMany({ where: { dataSourceId: { in: authoredSourceIds } } }),
      control.db.importRun.deleteMany({
        where: { id: { in: [importRunId, ...ownedRuns.map((run) => run.id)] } },
      }),
      control.db.dataSource.deleteMany({ where: { id: { in: [sourceId, ...authoredSourceIds] } } }),
      control.db.license.deleteMany({ where: { id: { in: [licenseId, ...authoredLicenseIds] } } }),
    ]);
  }
}

function ownedWordCurationRuns(fixture: WordCurationFixture) {
  return control.db.importRun.findMany({
    where: {
      sourceFileName: fixture.batch.sourceFile,
      statsJson: { path: ["batchId"], equals: fixture.batch.id },
    },
    include: { dataSource: true },
    orderBy: { id: "asc" },
  });
}

async function wordCurationRows(fixture: WordCurationFixture) {
  const items = await control.db.learningItem.findMany({
    where: { targetType: "WORD", targetId: { in: fixture.wordIds } },
    select: { id: true, targetId: true, status: true },
    orderBy: { id: "asc" },
  });
  const cards = await control.db.learningCard.findMany({
    where: { learningItemId: { in: items.map((item) => item.id) } },
    select: { id: true, learningItemId: true, promptType: true, answerType: true },
    orderBy: { id: "asc" },
  });
  const examples = await control.db.wordExample.findMany({
    where: { wordId: { in: fixture.wordIds } },
    select: { id: true, wordId: true, sentenceId: true, status: true },
    orderBy: { id: "asc" },
  });
  return { items, cards, examples };
}

function wordCurationImportedRows(fixture: WordCurationFixture) {
  return control.db.word.findMany({
    where: { id: { in: fixture.wordIds } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      expression: true,
      reading: true,
      jmdictEntryId: true,
      jmdictImportedRecordId: true,
      importedRecord: { select: { id: true, sourceRecordId: true, rawJson: true } },
      senses: { where: { sourceKind: "IMPORTED" }, orderBy: { id: "asc" } },
    },
  });
}

async function withWordExamplesFixture(
  base: Fixture,
  wordCount: number,
  run: (fixture: WordExamplesFixture) => Promise<void>,
) {
  const suffix = randomUUID();
  const items = Array.from({ length: wordCount }, () => ({
    id: randomUUID(),
    targetId: randomUUID(),
    targetType: "WORD",
  }));
  const sentenceIds = Array.from({ length: 7 }, () => randomUUID());
  const licenseId = randomUUID();
  const dataSourceId = randomUUID();
  const courseId = randomUUID();
  const courseLevelId = randomUUID();
  const courseSlug = `word-examples-${suffix}`;
  const licenseName = `Named project-authored fixture license ${suffix}`;
  const fixture: WordExamplesFixture = {
    items,
    sentenceIds,
    dataSourceId,
    licenseName,
    courseSlug,
    licenseIds: [licenseId],
    extraItemIds: [],
  };
  await control.db.$transaction(async (tx) => {
    await tx.license.create({
      data: { id: licenseId, name: licenseName, scope: "PROJECT_AUTHORED" },
    });
    await tx.dataSource.create({
      data: {
        id: dataSourceId,
        name: `Project examples ${suffix}`,
        licenseId,
        attributionText: "Independent integration fixture authors.",
        homepageUrl: "https://example.test/authored-fixtures",
      },
    });
    await tx.word.createMany({
      data: items.map((item, index) => ({
        id: item.targetId,
        expression: `fixture-${suffix}-${index}`,
        reading: "ほん",
      })),
    });
    await tx.learningItem.createMany({
      data: items.map((item) => ({
        id: item.id,
        targetId: item.targetId,
        kind: "WORD",
        targetType: "WORD",
        title: "Word example fixture",
        status: "PUBLISHED",
        curriculumBand: "FOUNDATION",
      })),
    });
    await tx.learningCard.createMany({
      data: items.map((item) => ({
        learningItemId: item.id,
        cardType: "REVIEW",
        promptType: "MEANING",
        answerType: "MEANING",
        locale: "ru-RU",
      })),
    });
    await tx.sentence.createMany({
      data: sentenceIds.map((id, index) => ({
        id,
        japaneseText: `本を読みます。${index}`,
        translationRu: "Читаю книгу.",
        translationEn: "I read a book.",
        licenseId,
        dataSourceId,
      })),
    });
    await tx.course.create({
      data: {
        id: courseId,
        slug: courseSlug,
        titleRu: "Example integration fixture",
        status: "PUBLISHED",
      },
    });
    await tx.courseLevel.create({
      data: { id: courseLevelId, courseId, levelNumber: 1, titleRu: "Fixture" },
    });
    await tx.courseLevelItem.createMany({
      data: items.map((item, index) => ({
        courseLevelId,
        learningItemId: item.id,
        sortOrder: index + 1,
      })),
    });
    await tx.userEnrollment.create({ data: { userId: base.userId, courseId } });
  });
  try {
    await run(fixture);
  } finally {
    await control.db.$transaction([
      control.db.learningItem.deleteMany({
        where: { id: { in: [...items.map((item) => item.id), ...fixture.extraItemIds] } },
      }),
      control.db.course.deleteMany({ where: { id: courseId } }),
      control.db.word.deleteMany({ where: { id: { in: items.map((item) => item.targetId) } } }),
      control.db.sentence.deleteMany({ where: { id: { in: sentenceIds } } }),
      control.db.importRun.deleteMany({ where: { dataSourceId } }),
      control.db.dataSource.deleteMany({ where: { id: dataSourceId } }),
      control.db.license.deleteMany({ where: { id: { in: fixture.licenseIds } } }),
    ]);
  }
}

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
