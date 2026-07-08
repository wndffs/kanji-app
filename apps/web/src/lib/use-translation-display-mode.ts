"use client";

import { useEffect, useState } from "react";

import { type TranslationDisplayMode } from "@kanji-srs/shared";

import {
  AUTH_CHANGED_EVENT,
  readTranslationDisplayMode,
  TRANSLATION_DISPLAY_MODE_CHANGED_EVENT,
} from "./auth-storage";

export function useTranslationDisplayMode(): TranslationDisplayMode {
  const [displayMode, setDisplayMode] = useState<TranslationDisplayMode>("ru");

  useEffect(() => {
    function syncDisplayMode(): void {
      setDisplayMode(readTranslationDisplayMode());
    }

    syncDisplayMode();
    window.addEventListener(AUTH_CHANGED_EVENT, syncDisplayMode);
    window.addEventListener(TRANSLATION_DISPLAY_MODE_CHANGED_EVENT, syncDisplayMode);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncDisplayMode);
      window.removeEventListener(TRANSLATION_DISPLAY_MODE_CHANGED_EVENT, syncDisplayMode);
    };
  }, []);

  return displayMode;
}
