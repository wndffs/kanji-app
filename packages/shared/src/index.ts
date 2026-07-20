export const APP_NAME = "Кандзи SRS";
export const DEFAULT_APP_LOCALE = "ru-RU";
export const DEFAULT_TRANSLATION_DISPLAY_MODE = "ru";
export const DEFAULT_SPEECH_RATE = 0.8;
export const MIN_SPEECH_RATE = 0.5;
export const MAX_SPEECH_RATE = 1.5;
export const WORKSPACE_STATUS = "Готово";

export const SUPPORTED_CONTENT_LOCALES = ["ru-RU", "en-US"] as const;
export const SUPPORTED_TRANSLATION_DISPLAY_MODES = ["ru", "en", "ru-en"] as const;
export const SUPPORTED_LESSON_PRONUNCIATION_MODES = ["kana", "furigana"] as const;

export type AppLocale = "ru-RU";
export type ContentLocale = (typeof SUPPORTED_CONTENT_LOCALES)[number];
export type TranslationDisplayMode = (typeof SUPPORTED_TRANSLATION_DISPLAY_MODES)[number];
export type LessonPronunciationMode = (typeof SUPPORTED_LESSON_PRONUNCIATION_MODES)[number];
export type KanaScript = "hiragana" | "katakana";
export type KanaVariant = "basic" | "dakuten" | "handakuten" | "yoon" | "sokuon" | "long-vowel";

export function isLessonPronunciationMode(value: unknown): value is LessonPronunciationMode {
  return (
    typeof value === "string" &&
    (SUPPORTED_LESSON_PRONUNCIATION_MODES as readonly string[]).includes(value)
  );
}

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
export type CourseType = "structured" | "goal" | "demo";
export type CourseEnrollmentStatus = "active" | "paused" | "completed";
export type EnrolledCourseDto = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly targetLevel: string | null;
  readonly band: CourseBand;
  readonly courseType: CourseType;
  readonly enrollmentStatus: CourseEnrollmentStatus;
  readonly isCurrent: boolean;
};
export type CourseListResponse = {
  readonly currentCourseId: string | null;
  readonly courses: readonly EnrolledCourseDto[];
};
export type SelectCurrentCourseRequestDto = {
  readonly courseId: string;
};
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

export const SUPPORTED_REVIEW_ORDER_MODES = [
  "shuffled",
  "oldest-first",
  "lower-levels-first",
] as const;
export type ReviewOrderMode = (typeof SUPPORTED_REVIEW_ORDER_MODES)[number];

export function isReviewOrderMode(value: unknown): value is ReviewOrderMode {
  return (
    typeof value === "string" && (SUPPORTED_REVIEW_ORDER_MODES as readonly string[]).includes(value)
  );
}

export type ReviewAnswerRequest = {
  readonly cardId: string;
  readonly answer: string;
  readonly answerType: CardAnswerType;
  readonly answeredAt: string;
  readonly revealRequested?: boolean;
  readonly manualIgnore?: boolean;
};

export const REVIEW_SRS_TRANSITIONS = ["advanced", "unchanged", "demoted", "burned"] as const;
export type ReviewSrsTransition = (typeof REVIEW_SRS_TRANSITIONS)[number];

export type ReviewSessionSummaryDto = {
  readonly totalAnswers: number;
  readonly correctAnswers: number;
  readonly incorrectAnswers: number;
  readonly ignoredAnswers: number;
  readonly accuracyPercent: number | null;
  readonly advanced: number;
  readonly unchanged: number;
  readonly demoted: number;
  readonly burned: number;
  readonly durationSeconds: number;
};

export type ReviewAnswerResponse = {
  readonly cardId: string;
  readonly accepted: boolean;
  readonly result: ReviewAnswerResultType;
  readonly normalizedAnswer: string;
  readonly matchedAnswer: string | null;
  readonly retry?: boolean;
  readonly feedback: {
    readonly message: string;
    readonly expected: readonly LocalizedTextDto[];
    readonly blockedReason?: string | null;
    readonly diagnostic?: AnswerDiagnosticDto | null;
  };
  readonly previousSrs: SrsStateSummaryDto;
  readonly nextSrs: SrsStateSummaryDto;
  readonly srsTransition: ReviewSrsTransition;
};

