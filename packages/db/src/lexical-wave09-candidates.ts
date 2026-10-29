import { type LexicalKind } from "./lexical-selection";

// Independent topic order; usefulness is an editorial score, not corpus frequency.
const pairs: readonly (readonly [string, string, LexicalKind, string])[] = [
  ["話す", "はなす", "verb", "communication"],
  ["休む", "やすむ", "verb", "routine"],
  ["立つ", "たつ", "verb", "movement"],
  ["分かる", "わかる", "verb", "understanding"],
  ["知る", "しる", "verb", "understanding"],
  ["使う", "つかう", "verb", "daily-actions"],
  ["作る", "つくる", "verb", "daily-actions"],
  ["帰る", "かえる", "verb", "movement"],
  ["白い", "しろい", "i-adjective", "description"],
  ["赤い", "あかい", "i-adjective", "description"],
  ["多い", "おおい", "i-adjective", "quantity"],
  ["読書", "どくしょ", "noun", "routine"],
  ["今月", "こんげつ", "noun", "calendar"],
  ["今後", "こんご", "noun", "time"],
  ["何時", "なんじ", "noun", "time"],
  ["毎日", "まいにち", "noun", "calendar"],
  ["毎月", "まいつき", "noun", "calendar"],
  ["毎年", "まいとし", "noun", "calendar"],
  ["時間", "じかん", "noun", "time"],
  ["語学", "ごがく", "noun", "study"],
];
export const WAVE09_CANDIDATES = pairs.map(([expression, reading, kind, topic]) => ({
  expression, reading, kind, topic, usefulness: 3,
}));

// Reserved topics, not reviewed teaching and not a promised modern-JLPT list.
export const WAVE09_DEFERRED_TOPICS = [
  "午前中: exact local pair lacks RU source; not publication eligible",
  "shopping: 買う・売る・店・買い物",
  "work: 仕事・働く・会社員",
  "health: 病院・薬・体調",
  "travel: 旅行・駅・運転",
] as const;
