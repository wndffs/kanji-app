import {
  type AdminApproveImportedTranslationRequest,
  type AdminContentStatus,
  type AdminPromoteCandidateRequest,
  type AdminReviewQueueFilters,
  type AdminUpdateCardAnswersRequest,
  type AdminUpdateItemRequest,
  type CardAnswerType,
  type ContentLocale,
  type CourseBand,
  type ItemKind,
} from "@kanji-srs/shared";

export type NormalizedAdminAcceptedAnswerInput = {
  readonly locale: ContentLocale;
  readonly text: string;
  readonly normalizedText: string;
  readonly answerKind: CardAnswerType;
  readonly isPrimary: boolean;
};

export type NormalizedAdminBlockedAnswerInput = {
  readonly text: string;
  readonly normalizedText: string;
  readonly reason: string | null;
};

export type NormalizedAdminCardAnswersInput = {
  readonly acceptedAnswers: readonly NormalizedAdminAcceptedAnswerInput[];
  readonly blockedAnswers: readonly NormalizedAdminBlockedAnswerInput[];
};

export type NormalizedAdminTextInput = {
  readonly locale: ContentLocale;
  readonly type: "meaning" | "reading" | "story" | "usage";
  readonly body: string;
};

export type NormalizedAdminItemCurationInput = {
  readonly status?: AdminContentStatus;
  readonly band?: CourseBand | null;
  readonly meanings?: NonNullable<AdminUpdateItemRequest["meanings"]>;
  readonly hints?: readonly NormalizedAdminTextInput[];
  readonly mnemonics?: readonly NormalizedAdminTextInput[];
};

export type NormalizedAdminReviewQueueFilters = AdminReviewQueueFilters;

export type NormalizedAdminPromoteCandidateInput = {
  readonly targetType: ItemKind;
  readonly targetId: string;
  readonly title: string;
  readonly band: CourseBand;
  readonly level: number | null;
};

export type NormalizedAdminApproveImportedTranslationInput = {
  readonly targetType: AdminApproveImportedTranslationRequest["targetType"];
  readonly targetId: string;
  readonly title: string;
  readonly band: CourseBand;
  readonly level: number | null;
  readonly meanings: {
    readonly ru: string;
    readonly en: string;
  };
  readonly acceptedAnswers: readonly NormalizedAdminAcceptedAnswerInput[];
};

export type RawAdminCardAnswersInput = AdminUpdateCardAnswersRequest;
export type RawAdminItemCurationInput = AdminUpdateItemRequest;
export type RawAdminPromoteCandidateInput = AdminPromoteCandidateRequest;
export type RawAdminApproveImportedTranslationInput = AdminApproveImportedTranslationRequest;
