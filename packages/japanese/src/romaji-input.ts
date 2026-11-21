import { toKatakana } from "wanakana";

const ROMAJI_RUN = /(?:n['\u2019]|[a-z-])+/gi;

export function romajiToKatakanaInput(value: string, finalize = false): string {
  // Transliterate only romaji; kana typed with a Japanese keyboard should stay as entered.
  return value.replace(ROMAJI_RUN, (run) =>
    toKatakana(run.replaceAll("\u2019", "'"), { IMEMode: !finalize }),
  );
}
