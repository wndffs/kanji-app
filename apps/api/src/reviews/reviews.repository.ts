import { Inject, Injectable } from "@nestjs/common";

import { parseCourseLevelPassPolicy, type Prisma, type CourseLevelPassPolicy } from "@kanji-srs/db";
import {
  type ContentLocale,
  type PracticeSource,
  type ReviewSrsTransition,
} from "@kanji-srs/shared";
import { type ReviewResult as SrsReviewResult } from "@kanji-srs/srs";

import { PrismaService } from "../database/prisma.service";
import { buildReviewSessionSummary } from "./review-summary";
import {
  type CreatePracticeSessionInput,
  type FinishedReviewSessionRecord,
  type PracticeSessionRecord,
  type RecordReviewAnswerInput,
  type ReviewAnswerRecord,
  type ReviewAnswerTargetRecord,
  type ReviewBlockedAnswerRecord,
  type ReviewCardRecord,
  type ReviewQueueRecord,
  type ReviewSessionRecord,
  type ReviewSrsStateRecord,
  type ReviewTargetRecord,
  type UpdatePracticeSessionProgressInput,
} from "./reviews.types";

export abstract class ReviewsRepository {
  abstract listDueReviewCards(
    userId: string,
    now: Date,
    limit: number,
  ): Promise<readonly ReviewQueueRecord[]>;
  abstract listPracticeCards(
    userId: string,
    source: PracticeSource,
    since: Date,
    limit: number,
  ): Promise<readonly ReviewQueueRecord[]>;
  abstract listPracticeCardsByIds(
    userId: string,
    cardIds: readonly string[],
  ): Promise<readonly ReviewQueueRecord[]>;
  abstract findPracticeCard(userId: string, cardId: string): Promise<ReviewQueueRecord | null>;
  abstract findActivePracticeSession(
    userId: string,
    source: PracticeSource,
  ): Promise<PracticeSessionRecord | null>;
  abstract findPracticeSession(
    userId: string,
    sessionId: string,
  ): Promise<PracticeSessionRecord | null>;
  abstract createPracticeSession(input: CreatePracticeSessionInput): Promise<PracticeSessionRecord>;
  abstract updatePracticeSessionProgress(
    input: UpdatePracticeSessionProgressInput,
  ): Promise<PracticeSessionRecord | null>;
  abstract finishPracticeSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<PracticeSessionRecord | null>;
  abstract createReviewSession(userId: string, now: Date): Promise<ReviewSessionRecord>;
  abstract findAnswerTarget(
    userId: string,
    sessionId: string,
    cardId: string,
    now: Date,
  ): Promise<ReviewAnswerTargetRecord | null>;
  abstract recordReviewAnswer(input: RecordReviewAnswerInput): Promise<void>;
  abstract finishReviewSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<FinishedReviewSessionRecord | null>;
}

type UserSrsStateRow = {
  readonly id: string;
  readonly userId: string;
  readonly learningCardId: string;
  readonly srsSystemId: string;
  readonly stageIndex: number;
  readonly availableAt: Date | null;
  readonly burnedAt: Date | null;
  readonly resurrectedAt: Date | null;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly lastReviewedAt: Date | null;
  readonly createdAt: Date;
  readonly srsSystem: {
    readonly stages: readonly SrsStageRow[];
  };
  readonly learningCard: LearningCardRow;
};

type SrsStageRow = {
  readonly stageIndex: number;
  readonly name: string;
  readonly intervalMinutes: number | null;
  readonly isBurned: boolean;
};

type LearningCardRow = {
  readonly id: string;
  readonly learningItemId: string;
  readonly cardType: string;
  readonly promptType: string;
  readonly answerType: string;
  readonly sortOrder: number;
  readonly learningItem: LearningItemRow;
  readonly answers: readonly LearningAnswerRow[];
  readonly blockedAnswers: readonly BlockedAnswerRow[];
};

type LearningItemRow = {
  readonly id: string;
  readonly kind: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly levelHint: number | null;
};

type LearningAnswerRow = {
  readonly text: string;
  readonly normalizedText: string;
  readonly answerKind: string;
  readonly locale: string;
  readonly isPrimary: boolean;
};

