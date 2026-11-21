import { normalizeJapaneseReading } from "@kanji-srs/japanese";

const HAN = /^\p{Script=Han}$/u;
const KANA = /^[ぁ-ゖー]$/u;
const MAX_EXAMPLE_LENGTH = 256;

function reachableOffsets(written: readonly string[], kana: readonly string[]) {
  let prior = new Uint8Array(kana.length + 1);
  prior[0] = 1;
  for (let i = 0; i < written.length; i++) {
    const symbol = written[i]!;
    const next = new Uint8Array(kana.length + 1);
    if (HAN.test(symbol)) {
      // A run of unannotated kanji consumes one or more kana. Literal kana and
      // punctuation still need to match exactly on either side of that run.
      while (i + 1 < written.length && HAN.test(written[i + 1]!)) i++;
      for (let end = 1; end <= kana.length; end++)
        if (KANA.test(kana[end - 1]!) && (prior[end - 1] || next[end - 1])) next[end] = 1;
    } else {
      for (let end = 1; end <= kana.length; end++)
        if (prior[end - 1] && symbol === kana[end - 1]) next[end] = 1;
    }
    prior = next;
  }
  return prior;
}

/** Structural check only; it cannot attest the reading of unannotated kanji. */
export function matchesAuthoredExampleReading(
  expression: string,
  reading: string,
  sentence: string,
  sentenceReading: string,
): boolean {
  const form = normalizeJapaneseReading(expression);
  const answer = normalizeJapaneseReading(reading);
  const written = normalizeJapaneseReading(sentence);
  const kana = normalizeJapaneseReading(sentenceReading);
  if (
    !form ||
    !answer ||
    ![...answer].every((symbol) => KANA.test(symbol)) ||
    written.length > MAX_EXAMPLE_LENGTH ||
    kana.length > MAX_EXAMPLE_LENGTH
  )
    return false;
  const chars = [...kana];
  const reversed = [...chars].reverse();
  const answerLength = [...answer].length;
  for (
    let index = written.indexOf(form);
    index >= 0;
    index = written.indexOf(form, index + form.length)
  ) {
    const prefix = reachableOffsets([...written.slice(0, index)], chars);
    const suffix = reachableOffsets([...written.slice(index + form.length)].reverse(), reversed);
    for (let offset = 0; offset + answerLength <= chars.length; offset++)
      if (
        prefix[offset] &&
        suffix[chars.length - offset - answerLength] &&
        chars.slice(offset, offset + answerLength).join("") === answer
      )
        return true;
  }
  return false;
}
