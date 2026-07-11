export const APP_NAME = "Кандзи SRS";
export const DEFAULT_APP_LOCALE = "ru-RU";
export const DEFAULT_TRANSLATION_DISPLAY_MODE = "ru";
export const WORKSPACE_STATUS = "Готово";

export const SUPPORTED_CONTENT_LOCALES = ["ru-RU", "en-US"] as const;
export const SUPPORTED_TRANSLATION_DISPLAY_MODES = ["ru", "en", "ru-en"] as const;

export type AppLocale = "ru-RU";
export type ContentLocale = (typeof SUPPORTED_CONTENT_LOCALES)[number];
export type TranslationDisplayMode = (typeof SUPPORTED_TRANSLATION_DISPLAY_MODES)[number];

export type WorkspacePackageName =
  | "@kanji-srs/db"
  | "@kanji-srs/srs"
  | "@kanji-srs/japanese"
  | "@kanji-srs/content-importers"
  | "@kanji-srs/shared"
  | "@kanji-srs/ui";

export type WorkspacePackageInfo = {
  readonly name: WorkspacePackageName;
  readonly responsibility: string;
};

export type ItemKind = "component" | "kanji" | "word" | "sentence";
export type LearningCardType = "lesson" | "review";
export type CardPromptType = "meaning" | "reading" | "recall" | "cloze" | "recognition";
export type CardAnswerType = "meaning" | "reading";
export type ReviewAnswerResultType =
  | "correct"
  | "wrong"
  | "typo"
  | "blocked"
  | "reveal"
  | "manual-ignore";
export type UserOverrideKind =
  | "accepted-answer"
  | "blocked-answer"
  | "meaning"
  | "note"
  | "mnemonic";
export type DeckStatus = "draft" | "active" | "archived";
export const SUPPORTED_COURSE_BANDS = ["foundation", "n5", "n4", "n3", "n2"] as const;
export type CourseBand = (typeof SUPPORTED_COURSE_BANDS)[number];
export type DeckItemReasonCode =
  | "appears-in-text"
  | "prerequisite-kanji"
  | "prerequisite-component"
  | "high-frequency";
export type AdminContentStatus = "draft" | "needs-review" | "published" | "archived";
export type AdminImportRunStatus = "pending" | "success" | "failed";
export type AdminTextSourceKind = "curated" | "imported" | "user";
export type AdminQualityIssueCode =
  | "missing-accepted-answer"
  | "missing-ru-accepted-answer"
  | "missing-en-accepted-answer"
  | "missing-ru-meaning"
  | "missing-en-meaning"
  | "missing-ru-mnemonic"
  | "missing-en-mnemonic"
  | "missing-attribution"
  | "missing-dependency"
  | "self-dependency"
  | "unpublished-dependency";

export type LocalizedTextDto = {
  readonly locale: ContentLocale;
  readonly text: string;
  readonly isPrimary?: boolean;
  readonly sourceKind?: "curated" | "imported" | "user";
};

export type BilingualTextDto = {
  readonly ru: readonly LocalizedTextDto[];
  readonly en: readonly LocalizedTextDto[];
};

export type TranslationBundleDto = BilingualTextDto & {
  readonly displayMode: TranslationDisplayMode;
  readonly primaryRu: string | null;
  readonly primaryEn: string | null;
};

export type SourceAttributionDto = {
  readonly sourceName: string;
  readonly licenseName: string;
  readonly attributionText: string;
  readonly sourceUrl?: string | null;
};

export type LeechScoreReason =
  | "wrong-count"
  | "recent-wrong"
  | "stage-instability"
  | "correct-streak-relief"
  | "burned";

export type LeechScoreDto = {
  readonly score: number;
  readonly isCandidate: boolean;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly recentWrongCount: number;
  readonly stageDropCount: number;
  readonly stageDropMagnitude: number;
  readonly reasons: readonly LeechScoreReason[];
};

export type SrsStateSummaryDto = {
  readonly stageIndex: number;
  readonly stageName: string;
  readonly availableAt: string | null;
  readonly burnedAt: string | null;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly leech?: LeechScoreDto | null;
};

