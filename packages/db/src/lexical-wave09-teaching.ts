import { type LexicalKind } from "./lexical-selection";

export type Wave09Identity = {
  readonly expression: string;
  readonly reading: string;
  readonly jmdictEntryId: string;
  readonly partOfSpeech: LexicalKind;
};
const row = (expression: string, reading: string, id: string, partOfSpeech: LexicalKind): Wave09Identity => ({
  expression, reading, jmdictEntryId: `jmdict:${id}`, partOfSpeech,
});

// Exact source identities, not an automatic list of accepted dictionary senses.
export const WAVE09_ACTIONS: readonly Wave09Identity[] = [
  row("話す", "はなす", "1562350", "verb"),
  row("休む", "やすむ", "1227560", "verb"),
  row("立つ", "たつ", "1597040", "verb"),
  row("分かる", "わかる", "1606560", "verb"),
  row("知る", "しる", "1420470", "verb"),
  row("使う", "つかう", "1305990", "verb"),
  row("作る", "つくる", "1597890", "verb"),
  row("帰る", "かえる", "1221270", "verb"),
  row("白い", "しろい", "1474910", "i-adjective"),
  row("赤い", "あかい", "1383240", "i-adjective"),
  row("多い", "おおい", "1407460", "i-adjective"),
];
