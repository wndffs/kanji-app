import {
  type AudioAssetDto,
  type CardAnswerType,
  type CardPromptType,
  type ItemKind,
  type BilingualTextDto,
  type LocalizedTextDto,
  type PracticeProgressDto,
  type PracticeCardOutcomeDto,
  type PracticeSource,
  type ReviewAnswerResponse,
  type ReviewAnswerResultType,
  type ReviewSessionProgressDto,
  type ReviewOrderMode,
  type ReviewQueueItem,
  type ReviewSessionSummaryDto,
  type ReviewSrsTransition,
} from "@kanji-srs/shared";

import { type ReviewResult as SrsReviewResult, type SrsStage } from "@kanji-srs/srs";

export type ReviewSessionRecord = {
  readonly id: string;
  readonly userId: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly mode: "review" | "lesson-quiz" | "extra-practice";
  readonly reviewState?: ScheduledReviewState | null;
};

export type ScheduledReviewState = {
  readonly reviewVersion: 1;
  readonly scheduledCardIds: readonly string[];
  readonly correctedCardIds: readonly string[];
};

export type ScheduledReviewAnswerRecord = {
  readonly cardId: string;
  readonly result: SrsReviewResult;
  readonly srsTransition: ReviewSrsTransition;
};

export type ReviewSessionProgressRecord = {
  readonly session: ReviewSessionRecord;
  readonly answers: readonly ScheduledReviewAnswerRecord[];
};

export type RecordReviewCorrectionInput = {
  readonly userId: string;
  readonly sessionId: string;
  readonly cardId: string;
  readonly expectedState: ScheduledReviewState;
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
  readonly translations?: BilingualTextDto;
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
  readonly audio?: AudioAssetDto | null;
};

export type ReviewQueueRecord = {
  readonly state: ReviewSrsStateRecord;
  readonly card: ReviewCardRecord;
  readonly stages: readonly SrsStage[];
};

export type ResumablePracticeSource = PracticeSource | "confusable-kanji";

export type PracticeSessionRecord = {
  readonly outcomes?: readonly PracticeCardOutcomeDto[];
  readonly id: string;
  readonly userId: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly source: ResumablePracticeSource;
  readonly contextId: string | null;
  readonly cardIds: readonly string[];
  readonly currentIndex: number;
  readonly progress: PracticeProgressDto;
};

export type CreatePracticeSessionInput = {
  readonly userId: string;
  readonly now: Date;
  readonly source: ResumablePracticeSource;
  readonly contextId?: string | null;
  readonly cardIds: readonly string[];
};

export type UpdatePracticeSessionProgressInput = {
  readonly outcome?: PracticeCardOutcomeDto;
  readonly userId: string;
  readonly sessionId: string;
  readonly currentIndex: number;
  readonly progress: PracticeProgressDto;
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
  readonly listeningEvidence?: {
    readonly completed: boolean;
    readonly playCount: number;
  };
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
  readonly srsTransition: ReviewSrsTransition;
  readonly expectedState: Pick<
    ReviewSrsStateRecord,
    | "srsSystemId"
    | "stageIndex"
    | "availableAt"
    | "burnedAt"
    | "resurrectedAt"
    | "wrongCount"
    | "correctStreak"
    | "lastReviewedAt"
  >;
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

export type FinishedReviewSessionRecord = {
  readonly session: ReviewSessionRecord;
  readonly summary: ReviewSessionSummaryDto;
};

export type ReviewQueueResponse = {
  readonly items: readonly ReviewQueueItem[];
  readonly orderMode: ReviewOrderMode;
  readonly vacationStartedAt: string | null;
};

export type StartReviewSessionResponse = {
  readonly session: {
    readonly id: string;
    readonly startedAt: string;
    readonly mode: ReviewSessionRecord["mode"];
  };
  readonly items?: readonly ReviewQueueItem[];
  readonly currentIndex?: number;
  readonly corrections?: readonly ReviewQueueItem[];
  readonly progress?: ReviewSessionProgressDto;
  readonly resumed?: boolean;
};

export type FinishReviewSessionResponse = {
  readonly session: {
    readonly id: string;
    readonly startedAt: string;
    readonly finishedAt: string;
    readonly mode: ReviewSessionRecord["mode"];
  };
  readonly summary: ReviewSessionSummaryDto;
};

export type SubmitReviewAnswerResponse = ReviewAnswerResponse;

export type ReviewAnswerRequestBody = {
  readonly cardId?: unknown;
  readonly answer?: unknown;
  readonly answerType?: unknown;
  readonly answeredAt?: unknown;
  readonly revealRequested?: unknown;
  readonly manualIgnore?: unknown;
  readonly listeningEvidence?: unknown;
};
