import { type MainCourseWordBatch, type MainCourseWordContent } from "./main-course-word-content";

const WORDS: readonly Omit<MainCourseWordContent, "sortOrder">[] = [
  word(
    "日本人",
    "にほんじん",
    "1464700",
    ["японец", "японка"],
    ["Japanese person"],
    [
      "К названию страны 日本 добавьте человека 人: человек из Японии.",
      "Add person 人 to Japan 日本: a person from Japan.",
    ],
    [
      "Сначала にほん, затем человек じん: にほんじん.",
      "Say にほん, then the person ending じん: にほんじん.",
    ],
    [
      "Человек, а не японский язык или название страны.",
      "A person, not the Japanese language or the country name.",
    ],
    ["В этом слове 人 читается じん, не ひと и не にん.", "Here 人 is じん, not ひと or にん."],
    [
      "あの人は日本人です。",
      "あのひとはにほんじんです。",
      "Тот человек из Японии.",
      "That person is Japanese.",
    ],
  ),
  word(
    "本人",
    "ほんにん",
    "1522750",
    ["сам человек", "сам лично", "лицо о котором идет речь"],
    ["the person in question", "the person themselves"],
    [
      "Выделите в списке одного человека: речь идёт именно о нём самом, 本人.",
      "Highlight one person on a list: 本人 is that very person.",
    ],
    [
      "У самого человека две таблички: ほん и にん. Вместе ほんにん.",
      "Give that very person two labels, ほん and にん: ほんにん.",
    ],
    [
      "Само лицо, о котором говорят, а не представитель этого лица.",
      "The actual person being discussed, not their representative.",
    ],
    ["人 здесь читается にん: ほんにん.", "Here 人 is にん: ほんにん."],
    [
      "この本は本人にわたします。",
      "このほんはほんにんにわたします。",
      "Эту книгу я передам самому человеку.",
      "I will hand this book to the person themselves.",
    ],
  ),
  word(
    "中年",
    "ちゅうねん",
    "1425240",
    ["средний возраст"],
    ["middle age", "midlife"],
    [
      "中 помещает возраст 年 в середину жизненного пути: средний возраст.",
      "中 places the years 年 in the middle of life: middle age.",
    ],
    [
      "Соедините середину ちゅう и год ねん: ちゅうねん.",
      "Join middle ちゅう and year ねん: ちゅうねん.",
    ],
    [
      "Период жизни человека, не середина календарного года.",
      "A stage of a person's life, not the middle of a calendar year.",
    ],
    ["После ち идёт маленькая ゅ: ちゅうねん.", "Use a small ゅ after ち: ちゅうねん."],
    [
      "あの人は中年です。",
      "あのひとはちゅうねんです。",
      "Тот человек среднего возраста.",
      "That person is middle-aged.",
    ],
  ),
  word(
    "年月",
    "ねんげつ",
    "1582870",
    ["годы и месяцы", "месяцы и годы"],
    ["months and years", "years and months"],
    [
      "Листайте календарь: месяцы 月 складываются в годы 年, и проходит время.",
      "Turn calendar pages: months 月 build into years 年 as time passes.",
    ],
    [
      "Год ねん и месяц げつ идут вместе: ねんげつ.",
      "Year ねん and month げつ travel together: ねんげつ.",
    ],
    [
      "Учим течение месяцев и лет, а не конкретное название месяца.",
      "Learn months and years passing, not a particular month name.",
    ],
    [
      "Для этой карточки используйте ねんげつ; 月 здесь не がつ.",
      "This card teaches ねんげつ; 月 is not がつ here.",
    ],
    [
      "長い年月がたちました。",
      "ながいねんげつがたちました。",
      "Прошли долгие годы и месяцы.",
      "Many months and years have passed.",
    ],
  ),
  word(
    "学年",
    "がくねん",
    "1207030",
    ["учебный год", "год обучения"],
    ["school year", "academic year", "year in school", "grade in school"],
    [
      "На учебнике 学 поставьте год 年: это учебный год или ступень обучения.",
      "Put a year 年 on a study book 学: a school year or year in school.",
    ],
    ["Учёба がく соединяется с годом ねん: がくねん.", "Study がく joins year ねん: がくねん."],
    [
      "Учебный год или год обучения; не оценка за работу.",
      "A school year or grade level, not a mark on an assignment.",
    ],
    ["がく・ねん, без удвоения согласных.", "Say がく・ねん without doubling a consonant."],
    [
      "この学年には三人の先生がいます。",
      "このがくねんにはさんにんのせんせいがいます。",
      "В этой параллели работают три учителя.",
      "There are three teachers for this grade.",
    ],
  ),
  word(
    "先月",
    "せんげつ",
    "1387500",
    ["прошлый месяц", "в прошлом месяце"],
    ["last month"],
    [
      "От текущей страницы календаря шагните к предыдущей: 先月, прошлый месяц.",
      "Step back one calendar page from the current month: 先月, last month.",
    ],
    ["Предыдущий せん плюс месяц げつ: せんげつ.", "Previous せん plus month げつ: せんげつ."],
    [
      "Месяц перед текущим, не следующий месяц.",
      "The month before the current one, not next month.",
    ],
    ["月 читается げつ, а не つき или がつ.", "月 is げつ, not つき or がつ."],
    [
      "先月、日本に行きました。",
      "せんげつ、にほんにいきました。",
      "В прошлом месяце я ездил в Японию.",
      "I went to Japan last month.",
    ],
  ),
  word(
    "本日",
    "ほんじつ",
    "1523110",
    ["сегодня", "сегодняшний день"],
    ["today", "this day"],
    [
      "Выделите текущий день 日 на официальном объявлении: 本日 означает сегодня.",
      "Highlight the current day 日 on a formal notice: 本日 means today.",
    ],
    [
      "На объявлении две части: ほん и じつ. Прочитайте ほんじつ.",
      "The notice has two parts, ほん and じつ: read ほんじつ.",
    ],
    ["Более официальное слово для сегодняшнего дня.", "A more formal word for today."],
    ["日 здесь читается じつ, не にち и не ひ.", "Here 日 is じつ, not にち or ひ."],
    [
      "本日は大雨です。",
      "ほんじつはおおあめです。",
      "Сегодня идёт сильный дождь.",
      "There is heavy rain today.",
    ],
  ),
  word(
    "年上",
    "としうえ",
    "1468870",
    ["старше по возрасту", "старший по возрасту"],
    ["older", "older in age"],
    [
      "На возрастной лестнице 年 человек стоит выше 上: он старше по возрасту.",
      "On an age ladder 年, a person stands higher 上: they are older.",
    ],
    [
      "Возраст とし и верх うえ складываются в としうえ.",
      "Age とし and above うえ combine into としうえ.",
    ],
    ["Сравнение возраста, не должности или звания.", "An age comparison, not a job rank or title."],
    ["Оба чтения кунные: とし・うえ.", "Both parts use kun readings: とし・うえ."],
    [
      "あの人はわたしより年上です。",
      "あのひとはわたしよりとしうえです。",
      "Тот человек старше меня.",
      "That person is older than me.",
    ],
  ),
  word(
    "年下",
    "としした",
    "1468230",
    ["младше по возрасту", "младший по возрасту"],
    ["younger", "younger in age"],
    [
      "На возрастной лестнице 年 человек стоит ниже 下: он младше.",
      "On an age ladder 年, a person stands lower 下: they are younger.",
    ],
    ["Возраст とし плюс низ した: としした.", "Age とし plus below した: としした."],
    ["Младше именно по возрасту, не ниже ростом.", "Younger in age, not shorter in height."],
    [
      "Не сокращайте две части とし・した: としした.",
      "Keep both parts とし・した intact: としした.",
    ],
    [
      "あの人はわたしより年下です。",
      "あのひとはわたしよりとししたです。",
      "Тот человек младше меня.",
      "That person is younger than me.",
    ],
  ),
  word(
    "目上",
    "めうえ",
    "1535490",
    ["старший по положению", "вышестоящий", "начальник"],
    ["superior", "senior in status"],
    [
      "Мысленно посмотрите 目 выше 上 по служебной лестнице: там вышестоящий человек.",
      "Look 目 upward 上 on a status ladder: there is a superior.",
    ],
    ["Глаз め смотрит вверх うえ: めうえ.", "An eye め looks above うえ: めうえ."],
    [
      "В этой карточке — старший по положению; слово также может называть старшего по возрасту. 年上 сравнивает только возраст.",
      "This card teaches someone senior in status; the word can also refer to someone older in age. 年上 compares age only.",
    ],
    [
      "め・うえ: не сливайте первые две гласные в один звук.",
      "Keep め・うえ distinct; do not merge the first two vowels.",
    ],
    [
      "目上の人にていねいにはなします。",
      "めうえのひとにていねいにはなします。",
      "Со старшим по положению человеком я говорю вежливо.",
      "I speak politely to a person of higher standing.",
    ],
  ),
  word(
    "目下",
    "めした",
    "1535320",
    ["подчиненный", "младший по положению"],
    ["subordinate", "junior in status"],
    [
      "На условной служебной лестнице взгляд 目 направлен ниже 下, к младшему по положению.",
      "On an imaginary status ladder, the eye 目 looks below 下 toward a junior.",
    ],
    ["Глаз め и низ した соединяются: めした.", "Eye め and below した join: めした."],
    [
      "В этой карточке — младший по положению; слово также может называть младшего по возрасту. Другое чтение もっか здесь не учим.",
      "This card teaches someone junior in status; the word can also refer to someone younger in age. The different reading もっか is not taught here.",
    ],
    [
      "Для значения подчинённого читайте めした, не もっか.",
      "For a subordinate, read めした, not もっか.",
    ],
    [
      "目下の人にもていねいにはなします。",
      "めしたのひとにもていねいにはなします。",
      "С подчинёнными я тоже говорю вежливо.",
      "I speak politely to subordinates too.",
    ],
  ),
  word(
    "気分",
    "きぶん",
    "1222590",
    ["настроение", "самочувствие"],
    ["mood", "feeling"],
    [
      "Представьте внутренний датчик 気 с делениями 分: он показывает ваше настроение и самочувствие.",
      "Imagine an inner 気 gauge with 分 divisions: it shows your mood and how you feel.",
    ],
    ["Начните с き и добавьте ぶん: きぶん.", "Start with き and add ぶん: きぶん."],
    ["Внутреннее настроение или самочувствие человека.", "A person's mood or how they feel."],
    ["В 分 здесь звонкий ぶ, не ふ: きぶん.", "分 has voiced ぶ, not ふ: きぶん."],
    [
      "この本を見て、気分がよくなりました。",
      "このほんをみて、きぶんがよくなりました。",
      "Посмотрев эту книгу, я почувствовал себя лучше.",
      "Looking at this book made me feel better.",
    ],
  ),
  word(
    "天文学",
    "てんもんがく",
    "1440280",
    ["астрономия"],
    ["astronomy"],
    [
      "На небе 天 будто написан текст 文, а учёба 学 помогает его прочитать: астрономия.",
      "The sky 天 seems to contain writing 文, and study 学 helps read it: astronomy.",
    ],
    [
      "Небо てん, письмо もん, учёба がく: てんもんがく.",
      "Sky てん, writing もん, study がく: てんもんがく.",
    ],
    ["Наука о небесных телах, не астрология.", "The science of celestial objects, not astrology."],
    ["文 здесь читается もん, а не ぶん.", "Here 文 is もん, not ぶん."],
    [
      "大学で天文学を学んでいます。",
      "だいがくでてんもんがくをまなんでいます。",
      "Я изучаю астрономию в университете.",
      "I study astronomy at university.",
    ],
  ),
  word(
    "中学生",
    "ちゅうがくせい",
    "1423660",
    ["ученик средней школы", "школьник средней ступени"],
    ["junior high school student", "middle school student", "middle school pupil"],
    [
      "Между начальной школой и следующей ступенью стоит 中: это ученик средней школы.",
      "中 marks the school stage between elementary school and the next stage: a middle school student.",
    ],
    [
      "К середине ちゅう добавьте ученика がくせい: ちゅうがくせい.",
      "Add student がくせい to middle ちゅう: ちゅうがくせい.",
    ],
    [
      "Ученик японской средней школы первой ступени, не студент университета.",
      "A student in Japanese lower secondary school, not a university student.",
    ],
    ["Маленькая ゅ в ちゅう, затем がくせい.", "Use a small ゅ in ちゅう, followed by がくせい."],
    [
      "あの子は中学生です。",
      "あのこはちゅうがくせいです。",
      "Тот ребёнок учится в средней школе.",
      "That child is a middle school student.",
    ],
  ),
  word(
    "月見",
    "つきみ",
    "1255630",
    ["любование луной", "созерцание луны"],
    ["moon viewing", "moon gazing"],
    [
      "Посмотрите 見 на луну 月 и задержите взгляд: это любование луной.",
      "Look 見 at the moon 月 and linger: this is moon viewing.",
    ],
    ["Луна つき и взгляд み: つきみ.", "Moon つき and viewing み: つきみ."],
    ["Наблюдение за луной ради её красоты.", "Watching the moon to enjoy its beauty."],
    [
      "Кунные части つき・み; здесь нет чтения げつ.",
      "Use kun parts つき・み; there is no げつ here.",
    ],
    [
      "山の上で月見をしました。",
      "やまのうえでつきみをしました。",
      "Мы любовались луной на вершине горы.",
      "We enjoyed moon viewing on top of the mountain.",
    ],
  ),
  word(
    "見本",
    "みほん",
    "1260100",
    ["образец", "пример", "пробный экземпляр"],
    ["sample", "example", "specimen"],
    [
      "Перед началом работы посмотрите 見 на исходный образец 本: это ваш 見本.",
      "Before starting work, look 見 at the original sample 本: your 見本.",
    ],
    ["Взгляд み соединяется с ほん: みほん.", "Viewing み joins ほん: みほん."],
    [
      "Вещь или пример, по которому можно судить о других или выполнить работу.",
      "An item or example used to judge others or guide work.",
    ],
    ["Начало み, не けん: みほん.", "Start with み, not けん: みほん."],
    [
      "この見本を見てください。",
      "このみほんをみてください。",
      "Пожалуйста, посмотрите на этот образец.",
      "Please look at this sample.",
    ],
  ),
  word(
    "大会",
    "たいかい",
    "1413180",
    ["турнир", "соревнование", "съезд", "конгресс"],
    ["tournament", "competition", "convention", "conference"],
    [
      "Большое 大 собрание 会 превращается в турнир или съезд.",
      "A large 大 gathering 会 becomes a tournament or convention.",
    ],
    ["Крупное たい собрание かい: たいかい.", "A large たい meeting かい: たいかい."],
    [
      "Организованное крупное мероприятие, в том числе спортивное соревнование.",
      "An organized major event, including a sporting competition.",
    ],
    ["大 здесь たい, не だい.", "Here 大 is たい, not だい."],
    [
      "この大会には百人が出ます。",
      "このたいかいにはひゃくにんがでます。",
      "В этом турнире участвуют сто человек.",
      "One hundred people are taking part in this tournament.",
    ],
  ),
  word(
    "日中",
    "にっちゅう",
    "1464250",
    ["дневное время", "днем"],
    ["daytime", "during the day"],
    [
      "Поместите занятие внутрь 中 светлого дня 日: оно происходит днём.",
      "Place an activity inside 中 the daylight hours 日: it happens during the day.",
    ],
    [
      "День с короткой паузой にっ, затем ちゅう: にっちゅう.",
      "Day with a brief stop にっ, then ちゅう: にっちゅう.",
    ],
    [
      "Здесь учим дневное время; другое значение о Японии и Китае не включено.",
      "Here learn daytime; the separate Japan-and-China sense is not included.",
    ],
    [
      "Обязательна маленькая っ: にっちゅう, не にちゅう.",
      "Keep the small っ: にっちゅう, not にちゅう.",
    ],
    [
      "日中はこの川であそびます。",
      "にっちゅうはこのかわであそびます。",
      "Днём мы играем у этой реки.",
      "We play at this river during the day.",
    ],
  ),
  word(
    "出国",
    "しゅっこく",
    "1580020",
    ["выезд из страны", "отъезд из страны"],
    ["departure from a country", "leaving a country"],
    [
      "Стрелка 出 выходит за границу страны 国: это выезд из страны.",
      "An 出 arrow crosses a country's 国 border outward: departure from a country.",
    ],
    [
      "Перед こ сделайте короткую остановку: しゅっ・こく.",
      "Make a short stop before こ: しゅっ・こく.",
    ],
    ["Покинуть страну, а не въехать в неё.", "Leaving a country, not entering it."],
    [
      "Маленькие ゅ и っ обе нужны: しゅっこく.",
      "Both small ゅ and small っ are needed: しゅっこく.",
    ],
    [
      "本日、日本を出国します。",
      "ほんじつ、にほんをしゅっこくします。",
      "Сегодня я выезжаю из Японии.",
      "I am leaving Japan today.",
    ],
  ),
  word(
    "会社",
    "かいしゃ",
    "1198550",
    ["компания", "фирма", "корпорация"],
    ["company", "firm", "corporation"],
    [
      "Люди собираются 会 под одной вывеской 社 для работы: это компания.",
      "People gather 会 under one 社 sign to work: a company.",
    ],
    [
      "Собрание かい и организация しゃ: かいしゃ.",
      "Meeting かい and organization しゃ: かいしゃ.",
    ],
    [
      "Организация или фирма, не компания друзей.",
      "A business organization, not a group of friends.",
    ],
    ["かい・しゃ: после し маленькая ゃ.", "Say かい・しゃ, using a small ゃ after し."],
    [
      "わたしは日本の会社でしごとをしています。",
      "わたしはにほんのかいしゃでしごとをしています。",
      "Я работаю в японской компании.",
      "I work for a Japanese company.",
    ],
  ),
];

