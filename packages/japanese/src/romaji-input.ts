import { toHiragana, toKatakana } from "wanakana";
import { type KanaScript } from "./kana";

const ROMAJI_RUN = /(?:n['\u2019]|[a-z-])+/gi;

export function romajiToKanaInput(value: string, script: KanaScript, finalize = false): string {
  const convert = script === "katakana" ? toKatakana : toHiragana;
  // Transliterate only romaji; kana typed with a Japanese keyboard should stay as entered.
  return value.replace(ROMAJI_RUN, (run) =>
    convert(run.replaceAll("\u2019", "'"), { IMEMode: !finalize }),
  );
}
