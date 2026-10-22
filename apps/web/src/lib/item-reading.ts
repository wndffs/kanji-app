import { romanizeKana } from "@kanji-srs/japanese";

export type ItemReadingPreferences = {
  readonly mode: "kana" | "furigana" | "hide";
  readonly showRomaji: boolean;
};

export function resolveItemReadingPreferences(
  settings?: {
    readonly lessonPronunciationMode?: unknown;
    readonly lessonRomaji?: unknown;
  } | null,
): ItemReadingPreferences {
  const mode = settings?.lessonPronunciationMode;
  return {
    mode: mode === "furigana" ? mode : "kana",
    showRomaji: settings?.lessonRomaji === true,
  };
}

export function itemReadingPresentation(
  reading: string | null | undefined,
  preferences: ItemReadingPreferences,
  revealed = false,
) {
  const knownReading = reading?.trim() || null;
  const hidden = knownReading !== null && preferences.mode === "hide" && !revealed;
  const visible = hidden ? null : knownReading;
  return {
    hidden,
    furigana: preferences.mode === "furigana" ? visible : null,
    kana: preferences.mode === "kana" || (preferences.mode === "hide" && revealed) ? visible : null,
    romaji: preferences.showRomaji && visible !== null ? romanizeKana(visible) : null,
  };
}