type BlockedAnswerRow = {
  readonly text: string;
  readonly normalizedText: string;
  readonly reason: string | null;
};

type ReviewSessionRow = {
  readonly id: string;
  readonly userId: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly mode: string;
  readonly statsJson: unknown;
};

type ReviewAnswerWithStateRow = {
  readonly userSrsState: UserSrsStateRow;
};

type ReviewAnswerSummaryRow = {
  readonly result: string;
  readonly previousStageIndex: number | null;
  readonly nextStageIndex: number | null;
  readonly detailsJson: unknown;
};

type ComponentTargetRow = {
  readonly symbol: string;
};

type KanjiTargetRow = {
  readonly character: string;
  readonly jlptLevel: number | null;
  readonly readings: readonly {
    readonly reading: string;
    readonly priority: number;
  }[];
};

type WordTargetRow = {
  readonly expression: string;
  readonly reading: string;
  readonly jlptLevel: number | null;
};

type SentenceTargetRow = {
  readonly japaneseText: string;
  readonly readingText: string | null;
};

@Injectable()
export class PrismaReviewsRepository extends ReviewsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listDueReviewCards(
    userId: string,
    now: Date,
    limit: number,
  ): Promise<readonly ReviewQueueRecord[]> {
    if (limit <= 0) {
      return [];
    }

    const states = (await this.prisma.db.userSrsState.findMany({
      where: {
        userId,
        burnedAt: null,
        availableAt: {
          lte: now,
        },
      },
      include: stateInclude,
      orderBy: [{ availableAt: "asc" }, { id: "asc" }],
      take: limit,
    })) as readonly UserSrsStateRow[];

    return Promise.all(states.map((state) => this.toQueueRecord(state)));
  }

  async listPracticeCards(
    userId: string,
    source: PracticeSource,
    since: Date,
    limit: number,
  ): Promise<readonly ReviewQueueRecord[]> {
    if (limit <= 0) {
      return [];
    }

    if (source === "recent-mistakes") {
      const attempts = (await this.prisma.db.reviewAnswer.findMany({
        where: {
          userSrsState: { userId },
          answeredAt: { gte: since },
          result: { in: ["WRONG", "REVEAL"] },
        },
        include: {
          userSrsState: { include: stateInclude },
        },
        distinct: ["learningCardId"],
        orderBy: [{ answeredAt: "desc" }, { id: "asc" }],
        take: limit,
      })) as readonly ReviewAnswerWithStateRow[];

      return Promise.all(attempts.map((attempt) => this.toQueueRecord(attempt.userSrsState)));
    }

    const states = (await this.prisma.db.userSrsState.findMany({
      where:
        source === "recent-lessons"
          ? { userId, createdAt: { gte: since } }
          : { userId, burnedAt: { not: null } },
      include: stateInclude,
      orderBy:
        source === "recent-lessons"
          ? [{ createdAt: "desc" }, { id: "asc" }]
          : [{ burnedAt: "desc" }, { id: "asc" }],
      take: limit,
    })) as readonly UserSrsStateRow[];

    return Promise.all(states.map((state) => this.toQueueRecord(state)));
  }

  async findPracticeCard(userId: string, cardId: string): Promise<ReviewQueueRecord | null> {
    const state = (await this.prisma.db.userSrsState.findUnique({
      where: {
        userId_learningCardId: {
          userId,
          learningCardId: cardId,
        },
      },
      include: stateInclude,
    })) as UserSrsStateRow | null;

    return state === null ? null : this.toQueueRecord(state);
  }

  async listPracticeCardsByIds(
    userId: string,
    cardIds: readonly string[],
  ): Promise<readonly ReviewQueueRecord[]> {
    if (cardIds.length === 0) {
      return [];
    }

    const states = (await this.prisma.db.userSrsState.findMany({
      where: {
        userId,
        learningCardId: { in: [...cardIds] },
      },
      include: stateInclude,
    })) as readonly UserSrsStateRow[];
    const stateByCardId = new Map(states.map((state) => [state.learningCardId, state]));
    const orderedStates = cardIds.flatMap((cardId) => {
      const state = stateByCardId.get(cardId);
      return state === undefined ? [] : [state];
    });

    return Promise.all(orderedStates.map((state) => this.toQueueRecord(state)));
  }

  async findActivePracticeSession(
    userId: string,
    source: PracticeSource,
  ): Promise<PracticeSessionRecord | null> {
    const rows = (await this.prisma.db.reviewSession.findMany({
      where: {
        userId,
        mode: "EXTRA_PRACTICE",
        finishedAt: null,
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: 10,
    })) as readonly ReviewSessionRow[];

    for (const row of rows) {
      const session = toPracticeSessionRecord(row);

      if (session?.source === source) {
        return session;
      }
    }

    return null;
  }

  async findPracticeSession(
    userId: string,
    sessionId: string,
  ): Promise<PracticeSessionRecord | null> {
    const row = (await this.prisma.db.reviewSession.findFirst({
      where: {
        id: sessionId,
        userId,
        mode: "EXTRA_PRACTICE",
        finishedAt: null,
      },
    })) as ReviewSessionRow | null;

    return row === null ? null : toPracticeSessionRecord(row);
  }

  async createPracticeSession(input: CreatePracticeSessionInput): Promise<PracticeSessionRecord> {
    const session = (await this.prisma.db.reviewSession.create({
      data: {
        userId: input.userId,
        startedAt: input.now,
        mode: "EXTRA_PRACTICE",
        statsJson: toPracticeSessionStats({
          source: input.source,
          cardIds: input.cardIds,
          currentIndex: 0,
          progress: { answered: 0, accepted: 0, missed: 0 },
        }),
      },
    })) as ReviewSessionRow;
    const record = toPracticeSessionRecord(session);

    if (record === null) {
      throw new Error("Created practice session has invalid stats.");
    }

    return record;
  }

  async updatePracticeSessionProgress(
    input: UpdatePracticeSessionProgressInput,
  ): Promise<PracticeSessionRecord | null> {
    const row = (await this.prisma.db.reviewSession.findFirst({
      where: {
        id: input.sessionId,
        userId: input.userId,
        mode: "EXTRA_PRACTICE",
        finishedAt: null,
      },
    })) as ReviewSessionRow | null;
    const active = row === null ? null : toPracticeSessionRecord(row);

    if (active === null) {
      return null;
    }

    const previousStats = toPracticeSessionStats(active);
    const nextStats = toPracticeSessionStats({
      ...active,
      currentIndex: input.currentIndex,
      progress: input.progress,
    });
    const updated = await this.prisma.db.reviewSession.updateMany({
      where: {
        id: input.sessionId,
        userId: input.userId,
        mode: "EXTRA_PRACTICE",
        finishedAt: null,
        statsJson: { equals: previousStats },
      },
      data: { statsJson: nextStats },
    });

    if (updated.count === 0) {
      return null;
    }

    return {
      ...active,
      currentIndex: input.currentIndex,
      progress: input.progress,
    };
  }

  async finishPracticeSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<PracticeSessionRecord | null> {
    const row = (await this.prisma.db.reviewSession.findFirst({
      where: {
        id: sessionId,
        userId,
        mode: "EXTRA_PRACTICE",
        finishedAt: null,
      },
    })) as ReviewSessionRow | null;
    const active = row === null ? null : toPracticeSessionRecord(row);

    if (active === null || active.currentIndex < active.cardIds.length) {
      return null;
    }

    const updated = await this.prisma.db.reviewSession.updateMany({
      where: {
        id: sessionId,
        userId,
        mode: "EXTRA_PRACTICE",
        finishedAt: null,
        statsJson: { equals: toPracticeSessionStats(active) },
      },
      data: {
        finishedAt: now,
        statsJson: toPracticeSessionStats(active, "completed"),
      },
    });

    return updated.count === 0 ? null : { ...active, finishedAt: now };
  }

  async createReviewSession(userId: string, now: Date): Promise<ReviewSessionRecord> {
    const session = (await this.prisma.db.reviewSession.create({
      data: {
        userId,
        startedAt: now,
        mode: "REVIEW",
      },
    })) as ReviewSessionRow;

    return toSessionRecord(session);
  }

  async findAnswerTarget(
    userId: string,
    sessionId: string,
    cardId: string,
    now: Date,
  ): Promise<ReviewAnswerTargetRecord | null> {
    const session = (await this.prisma.db.reviewSession.findFirst({
      where: {
        id: sessionId,
        userId,
        finishedAt: null,
      },
    })) as ReviewSessionRow | null;

    if (session === null) {
      return null;
    }

    const state = (await this.prisma.db.userSrsState.findUnique({
      where: {
        userId_learningCardId: {
          userId,
          learningCardId: cardId,
        },
      },
      include: stateInclude,
    })) as UserSrsStateRow | null;

    if (state === null) {
      return null;
    }

    if (
      state.burnedAt !== null ||
      state.availableAt === null ||
      state.availableAt.getTime() > now.getTime()
    ) {
      return null;
    }

    const existingAnswer = await this.prisma.db.reviewAnswer.findFirst({
      where: {
        reviewSessionId: session.id,
        userSrsStateId: state.id,
        learningCardId: cardId,
      },
      select: { id: true },
    });

    if (existingAnswer !== null) {
      return null;
    }

    return {
      ...(await this.toQueueRecord(state)),
      session: toSessionRecord(session),
    };
  }

  async recordReviewAnswer(input: RecordReviewAnswerInput): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      const session = await tx.reviewSession.findFirst({
        where: {
          id: input.sessionId,
          userId: input.userId,
          finishedAt: null,
        },
        select: { id: true },
      });

      if (session === null) {
        throw new Error("Review session ownership check failed.");
      }

      const existingAnswer = await tx.reviewAnswer.findFirst({
        where: {
          reviewSessionId: input.sessionId,
          userSrsStateId: input.stateId,
          learningCardId: input.cardId,
        },
        select: { id: true },
      });

      if (existingAnswer !== null) {
        throw new Error("Review answer has already been recorded for this session card.");
      }

      const updated = await tx.userSrsState.updateMany({
        where: {
          id: input.stateId,
          userId: input.userId,
          learningCardId: input.cardId,
        },
        data: {
          stageIndex: input.nextState.stageIndex,
          availableAt: input.nextState.availableAt,
          burnedAt: input.nextState.burnedAt,
          resurrectedAt: input.nextState.resurrectedAt,
          wrongCount: input.nextState.wrongCount,
          correctStreak: input.nextState.correctStreak,
          lastReviewedAt: input.nextState.lastReviewedAt,
        },
      });

      if (updated.count === 0) {
        throw new Error("Review SRS state ownership check failed.");
      }

      await tx.reviewAnswer.create({
        data: {
          reviewSessionId: input.sessionId,
          userSrsStateId: input.stateId,
          learningCardId: input.cardId,
          answerText: input.answerText,
          normalizedAnswer: input.normalizedAnswer,
          result: toPrismaReviewResult(input.recordedResult),
          previousStageIndex: input.previousStageIndex,
          nextStageIndex: input.nextStageIndex,
          answeredAt: input.answeredAt,
          detailsJson: input.details as Prisma.InputJsonObject,
        },
      });

      await recordCourseProgressEvents(tx, input);
    });
  }

  async finishReviewSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<FinishedReviewSessionRecord | null> {
    return this.prisma.db.$transaction(async (tx) => {
      const session = (await tx.reviewSession.findFirst({
        where: {
          id: sessionId,
          userId,
          finishedAt: null,
        },
      })) as ReviewSessionRow | null;

      if (session === null) {
        return null;
      }

      const answers = (await tx.reviewAnswer.findMany({
        where: { reviewSessionId: sessionId },
        select: {
          result: true,
          previousStageIndex: true,
          nextStageIndex: true,
          detailsJson: true,
        },
        orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
      })) as readonly ReviewAnswerSummaryRow[];
      const summary = buildReviewSessionSummary({
        answers: answers.map((answer) => ({
          result: toSrsReviewResult(answer.result),
          srsTransition: toPersistedSrsTransition(answer),
        })),
        startedAt: session.startedAt,
        finishedAt: now,
      });
      const result = await tx.reviewSession.updateMany({
        where: {
          id: sessionId,
          userId,
          finishedAt: null,
        },
        data: {
          finishedAt: now,
          statsJson: { ...summary } as Prisma.InputJsonObject,
        },
      });

      if (result.count === 0) {
        return null;
      }

      return {
        session: toSessionRecord({ ...session, finishedAt: now }),
        summary,
      };
    });
  }

  private async toQueueRecord(state: UserSrsStateRow): Promise<ReviewQueueRecord> {
    const target = await this.findTarget(state.learningCard.learningItem);

    return {
      state: toSrsStateRecord(state),
      card: toCardRecord(state.learningCard, target),
      stages: state.srsSystem.stages.map((stage) => ({
        stageIndex: stage.stageIndex,
        name: stage.name,
        intervalMinutes: stage.intervalMinutes,
        isBurned: stage.isBurned,
      })),
    };
  }

  private async findTarget(item: LearningItemRow): Promise<ReviewTargetRecord> {
    switch (item.targetType) {
      case "COMPONENT":
        return this.findComponentTarget(item);
      case "KANJI":
        return this.findKanjiTarget(item);
      case "WORD":
        return this.findWordTarget(item);
      case "SENTENCE":
        return this.findSentenceTarget(item);
      default:
        throw new Error(`Unsupported learning item target type: ${item.targetType}`);
    }
  }

  private async findComponentTarget(item: LearningItemRow): Promise<ReviewTargetRecord> {
    const component = (await this.prisma.db.component.findUnique({
      where: { id: item.targetId },
      select: { symbol: true },
    })) as ComponentTargetRow | null;

    if (component === null) {
      throw new Error(`Missing component target ${item.targetId}.`);
    }

    return {
      id: item.id,
      itemType: toItemKind(item.kind),
      japanese: component.symbol,
      reading: null,
      level: item.levelHint,
      jlptLevel: null,
    };
  }

  private async findKanjiTarget(item: LearningItemRow): Promise<ReviewTargetRecord> {
    const kanji = (await this.prisma.db.kanji.findUnique({
      where: { id: item.targetId },
      select: {
        character: true,
        jlptLevel: true,
        readings: {
          select: { reading: true, priority: true },
          orderBy: [{ priority: "desc" }, { reading: "asc" }],
        },
      },
    })) as KanjiTargetRow | null;

    if (kanji === null) {
      throw new Error(`Missing kanji target ${item.targetId}.`);
    }

    return {
      id: item.id,
      itemType: toItemKind(item.kind),
      japanese: kanji.character,
      reading: kanji.readings[0]?.reading ?? null,
      level: item.levelHint,
      jlptLevel: formatJlptLevel(kanji.jlptLevel),
    };
  }

  private async findWordTarget(item: LearningItemRow): Promise<ReviewTargetRecord> {
    const word = (await this.prisma.db.word.findUnique({
      where: { id: item.targetId },
      select: {
        expression: true,
        reading: true,
        jlptLevel: true,
      },
    })) as WordTargetRow | null;

    if (word === null) {
      throw new Error(`Missing word target ${item.targetId}.`);
    }

    return {
      id: item.id,
      itemType: toItemKind(item.kind),
      japanese: word.expression,
      reading: word.reading,
      level: item.levelHint,
      jlptLevel: formatJlptLevel(word.jlptLevel),
    };
  }

  private async findSentenceTarget(item: LearningItemRow): Promise<ReviewTargetRecord> {
    const sentence = (await this.prisma.db.sentence.findUnique({
      where: { id: item.targetId },
      select: {
        japaneseText: true,
        readingText: true,
      },
    })) as SentenceTargetRow | null;

    if (sentence === null) {
      throw new Error(`Missing sentence target ${item.targetId}.`);
    }

    return {
      id: item.id,
      itemType: toItemKind(item.kind),
      japanese: sentence.japaneseText,
      reading: sentence.readingText,
      level: item.levelHint,
      jlptLevel: null,
    };
  }
}

