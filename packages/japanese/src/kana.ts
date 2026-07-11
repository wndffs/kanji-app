export type KanaScript = "hiragana" | "katakana";
export type KanaVariant = "basic" | "dakuten" | "handakuten";

export type KanaCharacter = {
  readonly character: string;
  readonly script: KanaScript;
  readonly romaji: string;
  readonly acceptedRomaji: readonly string[];
  readonly row: string;
  readonly order: number;
  readonly variant: KanaVariant;
  readonly baseCharacter: string;
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

type ModifiedKanaDefinition = readonly [
  baseHiragana: string,
  baseKatakana: string,
  hiragana: string,
  katakana: string,
  romaji: string,
  row: string,
  variant: Exclude<KanaVariant, "basic">,
  aliases?: readonly string[],
];

const MODIFIED_KANA_DEFINITIONS: readonly ModifiedKanaDefinition[] = [
  ["か", "カ", "が", "ガ", "ga", "g", "dakuten"],
  ["き", "キ", "ぎ", "ギ", "gi", "g", "dakuten"],
  ["く", "ク", "ぐ", "グ", "gu", "g", "dakuten"],
  ["け", "ケ", "げ", "ゲ", "ge", "g", "dakuten"],
  ["こ", "コ", "ご", "ゴ", "go", "g", "dakuten"],
  ["さ", "サ", "ざ", "ザ", "za", "z", "dakuten"],
  ["し", "シ", "じ", "ジ", "ji", "z", "dakuten", ["zi"]],
  ["す", "ス", "ず", "ズ", "zu", "z", "dakuten"],
  ["せ", "セ", "ぜ", "ゼ", "ze", "z", "dakuten"],
  ["そ", "ソ", "ぞ", "ゾ", "zo", "z", "dakuten"],
  ["た", "タ", "だ", "ダ", "da", "d", "dakuten"],
  ["ち", "チ", "ぢ", "ヂ", "ji", "d", "dakuten", ["di"]],
  ["つ", "ツ", "づ", "ヅ", "zu", "d", "dakuten", ["du"]],
  ["て", "テ", "で", "デ", "de", "d", "dakuten"],
  ["と", "ト", "ど", "ド", "do", "d", "dakuten"],
  ["は", "ハ", "ば", "バ", "ba", "b", "dakuten"],
  ["ひ", "ヒ", "び", "ビ", "bi", "b", "dakuten"],
  ["ふ", "フ", "ぶ", "ブ", "bu", "b", "dakuten"],
  ["へ", "ヘ", "べ", "ベ", "be", "b", "dakuten"],
  ["ほ", "ホ", "ぼ", "ボ", "bo", "b", "dakuten"],
  ["は", "ハ", "ぱ", "パ", "pa", "p", "handakuten"],
  ["ひ", "ヒ", "ぴ", "ピ", "pi", "p", "handakuten"],
  ["ふ", "フ", "ぷ", "プ", "pu", "p", "handakuten"],
  ["へ", "ヘ", "ぺ", "ペ", "pe", "p", "handakuten"],
  ["ほ", "ホ", "ぽ", "ポ", "po", "p", "handakuten"],
];

export const BASIC_KANA: readonly KanaCharacter[] = BASIC_KANA_DEFINITIONS.flatMap(
  ([hiragana, katakana, romaji, row, aliases = []], order) => {
    const acceptedRomaji = [romaji, ...aliases];

    return [
      {
        character: hiragana,
        script: "hiragana" as const,
        romaji,
        acceptedRomaji,
        row,
        order,
        variant: "basic" as const,
        baseCharacter: hiragana,
      },
      {
        character: katakana,
        script: "katakana" as const,
        romaji,
        acceptedRomaji,
        row,
        order,
        variant: "basic" as const,
        baseCharacter: katakana,
      },
    ];
  },
);

export const MODIFIED_KANA: readonly KanaCharacter[] = MODIFIED_KANA_DEFINITIONS.flatMap(
  ([baseHiragana, baseKatakana, hiragana, katakana, romaji, row, variant, aliases = []], index) => {
    const acceptedRomaji = [romaji, ...aliases];
    const order = BASIC_KANA_DEFINITIONS.length + index;

    return [
      {
        character: hiragana,
        script: "hiragana" as const,
        romaji,
        acceptedRomaji,
        row,
        order,
        variant,
        baseCharacter: baseHiragana,
      },
      {
        character: katakana,
        script: "katakana" as const,
        romaji,
        acceptedRomaji,
        row,
        order,
        variant,
        baseCharacter: baseKatakana,
      },
    ];
  },
);

export const KANA: readonly KanaCharacter[] = [...BASIC_KANA, ...MODIFIED_KANA];

const BASIC_KANA_BY_CHARACTER = new Map(BASIC_KANA.map((kana) => [kana.character, kana]));
const KANA_BY_CHARACTER = new Map(KANA.map((kana) => [kana.character, kana]));

export function listBasicKana(script: KanaScript): readonly KanaCharacter[] {
  return BASIC_KANA.filter((kana) => kana.script === script);
}

export function findBasicKana(character: string): KanaCharacter | null {
  return BASIC_KANA_BY_CHARACTER.get(character.normalize("NFKC")) ?? null;
}

export function listKana(script: KanaScript): readonly KanaCharacter[] {
  return KANA.filter((kana) => kana.script === script);
}

export function findKana(character: string): KanaCharacter | null {
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
