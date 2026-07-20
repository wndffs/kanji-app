import {
  DEFAULT_SPEECH_RATE,
  MAX_SPEECH_RATE,
  MIN_SPEECH_RATE,
} from "@kanji-srs/shared";

export type JapaneseSpeechVoice = {
  readonly default?: boolean;
  readonly lang: string;
  readonly voiceURI?: string;
};

export function getJapaneseVoices<T extends JapaneseSpeechVoice>(voices: readonly T[]): readonly T[] {
  return voices.filter((voice) => normalizeLanguage(voice.lang).startsWith("ja"));
}

export function selectJapaneseVoice<T extends JapaneseSpeechVoice>(
  voices: readonly T[],
  preferredVoiceUri: string | null = null,
): T | null {
  const japaneseVoices = getJapaneseVoices(voices);

  return (
    (preferredVoiceUri === null
      ? undefined
      : japaneseVoices.find((voice) => voice.voiceURI === preferredVoiceUri)) ??
    japaneseVoices.find(
      (voice) => voice.default === true && normalizeLanguage(voice.lang) === "ja-jp",
    ) ??
    japaneseVoices.find((voice) => normalizeLanguage(voice.lang) === "ja-jp") ??
    japaneseVoices.find((voice) => voice.default === true) ??
    japaneseVoices[0] ??
    null
  );
}

export function normalizeSpeechRate(value: number | undefined): number {
  return value !== undefined &&
    Number.isFinite(value) &&
    value >= MIN_SPEECH_RATE &&
    value <= MAX_SPEECH_RATE
    ? value
    : DEFAULT_SPEECH_RATE;
}

function normalizeLanguage(language: string): string {
  return language.trim().toLocaleLowerCase("en-US").replaceAll("_", "-");
}
