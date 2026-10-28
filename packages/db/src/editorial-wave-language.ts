import { normalizeMeaning } from "@kanji-srs/japanese";
import { nextEditorialWave, type EditorialWaveInput } from "./editorial-wave";

export function auditWaveRussian(input: EditorialWaveInput = nextEditorialWave()) {
  let missingFields = 0; let invalidAcceptedSets = 0; let semanticContrasts = 0;
  const present = (value: string) => { if (!normalizeMeaning(value)) missingFields++; };
  for (const item of input.kanji.components) {
    for (const value of [item.displayName.ru, item.meaning.ru, item.shapeDescription.ru, item.mnemonic.ru]) present(value);
  }
  for (const item of [...input.kanji.kanji, ...input.words.words]) {
    const meanings = item.meanings.ru;
    present(meanings.primary); present(item.meaningMnemonic.ru); present(item.readingMnemonic.ru);
    const accepted = meanings.accepted.map((answer) => normalizeMeaning(answer));
    if (!accepted.includes(normalizeMeaning(meanings.primary)) || accepted.some((answer) => !answer) || new Set(accepted).size !== accepted.length) invalidAcceptedSets++;
    const symbol = "character" in item ? item.character : item.expression;
    const required = symbol === "兄" || symbol === "姉" ? "старш" : symbol === "弟" || symbol === "妹" ? "младш" : null;
    const prohibited = required === "старш" ? "младш" : "старш";
    if (required && (!normalizeMeaning(meanings.primary).includes(required) || accepted.some((answer) => !answer.includes(required) || answer.includes(prohibited)))) semanticContrasts++;
  }
  for (const item of input.words.words) {
    present(item.meaningHint.ru); present(item.readingHint.ru); present(item.example.translationRu);
  }
  return { locale: "ru-RU" as const, missingFields, invalidAcceptedSets, semanticContrasts,
    valid: missingFields === 0 && invalidAcceptedSets === 0 && semanticContrasts === 0,
    independentlyReviewed: false as const };
}
