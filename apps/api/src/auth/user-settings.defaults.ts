import {
  DEFAULT_DASHBOARD_WIDGET_PREFERENCES,
  DEFAULT_SPEECH_RATE,
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  MAX_SPEECH_RATE,
  MIN_SPEECH_RATE,
  isLessonOrderMode,
  isLessonPronunciationMode,
  isReviewOrderMode,
  isTranslationDisplayMode,
  normalizeDashboardWidgetPreferences,
} from "@kanji-srs/shared";

import { type UserSettingsDto } from "./auth.types";

export const DEFAULT_USER_SETTINGS: UserSettingsDto = {
  locale: "ru-RU",
  translationDisplayMode: DEFAULT_TRANSLATION_DISPLAY_MODE,
  timezone: "Europe/Moscow",
  dailyLessonLimit: 10,
  lessonBatchSize: 5,
  lessonOrderMode: "course",
  reviewBudget: 100,
  reviewOrderMode: "shuffled",
  strictMode: false,
  vacationStartedAt: null,
  speechVoiceUri: null,
  speechRate: DEFAULT_SPEECH_RATE,
  speechAutoplay: false,
  soundFeedback: false,
  lessonPronunciationMode: "kana",
  lessonRomaji: false,
  dashboardWidgets: DEFAULT_DASHBOARD_WIDGET_PREFERENCES,
};

export function mergeUserSettings(input: Partial<UserSettingsDto> = {}): UserSettingsDto {
  return {
    locale: "ru-RU",
    translationDisplayMode:
      input.translationDisplayMode !== undefined &&
      isTranslationDisplayMode(input.translationDisplayMode)
        ? input.translationDisplayMode
        : DEFAULT_USER_SETTINGS.translationDisplayMode,
    timezone: normalizeTimezone(input.timezone),
    dailyLessonLimit: normalizePositiveInteger(
      input.dailyLessonLimit,
      DEFAULT_USER_SETTINGS.dailyLessonLimit,
    ),
    lessonBatchSize: normalizeBoundedInteger(input.lessonBatchSize, 1, 5, 5),
    lessonOrderMode: isLessonOrderMode(input.lessonOrderMode) ? input.lessonOrderMode : "course",
    reviewBudget: normalizePositiveInteger(input.reviewBudget, DEFAULT_USER_SETTINGS.reviewBudget),
    reviewOrderMode: isReviewOrderMode(input.reviewOrderMode)
      ? input.reviewOrderMode
      : DEFAULT_USER_SETTINGS.reviewOrderMode,
    strictMode: input.strictMode ?? DEFAULT_USER_SETTINGS.strictMode,
    vacationStartedAt: normalizeVacationStartedAt(input.vacationStartedAt),
    speechVoiceUri: normalizeSpeechVoiceUri(input.speechVoiceUri),
    speechRate: normalizeSpeechRate(input.speechRate),
    speechAutoplay: input.speechAutoplay ?? DEFAULT_USER_SETTINGS.speechAutoplay,
    soundFeedback: input.soundFeedback ?? DEFAULT_USER_SETTINGS.soundFeedback,
    lessonPronunciationMode: isLessonPronunciationMode(input.lessonPronunciationMode)
      ? input.lessonPronunciationMode
      : DEFAULT_USER_SETTINGS.lessonPronunciationMode,
    lessonRomaji: input.lessonRomaji ?? DEFAULT_USER_SETTINGS.lessonRomaji,
    dashboardWidgets: normalizeDashboardWidgetPreferences(input.dashboardWidgets),
  };
}

function normalizeSpeechVoiceUri(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeSpeechRate(value: number | undefined): number {
  return value !== undefined &&
    Number.isFinite(value) &&
    value >= MIN_SPEECH_RATE &&
    value <= MAX_SPEECH_RATE
    ? value
    : DEFAULT_SPEECH_RATE;
}

function normalizeVacationStartedAt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeTimezone(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_USER_SETTINGS.timezone;
  }

  return value.trim();
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizeBoundedInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  return value !== undefined && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}
