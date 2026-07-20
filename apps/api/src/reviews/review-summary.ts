import {
  type ReviewSessionSummaryDto,
  type ReviewSrsTransition,
} from "@kanji-srs/shared";
import { type ReviewResult } from "@kanji-srs/srs";

export type ReviewSummaryAnswer = {
  readonly result: ReviewResult;
  readonly srsTransition: ReviewSrsTransition;
};

export function buildReviewSessionSummary(input: {
  readonly answers: readonly ReviewSummaryAnswer[];
  readonly startedAt: Date;
  readonly finishedAt: Date;
}): ReviewSessionSummaryDto {
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let ignoredAnswers = 0;
  let advanced = 0;
  let unchanged = 0;
  let demoted = 0;
  let burned = 0;

  for (const answer of input.answers) {
    switch (answer.result) {
      case "correct":
      case "typo":
        correctAnswers += 1;
        break;
      case "wrong":
      case "reveal":
        incorrectAnswers += 1;
        break;
      default:
        ignoredAnswers += 1;
        break;
    }

    switch (answer.srsTransition) {
      case "advanced":
        advanced += 1;
        break;
      case "demoted":
        demoted += 1;
        break;
      case "burned":
        burned += 1;
        break;
      default:
        unchanged += 1;
        break;
    }
  }

  const gradedAnswers = correctAnswers + incorrectAnswers;

  return {
    totalAnswers: input.answers.length,
    correctAnswers,
    incorrectAnswers,
    ignoredAnswers,
    accuracyPercent:
      gradedAnswers === 0 ? null : Math.round((correctAnswers / gradedAnswers) * 100),
    advanced,
    unchanged,
    demoted,
    burned,
    durationSeconds: Math.max(
      0,
      Math.floor((input.finishedAt.getTime() - input.startedAt.getTime()) / 1_000),
    ),
  };
}
