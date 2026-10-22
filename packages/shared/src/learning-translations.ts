import type {
  BilingualTextDto,
  ContentLocale,
  LocalizedTextDto,
  TranslationBundleDto,
  TranslationDisplayMode,
} from "./index";

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
