import { normalizeJapaneseReading } from "@kanji-srs/japanese";
import { nextEditorialWave, type EditorialWaveInput } from "./editorial-wave";

export function auditWaveReadings(input: EditorialWaveInput = nextEditorialWave()) {
  const kana = (text: string) =>
    /^[\u3041-\u3096ー]+$/u.test(text) && normalizeJapaneseReading(text) === text;
  let invalidPrimary = 0;
  let invalidAlternatives = 0;
  let sourceReadingMismatch = 0;
  let alternativeCount = 0;
  for (const item of input.kanji.kanji) {
    if (!kana(item.reading.primary)) invalidPrimary++;
    if (normalizeJapaneseReading(item.reading.source) !== item.reading.primary)
      sourceReadingMismatch++;
    const readings = item.reading.accepted;
    if (
      !readings.includes(item.reading.primary) ||
      readings.some((text) => !kana(text)) ||
      new Set(readings).size !== readings.length
    )
      invalidAlternatives++;
    alternativeCount += readings.filter((text) => text !== item.reading.primary).length;
  }
  for (const word of input.words.words) {
    if (!kana(word.reading)) invalidPrimary++;
    const alternatives = word.acceptedReadings ?? [];
    if (
      alternatives.some((text) => !kana(text) || text === word.reading) ||
      new Set(alternatives).size !== alternatives.length
    )
      invalidAlternatives++;
    alternativeCount += alternatives.length;
    if (!word.example.japaneseText.trim() || !word.example.readingText.trim()) invalidPrimary++;
  }
  return {
    primaryReadings: input.kanji.kanji.length + input.words.words.length,
    alternativeReadings: alternativeCount,
    invalidPrimary,
    invalidAlternatives,
    sourceReadingMismatch,
    valid: invalidPrimary === 0 && invalidAlternatives === 0 && sourceReadingMismatch === 0,
    sourceAttested: false as const,
  };
}
