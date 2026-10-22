import { type MainCourseWordBatch, type MainCourseWordContent } from "./main-course-word-content";

const WORDS: readonly Omit<MainCourseWordContent, "sortOrder">[] = [
  word(
    "入口",
    "いりぐち",
    "1582820",
    ["вход"],
    ["entrance"],
    [
      "Войти 入 через проём 口: представьте вход в здание.",
      "Enter 入 through an opening 口: picture a building's entrance.",
    ],
    [
      "Вход начинается с いり, а くち меняется на ぐち: いりぐち.",
      "The entrance starts with いり, and くち becomes ぐち: いりぐち.",
    ],
    ["Место, через которое входят, не выход.", "The place you enter through, not an exit."],
    ["いり・ぐち: середина ぐ, не く.", "いり・ぐち: the middle kana is ぐ, not く."],
    [
      "入口は左にあります。",
      "いりぐちはひだりにあります。",
      "Вход находится слева.",
      "The entrance is on the left.",
    ],
  ),
  word(
    "入学",
    "にゅうがく",
    "1465850",
    ["поступление в учебное заведение", "поступление в школу"],
    ["admission to school", "entering school"],
    [
      "Вход 入 в учёбу 学 напоминает поступление в учебное заведение.",
      "Entry 入 into study 学 suggests admission to a school.",
    ],
    [
      "Вход にゅう соединяется с учёбой がく: にゅうがく.",
      "Entry にゅう joins study がく: にゅうがく.",
    ],
    [
      "Начало обучения в учебном заведении, не вход в его здание.",
      "Entering an educational institution as a student, not entering its building.",
    ],
    [
      "にゅう・がく: сохраните маленькую ゅ и следующий う.",
      "にゅう・がく: keep small ゅ and the following う.",
    ],
    [
      "四月に大学に入学します。",
      "しがつにだいがくににゅうがくします。",
      "В апреле я поступаю в университет.",
      "I will enter university in April.",
    ],
  ),
  word(
    "休み",
    "やすみ",
    "1227500",
    ["отдых", "перерыв"],
    ["rest", "break"],
    [
      "Человек у дерева 休 сделал паузу: представьте короткий отдых.",
      "The person beside the tree 休 pauses: imagine a short rest.",
    ],
    [
      "На месте отдыха поставьте や и す, затем добавьте написанное み: やすみ.",
      "Put や and す at a resting place, then add the written み: やすみ.",
    ],
    [
      "Здесь учим отдых или перерыв; выходной день отдельно называется 休日.",
      "Here learn a rest or break; a day off is taught separately as 休日.",
    ],
    ["やす・み: включите конечное み; не きゅう.", "やす・み: include the final み, not きゅう."],
    [
      "すこし休みをとりましょう。",
      "すこしやすみをとりましょう。",
      "Давайте немного отдохнём.",
      "Let's take a short break.",
    ],
  ),
  word(
    "休日",
    "きゅうじつ",
    "1228040",
    ["выходной день", "выходной"],
    ["day off"],
    [
      "Отдых 休 занимает целый день 日: это выходной день.",
      "Rest 休 fills a whole day 日: it is a day off.",
    ],
    [
      "Отдых звучит きゅう, а день здесь じつ: きゅうじつ.",
      "Rest is きゅう, and day here is じつ: きゅうじつ.",
    ],
    [
      "День без обычной работы или учёбы, не короткий перерыв.",
      "A day away from regular work or school, not a short break.",
    ],
    [
      "きゅう・じつ: не заменяйте конец на にち.",
      "きゅう・じつ: do not replace the ending with にち.",
    ],
    [
      "休日は森をあるきます。",
      "きゅうじつはもりをあるきます。",
      "В выходные я гуляю по лесу.",
      "I walk in the forest on my days off.",
    ],
  ),
  word(
    "体",
    "からだ",
    "1409140",
    ["тело"],
    ["body"],
    [
      "У фигуры человека 体 представьте всё тело: голову, руки и ноги вместе.",
      "Picture the person's whole body in 体: head, arms and legs together.",
    ],
    [
      "Мысленно проведите по силуэту три метки か・ら・だ: からだ.",
      "Trace three labels along an imagined silhouette, か・ら・だ: からだ.",
    ],
    [
      "Тело как физическое целое, не отдельная часть тела.",
      "The physical body as a whole, not a single body part.",
    ],
    [
      "か・ら・だ: последнее だ звонкое; не онное たい.",
      "か・ら・だ: the final だ is voiced; not the on reading たい.",
    ],
    [
      "体を休めてください。",
      "からだをやすめてください。",
      "Дайте телу отдохнуть.",
      "Please let your body rest.",
    ],
  ),
  word(
    "体力",
    "たいりょく",
    "1409760",
    ["физическая сила", "физические силы"],
    ["physical strength"],
    [
      "Сила 力 тела 体 нужна, чтобы подняться на гору: представьте физические силы.",
      "The strength 力 of the body 体 helps you climb a mountain: picture physical strength.",
    ],
    [
      "Тело даёт たい, сила — りょく: たいりょく.",
      "Body gives たい and strength gives りょく: たいりょく.",
    ],
    [
      "Физические силы человека, не сила воли или власть.",
      "A person's physical strength, not willpower or authority.",
    ],
    [
      "たい・りょく: после り маленькая ょ; не たいりようく.",
      "たい・りょく: use small ょ after り, not たいりようく.",
    ],
    [
      "山をあるくには体力がいります。",
      "やまをあるくにはたいりょくがいります。",
      "Для прогулок в горах нужны физические силы.",
      "Walking in the mountains requires physical strength.",
    ],
  ),
  word(
    "林",
    "はやし",
    "1555440",
    ["роща", "лес", "лесок"],
    ["grove", "woods", "forest"],
    [
      "Два дерева 林 стоят рядом: представьте рощу вокруг них.",
      "Two trees stand together in 林: imagine a grove around them.",
    ],
    [
      "Между деревьями разместите три знака は・や・し: はやし.",
      "Place three kana between the trees, は・や・し: はやし.",
    ],
    ["Роща или лес; здесь не фамилия человека.", "A grove or woods, not a person's surname here."],
    [
      "は・や・し; онное りん не подходит этому слову.",
      "は・や・し; the on reading りん is not this word's reading.",
    ],
    [
      "林の中で休みましょう。",
      "はやしのなかでやすみましょう。",
      "Давайте отдохнём в роще.",
      "Let's rest in the grove.",
    ],
  ),
  word(
    "森林",
    "しんりん",
    "1362530",
    ["лес", "лесной массив"],
    ["forest", "woodland"],
    [
      "Соедините густую группу деревьев 森 с рощей 林: перед вами целый лесной массив.",
      "Join the dense trees 森 with the grove 林: picture an entire forest.",
    ],
    [
      "Сначала лес しん, затем роща りん: しんりん.",
      "First forest しん, then grove りん: しんりん.",
    ],
    [
      "Лес как пространство, покрытое деревьями, не отдельное дерево.",
      "A forest as land covered by trees, not an individual tree.",
    ],
    ["しん・りん: обе части заканчиваются на ん.", "しん・りん: both parts end in ん."],
    [
      "この山は森林におおわれています。",
      "このやまはしんりんにおおわれています。",
      "Эта гора покрыта лесом.",
      "This mountain is covered in forest.",
    ],
  ),
  word(
    "森",
    "もり",
    "1362490",
    ["лес"],
    ["forest", "woods"],
    [
      "Три дерева 森 окружают тропинку: представьте лес, в который можно войти.",
      "Three trees 森 surround a path: imagine a forest you can enter.",
    ],
    [
      "У входа в лес повесьте две таблички も и り: もり.",
      "Hang two signs at the forest entrance, も and り: もり.",
    ],
    ["Лес или лесная местность; не одиночное дерево.", "A forest or woods, not a single tree."],
    ["も・り: здесь не онное しん.", "も・り, not the on reading しん here."],
    [
      "森の中に小川があります。",
      "もりのなかにおがわがあります。",
      "В лесу есть ручей.",
      "There is a stream in the forest.",
    ],
  ),
  word(
    "犬",
    "いぬ",
    "1258330",
    ["собака", "пёс"],
    ["dog"],
    [
      "Точка у знакомой фигуры 犬 напоминает поднятое ухо собаки.",
      "The dot beside familiar 犬 suggests a dog's raised ear.",
    ],
    [
      "На двух концах воображаемого поводка поставьте い и ぬ: いぬ.",
      "Put い and ぬ at two ends of an imagined leash: いぬ.",
    ],
    [
      "Буквальное название животного, без переносных значений.",
      "The literal animal name, with no figurative senses.",
    ],
    ["い・ぬ; не чтение кандзи けん.", "い・ぬ, not the kanji reading けん."],
    [
      "犬と川のそばをあるきます。",
      "いぬとかわのそばをあるきます。",
      "Я гуляю с собакой у реки.",
      "I walk with my dog beside the river.",
    ],
  ),
  word(
    "夕日",
    "ゆうひ",
    "1542750",
    ["вечернее солнце", "заходящее солнце"],
    ["evening sun", "setting sun"],
    [
      "Поместите солнце 日 в вечер 夕: представьте его низко над горизонтом.",
      "Place the sun 日 in the evening 夕: imagine it low above the horizon.",
    ],
    ["Вечер ゆう соединяется с солнцем ひ: ゆうひ.", "Evening ゆう joins sun ひ: ゆうひ."],
    [
      "Солнце вечером, особенно заходящее, не восход солнца.",
      "The sun in the evening, especially as it sets, not the sunrise.",
    ],
    [
      "ゆう・ひ: чтение слова не выводится из изученного онного せき у 夕.",
      "ゆう・ひ: this word does not use the taught on reading せき of 夕.",
    ],
    [
      "山の上で夕日を見ました。",
      "やまのうえでゆうひをみました。",
      "Мы смотрели на вечернее солнце с вершины горы.",
      "We watched the evening sun from the mountaintop.",
    ],
  ),
  word(
    "名",
    "な",
    "1531330",
    ["имя", "название"],
    ["name"],
    [
      "Рот 口 под вечерним знаком 夕 произносит имя: представьте, как кого-то зовут.",
      "The mouth 口 beneath evening 夕 says a name: imagine calling someone.",
    ],
    [
      "На маленькой табличке с именем оставьте один знак な: всё слово короткое.",
      "Leave a single な on a small name label: the whole word is short.",
    ],
    [
      "Имя человека или название чего-либо; не счёт людей.",
      "A person's name or the name of something, not a count of people.",
    ],
    ["Один короткий な; не めい и не слово なまえ.", "One short な, not めい or the word なまえ."],
    [
      "この川の名をしっていますか。",
      "このかわのなをしっていますか。",
      "Вы знаете название этой реки?",
      "Do you know this river's name?",
    ],
  ),
  word(
    "外",
    "そと",
    "1203250",
    ["снаружи", "наружная сторона", "вне помещения"],
    ["outside", "outdoors"],
    [
      "Мысленно выйдите через вход 入口: теперь вы снаружи, 外.",
      "Imagine walking through the entrance 入口: now you are outside, 外.",
    ],
    [
      "На наружной стороне двери напишите そ и と: そと.",
      "Write そ and と on the outside of a door: そと.",
    ],
    [
      "Пространство снаружи или наружная сторона, не внутренность.",
      "The space outside or the outer side, not the interior.",
    ],
    ["そ・と; не онное がい.", "そ・と, not the on reading がい."],
    [
      "雨がやんだので、外へ出ましょう。",
      "あめがやんだので、そとへでましょう。",
      "Дождь прекратился, давайте выйдем наружу.",
      "The rain has stopped, so let's go outside.",
    ],
  ),
  word(
    "国外",
    "こくがい",
    "1286270",
    ["за границей", "за пределами страны", "зарубежье"],
    ["abroad", "outside the country"],
    [
      "Поставьте отметку снаружи 外 страны 国: она находится за границей.",
      "Put a marker outside 外 the country 国: it is abroad.",
    ],
    [
      "Страна даёт こく, внешняя сторона — がい: こくがい.",
      "Country gives こく and outside gives がい: こくがい.",
    ],
    [
      "Место за пределами страны, не само действие выезда.",
      "A place outside the country, not the act of leaving it.",
    ],
    [
      "こく・がい: последняя согласная звонкая が.",
      "こく・がい: the final part begins with voiced が.",
    ],
    [
      "国外で日本人に会いました。",
      "こくがいでにほんじんにあいました。",
      "За границей я встретил японца.",
      "I met a Japanese person abroad.",
    ],
  ),
  word(
    "王",
    "おう",
    "1629200",
    ["король", "царь"],
    ["king"],
    [
      "Три яруса воображаемого трона 王 помогают представить короля.",
      "Three tiers of an imagined throne 王 help you picture a king.",
    ],
    [
      "Над троном поместите お, а на его спинке う: король зовётся おう.",
      "Put お above the throne and う on its back: the king is called おう.",
    ],
    [
      "Правитель государства; здесь не игровая фигура.",
      "A ruler of a country, not a game piece here.",
    ],
    [
      "お・う: конечное う обязательно, не короткое お.",
      "お・う: keep the final う, not a short お.",
    ],
    [
      "その国の王はこの本をよみました。",
      "そのくにのおうはこのほんをよみました。",
      "Король той страны прочитал эту книгу.",
      "The king of that country read this book.",
    ],
  ),
  word(
    "王国",
    "おうこく",
    "1181480",
    ["королевство", "царство"],
    ["kingdom"],
    [
      "Страна 国 с королём 王 во главе становится королевством.",
      "A country 国 with a king 王 at its head becomes a kingdom.",
    ],
    [
      "Король おう и страна こく соединяются в おうこく.",
      "King おう and country こく join as おうこく.",
    ],
    [
      "Буквальное государство с королём, не переносное царство чего-либо.",
      "A literal country ruled by a king, not a figurative kingdom of something.",
    ],
    [
      "おう・こく: сохраните долгий гласный в начале.",
      "おう・こく: keep the long vowel at the beginning.",
    ],
    [
      "この王国には大きな川があります。",
      "このおうこくにはおおきなかわがあります。",
      "В этом королевстве есть большая река.",
      "There is a large river in this kingdom.",
    ],
  ),
  word(
    "玉",
    "たま",
    "1240530",
    ["шар", "шарик", "драгоценный камень", "драгоценность"],
    ["ball", "sphere", "gem", "jewel"],
    [
      "Представьте круглую 玉 как шар; драгоценный шар напомнит и о камне-самоцвете.",
      "Picture round 玉 as a ball; a precious ball also suggests a gem.",
    ],
    [
      "На двух половинах шара разместите た и ま: たま.",
      "Place た and ま on two halves of a ball: たま.",
    ],
    [
      "Принимаются шар и драгоценный камень; нужный буквальный смысл подсказывает предложение.",
      "Both a ball and a jewel are accepted; the sentence supplies the intended literal sense.",
    ],
    [
      "た・ま: это слово, не онное чтение ぎょく.",
      "た・ま: this is the word, not the on reading ぎょく.",
    ],
    [
      "子どもが小さな玉を手にもちました。",
      "こどもがちいさなたまをてにもちました。",
      "Ребёнок держал в руке маленький шарик.",
      "A child held a small ball in their hand.",
    ],
  ),
  word(
    "白",
    "しろ",
    "1474900",
    ["белый цвет"],
    ["white", "the color white"],
    [
      "Покройте знакомый знак 白 белой краской: слово называет сам цвет.",
      "Cover familiar 白 in white paint: the word names the color itself.",
    ],
    ["На белой полосе напишите し и ろ: しろ.", "Write し and ろ on a white stripe: しろ."],
    [
      "Название цвета как существительное: белый цвет. Прилагательное しろい — другая словоформа.",
      "The color name as a noun: white. The adjective しろい is a different word form.",
    ],
    ["し・ろ, без конечного い; не はく.", "し・ろ, with no final い; not はく."],
    ["この車は白です。", "このくるまはしろです。", "Эта машина белая.", "This car is white."],
  ),
  word(
    "糸",
    "いと",
    "1311450",
    ["нить", "нитка"],
    ["thread"],
    [
      "От воображаемого мотка 糸 отходит тонкая нить: представьте её между пальцами.",
      "A thin thread leaves an imagined skein 糸: picture it between your fingers.",
    ],
    [
      "Один конец нити подпишите い, другой と: いと.",
      "Label one end of a thread い and the other と: いと.",
    ],
    [
      "Буквальная нить или нитка, не переносная связь.",
      "A literal thread, not a figurative connection.",
    ],
    [
      "い・と, два коротких слога; не онное し.",
      "い・と, two short syllables; not the on reading し.",
    ],
    [
      "白い糸をつかいます。",
      "しろいいとをつかいます。",
      "Я использую белую нить.",
      "I use white thread.",
    ],
  ),
  word(
    "車",
    "くるま",
    "1323080",
    ["машина", "автомобиль"],
    ["car", "automobile"],
    [
      "Знакомую повозку 車 мысленно замените обычным автомобилем на дороге.",
      "Replace the familiar cart 車 in your imagination with an ordinary car on a road.",
    ],
    [
      "На воображаемом автомобиле разместите три метки く・る・ま: くるま.",
      "Place three labels on an imagined car, く・る・ま: くるま.",
    ],
    ["Автомобиль, не любая машина как механизм.", "A car, not just any machine or mechanism."],
    [
      "く・る・ま: три коротких слога; не онное しゃ.",
      "く・る・ま: three short syllables, not the on reading しゃ.",
    ],
    [
      "この車で山へ行きます。",
      "このくるまでやまへいきます。",
      "На этой машине мы поедем в горы.",
      "We will go to the mountains in this car.",
    ],
  ),
];

const BATCH: MainCourseWordBatch = {
  id: "task-127-course-words-06",
  version: "1",
  authoredAt: "2026-10-22",
  reviewedAt: "2026-10-22",
  reviewNotes:
    "AI-authored original RU/EN teaching copy and JP/kana/RU/EN examples. Independently reviewed by the parent agent on 2026-10-22 against twenty exact successful bilingual JMdict identities, literal curated senses, full kana readings, the earlier 81-kanji closure and free level-6 placements. 玉 accepts verified ball and jewel senses; 白 teaches the noun color しろ; 夕日 correctly teaches ゆうひ independently of the kanji card's on reading. No unverified alternate readings or raw data rewrites. Not human review or publication proof; full licensed-source, band, prerequisite and quality preflight remains mandatory. Frozen pilot V1/V2/V3 scopes are not expanded.",
  sourceFile: "packages/db/src/main-course-word-content-06.ts",
  courseSlug: "japanese-ru-n2",
  levelNumber: 6,
  sortOrderStart: 21,
  words: WORDS.map((content, index) => ({ ...content, sortOrder: 21 + index })),
};

export function buildMainCourseWordBatch06(): MainCourseWordBatch {
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
