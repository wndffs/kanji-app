import { type TranslationDisplayMode } from "@kanji-srs/shared";
import { buildKanjiDraft07 } from "./editorial-draft-kanji-07";
import { buildWordDraft07, type EditorialWordDraftBatch } from "./editorial-draft-words-07";
import { buildMainCourseContentBatches, validateMainCourseContentBatches, type MainCourseContentBatch, type MainCourseLocalizedText } from "./main-course-content";
import { buildMainCourseWordBatches, wordHanCharacters } from "./main-course-word-content";

export function buildEditorialDraftPreview(mode: TranslationDisplayMode, kanjiDraft: MainCourseContentBatch = buildKanjiDraft07(), wordDraft: EditorialWordDraftBatch = buildWordDraft07()) {
  if (!["ru", "en", "ru-en"].includes(mode)) throw new Error("Unsupported draft translation mode.");
  const kanjiBatches = [...buildMainCourseContentBatches(), kanjiDraft];
  const issues = [...validateMainCourseContentBatches(kanjiBatches)];
  const kanjiByCharacter = new Map(kanjiBatches.flatMap((batch) => batch.kanji.map((item) => [item.character, item] as const)));
  const approvedPairs = new Set(buildMainCourseWordBatches().flatMap((batch) => batch.words.map((word) => `${word.expression}:${word.reading}`)));
  const slots = new Set<number>();
  const localize = (text: MainCourseLocalizedText) => ({ ...(mode !== "en" ? { ru: text.ru } : {}), ...(mode !== "ru" ? { en: text.en } : {}) });
  const words = wordDraft.words.map((word) => {
    const pair = `${word.expression}:${word.reading}`;
    if (approvedPairs.has(pair)) issues.push(`Duplicate word pair: ${pair}`);
    approvedPairs.add(pair);
    if (slots.has(word.sortOrder)) issues.push(`Duplicate word slot: ${word.sortOrder}`);
    slots.add(word.sortOrder);
    const requiredKanji = wordHanCharacters(word.expression + word.example.japaneseText);
    for (const character of requiredKanji) {
      const prerequisite = kanjiByCharacter.get(character);
      if (!prerequisite || prerequisite.levelNumber >= wordDraft.levelNumber) issues.push(`Missing earlier kanji ${character} for ${pair}`);
    }
    return {
      kind: "word", japanese: word.expression, reading: word.reading, levelNumber: wordDraft.levelNumber, sortOrder: word.sortOrder,
      meanings: localize({ ru: word.meanings.ru.primary, en: word.meanings.en.primary }),
      meaningMnemonic: localize(word.meaningMnemonic), readingMnemonic: localize(word.readingMnemonic),
      meaningHint: localize(word.meaningHint), readingHint: localize(word.readingHint),
      example: { japanese: word.example.japaneseText, reading: word.example.readingText,
        translations: localize({ ru: word.example.translationRu, en: word.example.translationEn }) },
      requiredKanji,
    };
  });
  return {
    scope: "source-only-draft-preview", publicationApproved: false, translationDisplayMode: mode,
    validation: { valid: issues.length === 0, issues: [...new Set(issues)].sort() },
    components: kanjiDraft.components.map((item, index) => ({ kind: "component", key: item.key, japanese: item.symbol,
      levelNumber: kanjiDraft.componentLevelNumber, sortOrder: (kanjiDraft.componentSortOrderStart ?? 1) + index,
      meanings: localize(item.meaning), shapeDescription: localize(item.shapeDescription), meaningMnemonic: localize(item.mnemonic) })),
    kanji: kanjiDraft.kanji.map((item) => ({ kind: "kanji", japanese: item.character, reading: item.reading.primary,
      levelNumber: item.levelNumber, sortOrder: item.sortOrder, componentKeys: item.componentKeys,
      meanings: localize({ ru: item.meanings.ru.primary, en: item.meanings.en.primary }),
      meaningMnemonic: localize(item.meaningMnemonic), readingMnemonic: localize(item.readingMnemonic) })),
    words,
  };
}
