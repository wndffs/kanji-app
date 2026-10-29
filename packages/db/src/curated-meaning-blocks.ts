import { normalizeMeaning } from "@kanji-srs/japanese";

export type CuratedMeaningBlock = { readonly text: string; readonly reason: string };
type Meanings = Readonly<
  Record<
    "ru" | "en",
    {
      readonly accepted: readonly string[];
      readonly blocked?: readonly CuratedMeaningBlock[];
    }
  >
>;

export function buildCuratedMeaningBlocks(meanings: Meanings) {
  return (
    [
      ["ru", "ru-RU"],
      ["en", "en-US"],
    ] as const
  ).flatMap(([key, locale]) =>
    (meanings[key].blocked ?? []).map((block) => ({
      ...block,
      normalizedText: normalizeMeaning(block.text, locale),
    })),
  );
}

export function validateCuratedMeaningBlocks(meanings: Meanings): readonly string[] {
  const accepted = new Set(
    (
      [
        ["ru", "ru-RU"],
        ["en", "en-US"],
      ] as const
    ).flatMap(([key, locale]) =>
      meanings[key].accepted.map((text) => normalizeMeaning(text, locale)),
    ),
  );
  const seen = new Set<string>();
  const issues: string[] = [];
  for (const block of buildCuratedMeaningBlocks(meanings)) {
    if (
      !block.normalizedText ||
      !block.reason.trim() ||
      accepted.has(block.normalizedText) ||
      seen.has(block.normalizedText)
    )
      issues.push("Invalid, duplicate or accepted curated meaning block.");
    seen.add(block.normalizedText);
  }
  return issues;
}
