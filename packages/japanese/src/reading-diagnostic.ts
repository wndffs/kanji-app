import { normalizeJapaneseReading } from "./index";

export type ReadingDifference = "small-tsu" | "small-kana" | "vowel-spelling";

// A post-answer explanation only: never normalize these differences for grading.
export function diagnoseReadingDifference(
  answer: string,
  expected: readonly string[],
): ReadingDifference | null {
  if (answer.length > 128 || expected.length > 64) return null;
  const actual = normalizeJapaneseReading(answer);
  if (!actual || !/^[ぁ-ゖー]+$/u.test(actual)) return null;
  const targets = expected.filter((text) => text.length <= 128).map(normalizeJapaneseReading);
  if (targets.includes(actual)) return null;
  for (const target of targets) {
    if (!target || !/^[ぁ-ゖー]+$/u.test(target)) continue;
    if (target.replace(/っ/gu, "") === actual.replace(/っ/gu, "")) return "small-tsu";
    const fullSize = (text: string) =>
      text.replace(
        /[ゃゅょぁぃぅぇぉっ]/gu,
        (character) =>
          ({
            ゃ: "や",
            ゅ: "ゆ",
            ょ: "よ",
            ぁ: "あ",
            ぃ: "い",
            ぅ: "う",
            ぇ: "え",
            ぉ: "お",
            っ: "つ",
          })[character]!,
      );
    if (fullSize(target) === fullSize(actual))
      return target.includes("っ") || actual.includes("っ") ? "small-tsu" : "small-kana";
    if (
      Math.abs(target.length - actual.length) <= 2 &&
      target.replace(/[あいうえおー]/gu, "") === actual.replace(/[あいうえおー]/gu, "")
    )
      return "vowel-spelling";
  }
  return null;
}
