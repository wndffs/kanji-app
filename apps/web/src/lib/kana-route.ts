import { type KanaPracticeScript, type KanaScript } from "@kanji-srs/shared";

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