export const PRACTICE_SOURCES = ["recent-lessons", "recent-mistakes", "burned"] as const;
export type PracticeSource = (typeof PRACTICE_SOURCES)[number];

export type PracticeQueueResponse = {
  readonly source: PracticeSource;
  readonly items: readonly ReviewQueueItem[];
};

export type PracticeProgressDto = {
  readonly answered: number;
  readonly accepted: number;
  readonly missed: number;
};

export type PracticeSessionDto = {
  readonly id: string;
  readonly startedAt: string;
  readonly source: PracticeSource;
  readonly currentIndex: number;
  readonly totalItems: number;
  readonly progress: PracticeProgressDto;
};

export type PracticeSessionResponse = {
  readonly session: PracticeSessionDto;
  readonly items: readonly ReviewQueueItem[];
};

export type ActivePracticeSessionResponse = {
  readonly session: PracticeSessionDto | null;
  readonly items: readonly ReviewQueueItem[];
};

export type StartPracticeSessionRequest = {
  readonly source: PracticeSource;
};

export type PracticeAnswerRequest = {
  readonly cardId: string;
  readonly answer: string;
  readonly answerType: CardAnswerType;
};

export type PracticeAnswerResponse = Omit<
  ReviewAnswerResponse,
  "previousSrs" | "nextSrs" | "srsTransition"
>;

export type PracticeSessionAnswerResponse = {
  readonly answer: PracticeAnswerResponse;
  readonly session: PracticeSessionDto;
};

export type FinishPracticeSessionResponse = {
  readonly session: PracticeSessionDto & { readonly finishedAt: string };
  readonly summary: PracticeProgressDto;
};

export type LessonMnemonicPurpose = "meaning" | "reading" | "story";

export type LessonHintPurpose = "meaning" | "reading" | "usage";

export type LessonMnemonicGroupDto = {
  readonly purpose: LessonMnemonicPurpose;
  readonly texts: BilingualTextDto;
};

export type LessonHintGroupDto = {
  readonly purpose: LessonHintPurpose;
  readonly texts: BilingualTextDto;
};

export type LessonQueueItem = {
  readonly item: ItemSummary;
  readonly cards: readonly LearningCardDto[];
  readonly unlockedBy: readonly ItemSummary[];
  readonly mnemonics: readonly LessonMnemonicGroupDto[];
  readonly hints: readonly LessonHintGroupDto[];
  readonly exampleSentences: readonly SentenceDto[];
};

export type LessonQueueSourceDto =
  | { readonly kind: "course" }
  | { readonly kind: "deck"; readonly deckId: string; readonly title: string };

export const SUPPORTED_LESSON_ORDER_MODES = ["course", "interleaved"] as const;
export type LessonOrderMode = (typeof SUPPORTED_LESSON_ORDER_MODES)[number];

export function isLessonOrderMode(value: unknown): value is LessonOrderMode {
  return (
    typeof value === "string" && (SUPPORTED_LESSON_ORDER_MODES as readonly string[]).includes(value)
  );
}

export type LessonQueueResponse = {
  /** Suggested default batch, already capped by batchLimit. */
  readonly items: readonly LessonQueueItem[];
  /** All currently eligible items the learner may choose from today. */
  readonly availableItems: readonly LessonQueueItem[];
  readonly batchLimit: number;
  readonly remainingToday: number;
  readonly orderMode: LessonOrderMode;
  readonly source: LessonQueueSourceDto;
};

export type LessonSessionDto = {
  readonly id: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly mode: "lesson";
  readonly deckId: string | null;
  readonly itemIds: readonly string[];
  readonly currentItemId: string;
  readonly phase: LessonSessionPhase;
};

export type LessonSessionPhase = "meaning" | "reading" | "context" | "quiz";

export type StartLessonSessionRequestDto = {
  readonly deckId?: string;
  readonly itemIds?: readonly string[];
};

export type StartLessonSessionResponse = {
  readonly session: LessonSessionDto;
};

export type ActiveLessonSessionResponse = {
  readonly session: LessonSessionDto | null;
  readonly items: readonly LessonQueueItem[];
  readonly source: LessonQueueSourceDto | null;
  readonly completedItemCount: number;
  readonly createdSrsStateCount: number;
};

export type UpdateLessonSessionProgressRequestDto = {
  readonly currentItemId: string;
  readonly phase: LessonSessionPhase;
};

