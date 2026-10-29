import { Inject, Injectable } from "@nestjs/common";

import type { Prisma } from "@kanji-srs/db";
import {
  ADAPTIVE_KANA_EXERCISE_KINDS,
  type AdaptiveKanaExercise,
  type AdaptiveKanaExerciseKind,
  type AdaptiveKanaFocusReason,
  type AdaptiveKanaScriptMode,
} from "@kanji-srs/japanese";

import { PrismaService } from "../database/prisma.service";
import {
  type CreateKanaPracticeSessionInput,
  type KanaAttemptRecord,
  type KanaPracticeSessionRecord,
  KanaPracticeSessionConflictError,
  type KanaProgressRecord,
  type RecordKanaAttemptInput,
  type RecordKanaPracticeAttemptInput,
  type RecordKanaPracticeAttemptResult,
} from "./kana.types";

const KANA_ATTEMPT_RETENTION_LIMIT = 1_000;
const KANA_ATTEMPT_PRUNE_BATCH_SIZE = 100;
type PrismaKanaExerciseKind =
  | "TYPING"
  | "RECOGNITION_CHOICE"
  | "REVERSE_CHOICE"
  | "MATCHING"
  | "LISTENING_CHOICE"
  | "TRACING";

export abstract class KanaRepository {
  abstract listProgress(
    userId: string,
    script: KanaProgressRecord["script"],
  ): Promise<readonly KanaProgressRecord[]>;
  abstract listAttempts(
    userId: string,
    scripts: readonly KanaProgressRecord["script"][],
  ): Promise<readonly KanaAttemptRecord[]>;
  abstract findActivePracticeSession(
    userId: string,
    script: AdaptiveKanaScriptMode,
  ): Promise<KanaPracticeSessionRecord | null>;
  abstract findPracticeSession(
    userId: string,
    sessionId: string,
  ): Promise<KanaPracticeSessionRecord | null>;
  abstract createPracticeSession(
    input: CreateKanaPracticeSessionInput,
  ): Promise<KanaPracticeSessionRecord>;
  abstract recordAttempt(input: RecordKanaAttemptInput): Promise<KanaProgressRecord>;
  abstract recordPracticeAttempt(
    input: RecordKanaPracticeAttemptInput,
  ): Promise<RecordKanaPracticeAttemptResult>;
}

