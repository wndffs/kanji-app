"use client";

import { useEffect, useState } from "react";

import { isLessonPronunciationMode, type LessonPronunciationMode } from "@kanji-srs/shared";

import { AUTH_CHANGED_EVENT, readStoredSession } from "./auth-storage";
import { type UserSettingsDto } from "./api-client";

export type LessonPronunciationPreferences = {
  readonly mode: LessonPronunciationMode;
  readonly showRomaji: boolean;
};

export const DEFAULT_LESSON_PRONUNCIATION_PREFERENCES: LessonPronunciationPreferences = {
  mode: "kana",
  showRomaji: false,
};

export function resolveLessonPronunciationPreferences(
  settings: Partial<UserSettingsDto> | null | undefined,
): LessonPronunciationPreferences {
  return {
    mode: isLessonPronunciationMode(settings?.lessonPronunciationMode)
      ? settings.lessonPronunciationMode
      : DEFAULT_LESSON_PRONUNCIATION_PREFERENCES.mode,
    showRomaji: settings?.lessonRomaji === true,
  };
}

export function useLessonPronunciationPreferences(): LessonPronunciationPreferences {
  const [preferences, setPreferences] = useState(DEFAULT_LESSON_PRONUNCIATION_PREFERENCES);

  useEffect(() => {
    const updatePreferences = () => {
      setPreferences(resolveLessonPronunciationPreferences(readStoredSession()?.user.settings));
    };

    updatePreferences();
    window.addEventListener(AUTH_CHANGED_EVENT, updatePreferences);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, updatePreferences);
    };
  }, []);

  return preferences;
}