export type UpdateLessonSessionProgressResponse = {
  readonly session: LessonSessionDto;
};

export type LessonAnswerFeedbackDto = {
  readonly cardId: string;
  readonly answerType: CardAnswerType;
  readonly accepted: boolean;
  readonly result: "correct" | "typo" | "blocked" | "wrong";
  readonly normalizedAnswer: string;
  readonly expected: readonly LocalizedTextDto[];
  readonly diagnostic?: AnswerDiagnosticDto | null;
};

export type AnswerDiagnosticDto = {
  readonly kind: "alternative-reading";
  readonly matchedAnswer: string;
};

export type CheckLessonAnswerRequestDto = {
  readonly itemId: string;
  readonly cardId: string;
  readonly answerType: CardAnswerType;
  readonly answer: string;
};

export type CheckLessonAnswerResponse = LessonAnswerFeedbackDto;

export type CompleteLessonItemResponse = {
  readonly itemId: string;
  readonly passed: boolean;
  readonly createdSrsStateCount: number;
  readonly answers: readonly LessonAnswerFeedbackDto[];
  readonly cards: readonly {
    readonly cardId: string;
    readonly srs: SrsStateSummaryDto;
  }[];
};

export type CompleteLessonItemRequestDto = {
  readonly itemId: string;
  readonly answers: readonly {
    readonly cardId: string;
    readonly answerType: CardAnswerType;
    readonly answer: string;
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
  readonly cardPercent: number;
  readonly itemsByType: readonly {
    readonly itemType: ItemKind;
    readonly totalItems: number;
    readonly locked: number;
    readonly available: number;
    readonly inProgress: number;
    readonly burned: number;
  }[];
};

export type DashboardWorkloadDto = {
  readonly reviews: {
    readonly dueNow: number;
    readonly next24Hours: number;
    readonly laterThisWeek: number;
    readonly budget: number;
    readonly pressurePercent: number;
  };
  readonly lessons: {
    readonly completedToday: number;
    readonly remainingToday: number;
    readonly dailyLimit: number;
    readonly percent: number;
  };
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

export type DashboardItemTypeCardCountsDto = Readonly<Record<ItemKind, number>>;

export type DashboardSrsStageSpreadDto = {
  readonly srsSystemId: string;
  readonly srsSystemTitle: string;
  readonly totalCards: number;
  readonly stages: readonly {
    readonly stageIndex: number;
    readonly name: string;
    readonly isBurned: boolean;
    readonly totalCards: number;
    readonly cardsByItemType: DashboardItemTypeCardCountsDto;
  }[];
};

export type DashboardRecentItemDto = {
  readonly occurredAt: string | null;
  readonly item: ItemSummary;
};

export type DashboardRecentActivityDto = {
  readonly mistakes: readonly DashboardRecentItemDto[];
  readonly availableLessons: readonly DashboardRecentItemDto[];
  readonly burned: readonly DashboardRecentItemDto[];
};

export type DashboardStudyActivityDto = {
  readonly rangeStart: string;
  readonly rangeEnd: string;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly activeDays: number;
  readonly totalReviews: number;
  readonly totalLessons: number;
  readonly days: readonly {
    readonly localDate: string;
    readonly reviewCount: number;
    readonly lessonCount: number;
    readonly totalCount: number;
  }[];
};

export const DASHBOARD_WIDGET_IDS = [
  "summary",
  "workload",
  "study-activity",
  "srs-stage-spread",
  "recent-activity",
  "course-progress",
  "review-forecast",
  "leech-candidates",
  "recent-review-stats",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];
export type DashboardWidgetPresentation = "compact" | "expanded";

export type DashboardWidgetPreferenceDto = {
  readonly id: DashboardWidgetId;
  readonly visible: boolean;
  readonly presentation: DashboardWidgetPresentation;
};

export const DEFAULT_DASHBOARD_WIDGET_PREFERENCES: readonly DashboardWidgetPreferenceDto[] =
  DASHBOARD_WIDGET_IDS.map((id) => ({
    id,
    visible: true,
    presentation:
      id === "course-progress" ||
      id === "review-forecast" ||
      id === "leech-candidates" ||
      id === "recent-review-stats"
        ? "compact"
        : "expanded",
  }));

export function normalizeDashboardWidgetPreferences(
  value: unknown,
): readonly DashboardWidgetPreferenceDto[] {
  const preferences: DashboardWidgetPreferenceDto[] = [];
  const seen = new Set<DashboardWidgetId>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        continue;
      }

      const record = entry as Record<string, unknown>;
      const id = record.id;
      const presentation = record.presentation;

      if (
        !isDashboardWidgetId(id) ||
        seen.has(id) ||
        typeof record.visible !== "boolean" ||
        (presentation !== "compact" && presentation !== "expanded")
      ) {
        continue;
      }

      seen.add(id);
      preferences.push({
        id,
        visible: record.visible,
        presentation,
      });
    }
  }

  for (const fallback of DEFAULT_DASHBOARD_WIDGET_PREFERENCES) {
    if (!seen.has(fallback.id)) {
      preferences.push(fallback);
    }
  }

  return preferences;
}