@Injectable()
export class PrismaKanaRepository extends KanaRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listProgress(
    userId: string,
    script: KanaProgressRecord["script"],
  ): Promise<readonly KanaProgressRecord[]> {
    const rows = await this.prisma.db.userKanaProgress.findMany({
      where: { userId, script: toPrismaScript(script) },
      orderBy: { character: "asc" },
    });

    return rows.map(toProgressRecord);
  }

  async listAttempts(
    userId: string,
    scripts: readonly KanaProgressRecord["script"][],
  ): Promise<readonly KanaAttemptRecord[]> {
    const rows = await this.prisma.db.kanaAttempt.findMany({
      where: {
        userId,
        script: { in: scripts.map(toPrismaScript) },
      },
      orderBy: { answeredAt: "desc" },
      take: KANA_ATTEMPT_RETENTION_LIMIT,
    });

    return rows.map(toAttemptRecord);
  }

  async findActivePracticeSession(
    userId: string,
    script: AdaptiveKanaScriptMode,
  ): Promise<KanaPracticeSessionRecord | null> {
    const row = await this.prisma.db.kanaPracticeSession.findFirst({
      where: {
        userId,
        mode: toPrismaPracticeMode(script),
        finishedAt: null,
      },
      orderBy: { startedAt: "desc" },
    });

    return row === null ? null : toPracticeSessionRecord(row);
  }

  async findPracticeSession(
    userId: string,
    sessionId: string,
  ): Promise<KanaPracticeSessionRecord | null> {
    const row = await this.prisma.db.kanaPracticeSession.findFirst({
      where: { id: sessionId, userId },
    });

    return row === null ? null : toPracticeSessionRecord(row);
  }

  async createPracticeSession(
    input: CreateKanaPracticeSessionInput,
  ): Promise<KanaPracticeSessionRecord> {
    try {
      const row = await this.prisma.db.kanaPracticeSession.create({
        data: {
          userId: input.userId,
          mode: toPrismaPracticeMode(input.script),
          queueJson: input.items as unknown as Prisma.InputJsonValue,
          startedAt: input.startedAt,
        },
      });

      return toPracticeSessionRecord(row);
    } catch (error: unknown) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      const active = await this.findActivePracticeSession(input.userId, input.script);

      if (active === null) {
        throw error;
      }

      return active;
    }
  }

  async recordAttempt(input: RecordKanaAttemptInput): Promise<KanaProgressRecord> {
    const row = await this.prisma.db.$transaction(async (db) => {
      const updated = await upsertKanaProgress(db, input);
      await db.kanaAttempt.create({
        data: toAttemptCreateData(input),
      });
      await pruneAttemptHistory(db, input.userId);
      return updated;
    });

    return toProgressRecord(row);
  }

  async recordPracticeAttempt(
    input: RecordKanaPracticeAttemptInput,
  ): Promise<RecordKanaPracticeAttemptResult> {
    return this.prisma.db.$transaction(async (db) => {
      const nextIndex = input.expectedSessionIndex + 1;
      const finishedAt = nextIndex >= input.sessionItemCount ? input.answeredAt : null;
      const advanced = await db.kanaPracticeSession.updateMany({
        where: {
          id: input.sessionId,
          userId: input.userId,
          currentIndex: input.expectedSessionIndex,
          finishedAt: null,
        },
        data: {
          currentIndex: nextIndex,
          ...(finishedAt === null ? {} : { finishedAt }),
        },
      });

      if (advanced.count !== 1) {
        throw new KanaPracticeSessionConflictError();
      }

      await db.kanaAttempt.create({
        data: {
          ...toAttemptCreateData(input),
          practiceSessionId: input.sessionId,
        },
      });
      await pruneAttemptHistory(db, input.userId);
      const session = await db.kanaPracticeSession.findUniqueOrThrow({
        where: { id: input.sessionId },
      });

      return {
        session: toPracticeSessionRecord(session),
      };
    });
  }
}

function toPrismaScript(script: KanaProgressRecord["script"]): "HIRAGANA" | "KATAKANA" {
  return script === "hiragana" ? "HIRAGANA" : "KATAKANA";
}

function toProgressRecord(row: {
  readonly character: string;
  readonly script: string;
  readonly attemptCount: number;
  readonly correctCount: number;
  readonly currentStreak: number;
  readonly masteredAt: Date | null;
  readonly lastAnsweredAt: Date | null;
}): KanaProgressRecord {
  return {
    character: row.character,
    script: row.script === "HIRAGANA" ? "hiragana" : "katakana",
    attemptCount: row.attemptCount,
    correctCount: row.correctCount,
    currentStreak: row.currentStreak,
    masteredAt: row.masteredAt,
    lastAnsweredAt: row.lastAnsweredAt,
  };
}

async function upsertKanaProgress(db: Prisma.TransactionClient, input: RecordKanaAttemptInput) {
  const existing = await db.userKanaProgress.findUnique({
    where: {
      userId_character: {
        userId: input.userId,
        character: input.character,
      },
    },
  });
  const currentStreak = input.correct ? (existing?.currentStreak ?? 0) + 1 : 0;
  const masteredAt =
    existing?.masteredAt ?? (currentStreak >= input.masteryThreshold ? input.answeredAt : null);

  return db.userKanaProgress.upsert({
    where: {
      userId_character: {
        userId: input.userId,
        character: input.character,
      },
    },
    update: {
      script: toPrismaScript(input.script),
      attemptCount: { increment: 1 },
      ...(input.correct ? { correctCount: { increment: 1 } } : {}),
      currentStreak,
      masteredAt,
      lastAnsweredAt: input.answeredAt,
    },
    create: {
      userId: input.userId,
      character: input.character,
      script: toPrismaScript(input.script),
      attemptCount: 1,
      correctCount: input.correct ? 1 : 0,
      currentStreak,
      masteredAt,
      lastAnsweredAt: input.answeredAt,
    },
  });
}

