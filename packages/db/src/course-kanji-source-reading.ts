import { katakanaToHiragana } from "@kanji-srs/japanese";

export type CourseKanjiSourceReading = {
  readonly source: string;
  readonly sourceType?: "ja_on" | "ja_kun";
  readonly sourceForm?: "okurigana-stem";
};

export type CourseReinforcementSoundChange = "tsu-sokuon";

export function boundCourseKana(
  source: CourseKanjiSourceReading,
  characters: readonly string[],
  index: number,
  wordReading: string,
  offset: number,
  soundChange?: CourseReinforcementSoundChange,
): string | null {
  const kana = selectedCourseSourceKana(source);
  if (!kana || !Number.isSafeInteger(offset) || offset < 0) return null;
  let inWord = kana;
  if (soundChange !== undefined) {
    // A final on-reading つ can become っ before an unvoiced obstruent in a compound.
    if (
      soundChange !== "tsu-sokuon" ||
      source.sourceType !== "ja_on" ||
      !kana.endsWith("つ") ||
      !/^\p{Script=Han}$/u.test(characters[index + 1] ?? "") ||
      !/^[かきくけこさしすせそたちつてとぱぴぷぺぽ]/u.test(wordReading.slice(offset + kana.length))
    )
      return null;
    inWord = `${kana.slice(0, -1)}っ`;
  }
  return wordReading.startsWith(inWord, offset) ? inWord : null;
}

export function normalizeKanjidic2SourceReading(reading: string): string {
  return katakanaToHiragana(reading.normalize("NFKC").trim()).replace(/[.-]/gu, "");
}

export function kanjidic2Okurigana(reading: string) {
  const parts = /^([ぁ-ゖー]+)\.([ぁ-ゖー]+)$/u.exec(reading);
  return parts ? { stem: parts[1]!, ending: parts[2]! } : null;
}

export function selectedCourseSourceKana(reading: CourseKanjiSourceReading) {
  if (reading.sourceForm === undefined) return normalizeKanjidic2SourceReading(reading.source);
  if (reading.sourceForm !== "okurigana-stem" || reading.sourceType !== "ja_kun") return null;
  return kanjidic2Okurigana(reading.source)?.stem ?? null;
}

export function selectAuthoredSourceReading(source: string): CourseKanjiSourceReading {
  if (/[ァ-ヶ]/u.test(source)) return { source, sourceType: "ja_on" };
  return {
    source,
    sourceType: "ja_kun",
    ...(kanjidic2Okurigana(source) ? { sourceForm: "okurigana-stem" } : {}),
  };
}
