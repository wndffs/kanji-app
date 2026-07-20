import {
  DEFAULT_DASHBOARD_WIDGET_PREFERENCES,
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  isLessonOrderMode,
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
  strictMode: false,
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
    strictMode: input.strictMode ?? DEFAULT_USER_SETTINGS.strictMode,
    dashboardWidgets: normalizeDashboardWidgetPreferences(input.dashboardWidgets),
  };
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