function toAttemptCreateData(input: RecordKanaAttemptInput) {
  return {
    userId: input.userId,
    expectedCharacter: input.character,
    script: toPrismaScript(input.script),
    submittedAnswer: input.submittedAnswer,
    selectedCharacter: input.selectedCharacter,
    exerciseKind: toPrismaExerciseKind(input.exerciseKind),
    correct: input.correct,
    answeredAt: input.answeredAt,
  };
}

async function pruneAttemptHistory(db: Prisma.TransactionClient, userId: string): Promise<void> {
  const stale = await db.kanaAttempt.findMany({
    where: { userId },
    orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
    skip: KANA_ATTEMPT_RETENTION_LIMIT,
    take: KANA_ATTEMPT_PRUNE_BATCH_SIZE,
    select: { id: true },
  });

  if (stale.length > 0) {
    await db.kanaAttempt.deleteMany({
      where: { id: { in: stale.map((attempt) => attempt.id) } },
    });
  }
}

function toAttemptRecord(row: {
  readonly id: string;
  readonly expectedCharacter: string;
  readonly script: string;
  readonly submittedAnswer: string | null;
  readonly selectedCharacter: string | null;
  readonly exerciseKind: string;
  readonly correct: boolean;
  readonly answeredAt: Date;
}): KanaAttemptRecord {
  return {
    id: row.id,
    expectedCharacter: row.expectedCharacter,
    script: row.script === "HIRAGANA" ? "hiragana" : "katakana",
    submittedAnswer: row.submittedAnswer,
    selectedCharacter: row.selectedCharacter,
    exerciseKind: fromPrismaExerciseKind(row.exerciseKind),
    correct: row.correct,
    answeredAt: row.answeredAt,
  };
}

function toPracticeSessionRecord(row: {
  readonly id: string;
  readonly userId: string;
  readonly mode: string;
  readonly queueJson: unknown;
  readonly currentIndex: number;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
}): KanaPracticeSessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    script: fromPrismaPracticeMode(row.mode),
    items: parsePracticeQueue(row.queueJson),
    currentIndex: row.currentIndex,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

function parsePracticeQueue(value: unknown): readonly AdaptiveKanaExercise[] {
  if (!Array.isArray(value) || !value.every(isAdaptiveKanaExercise)) {
    throw new Error("Stored kana practice queue is invalid.");
  }

  return value;
}

function isAdaptiveKanaExercise(value: unknown): value is AdaptiveKanaExercise {
  if (!isRecord(value) || !Array.isArray(value.choices)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.character === "string" &&
    (value.script === "hiragana" || value.script === "katakana") &&
    typeof value.romaji === "string" &&
    ADAPTIVE_KANA_EXERCISE_KINDS.includes(value.exerciseKind as AdaptiveKanaExerciseKind) &&
    isFocusReason(value.focusReason) &&
    value.choices.every(
      (choice) =>
        isRecord(choice) &&
        typeof choice.character === "string" &&
        (choice.script === "hiragana" || choice.script === "katakana") &&
        typeof choice.romaji === "string",
    )
  );
}

function isFocusReason(value: unknown): value is AdaptiveKanaFocusReason {
  return value === "weak" || value === "overdue" || value === "new" || value === "review";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrismaUniqueConstraintError(value: unknown): value is { readonly code: "P2002" } {
  return isRecord(value) && value.code === "P2002";
}

function toPrismaPracticeMode(script: AdaptiveKanaScriptMode): "HIRAGANA" | "KATAKANA" | "MIXED" {
  return script === "hiragana" ? "HIRAGANA" : script === "katakana" ? "KATAKANA" : "MIXED";
}

function fromPrismaPracticeMode(mode: string): AdaptiveKanaScriptMode {
  return mode === "HIRAGANA" ? "hiragana" : mode === "KATAKANA" ? "katakana" : "mixed";
}

function toPrismaExerciseKind(kind: AdaptiveKanaExerciseKind): PrismaKanaExerciseKind {
  return kind.replaceAll("-", "_").toUpperCase() as PrismaKanaExerciseKind;
}

function fromPrismaExerciseKind(kind: string): AdaptiveKanaExerciseKind {
  return kind.toLocaleLowerCase("en-US").replaceAll("_", "-") as AdaptiveKanaExerciseKind;
}
