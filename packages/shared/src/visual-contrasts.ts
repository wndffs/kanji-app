export const VISUAL_KANJI_CONTRASTS = [
  { characters: ["日", "目"], ru: "日 и 目: внутри 日 одна горизонтальная черта, внутри 目 — две. Считайте внутренние черты, а не только высоту рамки.", en: "日 and 目: 日 has one inner horizontal stroke; 目 has two. Count the inner strokes instead of relying on the frame's height." },
  { characters: ["人", "入"], ru: "人 и 入: у 人 левый падающий штрих выходит к верхушке. У 入 короткий левый штрих начинается ниже и соединяется с верхней частью правого. Сравнивайте верхнее соединение штрихов.", en: "人 and 入: in 人 the left-falling stroke reaches the top. In 入 the shorter left stroke begins lower and meets the upper part of the right stroke. Compare the top junction." },
  { characters: ["大", "犬"], ru: "大 и 犬: у 犬 есть дополнительная точка справа вверху. Точка различает знаки; это не правило получения их чтения.", en: "大 and 犬: 犬 has an extra dot at the upper right. The dot distinguishes the shapes; it is not a rule for deriving their readings." },
] as const;

export function visualContrastFor(character: string) {
  return VISUAL_KANJI_CONTRASTS.find((contrast) =>
    contrast.characters.some((candidate) => candidate === character),
  ) ?? null;
}
