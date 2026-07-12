import {
  type BilingualTextDto,
  type CardAnswerType,
  type CardPromptType,
  type CompleteLessonItemRequestDto,
  type ContentLocale,
  type FinishLessonSessionResponse,
  type ItemKind,
  type LessonHintGroupDto,
  type LessonMnemonicGroupDto,
  type LessonQueueResponse,
  type LocalizedTextDto,
  type SentenceDto,
  type StartLessonSessionResponse,
  type TranslationDisplayMode,
  type CompleteLessonItemResponse,
} from "@kanji-srs/shared";

export type LessonSessionRecord = {
  readonly id: string;
  readonly userId: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly mode: "lesson";
  readonly deckId: string | null;
};

export type LessonTargetRecord = {
  readonly japanese: string;
  readonly reading: string | null;
  readonly jlptLevel: string | null;
  readonly translations: BilingualTextDto;
};

export type LessonAnswerRecord = LocalizedTextDto & {
  readonly normalizedText: string;
  readonly answerKind: CardAnswerType;
};

export type LessonBlockedAnswerRecord = LocalizedTextDto & {
  readonly normalizedText: string;
};

export type LessonCardRecord = {
  readonly id: string;
  readonly learningItemId: string;
  readonly itemType: ItemKind;
  readonly cardType: "lesson" | "review";
  readonly promptType: CardPromptType;
  readonly answerType: CardAnswerType;
  readonly sortOrder: number;
  readonly answers: readonly LessonAnswerRecord[];
  readonly blockedAnswers: readonly LessonBlockedAnswerRecord[];
};

export type LessonDependencyRecord = {
  readonly prerequisiteItemId: string;
  readonly requiredStage: number;
};

export type LessonItemRecord = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly title: string;
  readonly level: number | null;
  readonly target: LessonTargetRecord;
  readonly cards: readonly LessonCardRecord[];
  readonly dependencies: readonly LessonDependencyRecord[];
  readonly mnemonics: readonly LessonMnemonicGroupDto[];
  readonly hints: readonly LessonHintGroupDto[];
  readonly exampleSentences: readonly SentenceDto[];
};

export type CourseLessonItemRecord = {
  readonly courseId: string;
  readonly courseLevelNumber: number;
  readonly sortOrder: number;
  readonly item: LessonItemRecord;
  readonly unlockPolicy: Record<string, unknown> | null;
};

export type DeckLessonRecord = {
  readonly id: string;
  readonly title: string;
  readonly status: "draft" | "active" | "archived";
  readonly items: readonly {
    readonly sortOrder: number;
    readonly item: LessonItemRecord;
  }[];
};

export type UserItemProgressRecord = {
  readonly learningItemId: string;
  readonly learningCardId: string;
  readonly stageIndex: number;
  readonly createdAt: Date;
};

export type SrsSystemRecord = {
  readonly id: string;
  readonly stages: readonly {
    readonly stageIndex: number;
    readonly name: string;
    readonly intervalMinutes: number | null;
    readonly isBurned: boolean;
  }[];
};

export type CompleteLessonItemInput = {
  readonly userId: string;
  readonly sessionId: string;
  readonly item: LessonItemRecord;
  readonly srsSystem: SrsSystemRecord;
  readonly initialStageIndex: number;
  readonly availableAt: Date | null;
};

export type CompletedLessonItemRecord = {
  readonly createdSrsStateCount: number;
};

export type LessonDisplayContext = {
  readonly displayMode: TranslationDisplayMode;
};

export type {
  CompleteLessonItemRequestDto,
  CompleteLessonItemResponse,
  FinishLessonSessionResponse,
  LessonQueueResponse,
  StartLessonSessionResponse,
};

export type LessonContentLocale = ContentLocale;
