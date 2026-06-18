import { Inject, Injectable } from "@nestjs/common";

import { type Prisma } from "@kanji-srs/db";
import { type ContentLocale } from "@kanji-srs/shared";

import { PrismaService } from "../database/prisma.service";
import {
  type RecordReviewAnswerInput,
  type ReviewAnswerRecord,
  type ReviewAnswerTargetRecord,
  type ReviewBlockedAnswerRecord,
  type ReviewCardRecord,
  type ReviewQueueRecord,
  type ReviewSessionRecord,
  type ReviewSrsStateRecord,
  type ReviewTargetRecord,
} from "./reviews.types";

export abstract class ReviewsRepository {
  abstract listDueReviewCards(
    userId: string,
    now: Date,
    limit: number,
  ): Promise<readonly ReviewQueueRecord[]>;
  abstract createReviewSession(userId: string, now: Date): Promise<ReviewSessionRecord>;
  abstract findAnswerTarget(
    userId: string,
    sessionId: string,
    cardId: string,
  ): Promise<ReviewAnswerTargetRecord | null>;
  abstract recordReviewAnswer(input: RecordReviewAnswerInput): Promise<void>;
  abstract finishReviewSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<ReviewSessionRecord | null>;
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

    return {
      ...(await this.toQueueRecord(state)),
      session: toSessionRecord(session),
    };
  }

  async recordReviewAnswer(input: RecordReviewAnswerInput): Promise<void> {
    await this.prisma.db.$transaction([
      this.prisma.db.userSrsState.update({
        where: { id: input.stateId },
        data: {
          stageIndex: input.nextState.stageIndex,
          availableAt: input.nextState.availableAt,
          burnedAt: input.nextState.burnedAt,
          resurrectedAt: input.nextState.resurrectedAt,
          wrongCount: input.nextState.wrongCount,
          correctStreak: input.nextState.correctStreak,
          lastReviewedAt: input.nextState.lastReviewedAt,
        },
      }),
      this.prisma.db.reviewAnswer.create({
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
      }),
    ]);
  }

  async finishReviewSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<ReviewSessionRecord | null> {
    const result = await this.prisma.db.reviewSession.updateMany({
      where: {
        id: sessionId,
        userId,
        finishedAt: null,
      },
      data: {
        finishedAt: now,
      },
    });

    if (result.count === 0) {
      return null;
    }

    const session = (await this.prisma.db.reviewSession.findUnique({
      where: { id: sessionId },
    })) as ReviewSessionRow | null;

    return session === null ? null : toSessionRecord(session);
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

function formatJlptLevel(value: number | null): string | null {
  return value === null ? null : `N${value}`;
}
