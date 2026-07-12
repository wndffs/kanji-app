export type JapaneseSpeechVoice = {
  readonly default?: boolean;
  readonly lang: string;
};

export function selectJapaneseVoice<T extends JapaneseSpeechVoice>(voices: readonly T[]): T | null {
  const japaneseVoices = voices.filter((voice) => normalizeLanguage(voice.lang).startsWith("ja"));

  return (
    japaneseVoices.find(
      (voice) => voice.default === true && normalizeLanguage(voice.lang) === "ja-jp",
    ) ??
    japaneseVoices.find((voice) => normalizeLanguage(voice.lang) === "ja-jp") ??
    japaneseVoices.find((voice) => voice.default === true) ??
    japaneseVoices[0] ??
    null
  );
}

function normalizeLanguage(language: string): string {
  return language.trim().toLocaleLowerCase("en-US").replaceAll("_", "-");
}
