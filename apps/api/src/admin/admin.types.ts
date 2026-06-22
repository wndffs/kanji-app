import {
  type AdminContentStatus,
  type AdminUpdateCardAnswersRequest,
  type AdminUpdateItemRequest,
  type CardAnswerType,
  type ContentLocale,
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
  readonly meanings?: NonNullable<AdminUpdateItemRequest["meanings"]>;
  readonly hints?: readonly NormalizedAdminTextInput[];
  readonly mnemonics?: readonly NormalizedAdminTextInput[];
};

export type RawAdminCardAnswersInput = AdminUpdateCardAnswersRequest;
export type RawAdminItemCurationInput = AdminUpdateItemRequest;
