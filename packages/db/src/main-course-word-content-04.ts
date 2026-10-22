import { type MainCourseWordBatch, type MainCourseWordContent } from "./main-course-word-content";

const WORDS = [
  word(
    "六月",
    "ろくがつ",
    "1561330",
    ["июнь"],
    ["June"],
    [
      "Шестая страница календаря соединяет 六 и 月: июнь.",
      "The sixth calendar page joins 六 and 月: June.",
    ],
    [
      "Шесть читается ろく, календарный месяц добавляет がつ: ろくがつ.",
      "Six is ろく; a calendar month adds がつ: ろくがつ.",
    ],
    [
      "Название шестого месяца, не длительность шесть месяцев.",
      "The sixth calendar month, not a duration of six months.",
    ],
    ["ろく・がつ; месяц здесь がつ, не げつ.", "ろく・がつ; the month is がつ here, not げつ."],
    [
      "六月は雨がよくふります。",
      "ろくがつはあめがよくふります。",
      "В июне часто идёт дождь.",
      "It often rains in June.",
    ],
  ),
  word(
    "七月",
    "しちがつ",
    "1319280",
    ["июль"],
    ["July"],
    [
      "Поставьте 七 на седьмой странице календаря 月: это июль.",
      "Put 七 on the seventh calendar page 月: this is July.",
    ],
    [
      "Для июля выберите семь しち и добавьте がつ: しちがつ.",
      "For July choose seven as しち and add がつ: しちがつ.",
    ],
    [
      "Июль как месяц года, не семь месяцев подряд.",
      "July as a calendar month, not seven months in duration.",
    ],
    ["しち・がつ; не заменяйте しち на なな.", "しち・がつ; do not replace しち with なな."],
    [
      "七月に山へ行きたいです。",
      "しちがつにやまへいきたいです。",
      "В июле я хочу пойти в горы.",
      "I want to go to the mountains in July.",
    ],
  ),
  word(
    "八月",
    "はちがつ",
    "1476730",
    ["август"],
    ["August"],
    [
      "Восемь 八 отмечает восьмой календарный месяц 月, август.",
      "Eight 八 marks the eighth calendar month 月, August.",
    ],
    [
      "Соедините восемь はち с месяцем がつ: はちがつ.",
      "Join eight はち with month がつ: はちがつ.",
    ],
    [
      "Название месяца августа, не восьмимесячный срок.",
      "The calendar month August, not an eight-month period.",
    ],
    ["はち・がつ, без маленькой っ.", "はち・がつ, with no small っ."],
    [
      "八月の空はあおいです。",
      "はちがつのそらはあおいです。",
      "В августе небо голубое.",
      "The sky is blue in August.",
    ],
  ),
  word(
    "九月",
    "くがつ",
    "1243660",
    ["сентябрь"],
    ["September"],
    [
      "Девятая отметка 九 на календаре 月 указывает на сентябрь.",
      "The ninth mark 九 on the calendar 月 points to September.",
    ],
    [
      "В названии сентября девять сокращается до く: く плюс がつ даёт くがつ.",
      "In September, nine takes the short reading く: く plus がつ gives くがつ.",
    ],
    [
      "Девятый месяц года; не длительность девять месяцев.",
      "The ninth month of the year, not a duration of nine months.",
    ],
    ["く・がつ; не きゅうがつ.", "く・がつ, not きゅうがつ."],
    [
      "九月にこの本をよみました。",
      "くがつにこのほんをよみました。",
      "Я прочитал эту книгу в сентябре.",
      "I read this book in September.",
    ],
  ),
  word(
    "十月",
    "じゅうがつ",
    "1334570",
    ["октябрь"],
    ["October"],
    [
      "Десятка 十 у месяца 月 завершает первые десять страниц календаря: октябрь.",
      "Ten 十 beside month 月 completes the first ten calendar pages: October.",
    ],
    ["К десяти じゅう добавьте がつ: じゅうがつ.", "Add がつ to ten じゅう: じゅうがつ."],
    [
      "Календарный октябрь, не десять месяцев ожидания.",
      "October on the calendar, not ten months of waiting.",
    ],
    [
      "じゅう・がつ: сохраните маленькую ゅ и следующий う.",
      "じゅう・がつ: keep the small ゅ and the following う.",
    ],
    [
      "十月は山をあるくのによい月です。",
      "じゅうがつはやまをあるくのによいつきです。",
      "Октябрь — хороший месяц для прогулок в горах.",
      "October is a good month for walking in the mountains.",
    ],
  ),
  word(
    "十一月",
    "じゅういちがつ",
    "1334480",
    ["ноябрь"],
    ["November"],
    [
      "Десять 十 и один 一 дают одиннадцатый месяц 月: ноябрь.",
      "Ten 十 and one 一 make the eleventh month 月: November.",
    ],
    ["Сложите じゅう, いち и がつ: じゅういちがつ.", "Join じゅう, いち and がつ: じゅういちがつ."],
    [
      "Название одиннадцатого месяца, не срок в одиннадцать месяцев.",
      "The eleventh calendar month, not an eleven-month duration.",
    ],
    [
      "じゅう・いち・がつ; не теряйте い после долгого う.",
      "じゅう・いち・がつ; keep the い after the long う.",
    ],
    [
      "十一月に先生に会うよていです。",
      "じゅういちがつにせんせいにあうよていです。",
      "В ноябре я планирую встретиться с учителем.",
      "I plan to meet my teacher in November.",
    ],
  ),
  word(
    "十二月",
    "じゅうにがつ",
    "1334910",
    ["декабрь"],
    ["December"],
    [
      "Десять 十 и два 二 отмечают последнюю страницу календаря 月: декабрь.",
      "Ten 十 and two 二 mark the calendar's last page 月: December.",
    ],
    [
      "После десяти じゅう поставьте два に и месяц がつ: じゅうにがつ.",
      "After ten じゅう put two に and month がつ: じゅうにがつ.",
    ],
    [
      "Двенадцатый месяц года, не двенадцать месяцев как длительность.",
      "The twelfth month of the year, not twelve months as a duration.",
    ],
    ["じゅう・に・がつ; не добавляйте ち после に.", "じゅう・に・がつ; do not add ち after に."],
    [
      "十二月になると、川の水がつめたくなります。",
      "じゅうにがつになると、かわのみずがつめたくなります。",
      "Когда наступает декабрь, вода в реке становится холодной.",
      "When December comes, the river water gets cold.",
    ],
  ),
  word(
    "四日",
    "よっか",
    "1307320",
    ["четыре дня", "четвёртое число"],
    ["four days", "fourth day of the month"],
    [
      "Отметьте четыре клетки 日; последняя показывает и срок в четыре дня, и четвёртое число.",
      "Mark four day cells 日; the last marks both four days and the fourth date.",
    ],
    [
      "На четвёртой клетке задержитесь на маленькой っ: よ・っ・か, よっか.",
      "Pause on the fourth cell for small っ: よ・っ・か, よっか.",
    ],
    [
      "Длительность четыре дня или четвёртое число месяца, в зависимости от контекста.",
      "A duration of four days or the fourth day of a month, depending on context.",
    ],
    ["よっか с маленькой っ; не よんにち.", "よっか has small っ; not よんにち."],
    [
      "四日に先生と会います。",
      "よっかにせんせいとあいます。",
      "Четвёртого числа я встречусь с учителем.",
      "I will meet my teacher on the fourth.",
    ],
  ),
  word(
    "五日",
    "いつか",
    "1268570",
    ["пять дней", "пятое число"],
    ["five days", "fifth day of the month"],
    [
      "Пять 五 дневных клеток 日 дают пять дней; пятая клетка ещё и пятое число.",
      "Five 五 day cells 日 give five days; the fifth cell is also the fifth date.",
    ],
    [
      "Разместите на пятой клетке три знака い・つ・か: いつか.",
      "Place three kana on the fifth cell, い・つ・か: いつか.",
    ],
    [
      "Пять дней или пятое число месяца; не отдельное слово когда-нибудь.",
      "Five days or the fifth day of a month, not the separate word meaning someday.",
    ],
    ["い・つ・か, без маленькой っ; не ごにち.", "い・つ・か, with no small っ; not ごにち."],
    [
      "この本を五日でよみました。",
      "このほんをいつかでよみました。",
      "Я прочитал эту книгу за пять дней.",
      "I read this book in five days.",
    ],
  ),
  word(
    "六日",
    "むいか",
    "1561470",
    ["шесть дней", "шестое число"],
    ["six days", "sixth day of the month"],
    [
      "Шесть 六 отметок 日 могут обозначать шестидневный срок или шестую дату.",
      "Six 六 day marks 日 can mean a six-day duration or the sixth date.",
    ],
    [
      "На шестой клетке оставьте цепочку из трёх знаков む・い・か: むいか.",
      "Leave a three-kana trail on the sixth cell, む・い・か: むいか.",
    ],
    [
      "Длительность шесть дней и шестое число месяца — оба значения допустимы.",
      "Both a duration of six days and the sixth day of a month are accepted.",
    ],
    ["むい・か; не ろくにち и не むっか.", "むい・か, not ろくにち or むっか."],
    [
      "六日に山へ行きましょう。",
      "むいかにやまへいきましょう。",
      "Давайте пойдём в горы шестого числа.",
      "Let's go to the mountains on the sixth.",
    ],
  ),
  word(
    "七日",
    "なのか",
    "1579630",
    ["семь дней", "седьмое число"],
    ["seven days", "seventh day of the month"],
    [
      "Семь 七 дней 日 складываются в срок; седьмая отметка также служит датой.",
      "Seven 七 days 日 form a duration; the seventh mark also serves as a date.",
    ],
    [
      "Для седьмой даты сохраните середину の: な・の・か, なのか.",
      "For the seventh date keep の in the middle: な・の・か, なのか.",
    ],
    [
      "Семь дней как срок или седьмое число календаря.",
      "Seven days as a duration or the seventh calendar date.",
    ],
    ["な・の・か, не ななか и не しちにち.", "な・の・か, not ななか or しちにち."],
    [
      "あと七日で先生に会えます。",
      "あとなのかでせんせいにあえます。",
      "Ещё через семь дней я смогу увидеться с учителем.",
      "In seven more days I can see my teacher.",
    ],
  ),
  word(
    "八日",
    "ようか",
    "1476920",
    ["восемь дней", "восьмое число"],
    ["eight days", "eighth day of the month"],
    [
      "Восемь 八 клеток 日 задают восемь дней, а восьмая клетка называет дату.",
      "Eight 八 day cells 日 give eight days, while the eighth cell names the date.",
    ],
    [
      "Протяните よう над восьмой клеткой, затем добавьте か: ようか.",
      "Stretch よう over the eighth cell, then add か: ようか.",
    ],
    [
      "Восемь дней или восьмое число месяца, не указание месяца августа.",
      "Eight days or the eighth day of a month, not the month August.",
    ],
    [
      "よう・か: пишите う после よ; не よっか, это четыре дня.",
      "よう・か: write う after よ; not よっか, which means four days.",
    ],
    [
      "八日は天気がよかったです。",
      "ようかはてんきがよかったです。",
      "Восьмого числа погода была хорошая.",
      "The weather was good on the eighth.",
    ],
  ),
  word(
    "九日",
    "ここのか",
    "1243850",
    ["девять дней", "девятое число"],
    ["nine days", "ninth day of the month"],
    [
      "Девять 九 отметок 日 дают девятидневный срок или девятую дату в календаре.",
      "Nine 九 day marks 日 give a nine-day duration or the ninth calendar date.",
    ],
    [
      "Девятая клетка хранит повтор こ・こ, затем の・か: ここのか.",
      "The ninth cell holds repeated こ・こ, followed by の・か: ここのか.",
    ],
    [
      "Девять дней и девятое число месяца; нужный смысл определяется предложением.",
      "Nine days and the ninth day of a month; the sentence determines the intended sense.",
    ],
    ["こ・こ・の・か: два こ; не くにち.", "こ・こ・の・か: two こ kana; not くにち."],
    [
      "九日には日本にいます。",
      "ここのかにはにほんにいます。",
      "Девятого числа я буду в Японии.",
      "I will be in Japan on the ninth.",
    ],
  ),
  word(
    "二十日",
    "はつか",
    "1600850",
    ["двадцать дней", "двадцатое число"],
    ["twenty days", "twentieth day of the month"],
    [
      "Два 二 десятка 十 клеток 日 дают двадцать дней или отметку двадцатого числа.",
      "Two 二 tens 十 of day cells 日 give twenty days or the twentieth date.",
    ],
    [
      "Положите на двадцатую клетку короткую особую подпись は・つ・か: はつか.",
      "Put a short special label on the twentieth cell, は・つ・か: はつか.",
    ],
    [
      "Двадцать дней как срок или двадцатое число месяца.",
      "Twenty days as a duration or the twentieth day of a month.",
    ],
    [
      "は・つ・か, без маленькой っ; не にじゅうにち.",
      "は・つ・か, with no small っ; not にじゅうにち.",
    ],
    [
      "二十日にこの本をかえします。",
      "はつかにこのほんをかえします。",
      "Двадцатого числа я верну эту книгу.",
      "I will return this book on the twentieth.",
    ],
  ),
  word(
    "三人",
    "さんにん",
    "1301000",
    ["три человека"],
    ["three people"],
    [
      "Три 三 места рядом с 人 занимают ровно три человека.",
      "Exactly three people occupy the three 三 places beside 人.",
    ],
    [
      "После трёх さん добавьте счёт людей にん: さんにん.",
      "After three さん add the people counter にん: さんにん.",
    ],
    [
      "Количество людей, не три предмета и не само число три.",
      "A count of people, not three objects or the number three alone.",
    ],
    ["さん・にん; сохраните ん перед に.", "さん・にん; keep ん before に."],
    [
      "三人で川のそばをあるきました。",
      "さんにんでかわのそばをあるきました。",
      "Мы втроём гуляли вдоль реки.",
      "The three of us walked beside the river.",
    ],
  ),
  word(
    "四人",
    "よにん",
    "1985310",
    ["четыре человека"],
    ["four people"],
    [
      "Четыре 四 места у 人 отмечают группу ровно из четырёх человек.",
      "Four 四 places beside 人 mark a group of exactly four people.",
    ],
    [
      "Перед счётом людей にん у четырёх остаётся короткое よ: よにん.",
      "Before the people counter にん, four takes short よ: よにん.",
    ],
    [
      "Четыре человека как количество, не четыре дня или вещи.",
      "Four people as a count, not four days or objects.",
    ],
    ["よ・にん: не よんにん и не しにん.", "よ・にん, not よんにん or しにん."],
    [
      "四人ともこの本をよみました。",
      "よにんともこのほんをよみました。",
      "Все четверо прочитали эту книгу.",
      "All four people read this book.",
    ],
  ),
  word(
    "水中",
    "すいちゅう",
    "1371840",
    ["под водой", "в воде", "подводный"],
    ["underwater"],
    [
      "Поместите предмет внутрь 中 воды 水: он находится под водой.",
      "Place an object inside 中 water 水: it is underwater.",
    ],
    [
      "Вода даёт すい, середина добавляет ちゅう: すいちゅう.",
      "Water gives すい and inside adds ちゅう: すいちゅう.",
    ],
    [
      "Положение в воде или под её поверхностью; не название самой жидкости.",
      "Being in or under water, not the water itself.",
    ],
    [
      "すい・ちゅう: маленькая ゅ и следующий う обязательны.",
      "すい・ちゅう: keep the small ゅ and the following う.",
    ],
    [
      "水中に小さな石があります。",
      "すいちゅうにちいさないしがあります。",
      "Под водой есть маленький камень.",
      "There is a small stone underwater.",
    ],
  ),
  word(
    "大雨",
    "おおあめ",
    "1413070",
    ["сильный дождь", "ливень"],
    ["heavy rain", "downpour"],
    [
      "Большое 大 количество дождя 雨 превращает обычные капли в сильный дождь.",
      "A large 大 amount of rain 雨 turns ordinary drops into heavy rain.",
    ],
    ["К дождю あめ добавьте большое おお: おおあめ.", "Add big おお before rain あめ: おおあめ."],
    [
      "Именно сильный дождь или ливень, не любой дождь.",
      "Specifically heavy rain or a downpour, not just any rain.",
    ],
    [
      "おお・あめ: два お, затем あ; не おうあめ.",
      "おお・あめ: two お kana, then あ; not おうあめ.",
    ],
    [
      "大雨なので、山へは行きません。",
      "おおあめなので、やまへはいきません。",
      "Из-за сильного дождя мы не пойдём в горы.",
      "Because of the heavy rain, we will not go to the mountains.",
    ],
  ),
  word(
    "小川",
    "おがわ",
    "1348460",
    ["ручей"],
    ["stream", "brook", "creek"],
    [
      "Маленькая 小 река 川 сужается до ручья, через который легко перешагнуть.",
      "A small 小 river 川 narrows to a brook that is easy to step across.",
    ],
    [
      "Маленькое お соединяется с рекой かわ, где か озвончается до が: おがわ.",
      "Small お joins river かわ, whose か becomes voiced が: おがわ.",
    ],
    [
      "Небольшой водный поток, ручей; здесь не фамилия.",
      "A small watercourse, a stream or brook; not a surname here.",
    ],
    ["お・が・わ, не おかわ и не こがわ.", "お・が・わ, not おかわ or こがわ."],
    [
      "この小川の水はきれいです。",
      "このおがわのみずはきれいです。",
      "Вода в этом ручье чистая.",
      "The water in this stream is clean.",
    ],
  ),
  word(
    "手足",
    "てあし",
    "1328080",
    ["руки и ноги", "конечности"],
    ["hands and feet", "limbs"],
    [
      "Соедините руку 手 и ногу 足: слово охватывает руки и ноги вместе.",
      "Join a hand 手 and a foot 足: the word covers hands and feet together.",
    ],
    [
      "Знакомая рука て стоит перед ногой あし: てあし.",
      "The familiar hand て comes before foot あし: てあし.",
    ],
    [
      "Буквально руки и ноги, конечности тела; переносное значение здесь не изучается.",
      "Literal hands and feet, the body's limbs; figurative usage is not taught here.",
    ],
    [
      "て・あし; между словами нет маленькой っ и не меняется あ.",
      "て・あし; there is no small っ between the parts and あ stays unchanged.",
    ],
    [
      "手足をのばして、すこしやすみましょう。",
      "てあしをのばして、すこしやすみましょう。",
      "Давайте вытянем руки и ноги и немного отдохнём.",
      "Let's stretch out our arms and legs and rest a little.",
    ],
  ),
];

