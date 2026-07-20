import { describe, expect, it } from "vitest";

import { type DashboardNewLearnerGuideDto } from "@kanji-srs/shared";

import { resolveNewLearnerGuideState } from "../src/lib/new-learner-guide";

describe("resolveNewLearnerGuideState", () => {
  it("guides a learner from hiragana through lessons and the first review", () => {
    expect(resolveNewLearnerGuideState(createGuide(), 0)).toEqual({
      visible: true,
      kana: "current",
      lesson: "upcoming",
      review: "upcoming",
    });

    expect(
      resolveNewLearnerGuideState(
        createGuide({
          hiraganaMastered: 46,
        }),
        0,
      ),
    ).toEqual({
      visible: true,
      kana: "complete",
      lesson: "current",
      review: "upcoming",
    });

    expect(
      resolveNewLearnerGuideState(
        createGuide({
          firstLessonCompleted: true,
        }),
        0,
      ),
    ).toEqual({
      visible: true,
      kana: "parallel",
      lesson: "complete",
      review: "waiting",
    });

    expect(
      resolveNewLearnerGuideState(
        createGuide({
          firstLessonCompleted: true,
        }),
        2,
      ),
    ).toEqual({
      visible: true,
      kana: "parallel",
      lesson: "complete",
      review: "current",
    });

    expect(
      resolveNewLearnerGuideState(
        createGuide({
          firstLessonCompleted: true,
          firstReviewCompleted: true,
        }),
        0,
      ).visible,
    ).toBe(false);
  });
});

function createGuide({
  firstLessonCompleted = false,
  firstReviewCompleted = false,
  hiraganaMastered = 0,
}: {
  readonly firstLessonCompleted?: boolean;
  readonly firstReviewCompleted?: boolean;
  readonly hiraganaMastered?: number;
} = {}): DashboardNewLearnerGuideDto {
  return {
    kana: {
      hiragana: { masteredCount: hiraganaMastered, totalCount: 46 },
      katakana: { masteredCount: 0, totalCount: 46 },
    },
    firstLessonCompleted,
    firstReviewCompleted,
  };
}
