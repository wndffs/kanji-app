import { type LexicalKind } from "./lexical-selection";

export type Wave08TeachingRow = {
  readonly expression: string;
  readonly reading: string;
  readonly jmdictEntryId: string;
  readonly partOfSpeech: LexicalKind;
  readonly ru: string;
  readonly en: string;
  readonly memoryRu: string;
  readonly memoryEn: string;
};
const row = (expression:string,reading:string,id:string,partOfSpeech:LexicalKind,ru:string,en:string,memoryRu:string,memoryEn:string):Wave08TeachingRow => ({
  expression,reading,jmdictEntryId:`jmdict:${id}`,partOfSpeech,ru,en,memoryRu,memoryEn,
});

// Original project prose. These unregistered rows do not grant editorial approval.
export const WAVE08_TEACHING: readonly Wave08TeachingRow[] = [
  row("食べる","たべる","1358280","verb","есть","to eat",
    "Знак еды 食 соединяется с べる: теперь это действие — есть, а не название еды.",
    "Food 食 gains べる: this is the action of eating, not the name of a meal."),
  row("飲む","のむ","1169870","verb","пить","to drink",
    "В 食-подобной левой части 飲 представьте напиток; む завершает слово о действии.",
    "Imagine a drink beside the food-shaped left part of 飲; む completes the action word."),
  row("行く","いく","1578850","verb","идти","to go",
    "Дорога в 行 ведёт от говорящего: здесь речь о том, чтобы идти, не приходить.",
    "The road in 行 leads away: this card teaches going, not coming."),
  row("会う","あう","1198180","verb","встречаться","to meet",
    "Под одной крышей 会 встречаются люди. Здесь учим встречу с человеком, не организацию.",
    "People meet under one roof in this imagined 会 scene. Learn meeting a person, not an organization."),
  row("入る","はいる","1465590","verb","входить","to enter",
    "Фигура 入 движется внутрь комнаты: входит сам человек, а не кладёт туда предмет.",
    "Picture 入 moving into a room: the person enters, rather than putting an object inside."),
  row("出る","でる","1338240","verb","выходить","to go out",
    "Воображаемая фигура 出 выходит наружу. Противопоставьте её движению внутрь в 入る.",
    "Imagine 出 going outside. Contrast it with the inward movement of 入る."),
  row("見る","みる","1259290","verb","смотреть","to see",
    "Глаз в 見 помогает связать слово со зрением: смотреть или видеть, не слушать.",
    "The eye in 見 links this word to sight: seeing or looking, not listening."),
  row("聞く","きく","1591110","verb","слушать","to listen",
    "Ухо 耳 внутри ворот 門 напоминает о звуке. Здесь выбран смысл слушать или слышать.",
    "The ear 耳 inside the gate 門 suggests sound. This card selects listening or hearing."),
  row("読む","よむ","1456360","verb","читать","to read",
    "У речевой части 読 представьте страницу: здесь слова читают, а не записывают.",
    "Imagine a page beside the speech part of 読: the words are read, not written."),
  row("書く","かく","1343950","verb","писать","to write",
    "Ряды штрихов 書 напоминают строки: вы создаёте запись, а не читаете её.",
    "The rows of strokes in 書 suggest lines: you create writing instead of reading it."),
  row("大きい","おおきい","1588880","i-adjective","большой","big",
    "Раскинувшая руки фигура 大 стала признаком размера: большой, не просто важный.",
    "The spread-out figure 大 becomes a size description: big, not merely important."),
  row("小さい","ちいさい","1347750","i-adjective","маленький","small",
    "Небольшие штрихи 小 помогают представить маленький предмет; сохраните всё окончание さい.",
    "The little strokes of 小 suggest a small object; keep the entire ending さい."),
  row("早い","はやい","1404975","i-adjective","ранний","early",
    "Солнце 日 уже поднялось рано. Здесь учим время, не скорость: для быстрого обычно пишут 速い.",
    "Picture the sun 日 up early. This card selects time, not speed, normally written 速い."),
  row("長い","ながい","1429750","i-adjective","длинный","long",
    "Вытянутый знак 長 напоминает длинный путь или долгий промежуток времени, не рост человека.",
    "The stretched shape 長 suggests a long path or duration, not a person's height."),
  row("正しい","ただしい","1376600","i-adjective","правильный","correct",
    "Остановитесь у 正 и проверьте ответ: здесь «правильно», не направление вправо.",
    "Stop at 正 and check the answer: right as in correct, not the direction right."),
  row("午前","ごぜん","1269060","noun","до полудня","before noon",
    "Перед 前 полуднем 午 — утренняя часть суток. Это не обещание, что всякое утро начинается в полночь в бытовой речи.",
    "Before 前 noon 午 gives the a.m. part of the day, rather than afternoon."),
  row("午後","ごご","1268990","noun","после полудня","afternoon",
    "После 後 полудня 午: 午後 противопоставлено 午前. Обозначение p.m. включает и вечер.",
    "After 後 noon 午: contrast 午後 with 午前. The p.m. label also includes evening hours."),
  row("名前","なまえ","1531710","noun","имя","name",
    "Поставьте имя 名 перед 前 собой на табличке. Это воображаемая подсказка, не этимология слова.",
    "Imagine putting your name 名 in front 前 of you on a label. This is a memory scene, not etymology."),
  row("日本語","にほんご","1464530","noun","японский язык","Japanese language",
    "Япония 日本 и язык 語 вместе называют язык, не японского человека.",
    "Japan 日本 plus language 語 names the language, not a Japanese person."),
  row("外国語","がいこくご","1203640","noun","иностранный язык","foreign language",
    "Язык 語 другой страны 外国 — иностранный язык; 外 указывает наружу за пределы своей страны.",
    "A language 語 of a foreign country 外国 is a foreign language; 外 points beyond one's own country."),
];
