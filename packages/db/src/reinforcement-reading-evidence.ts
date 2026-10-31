import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";

export const REINFORCEMENT_GAP_CHARACTERS = [
  ..."映駅化界寒漢顔近京教業局苦県向広黒才思住昭勝色組族待台題着働通持皮悲美筆福平辺理良緑礼雪終",
];

// Editorial alignment to an exact primary word pair, not automatic character splitting.
// Prefix/suffix locate the taught sound in the checked whole-word reading.
const ALIGNMENTS = [
  ["映", "えい", "上映", "じょう", "", "1352650"],
  ["駅", "えき", "駅員", "", "いん", "1175150"],
  ["化", "か", "強化", "きょう", "", "1236200"],
  ["界", "かい", "業界", "ぎょう", "", "1239380"],
  ["寒", "かん", "寒気", "", "き", "2866134"],
  ["漢", "かん", "漢語", "", "ご", "1213150"],
  ["顔", "がん", "顔面", "", "めん", "1217860"],
  ["近", "きん", "近代", "", "だい", "1242420"],
  ["京", "きょう", "上京", "じょう", "", "1352980"],
  ["教", "きょう", "教員", "", "いん", "1236980"],
  ["業", "ぎょう", "工業", "こう", "", "1278040"],
  ["局", "きょく", "局員", "", "いん", "1239580"],
  ["苦", "く", "苦心", "", "しん", "1244530"],
  ["県", "けん", "県立", "", "りつ", "1258940"],
  ["向", "こう", "向上", "", "じょう", "1277250"],
  ["広", "こう", "広大", "", "だい", "1278600"],
  ["黒", "こく", "黒色", "", "しょく", "1287790"],
  ["才", "さい", "天才", "てん", "", "1439090"],
  ["思", "し", "意思", "い", "", "1156610"],
  ["住", "じゅう", "住人", "", "にん", "1334110"],
  ["昭", "しょう", "昭和", "", "わ", "1349820"],
  ["勝", "しょう", "勝者", "", "しゃ", "1346180"],
  ["色", "しき", "色紙", "", "し", "1357760"],
  ["組", "そ", "組成", "", "せい", "1397670"],
  ["族", "ぞく", "一族", "いち", "", "1164440"],
  ["待", "たい", "待機", "", "き", "1410600"],
  ["台", "たい", "台風", "", "ふう", "1596780"],
  ["題", "だい", "題名", "", "めい", "1415490"],
  ["着", "ちゃく", "着用", "", "よう", "1423270"],
  ["働", "どう", "労働", "ろう", "", "1606450"],
  ["通", "つう", "通行", "", "こう", "1433180"],
  ["持", "じ", "持病", "", "びょう", "1315830"],
  ["皮", "ひ", "皮下", "", "か", "1483820"],
  ["悲", "ひ", "悲鳴", "", "めい", "1483350"],
  ["美", "び", "美人", "", "じん", "1486530"],
  ["筆", "ひつ", "自筆", "じ", "", "1318590"],
  ["福", "ふく", "幸福", "こう", "", "1278400"],
  ["平", "へい", "平日", "", "じつ", "1507720"],
  ["辺", "へん", "近辺", "きん", "", "1242530"],
  ["理", "り", "心理", "しん", "", "1361000"],
  ["良", "りょう", "良心", "", "しん", "1554590"],
  ["緑", "りょく", "新緑", "しん", "", "1362460"],
  ["礼", "れい", "礼金", "", "きん", "1557500"],
  ["雪", "せつ", "新雪", "しん", "", "1362090"],
  ["終", "しゅう", "終日", "", "じつ", "1332980"],
  ["面", "めん", "顔面", "がん", "", "1217860"],
  ["和", "わ", "昭和", "しょう", "", "1349820"],
  ["成", "せい", "組成", "そ", "", "1397670"],
  ["機", "き", "待機", "たい", "", "1410600"],
  ["風", "ふう", "台風", "たい", "", "1596780"],
  ["労", "ろう", "労働", "", "どう", "1606450"],
  ["鳴", "めい", "悲鳴", "ひ", "", "1483350"],
  ["幸", "こう", "幸福", "", "ふく", "1278400"],
  ["方", "ほう", "方言", "", "げん", "1516980"],
  ["字", "じ", "漢字", "かん", "", "1213170"],
  ["画", "が", "映画", "えい", "", "1173720"],
  ["実", "じつ", "実力", "", "りょく", "1321530"],
] as const;

export const REINFORCEMENT_READING_EVIDENCE = ALIGNMENTS.map(
  ([character, kanjiReading, expression, before, after, sequence]) => ({
    character,
    kanjiReading,
    expression,
    before,
    after,
    jmdictEntryId: `jmdict:${sequence}`,
    realizedReading: character === "辺" ? "ぺん" : kanjiReading,
    soundChange:
      character === "辺"
        ? {
            ru: "В проверенном 近辺（きんぺん） чтение 辺 меняется с へん на ぺん после ん.",
            en: "In checked 近辺 (きんぺん), 辺 changes from へん to ぺん after ん.",
          }
        : null,
  }),
);

export function validateReinforcementReadings(
  kanjiBatches: readonly MainCourseContentBatch[],
  wordBatches: readonly MainCourseWordBatch[],
): readonly string[] {
  const issues: string[] = [];
  const kanji = new Map(kanjiBatches.flatMap((b) => b.kanji.map((k) => [k.character, k] as const)));
  const words = wordBatches.flatMap((b) => b.words);
  const required = [
    ...REINFORCEMENT_GAP_CHARACTERS,
    ...kanjiBatches
      .filter((b) => b.id === "full-course-kanji-reinforcement")
      .flatMap((b) => b.kanji.map((k) => k.character)),
  ];
  for (const c of required)
    if (REINFORCEMENT_READING_EVIDENCE.filter((e) => e.character === c).length !== 1)
      issues.push(`Missing unique reinforcement alignment: ${c}`);
  for (const e of REINFORCEMENT_READING_EVIDENCE) {
    const k = kanji.get(e.character);
    if (!k || k.reading.primary !== e.kanjiReading)
      issues.push(`Taught reading mismatch: ${e.character}`);
    const word = words.find(
      (w) =>
        w.expression === e.expression &&
        w.reading === e.before + e.realizedReading + e.after &&
        w.jmdictEntryId === e.jmdictEntryId,
    );
    if (!word || !word.expression.includes(e.character))
      issues.push(`Missing exact primary reinforcement pair: ${e.character}`);
    if (e.realizedReading !== e.kanjiReading && (!e.soundChange?.ru || !e.soundChange.en))
      issues.push(`Unexplained reinforcement sound change: ${e.character}`);
  }
  return issues;
}
