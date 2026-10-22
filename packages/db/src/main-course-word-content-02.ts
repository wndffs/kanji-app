import { type MainCourseWordBatch, type MainCourseWordContent } from "./main-course-word-content";

const WORDS = [
  word(
    "本",
    "ほん",
    "1522150",
    ["книга"],
    ["book"],
    [
      "Представьте 本 на обложке книги: здесь учим предмет для чтения, не значение корня.",
      "Imagine 本 on a book cover: learn the object you read, not the root sense.",
    ],
    [
      "На обложке напишите ほ, а на последней странице ん: вся книга читается ほん.",
      "Put ほ on the cover and ん on the final page; the whole book reads ほん.",
    ],
    ["Книга; не счётный суффикс длинных предметов.", "A book, not the counter for long objects."],
    ["ほん с конечной ん, без добавочного гласного.", "ほん ends in ん, with no added vowel."],
    [
      "この本をもういちどよみます。",
      "このほんをもういちどよみます。",
      "Я прочитаю эту книгу ещё раз.",
      "I will read this book again.",
    ],
  ),
  word(
    "日本",
    "にほん",
    "1582710",
    ["Япония"],
    ["Japan"],
    [
      "Соедините 日 и 本 в подпись страны на карте: 日本 здесь целиком означает Японию.",
      "Join 日 and 本 as a country label on a map: the whole word 日本 means Japan.",
    ],
    [
      "На карте поставьте метку に, а рядом книгу 本 с чтением ほん: вместе にほん.",
      "Put a に marker beside a 本 book read ほん on a map; together they make にほん.",
    ],
    [
      "Название страны Японии, не обозначение японского языка.",
      "The country Japan, not the Japanese language.",
    ],
    [
      "Основное чтение にほん; у этого же слова есть словарный вариант にっぽん с маленькой っ.",
      "The primary reading is にほん; the same word also has the dictionary variant にっぽん with small っ.",
    ],
    [
      "いつか日本に行きたいです。",
      "いつかにほんにいきたいです。",
      "Когда-нибудь я хочу поехать в Японию.",
      "I want to go to Japan someday.",
    ],
    ["にっぽん"],
  ),
  word(
    "一人",
    "ひとり",
    "1576150",
    ["один человек"],
    ["one person"],
    [
      "Одна отметка 一 рядом с 人 оставляет в воображаемой очереди ровно одного человека.",
      "One 一 mark beside 人 leaves exactly one person in an imagined queue.",
    ],
    [
      "Пусть человек ひと сделает последний шаг на り: запомните слово целиком, ひとり.",
      "Let a ひと person take a final step onto り; remember the whole word ひとり.",
    ],
    ["Количество людей: один человек.", "A count of people: one person."],
    [
      "Основное счётное чтение ひとり; словарь также подтверждает вариант いちにん.",
      "The primary counting reading is ひとり; the dictionary also supports the variant いちにん.",
    ],
    [
      "一人ずつ中にはいってください。",
      "ひとりずつなかにはいってください。",
      "Заходите внутрь по одному.",
      "Please come inside one person at a time.",
    ],
    ["いちにん"],
  ),
  word(
    "二人",
    "ふたり",
    "1582670",
    ["два человека"],
    ["two people"],
    [
      "Две линии 二 отмечают два места рядом с 人: на этих местах стоят два человека.",
      "The two lines 二 mark two places beside 人, occupied by two people.",
    ],
    [
      "Дайте двум людям таблички ふ и た, а рядом с ними поставьте り: получится ふたり.",
      "Give two people ふ and た signs, then place り beside them to form ふたり.",
    ],
    ["Ровно два человека, не два предмета.", "Exactly two people, not two objects."],
    [
      "Основное чтение ふたり; для этого же слова подтверждён и вариант ににん.",
      "The primary reading is ふたり; ににん is also a supported variant of the same word.",
    ],
    [
      "二人でこの本をよみます。",
      "ふたりでこのほんをよみます。",
      "Мы вдвоём читаем эту книгу.",
      "The two of us read this book together.",
    ],
    ["ににん"],
  ),
  word(
    "大人",
    "おとな",
    "1414170",
    ["взрослый", "взрослый человек"],
    ["adult", "grown-up"],
    [
      "Большой 大 человек 人 в этой мнемонической сцене уже взрослый; это не перевод «великан».",
      "The big 大 person 人 in this memory scene is an adult, not a literal giant.",
    ],
    [
      "На трёх ступенях взросления разместите お・と・な: всё слово читается おとな.",
      "Place お・と・な on three imagined steps into adulthood; the whole word is おとな.",
    ],
    [
      "Человек взрослого возраста, без указания пола.",
      "A person who has reached adulthood, regardless of gender.",
    ],
    [
      "Особое чтение целого слова おとな, не だいじん.",
      "Learn the whole-word reading おとな, not だいじん.",
    ],
    [
      "子どもも大人も、ここでやすめます。",
      "こどももおとなも、ここでやすめます。",
      "И дети, и взрослые могут здесь отдохнуть.",
      "Children and adults can both rest here.",
    ],
  ),
  word(
    "男子",
    "だんし",
    "1420070",
    ["мальчик", "юноша"],
    ["boy", "young man"],
    [
      "В школьной сцене 男 рядом с 子 помогает запомнить мальчика или юношу, не профессию.",
      "In a school scene, 男 beside 子 helps recall a boy or young man, not an occupation.",
    ],
    [
      "Соедините знакомые онные だん у 男 и し у 子 в одно слово だんし.",
      "Join the familiar on readings だん for 男 and し for 子 into だんし.",
    ],
    [
      "Мальчик или юноша; здесь выбран узкий учебный смысл.",
      "A boy or young man; this card uses that narrow teaching sense.",
    ],
    [
      "だんし: сохраните ん перед し, не читайте おとここ.",
      "Keep ん before し in だんし; do not combine it as おとここ.",
    ],
    [
      "男子が二人、そとでまっています。",
      "だんしがふたり、そとでまっています。",
      "Снаружи ждут два мальчика.",
      "Two boys are waiting outside.",
    ],
  ),
  word(
    "女子",
    "じょし",
    "1345140",
    ["девочка", "девушка"],
    ["girl", "young woman"],
    [
      "Поставьте 女 и 子 на карточке школьной участницы: запомните девочку или девушку.",
      "Place 女 and 子 on a school participant's card to remember a girl or young woman.",
    ],
    [
      "Соедините じょ и し; маленькая ょ держится рядом с じ и не образует отдельный слог.",
      "Join じょ and し; small ょ stays with じ rather than forming a separate syllable.",
    ],
    [
      "Девочка или девушка; не общее обозначение любого ребёнка.",
      "A girl or young woman, not a general word for any child.",
    ],
    [
      "じょし с маленькой ょ, не じよし и не おんなこ.",
      "Use じょし with small ょ, not じよし or おんなこ.",
    ],
    [
      "あの女子がこの本をかりました。",
      "あのじょしがこのほんをかりました。",
      "Та девушка взяла эту книгу на время.",
      "That girl borrowed this book.",
    ],
  ),
  word(
    "火山",
    "かざん",
    "1193910",
    ["вулкан"],
    ["volcano"],
    [
      "Огонь 火 внутри горы 山 создаёт образ вулкана; это образ для памяти, не объяснение происхождения слова.",
      "Fire 火 inside a mountain 山 makes a volcano memory image, not a claim about the word's origin.",
    ],
    [
      "Начните с か у 火, затем озвончите начало 山 до ざん: かざん.",
      "Start with 火 as か, then voice the start of 山 to ざん: かざん.",
    ],
    [
      "Вулкан, а не обычная гора или отдельный пожар.",
      "A volcano, not an ordinary mountain or a separate fire.",
    ],
    [
      "かざん со звонким ざ; не かさん и не ひやま.",
      "かざん has voiced ざ; neither かさん nor ひやま is this reading.",
    ],
    [
      "あの火山からけむりが出ています。",
      "あのかざんからけむりがでています。",
      "Из того вулкана поднимается дым.",
      "Smoke is rising from that volcano.",
    ],
  ),
  word(
    "水田",
    "すいでん",
    "1371890",
    ["заливное рисовое поле", "рисовое поле"],
    ["rice paddy", "paddy field"],
    [
      "Залейте поле 田 водой 水 в воображении: перед вами рисовое поле с водой.",
      "Imagine filling the 田 field with 水 water: a flooded rice paddy.",
    ],
    [
      "Пустите по полю поток со звуком すい, а у края поставьте табличку でん: すいでん.",
      "Send a すい stream across the field and put a でん sign at its edge: すいでん.",
    ],
    [
      "Поле для риса с орошением; не любое сухое поле.",
      "An irrigated rice paddy, not just any dry field.",
    ],
    [
      "Основное чтение すいでん складывается из онных すい・でん; словарный вариант みずた тоже относится к этому слову.",
      "Primary すいでん combines the on readings すい・でん; dictionary variant みずた belongs to the same word.",
    ],
    [
      "水田の水がきらきらしています。",
      "すいでんのみずがきらきらしています。",
      "Вода на рисовом поле блестит.",
      "The water in the rice paddy is sparkling.",
    ],
    ["みずた"],
  ),
  word(
    "上下",
    "じょうげ",
    "1352710",
    ["верх и низ"],
    ["top and bottom"],
    [
      "Отметьте 上 сверху коробки и 下 снизу: существительное объединяет верх и низ.",
      "Mark 上 at a box's top and 下 at its bottom; the noun combines top and bottom.",
    ],
    [
      "Верхнюю отметку подпишите じょう, нижнюю げ: соедините их в じょうげ.",
      "Label the upper mark じょう and the lower mark げ, then join them as じょうげ.",
    ],
    [
      "Здесь учим верх и низ как пару частей, не глагол движения.",
      "Learn top and bottom as a pair of parts here, not a movement verb.",
    ],
    [
      "じょうげ: длинное じょう и нижнее げ, не うえした.",
      "Use long じょう followed by げ, not うえした.",
    ],
    [
      "このはこの上下にしるしをつけます。",
      "このはこのじょうげにしるしをつけます。",
      "Мы отметим верх и низ этой коробки.",
      "We mark the top and bottom of this box.",
    ],
  ),
  word(
    "左右",
    "さゆう",
    "1290810",
    ["лево и право", "левая и правая стороны"],
    ["left and right"],
    [
      "Слева поставьте 左, справа 右: вместе они называют обе стороны.",
      "Place 左 on the left and 右 on the right; together they name both sides.",
    ],
    [
      "На левом указателе напишите さ, на правом ゆう с длинным гласным: さゆう.",
      "Put さ on the left sign and long ゆう on the right sign: さゆう.",
    ],
    [
      "Левая и правая стороны, не глагольное значение влияния.",
      "The left and right sides, not the verb sense of influencing something.",
    ],
    [
      "Основное чтение さゆう сохраняет конечное う; у этого же слова есть подтверждённый вариант そう.",
      "Primary さゆう keeps final う; the same word also has the supported variant そう.",
    ],
    [
      "左右を見てから、みちをわたります。",
      "さゆうをみてから、みちをわたります。",
      "Перед переходом дороги мы смотрим налево и направо.",
      "We look left and right before crossing the road.",
    ],
    ["そう"],
  ),
  word(
    "一月",
    "いちがつ",
    "1162120",
    ["январь"],
    ["January"],
    [
      "На первой странице календаря 一 перед 月 указывает январь, первый месяц года.",
      "On the calendar's first page, 一 before 月 points to January, the first month of the year.",
    ],
    [
      "Прочитайте номер страницы いち и календарное 月 как がつ: いちがつ.",
      "Read the page number as いち and calendar 月 as がつ: いちがつ.",
    ],
    [
      "Январь как название месяца; не длительность в один месяц.",
      "January as a month name, not a duration of one month.",
    ],
    [
      "いちがつ, не いっかげつ; 月 здесь がつ, не つき.",
      "Use いちがつ, not いっかげつ; 月 is がつ here, not つき.",
    ],
    [
      "一月はこの川の水がこおります。",
      "いちがつはこのかわのみずがこおります。",
      "В январе вода в этой реке замерзает.",
      "In January, the water in this river freezes.",
    ],
  ),
  word(
    "二月",
    "にがつ",
    "1461560",
    ["февраль"],
    ["February"],
    [
      "Перелистните календарь на вторую страницу 二月: на ней февраль.",
      "Turn the calendar to its second page, 二月: February.",
    ],
    [
      "Соедините короткое に для 二 с календарным がつ для 月: にがつ.",
      "Join short に for 二 with calendar がつ for 月: にがつ.",
    ],
    [
      "Февраль, второй месяц года; не два месяца по длительности.",
      "February, the second month of the year, not a two-month duration.",
    ],
    [
      "にがつ без удвоения согласного; не にかげつ.",
      "Use にがつ without a doubled consonant, not にかげつ.",
    ],
    [
      "二月に日本へ行きます。",
      "にがつににほんへいきます。",
      "В феврале я поеду в Японию.",
      "I am going to Japan in February.",
    ],
  ),
  word(
    "三月",
    "さんがつ",
    "1300250",
    ["март"],
    ["March"],
    [
      "На третьей странице календаря три линии 三 стоят перед 月: это март.",
      "On the calendar's third page, the three lines 三 precede 月: March.",
    ],
    [
      "Сначала полностью произнесите さん, затем добавьте がつ: さんがつ.",
      "Say all of さん first, then add がつ to make さんがつ.",
    ],
    [
      "Март как название месяца, не промежуток в три месяца.",
      "March as a month name, not a span of three months.",
    ],
    ["Сохраните ん в さんがつ; не さんかげつ.", "Keep ん in さんがつ; do not enter さんかげつ."],
    [
      "三月にこの木のはながさきます。",
      "さんがつにこのきのはながさきます。",
      "В марте это дерево зацветает.",
      "This tree blossoms in March.",
    ],
  ),
  word(
    "一日",
    "いちにち",
    "1576260",
    ["один день", "целый день"],
    ["one day", "a whole day"],
    [
      "Проведите линию 一 через целую страницу дня 日: запомните длительность в один день.",
      "Draw one 一 line across a full 日 day page to remember a whole day's duration.",
    ],
    [
      "Возьмите いち для одного и にち для дня: いちにち, от начала дня до конца.",
      "Take いち for one and にち for day: いちにち, from the day's start to its end.",
    ],
    [
      "Один целый день по длительности; первое число месяца сюда не входит.",
      "One whole day as a duration; the first day of a month is outside this card.",
    ],
    ["Только いちにち, не календарное ついたち.", "Only いちにち, not calendar-date ついたち."],
    [
      "一日かけて、この本をよみました。",
      "いちにちかけて、このほんをよみました。",
      "Я потратил целый день на чтение этой книги.",
      "I spent a whole day reading this book.",
    ],
  ),
  word(
    "二日",
    "ふつか",
    "1462900",
    ["два дня", "второе число"],
    ["two days", "second day of the month"],
    [
      "Выделите на календаре две клетки 二日 и представьте работу, которая длится два дня.",
      "Mark two 二日 calendar squares and imagine a job lasting two days.",
    ],
    [
      "На двух клетках разместите ふ и つ, а в конце か: особое чтение ふつか.",
      "Put ふ and つ on the two squares, then add か: the special reading ふつか.",
    ],
    [
      "Два дня по длительности или второе число месяца: оба значения читаются ふつか.",
      "A two-day duration or the second day of a month: both senses read ふつか.",
    ],
    [
      "ふつか: обычное つ, без маленькой っ и без ににち.",
      "Use full-sized つ in ふつか, with no small っ and no ににち.",
    ],
    [
      "このしごとは二日かかります。",
      "このしごとはふつかかかります。",
      "На эту работу нужно два дня.",
      "This job takes two days.",
    ],
  ),
  word(
    "三日",
    "みっか",
    "1301330",
    ["три дня", "третье число"],
    ["three days", "third day of the month"],
    [
      "Три линии 三 помогают выделить три дня 日 подряд, а не три месяца.",
      "The three lines 三 help mark three 日 days in a row, not three months.",
    ],
    [
      "Скажите み, сделайте короткую паузу на маленькой っ и закончите か: みっか.",
      "Say み, hold a short closure for small っ, then finish with か: みっか.",
    ],
    [
      "Три дня по длительности или третье число месяца; в обоих случаях чтение みっか.",
      "A three-day duration or the third day of a month; both use みっか.",
    ],
    [
      "みっか с маленькой っ, не みつか и не さんにち.",
      "Use みっか with small っ, not みつか or さんにち.",
    ],
    [
      "三日つづけて、あめがふりました。",
      "みっかつづけて、あめがふりました。",
      "Дождь шёл три дня подряд.",
      "It rained for three days in a row.",
    ],
  ),
  word(
    "十日",
    "とおか",
    "1335000",
    ["десять дней", "десятое число"],
    ["ten days", "tenth day of the month"],
    [
      "Соберите десять клеток 日 под знаком 十: получится десятидневное пребывание.",
      "Gather ten 日 day squares under 十 to picture a ten-day stay.",
    ],
    [
      "Растяните と до とお, затем добавьте か: десять дней читаются とおか.",
      "Lengthen と to とお, then add か: ten days reads とおか.",
    ],
    [
      "Десять дней по длительности или десятое число месяца: оба значения читаются とおか.",
      "A ten-day duration or the tenth day of a month: both senses read とおか.",
    ],
    [
      "Пишите とおか с お, не とうか и не じゅうにち.",
      "Spell とおか with お, not とうか or じゅうにち.",
    ],
    [
      "日本に十日いました。",
      "にほんにとおかいました。",
      "Я пробыл в Японии десять дней.",
      "I stayed in Japan for ten days.",
    ],
  ),
  word(
    "国",
    "くに",
    "1592250",
    ["страна", "государство"],
    ["country", "nation"],
    [
      "Представьте рамку 国 как границу страны на условной карте: внутри целое государство.",
      "Imagine the 国 frame as a country's border on a simple map, enclosing a nation.",
    ],
    [
      "Поставьте на двух сторонах воображаемой границы метки く и に: くに.",
      "Put く and に markers on two sides of an imaginary border: くに.",
    ],
    [
      "Страна или государство; не сельская местность в английском значении country.",
      "A country or nation, not the countryside sense of English country.",
    ],
    [
      "Два слога く・に; онное こく здесь не подходит.",
      "Two syllables, く・に; the on reading こく is not this word.",
    ],
    [
      "この国には大きな川があります。",
      "このくににはおおきなかわがあります。",
      "В этой стране есть большая река.",
      "There is a large river in this country.",
    ],
  ),
  word(
    "中",
    "なか",
    "1423310",
    ["внутри", "внутренняя часть"],
    ["inside", "interior"],
    [
      "Мысленно положите предмет внутрь рамки 中: здесь учим внутреннее пространство.",
      "Imagine placing an object inside the 中 frame: learn the interior space here.",
    ],
    [
      "Воображаемую коробку подпишите изнутри двумя знаками な и か: なか.",
      "Label an imaginary box on the inside with な and か: なか.",
    ],
    [
      "Внутренняя часть или пространство внутри чего-то.",
      "The inner part or space inside something.",
    ],
    ["なか, не онное ちゅう и не じゅう.", "Use なか, not the on readings ちゅう or じゅう."],
    [
      "かばんの中に本があります。",
      "かばんのなかにほんがあります。",
      "Внутри сумки лежит книга.",
      "There is a book inside the bag.",
    ],
  ),
];

