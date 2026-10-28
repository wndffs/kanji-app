import { normalizeMeaning } from "@kanji-srs/japanese";
import { nextEditorialWave, type EditorialWaveInput } from "./editorial-wave";

export function auditWaveRussian(input: EditorialWaveInput = nextEditorialWave()) {
  return auditWaveLocale("ru", input);
}
export function auditWaveLocale(
  locale: "ru" | "en",
  input: EditorialWaveInput = nextEditorialWave(),
) {
  const language = locale === "ru" ? ("ru-RU" as const) : ("en-US" as const);
  const normalize = (value: string) => normalizeMeaning(value, language);
  let missingFields = 0;
  let invalidAcceptedSets = 0;
  let semanticContrasts = 0;
  let wrongScript = 0;
  const present = (value: string) => {
    if (!normalize(value)) missingFields++;
  };
  for (const item of input.kanji.components) {
    for (const value of [
      item.displayName[locale],
      item.meaning[locale],
      item.shapeDescription[locale],
      item.mnemonic[locale],
    ])
      present(value);
  }
  for (const item of [...input.kanji.kanji, ...input.words.words]) {
    const meanings = item.meanings[locale];
    present(meanings.primary);
    present(item.meaningMnemonic[locale]);
    present(item.readingMnemonic[locale]);
    if (
      meanings.primary.trim() &&
      (locale === "ru"
        ? !/\p{Script=Cyrillic}/u.test(meanings.primary)
        : /\p{Script=Cyrillic}/u.test(meanings.primary))
    )
      wrongScript++;
    const accepted = meanings.accepted.map(normalize);
    if (
      !accepted.includes(normalize(meanings.primary)) ||
      accepted.some((answer) => !answer) ||
      new Set(accepted).size !== accepted.length
    )
      invalidAcceptedSets++;
    const symbol = "character" in item ? item.character : item.expression;
    const age =
      symbol === "兄" || symbol === "姉"
        ? "older"
        : symbol === "弟" || symbol === "妹"
          ? "younger"
          : null;
    const required =
      locale === "ru"
        ? age === "older"
          ? /старш/u
          : /младш/u
        : age === "older"
          ? /\b(older|elder)\b/u
          : /\byounger\b/u;
    const prohibited =
      locale === "ru"
        ? age === "older"
          ? /младш/u
          : /старш/u
        : age === "older"
          ? /\byounger\b/u
          : /\b(older|elder)\b/u;
    if (
      age &&
      (!required.test(normalize(meanings.primary)) ||
        accepted.some((answer) => !required.test(answer) || prohibited.test(answer)))
    )
      semanticContrasts++;
  }
  for (const item of input.words.words) {
    present(item.meaningHint[locale]);
    present(item.readingHint[locale]);
    present(locale === "ru" ? item.example.translationRu : item.example.translationEn);
  }
  return {
    locale: language,
    missingFields,
    invalidAcceptedSets,
    semanticContrasts,
    wrongScript,
    valid:
      missingFields === 0 &&
      invalidAcceptedSets === 0 &&
      semanticContrasts === 0 &&
      wrongScript === 0,
    independentlyReviewed: false as const,
  };
}
