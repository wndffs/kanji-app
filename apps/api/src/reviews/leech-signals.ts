import { type Prisma } from "@kanji-srs/db";

export const LEECH_RECENT_REVIEW_DAYS = 14;

export type LeechReviewAnswerRow = {
  readonly result: string;
  readonly previousStageIndex: number | null;
  readonly nextStageIndex: number | null;
};

export function leechStateWhere(userId: string, since: Date): Prisma.UserSrsStateWhereInput {
  return {
    userId,
    burnedAt: null,
    OR: [
      { wrongCount: { gt: 0 } },
      { reviewAnswers: { some: { answeredAt: { gte: since }, result: { not: "RESURRECT" } } } },
    ],
  };
}

export function leechRecentReviewSelect(since: Date) {
  return {
    where: { answeredAt: { gte: since }, result: { not: "RESURRECT" } },
    select: { result: true, previousStageIndex: true, nextStageIndex: true },
  } as const;
}

export function summarizeLeechReviews(answers: readonly LeechReviewAnswerRow[]) {
  let recentWrongCount = 0;
  let stageDropCount = 0;
  let stageDropMagnitude = 0;
  for (const { result, previousStageIndex, nextStageIndex } of answers) {
    if (result === "RESURRECT") continue;
    if (result === "WRONG" || result === "REVEAL") recentWrongCount += 1;
    if (
      previousStageIndex !== null &&
      nextStageIndex !== null &&
      previousStageIndex > nextStageIndex
    ) {
      stageDropCount += 1;
      stageDropMagnitude += previousStageIndex - nextStageIndex;
    }
  }
  return { recentWrongCount, stageDropCount, stageDropMagnitude };
}