export type ItemSummary = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly slug: string;
  readonly japanese: string;
  readonly reading: string | null;
  readonly translations: TranslationBundleDto;
  readonly level: number | null;
  readonly jlptLevel: string | null;
  readonly srs: SrsStateSummaryDto | null;
};

export type ItemRelationDto = {
  readonly item: ItemSummary;
  readonly relationType: "component" | "kanji" | "word" | "dependency" | "example";
};

export type ComponentDetailsDto = {
  readonly name: TranslationBundleDto;
  readonly shapeDescription: TranslationBundleDto;
};

export type KanjiStrokePathDto = {
  readonly id: string;
  readonly order: number;
  readonly path: string;
  readonly type: string | null;
};

export type KanjiStrokeGraphicDto = {
  readonly sourceRecordId: string;
  readonly viewBox: string;
  readonly strokes: readonly KanjiStrokePathDto[];
};

export type LearningCardDto = {
  readonly id: string;
  readonly learningItemId: string;
  readonly itemType: ItemKind;
  readonly cardType: LearningCardType;
  readonly promptType: CardPromptType;
  readonly answerType: CardAnswerType;
  readonly translationDisplayMode: TranslationDisplayMode;
  readonly prompt: {
    readonly japanese: string;
    readonly reading: string | null;
    readonly clozeText?: string | null;
  };
  readonly translations: TranslationBundleDto;
  readonly acceptedAnswers: readonly LocalizedTextDto[];
  readonly blockedAnswers: readonly LocalizedTextDto[];
  readonly sortOrder: number;
};

export type ReviewQueueCardDto = {
  readonly id: string;
  readonly learningItemId: string;
  readonly itemType: ItemKind;
  readonly cardType: LearningCardType;
  readonly promptType: CardPromptType;
  readonly answerType: CardAnswerType;
  readonly prompt: {
    readonly japanese: string;
    readonly reading: string | null;
    readonly clozeText?: string | null;
  };
  readonly sortOrder: number;
};

export type ReviewQueueItemSummary = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly slug: string;
  readonly japanese: string;
  readonly reading: string | null;
  readonly level: number | null;
  readonly jlptLevel: string | null;
};

export type ItemDetails = ItemSummary & {
  readonly componentDetails: ComponentDetailsDto | null;
  readonly cards: readonly LearningCardDto[];
  readonly relations: readonly ItemRelationDto[];
  readonly mnemonics: BilingualTextDto;
  readonly hints: BilingualTextDto;
  readonly exampleSentences: readonly SentenceDto[];
  readonly attributions: readonly SourceAttributionDto[];
  readonly userOverrides: readonly UserOverrideDto[];
  readonly strokeGraphic: KanjiStrokeGraphicDto | null;
};

export type SearchResponseDto = {
  readonly query: string;
  readonly items: readonly ItemSummary[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly hasNextPage: boolean;
  };
};

export type SentenceDto = {
  readonly id: string;
  readonly japaneseText: string;
  readonly readingText: string | null;
  readonly translationRu: string | null;
  readonly translationEn: string | null;
  readonly difficulty: number | null;
  readonly attribution: SourceAttributionDto | null;
};

export type ReviewQueueItem = {
  readonly card: ReviewQueueCardDto;
  readonly item: ReviewQueueItemSummary;
  readonly dueAt: string;
  readonly srs: SrsStateSummaryDto;
};

export type ReviewAnswerRequest = {
  readonly cardId: string;
  readonly answer: string;
  readonly answerType: CardAnswerType;
  readonly answeredAt: string;
  readonly revealRequested?: boolean;
  readonly manualIgnore?: boolean;
};

export type ReviewAnswerResponse = {
  readonly cardId: string;
  readonly accepted: boolean;
  readonly result: ReviewAnswerResultType;
  readonly normalizedAnswer: string;
  readonly matchedAnswer: string | null;
  readonly feedback: {
    readonly message: string;
    readonly expected: readonly LocalizedTextDto[];
    readonly blockedReason?: string | null;
  };
  readonly previousSrs: SrsStateSummaryDto;
  readonly nextSrs: SrsStateSummaryDto;
};

