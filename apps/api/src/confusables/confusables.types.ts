import {
  type AdminContentStatus,
  type BilingualTextDto,
  type ConfusableRelationKind,
  type ContentLocale,
} from "@kanji-srs/shared";

export type ConfusableKanjiRefRecord = {
  readonly kanjiId: string;
  readonly itemId: string;
  readonly character: string;
  readonly level: number | null;
  readonly jlptLevel: string | null;
};

export type ConfusablePairRecord = {
  readonly id: string;
  readonly kinds: readonly ConfusableRelationKind[];
  readonly strength: number;
  readonly recentWrongCount: number;
  readonly kanji: readonly [ConfusableKanjiRefRecord, ConfusableKanjiRefRecord];
  readonly explanationRu: string | null;
  readonly explanationEn: string | null;
  readonly sourceNote: string;
  readonly status: AdminContentStatus;
  readonly createdByUserId: string;
  readonly approvedByUserId: string | null;
  readonly approvedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type ConfusableRelatedItemRecord = {
  readonly id: string;
  readonly japanese: string;
  readonly reading: string | null;
  readonly translations: BilingualTextDto;
};

export type ConfusableComparisonKanjiRecord = ConfusableKanjiRefRecord & {
  readonly meanings: BilingualTextDto;
  readonly readings: readonly string[];
  readonly components: readonly ConfusableRelatedItemRecord[];
  readonly vocabulary: readonly ConfusableRelatedItemRecord[];
};

export type ConfusableComparisonRecord = {
  readonly pair: ConfusablePairRecord;
  readonly kanji: readonly [ConfusableComparisonKanjiRecord, ConfusableComparisonKanjiRecord];
};

export type ConfusablePairRankingInput = ConfusablePairRecord;

export type NormalizedCreateConfusablePairInput = {
  readonly leftItemId: string;
  readonly rightItemId: string;
  readonly kinds: readonly ConfusableRelationKind[];
  readonly strength: number;
  readonly explanationRu: string | null;
  readonly explanationEn: string | null;
  readonly sourceNote: string;
};

export type CreateConfusablePairRecordInput = Omit<
  NormalizedCreateConfusablePairInput,
  "leftItemId" | "rightItemId"
> & {
  readonly left: ConfusableKanjiRefRecord;
  readonly right: ConfusableKanjiRefRecord;
  readonly createdByUserId: string;
};

export type UpdateConfusablePairRecordInput = Omit<
  NormalizedCreateConfusablePairInput,
  "leftItemId" | "rightItemId"
>;

export type LocalizedEvidenceRecord = {
  readonly locale: ContentLocale;
  readonly text: string;
  readonly isPrimary?: boolean;
  readonly sourceKind: "curated" | "imported";
};
