import { katakanaToHiragana } from "@kanji-srs/japanese";

export type CourseKanjiSourceReading = {
  readonly source: string;
  readonly sourceType?: "ja_on" | "ja_kun";
  readonly sourceForm?: "okurigana-stem";
};

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
