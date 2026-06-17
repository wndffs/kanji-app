import {
  type BilingualTextDto,
  type ContentLocale,
  type ItemKind,
  type LocalizedTextDto,
  type SourceAttributionDto,
} from "@kanji-srs/shared";

export type ItemTargetRecord = {
  readonly japanese: string;
  readonly reading: string | null;
  readonly jlptLevel: string | null;
  readonly translations: BilingualTextDto;
  readonly sourceRecordIds: readonly string[];
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
  readonly text: string;
  readonly normalizedText: string;
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
  readonly attributions: readonly SourceAttributionDto[];
  readonly userOverrides: readonly ItemUserOverrideRecord[];
};

export type ItemLookupOptions = {
  readonly userId?: string;
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
