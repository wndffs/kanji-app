export function formatKanjiJlptLevel(
  modernLevel: number | null,
  legacyLevel?: number | null,
): string | null {
  if (modernLevel !== null && Number.isInteger(modernLevel) && modernLevel >= 1 && modernLevel <= 5)
    return `N${modernLevel}`;
  return legacyLevel != null &&
    Number.isInteger(legacyLevel) &&
    legacyLevel >= 1 &&
    legacyLevel <= 4
    ? `до 2010: ${legacyLevel}`
    : null;
}