export type LessonQueueItem = {
  readonly item: ItemSummary;
  readonly cards: readonly LearningCardDto[];
  readonly unlockedBy: readonly ItemSummary[];
};

export type LessonQueueResponse = {
  readonly items: readonly LessonQueueItem[];
};

export type LessonSessionDto = {
  readonly id: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly mode: "lesson";
};

export type StartLessonSessionResponse = {
  readonly session: LessonSessionDto;
};

export type CompleteLessonItemResponse = {
  readonly itemId: string;
  readonly createdSrsStateCount: number;
  readonly cards: readonly {
    readonly cardId: string;
    readonly srs: SrsStateSummaryDto;
  }[];
};

export type FinishLessonSessionResponse = {
  readonly session: LessonSessionDto;
};

export type ReviewForecastBucketDto = {
  readonly bucketKey: string;
  readonly localDate: string;
  readonly localHour: number | null;
  readonly dueCount: number;
};

export type DashboardLevelProgressDto = {
  readonly level: number;
  readonly completedItems: number;
  readonly totalItems: number;
  readonly completedCards: number;
  readonly totalCards: number;
  readonly percent: number;
};

export type DashboardRecentReviewStatsDto = {
  readonly since: string;
  readonly total: number;
  readonly correct: number;
  readonly wrong: number;
  readonly typo: number;
  readonly reveal: number;
  readonly manualIgnore: number;
  readonly resurrect: number;
  readonly accuracy: number | null;
};

export type DashboardLeechCandidateDto = {
  readonly learningCardId: string;
  readonly item: ItemSummary;
  readonly leech: LeechScoreDto;
};

export type DashboardDto = {
  readonly user: {
    readonly id: string;
    readonly displayName: string | null;
    readonly locale: AppLocale;
    readonly translationDisplayMode: TranslationDisplayMode;
    readonly timezone: string;
  };
  readonly counts: {
    readonly dueReviews: number;
    readonly availableLessons: number;
    readonly burnedCards: number;
    readonly leechCandidates: number;
  };
  readonly currentCourse: {
    readonly id: string;
    readonly title: string;
    readonly currentLevel: number;
    readonly levelProgress: DashboardLevelProgressDto;
  } | null;
  readonly reviewForecast: readonly ReviewForecastBucketDto[];
  readonly leechCandidates: readonly DashboardLeechCandidateDto[];
  readonly recentReviewStats: DashboardRecentReviewStatsDto;
  readonly recentItems: readonly ItemSummary[];
};

export type UserOverrideDto = {
  readonly id: string;
  readonly learningCardId: string;
  readonly kind: UserOverrideKind;
  readonly locale: ContentLocale;
  readonly text: string;
  readonly normalizedText: string;
  readonly note: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type UserMnemonicDto = {
  readonly id: string;
  readonly learningItemId: string;
  readonly locale: ContentLocale;
  readonly mnemonicType: "meaning" | "reading" | "story";
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type DeckDto = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: DeckStatus;
  readonly itemCount: number;
  readonly newItemCount: number;
  readonly translationDisplayMode: TranslationDisplayMode;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly items?: readonly ItemSummary[];
};

export type DeckItemReasonDto = {
  readonly code: DeckItemReasonCode;
  readonly detail: string;
  readonly matchedText?: string | null;
  readonly sourceItemId?: string | null;
  readonly rank?: number | null;
};

export type DeckItemDto = {
  readonly item: ItemSummary;
  readonly sortOrder: number;
  readonly reasons: readonly DeckItemReasonDto[];
  readonly isNewForUser: boolean;
};

export type DeckDetailsDto = Omit<DeckDto, "items"> & {
  readonly items: readonly DeckItemDto[];
};

export type CreateTextDeckRequest = {
  readonly text: string;
  readonly title?: string | null;
  readonly maxItems?: number | null;
};

export type CreateTextDeckResponse = {
  readonly deck: DeckDetailsDto;
  readonly tokenization: {
    readonly strategy: "substring-fallback";
    readonly candidateCount: number;
    readonly matchedItemCount: number;
    readonly unmatchedCandidateCount: number;
  };
};

export type DeckListResponse = {
  readonly decks: readonly DeckDto[];
};

export type AdminReviewQueueItemDto = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly band: CourseBand | null;
  readonly title: string;
  readonly japanese: string;
  readonly reading: string | null;
  readonly level: number | null;
  readonly jlptLevel: string | null;
  readonly status: AdminContentStatus;
  readonly updatedAt: string;
  readonly sourceNames: readonly string[];
  readonly qualityIssues: readonly AdminQualityIssueDto[];
};

