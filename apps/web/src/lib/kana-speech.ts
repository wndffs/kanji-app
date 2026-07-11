import { type KanaLessonItemDto } from "@kanji-srs/shared";

export type KanaSpeechVoice = {
  readonly default?: boolean;
  readonly lang: string;
};

export function selectJapaneseVoice<T extends KanaSpeechVoice>(voices: readonly T[]): T | null {
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

export function buildKanaSpeechText(
  item: Pick<KanaLessonItemDto, "character" | "variant">,
): string {
  if (item.variant !== "sokuon") {
    return item.character;
  }

  const characters = Array.from(item.character);
  const followingKana = characters.slice(1).join("");

  return followingKana === "" ? item.character : `${followingKana}${item.character}`;
}

function normalizeLanguage(language: string): string {
  return language.trim().toLocaleLowerCase("en-US").replaceAll("_", "-");
}
