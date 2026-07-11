import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import { type KanaProgressRecord, type RecordKanaAttemptInput } from "./kana.types";

export abstract class KanaRepository {
  abstract listProgress(
    userId: string,
    script: KanaProgressRecord["script"],
  ): Promise<readonly KanaProgressRecord[]>;
  abstract recordAttempt(input: RecordKanaAttemptInput): Promise<KanaProgressRecord>;
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

  async recordAttempt(input: RecordKanaAttemptInput): Promise<KanaProgressRecord> {
    const row = await this.prisma.db.$transaction(async (db) => {
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
    });

    return toProgressRecord(row);
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