export type AdminReviewQueueResponse = {
  readonly items: readonly AdminReviewQueueItemDto[];
};

export type AdminReviewQueueFilters = {
  readonly band?: CourseBand;
  readonly jlptLevel?: "N5" | "N4" | "N3" | "N2";
  readonly status?: AdminContentStatus;
  readonly missingAcceptedAnswers?: boolean;
  readonly missingMnemonics?: boolean;
};

export type AdminImportedCandidateReasonCode =
  | "source-frequency"
  | "source-priority"
  | "jlpt"
  | "school-grade"
  | "ru-coverage"
  | "en-coverage"
  | "reading"
  | "stroke-data"
  | "kanji-orthography";

export type AdminImportedCandidateReasonDto = {
  readonly code: AdminImportedCandidateReasonCode;
  readonly points: number;
};

export type AdminImportedCandidateDto = {
  readonly rank: number;
  readonly score: number;
  readonly targetId: string;
  readonly itemType: "kanji" | "word";
  readonly japanese: string;
  readonly reading: string | null;
  readonly meanings: {
    readonly ru: readonly string[];
    readonly en: readonly string[];
  };
  readonly jlptLevel: "N5" | "N4" | "N3" | "N2" | null;
  readonly sourcePriority: number | null;
  readonly sourceName: "KANJIDIC2" | "JMdict";
  readonly suggestedBand: CourseBand;
  readonly suggestedTitle: string;
  readonly reasons: readonly AdminImportedCandidateReasonDto[];
};

export type AdminImportedCandidateListResponse = {
  readonly candidates: readonly AdminImportedCandidateDto[];
};

export type AdminQualityIssueDto = {
  readonly code: AdminQualityIssueCode;
  readonly message: string;
  readonly cardId?: string | null;
  readonly dependencyItemId?: string | null;
};

export type AdminDependencyDto = {
  readonly id: string;
  readonly prerequisiteItemId: string;
  readonly prerequisiteTitle: string;
  readonly prerequisiteStatus: AdminContentStatus;
  readonly dependencyType: "prerequisite" | "related" | "unlock";
  readonly requiredStage: number | null;
};

export type AdminCurationAnswerDto = {
  readonly id: string;
  readonly cardId: string;
  readonly locale: ContentLocale;
  readonly text: string;
  readonly normalizedText: string;
  readonly answerKind: CardAnswerType;
  readonly isPrimary: boolean;
};

export type AdminCurationBlockedAnswerDto = {
  readonly id: string;
  readonly cardId: string;
  readonly text: string;
  readonly normalizedText: string;
  readonly reason: string | null;
};

export type AdminCurationCardDto = {
  readonly id: string;
  readonly promptType: CardPromptType;
  readonly answerType: CardAnswerType;
  readonly locale: ContentLocale;
  readonly sortOrder: number;
  readonly updatedAt: string;
  readonly acceptedAnswers: readonly AdminCurationAnswerDto[];
  readonly blockedAnswers: readonly AdminCurationBlockedAnswerDto[];
};

export type AdminCurationTextDto = {
  readonly id: string;
  readonly locale: ContentLocale;
  readonly type: "meaning" | "reading" | "story" | "usage";
  readonly body: string;
  readonly sourceKind: AdminTextSourceKind;
  readonly version: number;
  readonly updatedAt: string;
};

export type AdminImportRunSummaryDto = {
  readonly id: string;
  readonly dataSourceName: string;
  readonly licenseName: string;
  readonly sourceVersion: string | null;
  readonly sourceFileName: string;
  readonly checksumSha256: string;
  readonly status: AdminImportRunStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly recordCount: number;
  readonly stats: Readonly<Record<string, string | number | boolean | null>>;
  readonly errorText: string | null;
};

