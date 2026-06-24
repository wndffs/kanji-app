import {
  type CardAnswerType,
  type CardPromptType,
  type ItemKind,
  type LocalizedTextDto,
  type ReviewAnswerResponse,
  type ReviewAnswerResultType,
  type ReviewQueueItem,
} from "@kanji-srs/shared";

import { type ReviewResult as SrsReviewResult, type SrsStage } from "@kanji-srs/srs";

export type ReviewSessionRecord = {
  readonly id: string;
  readonly userId: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly mode: "review" | "lesson-quiz" | "extra-practice";
};

export type ReviewSrsStateRecord = {
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
};

export type ReviewTargetRecord = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly japanese: string;
  readonly reading: string | null;
  readonly level: number | null;
  readonly jlptLevel: string | null;
};

export type ReviewAnswerRecord = LocalizedTextDto & {
  readonly normalizedText: string;
  readonly answerKind: CardAnswerType;
};

export type ReviewBlockedAnswerRecord = LocalizedTextDto & {
  readonly normalizedText: string;
  readonly reason: string | null;
};

export type ReviewCardRecord = {
  readonly id: string;
  readonly learningItemId: string;
  readonly itemType: ItemKind;
  readonly cardType: "lesson" | "review";
  readonly promptType: CardPromptType;
  readonly answerType: CardAnswerType;
  readonly sortOrder: number;
  readonly target: ReviewTargetRecord;
  readonly acceptedAnswers: readonly ReviewAnswerRecord[];
  readonly blockedAnswers: readonly ReviewBlockedAnswerRecord[];
};

export type ReviewQueueRecord = {
  readonly state: ReviewSrsStateRecord;
  readonly card: ReviewCardRecord;
  readonly stages: readonly SrsStage[];
};

export type ReviewAnswerTargetRecord = ReviewQueueRecord & {
  readonly session: ReviewSessionRecord;
};

export type ParsedReviewAnswerRequest = {
  readonly cardId: string;
  readonly answer: string;
  readonly answerType: CardAnswerType;
  readonly revealRequested: boolean;
  readonly manualIgnore: boolean;
};

export type RecordReviewAnswerInput = {
  readonly userId: string;
  readonly sessionId: string;
  readonly stateId: string;
  readonly cardId: string;
  readonly answerText: string;
  readonly normalizedAnswer: string;
  readonly answeredAt: Date;
  readonly recordedResult: SrsReviewResult;
  readonly responseResult: ReviewAnswerResultType;
  readonly previousStageIndex: number;
  readonly nextStageIndex: number;
  readonly nextState: {
    readonly stageIndex: number;
    readonly availableAt: Date | null;
    readonly burnedAt: Date | null;
    readonly resurrectedAt: Date | null;
    readonly wrongCount: number;
    readonly correctStreak: number;
    readonly lastReviewedAt: Date | null;
  };
  readonly details: Record<string, unknown>;
};

export type ReviewQueueResponse = {
  readonly items: readonly ReviewQueueItem[];
};

export type StartReviewSessionResponse = {
  readonly session: {
    readonly id: string;
    readonly startedAt: string;
    readonly mode: ReviewSessionRecord["mode"];
  };
};

export type FinishReviewSessionResponse = {
  readonly session: {
    readonly id: string;
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly mode: ReviewSessionRecord["mode"];
  };
};

export type SubmitReviewAnswerResponse = ReviewAnswerResponse;

export type ReviewAnswerRequestBody = {
  readonly cardId?: unknown;
  readonly answer?: unknown;
  readonly answerType?: unknown;
  readonly answeredAt?: unknown;
  readonly revealRequested?: unknown;
  readonly manualIgnore?: unknown;
};
