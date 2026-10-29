import { findKana, normalizeRomaji } from "./kana";

// Original project selection, not a borrowed curriculum or a claim of identical shapes.
export const KANA_VISUAL_GROUPS = [
  ["シ", "ツ"],
  ["ソ", "ン"],
  ["ク", "ケ"],
  ["ウ", "ワ"],
  ["ぬ", "め"],
  ["ね", "れ", "わ"],
  ["る", "ろ"],
  ["は", "ほ"],
] as const;

export function kanaDistractorPriority(expected: string, candidate: string): number {
  const left = findKana(expected);
  const right = findKana(candidate);
  if (
    left &&
    right &&
    left.baseCharacter === right.baseCharacter &&
    left.variant !== "yoon" &&
    right.variant !== "yoon"
  )
    return 0;
  if (
    KANA_VISUAL_GROUPS.some(
      (group) =>
        (group as readonly string[]).includes(expected) &&
        (group as readonly string[]).includes(candidate),
    )
  )
    return 1;
  return left && right && left.row === right.row ? 2 : 3;
}

export function kanaReadingAliases(character: string, romaji: string): readonly string[] {
  return [
    ...new Set([romaji, ...(findKana(character)?.acceptedRomaji ?? [])].map(normalizeRomaji)),
  ];
}

export type KanaConfusion = {
  readonly category: "script" | "marks" | "small-kana" | "shape" | "reading";
  readonly ru: string;
  readonly en: string;
};
export function explainKanaContrast(expected: string, selected: string): KanaConfusion | null {
  if (expected === selected) return null;
  const left = findKana(expected),
    right = findKana(selected);
  if (!left || !right) return null;
  const pairRu = `${selected} — ${right.romaji}; ${expected} — ${left.romaji}.`;
  const pairEn = `${selected}: ${right.romaji}; ${expected}: ${left.romaji}.`;
  if (
    left.script !== right.script &&
    kanaReadingAliases(expected, left.romaji).some((x) =>
      kanaReadingAliases(selected, right.romaji).includes(x),
    )
  )
    return {
      category: "script",
      ru: `Звук совпадает, но азбуки разные. ${pairRu}`,
      en: `The sound overlaps, but the scripts differ. ${pairEn}`,
    };
  if (
    left.variant === "yoon" &&
    right.variant === "yoon" &&
    left.baseCharacter === right.baseCharacter
  )
    return {
      category: "small-kana",
      ru: `Сравните маленькие ゃ・ゅ・ょ (ャ・ュ・ョ), а не дакутэн. ${pairRu}`,
      en: `Compare the small ゃ/ゅ/ょ (ャ/ュ/ョ), not dakuten marks. ${pairEn}`,
    };
  if (
    left.baseCharacter === right.baseCharacter &&
    [left.variant, right.variant].some((v) => v === "dakuten" || v === "handakuten")
  )
    return {
      category: "marks",
      ru: `Сравните отсутствие метки, две черты ゛ и кружок ゜. ${pairRu}`,
      en: `Compare no mark, the two dakuten marks ゛, and the handakuten circle ゜. ${pairEn}`,
    };
  const shapes: readonly { chars: readonly string[]; ru: string; en: string }[] = [
    {
      chars: ["シ", "ツ"],
      ru: "У シ короткие штрихи расположены более вертикально слева, у ツ — более горизонтально сверху.",
      en: "シ has a more vertical arrangement of short strokes on the left; ツ has a more horizontal arrangement at the top.",
    },
    {
      chars: ["ソ", "ン"],
      ru: "Сравните наклон короткого штриха и положение начала длинной линии у ソ и ン.",
      en: "Compare the short-stroke angle and the start of the long stroke in ソ and ン.",
    },
    {
      chars: ["ぬ", "め"],
      ru: "У ぬ есть маленькая петля справа внизу; у め её нет.",
      en: "ぬ has a small loop at the lower right; め does not.",
    },
    {
      chars: ["る", "ろ"],
      ru: "У る есть нижняя петля; у ろ её нет.",
      en: "る has a lower loop; ろ does not.",
    },
    {
      chars: ["は", "ほ"],
      ru: "Сравните число верхних перекладин справа: одна у は, две у ほ.",
      en: "Compare the upper crossbars on the right: one in は, two in ほ.",
    },
    {
      chars: ["ね", "れ", "わ"],
      ru: "Сравните правую часть: маленькую петлю ね, вытянутый хвост れ и округлую дугу わ.",
      en: "Compare the right side: the small loop in ね, the extended tail in れ, and the rounded curve in わ.",
    },
  ];
  const shape = shapes.find((x) => x.chars.includes(expected) && x.chars.includes(selected));
  return shape
    ? { category: "shape", ru: `${shape.ru} ${pairRu}`, en: `${shape.en} ${pairEn}` }
    : {
        category: "reading",
        ru: `Сравните форму и чтение. ${pairRu}`,
        en: `Compare shape and reading. ${pairEn}`,
      };
}

export function buildDistinctKanaChoices<
  T extends { readonly character: string; readonly romaji: string; readonly order: number },
>(items: readonly T[], current: T, limit: number): readonly T[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 8)
    throw new Error("Invalid kana choice limit.");
  const ranked = [
    current,
    ...items
      .filter((item) => item.character !== current.character)
      .sort(
        (a, b) =>
          kanaDistractorPriority(current.character, a.character) -
            kanaDistractorPriority(current.character, b.character) ||
          Math.abs(a.order - current.order) - Math.abs(b.order - current.order) ||
          a.order - b.order ||
          (a.character < b.character ? -1 : a.character > b.character ? 1 : 0),
      ),
  ];
  const aliases = new Set<string>();
  const characters = new Set<string>();
  const selected: T[] = [];
  for (const item of ranked) {
    const readings = kanaReadingAliases(item.character, item.romaji);
    if (characters.has(item.character) || readings.some((reading) => aliases.has(reading)))
      continue;
    selected.push(item);
    characters.add(item.character);
    readings.forEach((reading) => aliases.add(reading));
    if (selected.length === limit) break;
  }
  const offset = Math.abs(current.order) % selected.length;
  return [...selected.slice(offset), ...selected.slice(0, offset)];
}
