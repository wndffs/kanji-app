import {
  type BilingualTextDto,
  type ContentLocale,
  type DeckItemReasonDto,
  type ItemKind,
} from "@kanji-srs/shared";

export type TextDeckTargetRecord = {
  readonly japanese: string;
  readonly reading: string | null;
  readonly jlptLevel: string | null;
  readonly translations: BilingualTextDto;
  readonly frequencyRank: number | null;
};

export type TextDeckItemRecord = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly title: string;
  readonly level: number | null;
  readonly target: TextDeckTargetRecord;
};

export type TextDeckMatchRecord = {
  readonly item: TextDeckItemRecord;
  readonly matchedText: string;
  readonly sourceIndex: number;
  readonly frequencyRank: number | null;
};

export type TextDeckPrerequisiteRecord = {
  readonly sourceItemId: string;
  readonly item: TextDeckItemRecord;
};

export type TextDeckTokenLookup = {
  readonly wordCandidates: readonly string[];
  readonly kanjiCharacters: readonly string[];
  readonly sourceText: string;
};

export type CreateTextDeckItemInput = {
  readonly learningItemId: string;
  readonly sortOrder: number;
  readonly reasons: readonly DeckItemReasonDto[];
};

export type CreateTextDeckInput = {
  readonly ownerUserId: string;
  readonly title: string;
  readonly sourceText: string;
  readonly items: readonly CreateTextDeckItemInput[];
};

export type TextDeckStoredItemRecord = {
  readonly item: TextDeckItemRecord;
  readonly sortOrder: number;
  readonly reasons: readonly DeckItemReasonDto[];
  readonly isNewForUser: boolean;
};

export type TextDeckRecord = {
  readonly id: string;
  readonly ownerUserId: string;
  readonly title: string;
  readonly sourceText: string | null;
  readonly status: "draft" | "active" | "archived";
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly itemCount: number;
  readonly newItemCount: number;
  readonly items: readonly TextDeckStoredItemRecord[];
};

export type TextDeckListRecord = Omit<TextDeckRecord, "sourceText" | "items">;

export type ParsedCreateTextDeckRequest = {
  readonly text: string;
  readonly title: string;
  readonly maxItems: number;
};

export function localizedText(
  locale: ContentLocale,
  text: string,
  options: {
    readonly isPrimary?: boolean;
    readonly sourceKind?: "curated" | "imported" | "user";
  } = {},
) {
  return {
    locale,
    text,
    ...options,
  };
}