export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === "string" && (DASHBOARD_WIDGET_IDS as readonly string[]).includes(value);
}

export type DashboardDto = {
  readonly user: {
    readonly id: string;
    readonly displayName: string | null;
    readonly locale: AppLocale;
    readonly translationDisplayMode: TranslationDisplayMode;
    readonly timezone: string;
    readonly dashboardWidgets: readonly DashboardWidgetPreferenceDto[];
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
  readonly workload: DashboardWorkloadDto;
  readonly reviewForecast: readonly ReviewForecastBucketDto[];
  readonly srsStageSpread: readonly DashboardSrsStageSpreadDto[];
  readonly leechCandidates: readonly DashboardLeechCandidateDto[];
  readonly recentReviewStats: DashboardRecentReviewStatsDto;
  readonly recentActivity: DashboardRecentActivityDto;
  readonly studyActivity: DashboardStudyActivityDto;
};

export type KanaAssessmentItemDto = {
  readonly character: string;
  readonly script: KanaScript;
  readonly row: string;
  readonly order: number;
  readonly variant: KanaVariant;
  readonly baseCharacter: string;
  readonly attemptCount: number;
  readonly correctCount: number;
  readonly currentStreak: number;
  readonly mastered: boolean;
  readonly lastAnsweredAt: string | null;
};

export type KanaAssessmentProgressDto = {
  readonly script: KanaScript;
  readonly masteryThreshold: number;
  readonly totalCount: number;
  readonly attemptedCount: number;
  readonly masteredCount: number;
  readonly items: readonly KanaAssessmentItemDto[];
};

export type KanaAssessmentAnswerRequest = {
  readonly character: string;
  readonly answer: string;
};

export type KanaAssessmentAnswerResponse = {
  readonly correct: boolean;
  readonly normalizedAnswer: string;
  readonly expectedRomaji: string;
  readonly item: KanaAssessmentItemDto;
  readonly attemptedCount: number;
  readonly masteredCount: number;
};

export type KanaLessonItemDto = KanaAssessmentItemDto & {
  readonly romaji: string;
};

export type KanaLessonUnitDto = {
  readonly id: string;
  readonly script: KanaScript;
  readonly title: string;
  readonly order: number;
  readonly unlocked: boolean;
  readonly complete: boolean;
  readonly masteredCount: number;
  readonly totalCount: number;
  readonly items: readonly KanaLessonItemDto[];
};

export type KanaLessonPathDto = {
  readonly script: KanaScript;
  readonly masteryThreshold: number;
  readonly masteredCount: number;
  readonly totalCount: number;
  readonly units: readonly KanaLessonUnitDto[];
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
    readonly strategy: "dictionary-longest-match";
    readonly candidateCount: number;
    readonly matchedItemCount: number;
    readonly unmatchedCandidateCount: number;
    readonly discardedOverlapCount: number;
  };
};

export type DeckListResponse = {
  readonly decks: readonly DeckDto[];
};

export type UpdateDeckStatusRequest = {
  readonly status: Extract<DeckStatus, "active" | "archived">;
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
  readonly pagination: {
    readonly limit: number;
    readonly nextCursor: string | null;
  };
};