const BATCH: MainCourseWordBatch = {
  id: "task-127-foundation-words-02",
  version: "1",
  authoredAt: "2026-10-22",
  reviewedAt: "2026-10-22",
  reviewNotes:
    "AI-authored independent RU/EN teaching copy and original JP/kana/RU/EN examples. Independently reviewed and corrected by the parent agent on 2026-10-22: all twenty primary pairs and five alternate readings were checked against successful bilingual JMdict records; date/duration meanings and reading hints were corrected. Full source preflight remains mandatory. Not a human-review claim or full Task127 completion. No legacy-to-modern JLPT inference.",
  sourceFile: "packages/db/src/main-course-word-content-02.ts",
  courseSlug: "japanese-ru-n2",
  levelNumber: 5,
  sortOrderStart: 21,
  words: WORDS.map((content, index) => ({ ...content, sortOrder: 21 + index })),
};

export function buildMainCourseWordBatch02(): MainCourseWordBatch {
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
  acceptedReadings?: readonly string[],
): Omit<MainCourseWordContent, "sortOrder"> {
  const bilingual = ([ru, en]: readonly [string, string]) => ({ ru, en });
  return {
    expression,
    reading,
    jmdictEntryId: `jmdict:${entryId}`,
    ...(acceptedReadings === undefined ? {} : { acceptedReadings }),
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
