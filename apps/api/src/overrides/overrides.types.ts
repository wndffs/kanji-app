import {
  type AnswerKind as JapaneseAnswerKind,
  type AnswerValidationResult,
} from "@kanji-srs/japanese";
import { type ContentLocale, type UserMnemonicDto, type UserOverrideDto } from "@kanji-srs/shared";

export type AcceptedAnswerKind = "meaning" | "reading";
export type PrivateMnemonicType = "meaning" | "reading" | "story";

export type AddAcceptedAnswerRequest = {
  readonly answerKind?: AcceptedAnswerKind;
  readonly text?: string;
  readonly locale?: ContentLocale;
  readonly note?: string | null;
};

export type SavePrivateMnemonicRequest = {
  readonly body?: string;
  readonly locale?: ContentLocale;
  readonly mnemonicType?: PrivateMnemonicType;
};

export type DeletePrivateMnemonicRequest = {
  readonly locale?: ContentLocale;
  readonly mnemonicType?: PrivateMnemonicType;
};

export type ValidateCardAnswerInput = {
  readonly userId: string;
  readonly cardId: string;
  readonly answerKind: JapaneseAnswerKind;
  readonly answer: string;
};

export type CardAnswerValidationRecord = {
  readonly cardId: string;
  readonly answerKind: JapaneseAnswerKind;
  readonly acceptedAnswers: readonly string[];
  readonly blockedAnswers: readonly string[];
  readonly kanjiTargetId?: string | null;
};

export type UserAcceptedAnswerRecord = {
  readonly id: string;
  readonly userId: string;
  readonly learningCardId: string;
  readonly overrideType: "accepted-meaning" | "accepted-reading";
  readonly locale: ContentLocale;
  readonly text: string;
  readonly normalizedText: string;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type UserMnemonicRecord = {
  readonly id: string;
  readonly userId: string;
  readonly learningItemId: string;
  readonly locale: ContentLocale;
  readonly mnemonicType: PrivateMnemonicType;
  readonly body: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type UpsertAcceptedAnswerInput = {
  readonly userId: string;
  readonly cardId: string;
  readonly answerKind: AcceptedAnswerKind;
  readonly locale: ContentLocale;
  readonly text: string;
  readonly normalizedText: string;
  readonly note: string | null;
};

export type UpsertPrivateMnemonicInput = {
  readonly userId: string;
  readonly learningItemId: string;
  readonly locale: ContentLocale;
  readonly mnemonicType: PrivateMnemonicType;
  readonly body: string;
};

export type CardAnswerValidationResult = AnswerValidationResult & {
  readonly relatedAnswer?: string | null;
};

export type ListOverridesResponse = {
  readonly overrides: readonly UserOverrideDto[];
};

export type DeleteOverrideResponse = {
  readonly deleted: boolean;
};

export type SavePrivateMnemonicResponse = {
  readonly mnemonic: UserMnemonicDto;
};

export type DeletePrivateMnemonicResponse = {
  readonly deleted: boolean;
};
