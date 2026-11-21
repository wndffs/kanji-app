const KANJI = /^\p{Unified_Ideograph}$/u;
const HAN = /^\p{Script=Han}$/u;
const ITERATION_MARK = "々";

export function wordHanCharacters(text: string): readonly string[] {
  return [
    ...new Set(
      [...text].filter((character) => character !== ITERATION_MARK && HAN.test(character)),
    ),
  ];
}

export function validKanjiIterationMarks(text: string): boolean {
  const characters = [...text];
  return characters.every(
    (character, index) => character !== ITERATION_MARK || KANJI.test(characters[index - 1] ?? ""),
  );
}
