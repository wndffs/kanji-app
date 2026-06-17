import { DEFAULT_TRANSLATION_DISPLAY_MODE, isTranslationDisplayMode } from "@kanji-srs/shared";

import { type UserSettingsDto } from "./auth.types";

export const DEFAULT_USER_SETTINGS: UserSettingsDto = {
  locale: "ru-RU",
  translationDisplayMode: DEFAULT_TRANSLATION_DISPLAY_MODE,
  timezone: "Europe/Moscow",
  dailyLessonLimit: 10,
  reviewBudget: 100,
  strictMode: false,
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
    reviewBudget: normalizePositiveInteger(input.reviewBudget, DEFAULT_USER_SETTINGS.reviewBudget),
    strictMode: input.strictMode ?? DEFAULT_USER_SETTINGS.strictMode,
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
