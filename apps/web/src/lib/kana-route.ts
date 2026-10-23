import { type KanaPracticeScript, type KanaScript, type KanaLessonPathDto } from "@kanji-srs/shared";

export type KanaRouteMode = "lessons" | "assessment" | "practice";

export type KanaRouteSelection = {
  readonly mode: KanaRouteMode;
  readonly lessonScript: KanaScript;
  readonly practiceScript: KanaPracticeScript;
};

export function parseKanaRouteSelection(
  params: Record<string, string | string[] | undefined>,
): KanaRouteSelection {
  const mode = readFirst(params.mode);
  const script = readFirst(params.script);
  const practiceScript: KanaPracticeScript =
    script === "katakana" || script === "mixed" ? script : "hiragana";

  return {
    mode: mode === "assessment" || mode === "practice" ? mode : "lessons",
    lessonScript: practiceScript === "katakana" ? "katakana" : "hiragana",
    practiceScript,
  };
}

function readFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseKanaLessonDestination(params: Record<string, string | string[] | undefined>) {
  const unitId = readFirst(params.unit);
  const character = readFirst(params.character)?.normalize("NFKC");
  return { unitId: unitId && /^[a-z0-9-]{1,128}$/iu.test(unitId) ? unitId : null,
    character: character && /^[\p{Script=Hiragana}\p{Script=Katakana}ー]{1,4}$/u.test(character) ? character : null };
}

export function resolveKanaLessonDestination(path: KanaLessonPathDto, unitId: string | null, character: string | null) {
  const unit = unitId === null ? path.units.find((unit) => unit.unlocked && unit.items.some((item) => item.character === character)) : path.units.find((unit) => unit.id === unitId && unit.unlocked);
  return unit === undefined ? null : { unit, character: unit.items.some((item) => item.character === character) ? character : null };
}

export function kanaLessonHref(script: KanaScript, unitId: string, character: string) {
  return `/kana?${new URLSearchParams({ script, mode: "lessons", unit: unitId, character })}`;
}
