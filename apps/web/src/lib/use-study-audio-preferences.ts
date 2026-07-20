"use client";

import { useEffect, useState } from "react";

import { DEFAULT_SPEECH_RATE } from "@kanji-srs/shared";

import { AUTH_CHANGED_EVENT, readStoredSession } from "./auth-storage";
import { normalizeSpeechRate } from "./japanese-speech";
import { type UserSettingsDto } from "./api-client";

export type StudyAudioPreferences = {
  readonly speechVoiceUri: string | null;
  readonly speechRate: number;
  readonly speechAutoplay: boolean;
  readonly soundFeedback: boolean;
};

export const DEFAULT_STUDY_AUDIO_PREFERENCES: StudyAudioPreferences = {
  speechVoiceUri: null,
  speechRate: DEFAULT_SPEECH_RATE,
  speechAutoplay: false,
  soundFeedback: false,
};

export function resolveStudyAudioPreferences(
  settings: Partial<UserSettingsDto> | null | undefined,
): StudyAudioPreferences {
  const speechVoiceUri = settings?.speechVoiceUri?.trim();

  return {
    speechVoiceUri:
      speechVoiceUri === undefined || speechVoiceUri === "" ? null : speechVoiceUri,
    speechRate: normalizeSpeechRate(settings?.speechRate),
    speechAutoplay: settings?.speechAutoplay === true,
    soundFeedback: settings?.soundFeedback === true,
  };
}

export function useStudyAudioPreferences(): StudyAudioPreferences {
  const [preferences, setPreferences] = useState(DEFAULT_STUDY_AUDIO_PREFERENCES);

  useEffect(() => {
    const updatePreferences = () => {
      setPreferences(resolveStudyAudioPreferences(readStoredSession()?.user.settings));
    };

    updatePreferences();
    window.addEventListener(AUTH_CHANGED_EVENT, updatePreferences);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, updatePreferences);
    };
  }, []);

  return preferences;
}