export type AdminReviewQueueFilters = {
  readonly band?: CourseBand;
  readonly jlptLevel?: "N5" | "N4" | "N3" | "N2";
  readonly status?: AdminContentStatus;
  readonly missingAcceptedAnswers?: boolean;
  readonly missingMnemonics?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
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

export const ADMIN_IMPORTED_CANDIDATE_REJECTION_REASONS = [
  "duplicate",
  "out-of-scope",
  "data-quality",
  "low-educational-value",
  "other",
] as const;

export type AdminImportedCandidateRejectionReason =
  (typeof ADMIN_IMPORTED_CANDIDATE_REJECTION_REASONS)[number];

export type AdminImportedCandidateRejectionDto = {
  readonly id: string;
  readonly targetType: "kanji" | "word";
  readonly targetId: string;
  readonly reason: AdminImportedCandidateRejectionReason;
  readonly note: string | null;
  readonly rejectedByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AdminImportedCandidateRejectionListItemDto = AdminImportedCandidateRejectionDto & {
  readonly japanese: string | null;
  readonly reading: string | null;
};

export type AdminImportedCandidateRejectionListResponse = {
  readonly rejections: readonly AdminImportedCandidateRejectionListItemDto[];
};

export type AdminRejectImportedCandidateRequest = {
  readonly reason: AdminImportedCandidateRejectionReason;
  readonly note?: string | null;
};

export type AdminRestoreImportedCandidateResponse = {
  readonly targetType: "kanji" | "word";
  readonly targetId: string;
  readonly restored: boolean;
};

export type AdminImportedCandidateDetailsDto = {
  readonly targetId: string;
  readonly itemType: "kanji" | "word";
  readonly japanese: string;
  readonly reading: string | null;
  readonly readings: readonly {
    readonly text: string;
    readonly type: "on" | "kun" | "nanori" | "other" | "word";
  }[];
  readonly meanings: {
    readonly ru: readonly string[];
    readonly en: readonly string[];
  };
  readonly jlptLevel: "N5" | "N4" | "N3" | "N2" | null;
  readonly sourcePriority: number | null;
  readonly schoolGrade: number | null;
  readonly strokeCount: number | null;
  readonly hasStrokeData: boolean | null;
  readonly source: {
    readonly name: "KANJIDIC2" | "JMdict";
    readonly sourceRecordId: string;
    readonly sourceUrl: string | null;
    readonly licenseName: string;
    readonly attributionText: string;
    readonly importRunId: string;
    readonly sourceVersion: string | null;
    readonly sourceFileName: string;
    readonly checksumSha256: string;
  };
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

export type AdminPrerequisiteCandidateDto = {
  readonly prerequisiteItemId: string;
  readonly prerequisiteTitle: string;
  readonly prerequisiteItemType: ItemKind;
  readonly prerequisiteStatus: AdminContentStatus;
  readonly selected: boolean;
  readonly requiredStage: number | null;
  readonly suggestionReason: "component" | "kanji" | "existing";
};

export type AdminPrerequisiteCandidateListResponse = {
  readonly itemId: string;
  readonly candidates: readonly AdminPrerequisiteCandidateDto[];
};

export type AdminUpdatePrerequisitesRequest = {
  readonly prerequisites: readonly {
    readonly prerequisiteItemId: string;
    readonly requiredStage?: number | null;
  }[];
};

export type AdminCourseLevelOptionDto = {
  readonly courseId: string;
  readonly courseTitle: string;
  readonly courseStatus: AdminContentStatus;
  readonly courseType: "structured" | "demo";
  readonly courseLevelId: string;
  readonly levelNumber: number;
  readonly levelTitle: string;
  readonly band: CourseBand;
  readonly selected: boolean;
  readonly sortOrder: number | null;
};

export type AdminCoursePlacementListResponse = {
  readonly itemId: string;
  readonly levels: readonly AdminCourseLevelOptionDto[];
};

export type AdminUpdateCoursePlacementsRequest = {
  readonly courseLevelIds: readonly string[];
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

export type AdminApproveImportedTranslationRequest = {
  readonly targetType: "kanji" | "word";
  readonly targetId: string;
  readonly title: string;
  readonly band: CourseBand;
  readonly level?: number | null;
  readonly meanings: {
    readonly ru: string;
    readonly en: string;
  };
  readonly acceptedAnswers: {
    readonly ru: readonly string[];
    readonly en: readonly string[];
  };
  readonly acceptedReadings: readonly string[];
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

export const CURRICULUM_SCALE_TARGETS = {
  kanji: 2_300,
  word: 8_000,
} as const;

export type AdminCurriculumScaleItemReadinessDto = {
  readonly itemType: "kanji" | "word";
  readonly targetItems: number;
  readonly publishedItems: number;
  readonly inCurationItems: number;
  readonly importedCandidates: number;
  readonly remainingToPublish: number;
  readonly candidatesNeeded: number;
  readonly fillableCandidateSlots: number;
  readonly capacityShortfall: number;
  readonly candidateCoverage: {
    readonly withReading: number;
    readonly withRussianMeaning: number;
    readonly withEnglishMeaning: number;
    readonly withBilingualMeanings: number;
    readonly withStrokeData: number | null;
  };
};

export type AdminCurriculumScaleReadinessDto = {
  readonly generatedAt: string;
  readonly items: readonly AdminCurriculumScaleItemReadinessDto[];
};

export type AdminCourseAllocationIssueCode =
  | "missing-band"
  | "missing-prerequisite"
  | "prerequisite-unavailable"
  | "prerequisite-cycle"
  | "prerequisite-after-band"
  | "capacity-exhausted"
  | "multiple-placements"
  | "placement-band-mismatch"
  | "placement-prerequisite-order";

export type AdminCourseAllocationIssueDto = {
  readonly learningItemId: string;
  readonly title: string;
  readonly code: AdminCourseAllocationIssueCode;
  readonly message: string;
};

export type AdminCourseAllocationPreviewItemDto = {
  readonly learningItemId: string;
  readonly title: string;
  readonly itemType: ItemKind;
  readonly band: CourseBand | null;
  readonly levelNumber: number;
  readonly prerequisiteLevelFloor: number;
  readonly placement: "existing" | "level-hint" | "balanced";
};

export type AdminCourseAllocationBandSummaryDto = {
  readonly band: CourseBand;
  readonly levelCount: number;
  readonly publishedItems: number;
  readonly existingPlacements: number;
  readonly proposedPlacements: number;
  readonly blockedItems: number;
};

export type AdminCourseAllocationPreviewResponse = {
  readonly policyVersion: "balanced-prerequisite-levels-v1";
  readonly planVersion: string;
  readonly generatedAt: string;
  readonly maxItemsPerLevel: number;
  readonly course: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly status: AdminContentStatus;
    readonly levelCount: number;
  };
  readonly summary: {
    readonly publishedItems: number;
    readonly existingPlacements: number;
    readonly proposedPlacements: number;
    readonly blockedItems: number;
  };
  readonly bands: readonly AdminCourseAllocationBandSummaryDto[];
  readonly items: readonly AdminCourseAllocationPreviewItemDto[];
  readonly issues: readonly AdminCourseAllocationIssueDto[];
  readonly itemsTruncated: boolean;
  readonly issuesTruncated: boolean;
};

export type AdminApplyCourseAllocationRequest = {
  readonly planVersion: string;
};

export type AdminApplyCourseAllocationResponse = {
  readonly appliedPlanVersion: string;
  readonly appliedAt: string;
  readonly createdPlacements: number;
  readonly preview: AdminCourseAllocationPreviewResponse;
};

export type AdminMainCourseReadinessCheckCode =
  | "course-state"
  | "course-blueprint"
  | "allocation-complete"
  | "published-placements-only"
  | "levels-populated"
  | "initial-lesson"
  | "kanji-target"
  | "word-target";

export type AdminMainCourseReadinessCheckDto = {
  readonly code: AdminMainCourseReadinessCheckCode;
  readonly passed: boolean;
  readonly title: string;
  readonly message: string;
  readonly current: number | null;
  readonly required: number | null;
};

export type AdminMainCoursePublicationReadinessResponse = {
  readonly policyVersion: "main-course-publication-readiness-v1";
  readonly readinessVersion: string;
  readonly allocationPlanVersion: string;
  readonly generatedAt: string;
  readonly readyToPublish: boolean;
  readonly course: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly status: AdminContentStatus;
  };
  readonly summary: {
    readonly passedChecks: number;
    readonly blockedChecks: number;
  };
  readonly checks: readonly AdminMainCourseReadinessCheckDto[];
};

export type AdminPublishMainCourseRequest = {
  readonly readinessVersion: string;
};

export type AdminPublishMainCourseResponse = {
  readonly appliedReadinessVersion: string;
  readonly publishedAt: string;
  readonly statusChanged: boolean;
  readonly readiness: AdminMainCoursePublicationReadinessResponse;
};

export type AdminMainCourseEnrollmentRolloutPreviewResponse = {
  readonly policyVersion: "main-course-enrollment-rollout-v1";
  readonly rolloutVersion: string;
  readonly readinessVersion: string;
  readonly generatedAt: string;
  readonly readyToApply: boolean;
  readonly strategy: "add-only";
  readonly course: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly status: AdminContentStatus;
  };
  readonly summary: {
    readonly learnerAccounts: number;
    readonly newEnrollments: number;
    readonly existingActiveEnrollments: number;
    readonly preservedInactiveEnrollments: number;
    readonly activeStarterEnrollments: number;
  };
};

export type AdminApplyMainCourseEnrollmentRolloutRequest = {
  readonly rolloutVersion: string;
};

export type AdminApplyMainCourseEnrollmentRolloutResponse = {
  readonly appliedRolloutVersion: string;
  readonly appliedAt: string;
  readonly createdEnrollments: number;
  readonly preview: AdminMainCourseEnrollmentRolloutPreviewResponse;
};

export type AdminCurriculumCandidatePlanItemDto = {
  readonly selectionRank: number;
  readonly targetId: string;
  readonly itemType: "kanji" | "word";
  readonly japanese: string;
  readonly reading: string | null;
  readonly score: number;
  readonly sourcePriority: number | null;
  readonly sourceName: "KANJIDIC2" | "JMdict";
  readonly suggestedBand: CourseBand;
  readonly prerequisiteKanji: readonly string[];
  readonly coverage: {
    readonly russianMeaning: boolean;
    readonly englishMeaning: boolean;
    readonly reading: boolean;
    readonly strokeData: boolean | null;
  };
};

export type AdminCurriculumCandidatePlanSummaryDto = {
  readonly policyVersion: "independent-frequency-prerequisites-v1";
  readonly targetItems: Readonly<Record<"kanji" | "word", number>>;
  readonly existingItems: Readonly<Record<"kanji" | "word", number>>;
  readonly candidateSlots: Readonly<Record<"kanji" | "word", number>>;
  readonly candidatePool: Readonly<Record<"kanji" | "word", number>>;
  readonly poolTruncated: Readonly<Record<"kanji" | "word", boolean>>;
  readonly selectedItems: Readonly<Record<"kanji" | "word", number>>;
  readonly unfilledSlots: Readonly<Record<"kanji" | "word", number>>;
  readonly excludedWordsMissingKanji: number;
  readonly bands: readonly {
    readonly band: CourseBand;
    readonly kanjiItems: number;
    readonly wordItems: number;
  }[];
};

export const ADMIN_CANDIDATE_PLAN_COVERAGE_FILTERS = [
  "bilingual",
  "missing-russian",
  "missing-english",
  "missing-reading",
  "missing-stroke-data",
] as const;

export type AdminCandidatePlanCoverageFilter =
  (typeof ADMIN_CANDIDATE_PLAN_COVERAGE_FILTERS)[number];

export type AdminCurriculumCandidatePlanResponse = {
  readonly planVersion: string;
  readonly generatedAt: string;
  readonly summary: AdminCurriculumCandidatePlanSummaryDto;
  readonly page: {
    readonly itemType: "kanji" | "word";
    readonly search: string | null;
    readonly band: CourseBand | null;
    readonly coverage: AdminCandidatePlanCoverageFilter | null;
    readonly offset: number;
    readonly limit: number;
    readonly total: number;
    readonly hasMore: boolean;
  };
  readonly candidates: readonly AdminCurriculumCandidatePlanItemDto[];
};

export type AdminEnqueueCandidatePlanRequest = {
  readonly planVersion: string;
  readonly candidates: readonly {
    readonly targetId: string;
    readonly itemType: "kanji" | "word";
  }[];
};

export type AdminEnqueueCandidatePlanResponse = {
  readonly planVersion: string;
  readonly requestedCount: number;
  readonly enqueuedCount: number;
  readonly alreadyQueuedCount: number;
  readonly items: readonly {
    readonly learningItemId: string;
    readonly targetId: string;
    readonly itemType: "kanji" | "word";
    readonly status: AdminContentStatus;
  }[];
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
