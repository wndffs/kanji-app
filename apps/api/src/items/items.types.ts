import {
  type BilingualTextDto,
  type ContentLocale,
  type ItemRelationGroupKind,
  type ItemKind,
  type ItemReviewResult,
  type KanjiReadingEvidenceDto,
  type KanjiStrokeGraphicDto,
  type LocalizedTextDto,
  type SentenceDto,
  type SourceAttributionDto,
  type SrsStateSummaryDto,
  type WordStudyDetailsDto,
} from "@kanji-srs/shared";

export type ItemStrokeGraphicRecord = KanjiStrokeGraphicDto;

export type ItemComponentDetailsRecord = {
  readonly name: BilingualTextDto;
  readonly shapeDescription: BilingualTextDto;
};

export type ItemTargetRecord = {
  readonly japanese: string;
  readonly reading: string | null;
  readonly jlptLevel: string | null;
  readonly translations: BilingualTextDto;
  readonly componentDetails: ItemComponentDetailsRecord | null;
  readonly kanjiReadingEvidence: readonly KanjiReadingEvidenceDto[];
  readonly wordDetails: WordStudyDetailsDto | null;
  readonly sourceRecordIds: readonly string[];
  readonly strokeGraphic: ItemStrokeGraphicRecord | null;
  readonly attributions: readonly SourceAttributionDto[];
};

export type ItemTextRecord = LocalizedTextDto & {
  readonly type: string;
};

export type ItemAnswerRecord = LocalizedTextDto & {
  readonly normalizedText: string;
  readonly answerKind: "meaning" | "reading";
};

export type ItemBlockedAnswerRecord = LocalizedTextDto & {
  readonly normalizedText: string;
  readonly reason: string | null;
};

export type ItemUserOverrideRecord = {
  readonly id: string;
  readonly userId: string;
  readonly learningCardId: string;
  readonly overrideType: "accepted-meaning" | "accepted-reading" | "blocked-personal" | "note";
  readonly locale: ContentLocale;
  readonly text: string;
  readonly normalizedText: string;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type ItemCardRecord = {
  readonly id: string;
  readonly cardType: "lesson" | "review";
  readonly promptType: "meaning" | "reading" | "recall" | "cloze" | "recognition";
  readonly answerType: "meaning" | "reading";
  readonly sortOrder: number;
  readonly answers: readonly ItemAnswerRecord[];
  readonly blockedAnswers: readonly ItemBlockedAnswerRecord[];
  readonly userOverrides: readonly ItemUserOverrideRecord[];
};

export type ItemRelationRecord = {
  readonly relationType: "component" | "kanji" | "word" | "dependency" | "example";
  readonly item: ItemRecord;
};

export type ItemRelationGroupRecord = {
  readonly kind: ItemRelationGroupKind;
  readonly items: readonly ItemRecord[];
  readonly total: number;
};

export type ItemReviewHistoryRecord = {
  readonly id: string;
  readonly learningCardId: string;
  readonly promptType: "meaning" | "reading" | "recall" | "cloze" | "recognition";
  readonly answerType: "meaning" | "reading";
  readonly result: ItemReviewResult;
  readonly previousStageIndex: number | null;
  readonly nextStageIndex: number | null;
  readonly answeredAt: Date;
};

export type ItemReviewHistoryCursor = {
  readonly answeredAt: Date;
  readonly id: string;
};

export type ItemReviewHistoryLookup = {
  readonly cursor: ItemReviewHistoryCursor | null;
  readonly limit: number;
};

export type ItemReviewHistoryRecordPage = {
  readonly items: readonly ItemReviewHistoryRecord[];
  readonly hasNextPage: boolean;
};

export type ItemRecord = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly title: string;
  readonly level: number | null;
  readonly status: string;
  readonly target: ItemTargetRecord;
  readonly cards: readonly ItemCardRecord[];
  readonly mnemonics: readonly ItemTextRecord[];
  readonly hints: readonly ItemTextRecord[];
  readonly relations: readonly ItemRelationRecord[];
  readonly relationGroups: readonly ItemRelationGroupRecord[];
  readonly exampleSentences: readonly SentenceDto[];
  readonly attributions: readonly SourceAttributionDto[];
  readonly userOverrides: readonly ItemUserOverrideRecord[];
  readonly srs: SrsStateSummaryDto | null;
  readonly nextReviewAt: Date | null;
};

export type ItemLookupOptions = {
  readonly userId?: string;
  readonly includeExamples?: boolean;
};

export type SearchLookupOptions = ItemLookupOptions;

export type SearchParams = {
  readonly query: string;
  readonly page: number;
  readonly limit: number;
};

export type ParsedSearchQuery = {
  readonly q?: string | readonly string[];
  readonly page?: string | readonly string[];
  readonly limit?: string | readonly string[];
};

export type ParsedItemHistoryQuery = {
  readonly cursor?: string | readonly string[];
  readonly limit?: string | readonly string[];
};

export function localizedText(
  locale: ContentLocale,
  text: string,
  options: {
    readonly isPrimary?: boolean;
    readonly sourceKind?: "curated" | "imported" | "user";
  } = {},
): LocalizedTextDto {
  return {
    locale,
    text,
    ...options,
  };
}
