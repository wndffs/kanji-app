export type KanaScript = "hiragana" | "katakana";

export type KanaCharacter = {
  readonly character: string;
  readonly script: KanaScript;
  readonly romaji: string;
  readonly acceptedRomaji: readonly string[];
  readonly row: string;
  readonly order: number;
};

type KanaDefinition = readonly [
  hiragana: string,
  katakana: string,
  romaji: string,
  row: string,
  aliases?: readonly string[],
];

const BASIC_KANA_DEFINITIONS: readonly KanaDefinition[] = [
  ["あ", "ア", "a", "vowels"],
  ["い", "イ", "i", "vowels"],
  ["う", "ウ", "u", "vowels"],
  ["え", "エ", "e", "vowels"],
  ["お", "オ", "o", "vowels"],
  ["か", "カ", "ka", "k"],
  ["き", "キ", "ki", "k"],
  ["く", "ク", "ku", "k"],
  ["け", "ケ", "ke", "k"],
  ["こ", "コ", "ko", "k"],
  ["さ", "サ", "sa", "s"],
  ["し", "シ", "shi", "s", ["si"]],
  ["す", "ス", "su", "s"],
  ["せ", "セ", "se", "s"],
  ["そ", "ソ", "so", "s"],
  ["た", "タ", "ta", "t"],
  ["ち", "チ", "chi", "t", ["ti"]],
  ["つ", "ツ", "tsu", "t", ["tu"]],
  ["て", "テ", "te", "t"],
  ["と", "ト", "to", "t"],
  ["な", "ナ", "na", "n"],
  ["に", "ニ", "ni", "n"],
  ["ぬ", "ヌ", "nu", "n"],
  ["ね", "ネ", "ne", "n"],
  ["の", "ノ", "no", "n"],
  ["は", "ハ", "ha", "h"],
  ["ひ", "ヒ", "hi", "h"],
  ["ふ", "フ", "fu", "h", ["hu"]],
  ["へ", "ヘ", "he", "h"],
  ["ほ", "ホ", "ho", "h"],
  ["ま", "マ", "ma", "m"],
  ["み", "ミ", "mi", "m"],
  ["む", "ム", "mu", "m"],
  ["め", "メ", "me", "m"],
  ["も", "モ", "mo", "m"],
  ["や", "ヤ", "ya", "y"],
  ["ゆ", "ユ", "yu", "y"],
  ["よ", "ヨ", "yo", "y"],
  ["ら", "ラ", "ra", "r"],
  ["り", "リ", "ri", "r"],
  ["る", "ル", "ru", "r"],
  ["れ", "レ", "re", "r"],
  ["ろ", "ロ", "ro", "r"],
  ["わ", "ワ", "wa", "w"],
  ["を", "ヲ", "wo", "w", ["o"]],
  ["ん", "ン", "n", "n-final"],
];

export const BASIC_KANA: readonly KanaCharacter[] = BASIC_KANA_DEFINITIONS.flatMap(
  ([hiragana, katakana, romaji, row, aliases = []], order) => {
    const acceptedRomaji = [romaji, ...aliases];

    return [
      { character: hiragana, script: "hiragana", romaji, acceptedRomaji, row, order },
      { character: katakana, script: "katakana", romaji, acceptedRomaji, row, order },
    ];
  },
);

const KANA_BY_CHARACTER = new Map(BASIC_KANA.map((kana) => [kana.character, kana]));

export function listBasicKana(script: KanaScript): readonly KanaCharacter[] {
  return BASIC_KANA.filter((kana) => kana.script === script);
}

export function findBasicKana(character: string): KanaCharacter | null {
  return KANA_BY_CHARACTER.get(character.normalize("NFKC")) ?? null;
}

export function normalizeRomaji(input: string): string {
  return input
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s'’-]+/gu, "");
}

export function isKanaRomajiAccepted(kana: KanaCharacter, answer: string): boolean {
  const normalized = normalizeRomaji(answer);

  return kana.acceptedRomaji.some((candidate) => normalizeRomaji(candidate) === normalized);
}