type ProgressCard = {
  readonly id: string;
  readonly srsStates: readonly {
    readonly stageIndex: number;
  }[];
};

type DependencyProgress = {
  readonly requiredStage: number | null;
  readonly prerequisiteItem: {
    readonly cards: readonly ProgressCard[];
  };
};

async function recordCourseProgressEvents(
  tx: Prisma.TransactionClient,
  input: RecordReviewAnswerInput,
): Promise<void> {
  if (input.nextStageIndex <= input.previousStageIndex) {
    return;
  }

  const changedCard = await tx.learningCard.findUnique({
    where: { id: input.cardId },
    select: {
      learningItemId: true,
      learningItem: { select: { kind: true } },
    },
  });

  if (changedCard === null) {
    return;
  }

  await recordNewlyUnlockedItems(tx, input, changedCard.learningItemId);
  await recordCompletedCourseLevels(
    tx,
    input,
    changedCard.learningItemId,
    changedCard.learningItem.kind,
  );
}

async function recordNewlyUnlockedItems(
  tx: Prisma.TransactionClient,
  input: RecordReviewAnswerInput,
  changedItemId: string,
): Promise<void> {
  const dependencyRows = await tx.dependency.findMany({
    where: {
      prerequisiteItemId: changedItemId,
      dependencyType: "PREREQUISITE",
      learningItem: {
        status: "PUBLISHED",
        courseLevelItems: {
          some: {
            courseLevel: {
              course: {
                status: "PUBLISHED",
                enrollments: {
                  some: {
                    userId: input.userId,
                    status: "ACTIVE",
                  },
                },
              },
            },
          },
        },
      },
    },
    select: {
      learningItem: {
        select: {
          id: true,
          cards: {
            select: {
              id: true,
              srsStates: {
                where: { userId: input.userId },
                select: { stageIndex: true },
              },
            },
          },
          dependencies: {
            where: { dependencyType: "PREREQUISITE" },
            select: {
              requiredStage: true,
              prerequisiteItem: {
                select: {
                  cards: {
                    select: {
                      id: true,
                      srsStates: {
                        where: { userId: input.userId },
                        select: { stageIndex: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ learningItemId: "asc" }, { id: "asc" }],
  });
  const newlyUnlockedIds = [
    ...new Set(
      dependencyRows.flatMap(({ learningItem }) => {
        const alreadyStarted = learningItem.cards.some((card) => card.srsStates.length > 0);
        const wasAvailable = dependenciesAreSatisfied(learningItem.dependencies, {
          cardId: input.cardId,
          stageIndex: input.previousStageIndex,
        });
        const isAvailable = dependenciesAreSatisfied(learningItem.dependencies);

        return !alreadyStarted && !wasAvailable && isAvailable ? [learningItem.id] : [];
      }),
    ),
  ];

  if (newlyUnlockedIds.length === 0) {
    return;
  }

  await tx.userUnlockEvent.createMany({
    data: newlyUnlockedIds.map((learningItemId) => ({
      userId: input.userId,
      learningItemId,
      reviewSessionId: input.sessionId,
      triggerLearningCardId: input.cardId,
      unlockedAt: input.answeredAt,
    })),
    skipDuplicates: true,
  });
}

async function recordCompletedCourseLevels(
  tx: Prisma.TransactionClient,
  input: RecordReviewAnswerInput,
  changedItemId: string,
  changedItemKind: string,
): Promise<void> {
  const levels = await tx.courseLevel.findMany({
    where: {
      items: { some: { learningItemId: changedItemId } },
      course: {
        status: "PUBLISHED",
        enrollments: {
          some: {
            userId: input.userId,
            status: "ACTIVE",
          },
        },
      },
    },
    select: {
      id: true,
      passPolicyJson: true,
      items: {
        where: { learningItem: { status: "PUBLISHED" } },
        select: {
          learningItem: {
            select: {
              kind: true,
              cards: {
                select: {
                  id: true,
                  srsStates: {
                    where: { userId: input.userId },
                    select: { stageIndex: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ courseId: "asc" }, { levelNumber: "asc" }, { id: "asc" }],
  });
  const completedLevels = levels.flatMap((level) => {
    const policy = parseCourseLevelPassPolicy(level.passPolicyJson);

    if (policy.itemKind !== changedItemKind) {
      return [];
    }

    const qualifyingItems = level.items
      .map((item) => item.learningItem)
      .filter((item) => item.kind === policy.itemKind && item.cards.length > 0);
    const requiredCount = calculateRequiredItemCount(qualifyingItems.length, policy);
    const passedCount = qualifyingItems.filter((item) =>
      itemCardsReachedStage(item.cards, policy.passStageIndex),
    ).length;

    return requiredCount > 0 && passedCount >= requiredCount
      ? [{ courseLevelId: level.id, policyVersion: policy.version }]
      : [];
  });

  if (completedLevels.length === 0) {
    return;
  }

  await tx.userCourseLevelCompletion.createMany({
    data: completedLevels.map((level) => ({
      userId: input.userId,
      courseLevelId: level.courseLevelId,
      reviewSessionId: input.sessionId,
      policyVersion: level.policyVersion,
      completedAt: input.answeredAt,
    })),
    skipDuplicates: true,
  });
}

function dependenciesAreSatisfied(
  dependencies: readonly DependencyProgress[],
  override?: { readonly cardId: string; readonly stageIndex: number },
): boolean {
  return dependencies.every((dependency) => {
    const requiredStage = dependency.requiredStage ?? 1;
    const cards = dependency.prerequisiteItem.cards;

    return (
      cards.length > 0 && cards.every((card) => readCardStage(card, override) >= requiredStage)
    );
  });
}

function itemCardsReachedStage(cards: readonly ProgressCard[], requiredStage: number): boolean {
  return cards.length > 0 && cards.every((card) => readCardStage(card) >= requiredStage);
}

function readCardStage(
  card: ProgressCard,
  override?: { readonly cardId: string; readonly stageIndex: number },
): number {
  if (override !== undefined && card.id === override.cardId) {
    return override.stageIndex;
  }

  return card.srsStates[0]?.stageIndex ?? 0;
}

function calculateRequiredItemCount(totalItems: number, policy: CourseLevelPassPolicy): number {
  return totalItems === 0 ? 0 : Math.ceil((totalItems * policy.requiredPercentage) / 100);
}

const stateInclude = {
  srsSystem: {
    include: {
      stages: {
        orderBy: { stageIndex: "asc" as const },
      },
    },
  },
  learningCard: {
    include: {
      learningItem: true,
      answers: { orderBy: [{ isPrimary: "desc" as const }, { text: "asc" as const }] },
      blockedAnswers: { orderBy: { text: "asc" as const } },
    },
  },
};

function toSrsStateRecord(row: UserSrsStateRow): ReviewSrsStateRecord {
  return {
    id: row.id,
    userId: row.userId,
    learningCardId: row.learningCardId,
    srsSystemId: row.srsSystemId,
    stageIndex: row.stageIndex,
    availableAt: row.availableAt,
    burnedAt: row.burnedAt,
    resurrectedAt: row.resurrectedAt,
    wrongCount: row.wrongCount,
    correctStreak: row.correctStreak,
    lastReviewedAt: row.lastReviewedAt,
  };
}

function toSessionRecord(row: ReviewSessionRow): ReviewSessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    mode: toSessionMode(row.mode),
  };
}

function toPracticeSessionRecord(row: ReviewSessionRow): PracticeSessionRecord | null {
  const stats = isRecord(row.statsJson) ? row.statsJson : null;
  const source = toPracticeSource(stats?.source);
  const cardIds = Array.isArray(stats?.cardIds)
    ? [...new Set(stats.cardIds.filter((value): value is string => typeof value === "string"))]
    : [];

  if (source === null || cardIds.length === 0) {
    return null;
  }

  const progress = isRecord(stats?.progress) ? stats.progress : null;

  return {
    id: row.id,
    userId: row.userId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    source,
    cardIds,
    currentIndex: Math.min(readNonNegativeInteger(stats?.currentIndex), cardIds.length),
    progress: {
      answered: readNonNegativeInteger(progress?.answered),
      accepted: readNonNegativeInteger(progress?.accepted),
      missed: readNonNegativeInteger(progress?.missed),
    },
  };
}

function toPracticeSessionStats(
  input: Pick<PracticeSessionRecord, "source" | "cardIds" | "currentIndex" | "progress">,
  outcome: "active" | "completed" = "active",
): Prisma.InputJsonObject {
  return {
    source: input.source,
    cardIds: [...input.cardIds],
    currentIndex: input.currentIndex,
    progress: {
      answered: input.progress.answered,
      accepted: input.progress.accepted,
      missed: input.progress.missed,
    },
    outcome,
  };
}

function toPracticeSource(value: unknown): PracticeSource | null {
  switch (value) {
    case "recent-lessons":
    case "recent-mistakes":
    case "burned":
      return value;
    default:
      return null;
  }
}

function readNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function toCardRecord(card: LearningCardRow, target: ReviewTargetRecord): ReviewCardRecord {
  return {
    id: card.id,
    learningItemId: card.learningItemId,
    itemType: target.itemType,
    cardType: card.cardType === "LESSON" ? "lesson" : "review",
    promptType: toPromptType(card.promptType),
    answerType: card.answerType === "READING" ? "reading" : "meaning",
    sortOrder: card.sortOrder,
    target,
    acceptedAnswers: card.answers.map(toAnswerRecord),
    blockedAnswers: card.blockedAnswers.map(toBlockedAnswerRecord),
  };
}

function toAnswerRecord(answer: LearningAnswerRow): ReviewAnswerRecord {
  return {
    locale: toContentLocale(answer.locale),
    text: answer.text,
    normalizedText: answer.normalizedText,
    answerKind: answer.answerKind === "READING" ? "reading" : "meaning",
    isPrimary: answer.isPrimary,
  };
}

function toBlockedAnswerRecord(answer: BlockedAnswerRow): ReviewBlockedAnswerRecord {
  return {
    locale: "ru-RU",
    text: answer.text,
    normalizedText: answer.normalizedText,
    reason: answer.reason,
  };
}

function toItemKind(kind: string): ReviewTargetRecord["itemType"] {
  switch (kind) {
    case "COMPONENT":
      return "component";
    case "KANJI":
      return "kanji";
    case "WORD":
      return "word";
    case "SENTENCE":
      return "sentence";
    default:
      throw new Error(`Unsupported learning item kind: ${kind}`);
  }
}

function toPromptType(value: string): ReviewCardRecord["promptType"] {
  switch (value) {
    case "READING":
      return "reading";
    case "RECALL":
      return "recall";
    case "CLOZE":
      return "cloze";
    case "RECOGNITION":
      return "recognition";
    default:
      return "meaning";
  }
}

function toContentLocale(locale: string): ContentLocale {
  return locale === "en-US" ? "en-US" : "ru-RU";
}

function toSessionMode(mode: string): ReviewSessionRecord["mode"] {
  switch (mode) {
    case "LESSON_QUIZ":
      return "lesson-quiz";
    case "EXTRA_PRACTICE":
      return "extra-practice";
    default:
      return "review";
  }
}

function toPrismaReviewResult(result: RecordReviewAnswerInput["recordedResult"]) {
  switch (result) {
    case "correct":
      return "CORRECT";
    case "typo":
      return "TYPO";
    case "reveal":
      return "REVEAL";
    case "manual-ignore":
      return "MANUAL_IGNORE";
    case "resurrect":
      return "RESURRECT";
    default:
      return "WRONG";
  }
}

function toSrsReviewResult(result: string): SrsReviewResult {
  switch (result) {
    case "CORRECT":
      return "correct";
    case "TYPO":
      return "typo";
    case "REVEAL":
      return "reveal";
    case "MANUAL_IGNORE":
      return "manual-ignore";
    case "RESURRECT":
      return "resurrect";
    default:
      return "wrong";
  }
}

function toPersistedSrsTransition(row: ReviewAnswerSummaryRow): ReviewSrsTransition {
  const scheduling = isRecord(row.detailsJson) ? row.detailsJson.scheduling : null;
  const action = isRecord(scheduling) ? scheduling.action : null;

  switch (action) {
    case "advanced":
      return "advanced";
    case "demoted":
      return "demoted";
    case "burned":
      return "burned";
  }

  if (
    row.previousStageIndex !== null &&
    row.nextStageIndex !== null &&
    row.nextStageIndex !== row.previousStageIndex
  ) {
    return row.nextStageIndex > row.previousStageIndex ? "advanced" : "demoted";
  }

  return "unchanged";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatJlptLevel(value: number | null): string | null {
  return value === null ? null : `N${value}`;
}
