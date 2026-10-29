import { type LexicalKind } from "./lexical-selection";

const pairs: readonly (readonly [string, string, LexicalKind, number])[] = [
  ["食べる", "たべる", "verb", 3], ["飲む", "のむ", "verb", 3],
  ["行く", "いく", "verb", 3], ["会う", "あう", "verb", 3],
  ["入る", "はいる", "verb", 3], ["出る", "でる", "verb", 3],
  ["見る", "みる", "verb", 3], ["聞く", "きく", "verb", 3],
  ["話す", "はなす", "verb", 2], ["読む", "よむ", "verb", 3],
  ["書く", "かく", "verb", 3], ["休む", "やすむ", "verb", 2],
  ["立つ", "たつ", "verb", 2],
  ["大きい", "おおきい", "i-adjective", 3], ["小さい", "ちいさい", "i-adjective", 3],
  ["早い", "はやい", "i-adjective", 3], ["長い", "ながい", "i-adjective", 3],
  ["白い", "しろい", "i-adjective", 2], ["赤い", "あかい", "i-adjective", 2],
  ["多い", "おおい", "i-adjective", 2], ["正しい", "ただしい", "i-adjective", 3],
  ["午前", "ごぜん", "noun", 3], ["午後", "ごご", "noun", 3],
  ["名前", "なまえ", "noun", 3], ["日本語", "にほんご", "noun", 3],
  ["外国語", "がいこくご", "noun", 3], ["読書", "どくしょ", "noun", 2],
  ["今月", "こんげつ", "noun", 2], ["今後", "こんご", "noun", 2],
  ["何時", "なんじ", "noun", 2],
];

export const WAVE08_CANDIDATES = pairs.map(([expression, reading, kind, usefulness]) => ({
  expression, reading, kind, usefulness,
}));