const BATCH: MainCourseWordBatch = {
  id: "task-127-course-words-05",
  version: "1",
  authoredAt: "2026-10-22",
  reviewedAt: "2026-10-22",
  reviewNotes:
    "AI-authored original RU/EN teaching copy and JP/kana/RU/EN examples, independently editorially reviewed and corrected by a separate AI agent on 2026-10-22. The parent supplied exact identities and bilingual licensed SUCCESS JMdict 2026-07-28 evidence; the reviewer did not perform a new live source query. Reviewed all twenty entries, readings, scoped meanings and examples against the registered 61-kanji closure. Replaced two unregistered 話 with kana, corrected the 学年 example translations and awkward accepted wording, and clarified age/status scope for 目上 and 目下. Placed at course level 6 slots 1-20 as requested; no new kanji, alternate reading claims or progress migration. Not human approval, publication proof or full Task127 completion. Complete source, blueprint-band, prerequisite and quality preflight remains mandatory.",
  sourceFile: "packages/db/src/main-course-word-content-05.ts",
  courseSlug: "japanese-ru-n2",
  levelNumber: 6,
  sortOrderStart: 1,
  words: WORDS.map((content, index) => ({ ...content, sortOrder: index + 1 })),
};

export function buildMainCourseWordBatch05(): MainCourseWordBatch {
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