export type AdminImportRunListResponse = {
  readonly importRuns: readonly AdminImportRunSummaryDto[];
};

export type AdminCurationItemDto = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly band: CourseBand | null;
  readonly title: string;
  readonly japanese: string;
  readonly reading: string | null;
  readonly level: number | null;
  readonly jlptLevel: string | null;
  readonly status: AdminContentStatus;
  readonly updatedAt: string;
  readonly meanings: {
    readonly ru: string;
    readonly en: string;
  };
  readonly cards: readonly AdminCurationCardDto[];
  readonly hints: readonly AdminCurationTextDto[];
  readonly mnemonics: readonly AdminCurationTextDto[];
  readonly dependencies: readonly AdminDependencyDto[];
  readonly attributions: readonly SourceAttributionDto[];
  readonly importRuns: readonly AdminImportRunSummaryDto[];
  readonly qualityIssues: readonly AdminQualityIssueDto[];
};

export type AdminUpdateItemRequest = {
  readonly status?: AdminContentStatus;
  readonly band?: CourseBand | null;
  readonly meanings?: {
    readonly ru?: string;
    readonly en?: string;
  };
  readonly hints?: readonly {
    readonly locale: ContentLocale;
    readonly type: "meaning" | "reading" | "usage";
    readonly body: string;
  }[];
  readonly mnemonics?: readonly {
    readonly locale: ContentLocale;
    readonly type: "meaning" | "reading" | "story";
    readonly body: string;
  }[];
};

export type AdminPromoteCandidateRequest = {
  readonly targetType: ItemKind;
  readonly targetId: string;
  readonly title: string;
  readonly band: CourseBand;
  readonly level?: number | null;
};

export type AdminCurriculumBandCompletenessDto = {
  readonly band: CourseBand;
  readonly totalItems: number;
  readonly publishedItems: number;
  readonly draftItems: number;
  readonly needsReviewItems: number;
  readonly archivedItems: number;
  readonly importDerivedCandidates: number;
  readonly missingAcceptedAnswers: number;
  readonly missingMnemonics: number;
  readonly missingLocaleCoverage: number;
  readonly missingAttribution: number;
  readonly invalidDependencies: number;
};

export type AdminCurriculumCompletenessReportDto = {
  readonly generatedAt: string;
  readonly bands: readonly AdminCurriculumBandCompletenessDto[];
};

export type AdminUpdateCardAnswersRequest = {
  readonly acceptedAnswers: readonly {
    readonly locale: ContentLocale;
    readonly text: string;
    readonly answerKind: CardAnswerType;
    readonly isPrimary?: boolean;
  }[];
  readonly blockedAnswers: readonly {
    readonly text: string;
    readonly reason?: string | null;
  }[];
};

export const workspacePackages: readonly WorkspacePackageInfo[] = [
  { name: "@kanji-srs/db", responsibility: "database schema and client ownership" },
  { name: "@kanji-srs/srs", responsibility: "framework-agnostic scheduling logic" },
  {
    name: "@kanji-srs/japanese",
    responsibility: "Japanese, Russian, and English answer helpers",
  },
  { name: "@kanji-srs/content-importers", responsibility: "open-data import pipelines" },
  { name: "@kanji-srs/shared", responsibility: "serializable shared contracts" },
  { name: "@kanji-srs/ui", responsibility: "reusable web UI components" },
];

export function isContentLocale(value: string): value is ContentLocale {
  return (SUPPORTED_CONTENT_LOCALES as readonly string[]).includes(value);
}

export function isCourseBand(value: string): value is CourseBand {
  return (SUPPORTED_COURSE_BANDS as readonly string[]).includes(value);
}

export function isTranslationDisplayMode(value: string): value is TranslationDisplayMode {
  return (SUPPORTED_TRANSLATION_DISPLAY_MODES as readonly string[]).includes(value);
}

export function getContentLocalesForDisplayMode(
  mode: TranslationDisplayMode,
): readonly ContentLocale[] {
  switch (mode) {
    case "ru":
      return ["ru-RU"];
    case "en":
      return ["en-US"];
    case "ru-en":
      return SUPPORTED_CONTENT_LOCALES;
  }
}
