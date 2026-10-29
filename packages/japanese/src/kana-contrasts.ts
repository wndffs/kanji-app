import { findKana, normalizeRomaji } from "./kana";

// Original project selection, not a borrowed curriculum or a claim of identical shapes.
export const KANA_VISUAL_GROUPS = [
  ["シ", "ツ"], ["ソ", "ン"], ["ク", "ケ"], ["ウ", "ワ"],
  ["ぬ", "め"], ["ね", "れ", "わ"], ["る", "ろ"], ["は", "ほ"],
] as const;

export function kanaDistractorPriority(expected: string, candidate: string): number {
  const left = findKana(expected);
  const right = findKana(candidate);
  if (left && right && left.baseCharacter === right.baseCharacter) return 0;
  if (KANA_VISUAL_GROUPS.some(group => (group as readonly string[]).includes(expected) && (group as readonly string[]).includes(candidate))) return 1;
  return left && right && left.row === right.row ? 2 : 3;
}

export function kanaReadingAliases(character: string, romaji: string): readonly string[] {
  return [...new Set([romaji, ...(findKana(character)?.acceptedRomaji ?? [])].map(normalizeRomaji))];
}

export function buildDistinctKanaChoices<T extends {readonly character: string; readonly romaji: string; readonly order: number}>(
  items: readonly T[], current: T, limit: number,
): readonly T[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) throw new Error("Invalid kana choice limit.");
  const ranked = [current, ...items.filter(item => item.character !== current.character).sort((a,b) =>
    kanaDistractorPriority(current.character,a.character) - kanaDistractorPriority(current.character,b.character) ||
    Math.abs(a.order-current.order)-Math.abs(b.order-current.order) || a.order-b.order ||
    (a.character < b.character ? -1 : a.character > b.character ? 1 : 0))];
  const aliases = new Set<string>();
  const characters = new Set<string>();
  const selected: T[] = [];
  for (const item of ranked) {
    const readings = kanaReadingAliases(item.character,item.romaji);
    if (characters.has(item.character) || readings.some(reading => aliases.has(reading))) continue;
    selected.push(item);
    characters.add(item.character);
    readings.forEach(reading => aliases.add(reading));
    if (selected.length === limit) break;
  }
  const offset = Math.abs(current.order) % selected.length;
  return [...selected.slice(offset),...selected.slice(0,offset)];
}