const BATCH: MainCourseWordBatch = {
  id: "task-127-foundation-words-04",
  version: "1",
  authoredAt: "2026-10-22",
  reviewedAt: "2026-10-22",
  reviewNotes:
    "AI-authored original RU/EN teaching copy and JP/kana/RU/EN examples. Independently reviewed by the parent agent on 2026-10-22 against exact successful bilingual JMdict pairs: calendar months versus durations, irregular dates and counters, literal limbs, kana readings and the earlier 61-kanji whitelist checked. Replaced an absent counter candidate and a candidate with an unreviewed prerequisite before authorship. Not a human-review claim or publication approval. No proprietary content or legacy-to-modern JLPT inference; full source/prerequisite preflight remains mandatory.",
  sourceFile: "packages/db/src/main-course-word-content-04.ts",
  courseSlug: "japanese-ru-n2",
  levelNumber: 5,
  sortOrderStart: 61,
  words: WORDS.map((content, index) => ({ ...content, sortOrder: 61 + index })),
};

export function buildMainCourseWordBatch04(): MainCourseWordBatch {
  return BATCH;
}

function word(
  expression: string,
  reading: string,
  entryId: string,
  ru: readonly [string, ...string[]],
  en: readonly [string, ...string[]],
  meaningMnemonic: readonly [string, string],
  readingMnemonic: readonly [string, string],
  meaningHint: readonly [string, string],
  readingHint: readonly [string, string],
  example: readonly [string, string, string, string],
): Omit<MainCourseWordContent, "sortOrder"> {
  const bilingual = ([ru, en]: readonly [string, string]) => ({ ru, en });
  return {
    expression,
    reading,
    jmdictEntryId: `jmdict:${entryId}`,
    meanings: { ru: { primary: ru[0], accepted: ru }, en: { primary: en[0], accepted: en } },
    meaningMnemonic: bilingual(meaningMnemonic),
    readingMnemonic: bilingual(readingMnemonic),
    meaningHint: bilingual(meaningHint),
    readingHint: bilingual(readingHint),
    example: {
      japaneseText: example[0],
      readingText: example[1],
      translationRu: example[2],
      translationEn: example[3],
    },
  };
}
