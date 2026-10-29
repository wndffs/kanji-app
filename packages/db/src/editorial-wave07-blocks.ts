import { type CuratedMeaningBlock } from "./curated-meaning-blocks";

const blocks = (answers: readonly string[], reason: string): readonly CuratedMeaningBlock[] =>
  answers.map((text) => ({ text, reason }));

export const WAVE07_MEANING_BLOCKS: Readonly<
  Record<
    string,
    {
      readonly ru: readonly CuratedMeaningBlock[];
      readonly en: readonly CuratedMeaningBlock[];
    }
  >
> = {
  兄: {
    ru: blocks(
      ["старый брат", "младший брат", "брат"],
      "Нужен старший брат: не пожилой, не младший и не просто брат.",
    ),
    en: blocks(
      ["other brother", "younger brother", "brother"],
      "Older brother, not another or younger brother; keep the age distinction.",
    ),
  },
  姉: {
    ru: blocks(
      ["старая сестра", "младшая сестра", "сестра"],
      "Нужна старшая сестра: не пожилая, не младшая и не просто сестра.",
    ),
    en: blocks(
      ["other sister", "younger sister", "sister"],
      "Older sister, not another or younger sister; keep the age distinction.",
    ),
  },
  弟: {
    ru: blocks(["старший брат", "брат"], "Нужен младший брат, а не старший или просто брат."),
    en: blocks(
      ["older brother", "elder brother", "brother"],
      "Younger brother, not an older brother; keep the age distinction.",
    ),
  },
  妹: {
    ru: blocks(
      ["старшая сестра", "сестра"],
      "Нужна младшая сестра, а не старшая или просто сестра.",
    ),
    en: blocks(
      ["older sister", "elder sister", "sister"],
      "Younger sister, not an older sister; keep the age distinction.",
    ),
  },
  父母: {
    ru: blocks(["отец и брат"], "Отец и мать, не отец и брат."),
    en: blocks(["father and brother"], "Father and mother, not father and brother."),
  },
};
