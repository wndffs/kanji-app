import type {
  BilingualTextDto,
  ContentLocale,
  LocalizedTextDto,
  TranslationBundleDto,
  TranslationDisplayMode,
} from "./index";

export function getOtherKanjiMeanings(
  dictionary: BilingualTextDto,
  learning: BilingualTextDto,
  accepted: readonly LocalizedTextDto[],
  includeImported: boolean,
): BilingualTextDto {
  const key = (text: LocalizedTextDto) =>
    `${text.locale}:${text.text.normalize("NFKC").trim().toLowerCase()}`;
  const seen = new Set([...learning.ru, ...learning.en, ...accepted].map(key));
  const collect = (texts: readonly LocalizedTextDto[], locale: ContentLocale) =>
    texts
      .filter(
        (text) =>
          text.locale === locale &&
          (text.sourceKind === "curated" || (includeImported && text.sourceKind === "imported")),
      )
      .sort((a, b) => Number(b.sourceKind === "curated") - Number(a.sourceKind === "curated"))
      .filter((text) => {
        if (text.text.trim() === "" || seen.has(key(text))) return false;
        seen.add(key(text));
        return true;
      });

  return { ru: collect(dictionary.ru, "ru-RU"), en: collect(dictionary.en, "en-US") };
}

export function buildLearningTranslationBundle(
  translations: BilingualTextDto,
  displayMode: TranslationDisplayMode,
  meaningAnswers: readonly LocalizedTextDto[] = [],
): TranslationBundleDto {
  const select = (texts: readonly LocalizedTextDto[], locale: ContentLocale) => {
    const answers = meaningAnswers.filter(
      (text) => text.locale === locale && text.sourceKind === "curated",
    );
    const curated = texts.filter((text) => text.locale === locale && text.sourceKind === "curated");
    const chosen = answers.length
      ? answers
      : curated.length
        ? curated
        : texts.filter((text) => text.locale === locale);
    const unique = new Map<string, LocalizedTextDto>();
    for (const text of chosen) {
      const previous = unique.get(text.text);
      if (previous === undefined || (!previous.isPrimary && text.isPrimary))
        unique.set(text.text, text);
    }
    return [...unique.values()];
  };
  const ru = select(translations.ru, "ru-RU");
  const en = select(translations.en, "en-US");
  return {
    ru,
    en,
    displayMode,
    primaryRu: ru.find((text) => text.isPrimary)?.text ?? ru[0]?.text ?? null,
    primaryEn: en.find((text) => text.isPrimary)?.text ?? en[0]?.text ?? null,
  };
}
