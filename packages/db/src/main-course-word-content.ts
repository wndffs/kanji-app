import { createHash } from "node:crypto";

import { normalizeJapaneseReading, normalizeMeaning } from "@kanji-srs/japanese";
import { buildMainCourseBlueprint } from "./main-course";
import { validateCuratedMeaningBlocks } from "./curated-meaning-blocks";
import { buildMainCourseWordBatch02 } from "./main-course-word-content-02";
import { buildMainCourseWordBatch04 } from "./main-course-word-content-04";
import { buildMainCourseWordBatch05 } from "./main-course-word-content-05";
import { buildMainCourseWordBatch06 } from "./main-course-word-content-06";
import { buildMainCourseWordBatch07 } from "./main-course-word-content-07";
import { buildMainCourseWordBatch08 } from "./main-course-word-content-08";
import { type LexicalKind } from "./lexical-selection";

import {
  type MainCourseAcceptedMeanings,
  type MainCourseLocalizedText,
} from "./main-course-content";

export type MainCourseWordContent = {
  readonly expression: string;
  readonly reading: string;
  readonly acceptedReadings?: readonly string[];
  readonly jmdictEntryId: string;
  readonly partOfSpeech?: LexicalKind;
  readonly sortOrder: number;
  readonly meanings: {
    readonly ru: MainCourseAcceptedMeanings;
    readonly en: MainCourseAcceptedMeanings;
  };
  readonly meaningMnemonic: MainCourseLocalizedText;
  readonly readingMnemonic: MainCourseLocalizedText;
  readonly meaningHint: MainCourseLocalizedText;
  readonly readingHint: MainCourseLocalizedText;
  readonly example: {
    readonly japaneseText: string;
    readonly readingText: string;
    readonly translationRu: string;
    readonly translationEn: string;
  };
};

export type MainCourseWordBatch = {
  readonly id: string;
  readonly version: string;
  readonly authoredAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNotes: string;
  readonly sourceFile: string;
  readonly courseSlug: string;
  readonly levelNumber: number;
  readonly sortOrderStart?: number;
  readonly words: readonly MainCourseWordContent[];
};

export const AUTHORED_WORD_PART_OF_SPEECH = "noun (course-authored)";
export function authoredWordPartOfSpeech(content: Pick<MainCourseWordContent, "partOfSpeech">) {
  return `${content.partOfSpeech ?? "noun"} (course-authored)`;
}

const FOUNDATION_WORDS = [
  word(
    "山",
    "やま",
    "1302680",
    ["гора"],
    ["mountain"],
    [
      "Знакомые вершины 山 теперь называют целую гору, а не чтение кандзи в сложном слове.",
      "The familiar peaks 山 now name a whole mountain, not a kanji reading inside a compound.",
    ],
    [
      "Русская «яма» уходит вниз, а японское やま поднимается горой: контраст связывает два слога.",
      "Trace a mountain's two slopes while saying や, then ま, to link the shape with やま.",
    ],
    ["Природная возвышенность, не холм в узком значении.", "A mountain as a natural landform."],
    [
      "Два слога や・ま; онное さん здесь не подходит.",
      "Two syllables, や・ま; the on reading さん is not this word.",
    ],
    [
      "あの山はたかいです。",
      "あのやまはたかいです。",
      "Та гора высокая.",
      "That mountain is tall.",
    ],
  ),
  word(
    "川",
    "かわ",
    "1390020",
    ["река"],
    ["river"],
    [
      "Три потока в 川 напоминают реку, по которой течёт вода.",
      "The three streams in 川 suggest a river carrying water.",
    ],
    [
      "В образе реки соедините два берега: на одном か, на другом わ. Вместе かわ.",
      "Put か on one riverbank and わ on the other; together they give かわ.",
    ],
    ["Водный поток между берегами.", "A stream of water between riverbanks."],
    [
      "Начните с か, закончите わ; не используйте せん.",
      "Start with か and finish with わ, not せん.",
    ],
    [
      "川の水はつめたいです。",
      "かわのみずはつめたいです。",
      "Вода в реке холодная.",
      "The river water is cold.",
    ],
  ),
  word(
    "水",
    "みず",
    "1371260",
    ["вода"],
    ["water"],
    [
      "Представьте обычную воду в стакане: здесь 水 называет вещество целиком.",
      "Picture ordinary water in a glass: 水 names the substance itself here.",
    ],
    [
      "Мысленно напишите на стакане み, а на капле рядом ず: получается みず.",
      "Write み on an imaginary glass and ず on a drop beside it: みず.",
    ],
    ["Обычная вода, не общее название напитков.", "Ordinary water, not a general word for drinks."],
    [
      "Второй знак ず с двумя точками; это не すい.",
      "The second kana is voiced ず; this word is not すい.",
    ],
    [
      "水をもうすこしください。",
      "みずをもうすこしください。",
      "Дайте ещё немного воды, пожалуйста.",
      "A little more water, please.",
    ],
  ),
  word(
    "火",
    "ひ",
    "1193610",
    ["огонь"],
    ["fire"],
    [
      "У центрального пламени 火 разлетаются искры: запомните именно огонь.",
      "Sparks scatter beside the central flame 火: remember fire itself.",
    ],
    [
      "Одну искру мысленно подпишите одним знаком ひ: короткое слово для огня.",
      "Label one imagined spark with one kana, ひ: a short word for fire.",
    ],
    ["Пламя или огонь, не день недели.", "Fire or a flame, not a weekday."],
    [
      "Только ひ, без удлинения и без онного か.",
      "Only ひ, with no long vowel and no on reading か.",
    ],
    [
      "火にちかづかないでください。",
      "ひにちかづかないでください。",
      "Не подходите близко к огню.",
      "Please do not go near the fire.",
    ],
  ),
  word(
    "木",
    "き",
    "1534520",
    ["дерево", "древесина"],
    ["tree", "wood"],
    [
      "Ствол и ветви 木 помогают представить одно растущее дерево.",
      "The trunk and branches 木 help you picture one growing tree.",
    ],
    [
      "Повесьте на дерево маленькую табличку き: вся короткая надпись и есть чтение слова.",
      "Hang a small き sign on a tree; that entire short label is the word's reading.",
    ],
    [
      "Дерево как растение; значение древесины тоже допустимо.",
      "A tree as a plant; wood as a material is also accepted.",
    ],
    [
      "Один короткий слог き, а не онные ぼく или もく.",
      "One short syllable き, not the on readings ぼく or もく.",
    ],
    [
      "この木の下でやすみましょう。",
      "このきのしたでやすみましょう。",
      "Давайте отдохнём под этим деревом.",
      "Let's rest under this tree.",
    ],
  ),
  word(
    "石",
    "いし",
    "1382440",
    ["камень"],
    ["stone", "rock"],
    [
      "Представьте отдельный небольшой камень под знакомым уступом 石.",
      "Picture a single small stone beneath the familiar ledge in 石.",
    ],
    [
      "Сначала покажите на камень со звуком い, затем приложите палец к губам на し: いし.",
      "Point at a stone with い, then imagine a quiet し beside it: いし.",
    ],
    ["Отдельный камень или кусок горной породы.", "A stone or a piece of rock."],
    ["Два знака い・し; не используйте せき.", "Two kana, い・し; do not use せき."],
    [
      "ちいさな石をひろいました。",
      "ちいさないしをひろいました。",
      "Я поднял маленький камень.",
      "I picked up a small stone.",
    ],
  ),
  word(
    "土",
    "つち",
    "1445270",
    ["почва", "земля"],
    ["soil", "earth"],
    [
      "Вспомните росток над землёй 土 и рыхлую почву у его корней.",
      "Recall the shoot above 土 and the loose soil around its roots.",
    ],
    [
      "На двух комочках земли мысленно разместите つ и ち: вместе つち.",
      "Put つ and ち on two imaginary clumps of soil: together they make つち.",
    ],
    ["Земля под ногами, а не планета Земля.", "Earth beneath your feet, not the planet Earth."],
    ["Сначала つ, затем ち; не と и не ど.", "First つ, then ち; neither と nor ど."],
    [
      "あめで土がぬれました。",
      "あめでつちがぬれました。",
      "Почва намокла от дождя.",
      "The rain made the soil wet.",
    ],
  ),
  word(
    "金",
    "かね",
    "1242590",
    ["деньги"],
    ["money"],
    [
      "Представьте кошелёк с деньгами под знаком 金. В этом слове учим деньги, не золото.",
      "Picture money in a purse beneath 金. This word teaches money, not gold.",
    ],
    [
      "Положите в воображаемый кошелёк две монеты с надписями か и ね: かね.",
      "Put two coins marked か and ね into an imaginary purse: かね.",
    ],
    ["Деньги как средство оплаты.", "Money used to pay for things."],
    [
      "На карточке かね; в вежливой речи часто добавляют お: おかね.",
      "Enter かね; polite speech often adds お to make おかね.",
    ],
    [
      "いまはお金がありません。",
      "いまはおかねがありません。",
      "Сейчас у меня нет денег.",
      "I do not have any money right now.",
    ],
  ),
  word(
    "女",
    "おんな",
    "1344930",
    ["женщина"],
    ["woman"],
    [
      "Знакомая форма 女 напоминает женщину со сложенными руками.",
      "The familiar 女 form suggests a woman with folded arms.",
    ],
    [
      "Разместите рядом с образом женщины три знака お・ん・な и произнесите все три моры.",
      "Place お・ん・な beside the image of a woman and pronounce all three morae.",
    ],
    [
      "Взрослая женщина. В обычной вежливой речи часто говорят 女の人.",
      "An adult woman. Everyday polite speech often uses 女の人.",
    ],
    [
      "Сохраните ん перед な: おんな, не おな и не じょ.",
      "Keep ん before な: おんな, not おな or じょ.",
    ],
    [
      "あの女の人はせんせいです。",
      "あのおんなのひとはせんせいです。",
      "Та женщина работает учительницей.",
      "That woman is a teacher.",
    ],
  ),
  word(
    "男",
    "おとこ",
    "1419990",
    ["мужчина"],
    ["man"],
    [
      "Условная сцена с полем и силой помогает узнать 男; слово означает мужчину, а не профессию.",
      "An imagined field-and-strength scene helps identify 男; the word means man, not an occupation.",
    ],
    [
      "Пройдите по трём клеткам с надписями お・と・こ к человеку в конце: おとこ.",
      "Walk across three squares marked お・と・こ toward the man at the end: おとこ.",
    ],
    [
      "Взрослый мужчина. В обычной вежливой речи часто говорят 男の人.",
      "An adult man. Everyday polite speech often uses 男の人.",
    ],
    ["Три коротких слога お・と・こ; это не だん.", "Three short syllables, お・と・こ; not だん."],
    [
      "あの男の人はわたしのちちです。",
      "あのおとこのひとはわたしのちちです。",
      "Тот мужчина мой отец.",
      "That man is my father.",
    ],
  ),
  word(
    "子",
    "こ",
    "1307770",
    ["ребёнок"],
    ["child"],
    [
      "Представьте ребёнка с большой головой и раскинутыми руками 子: это только образ для памяти.",
      "Picture a child with a large head and outstretched arms 子: only a memory image.",
    ],
    [
      "На маленькой детской карточке помещается один знак こ — всё чтение слова.",
      "A small child's name card holds one kana, こ: the entire reading.",
    ],
    ["Ребёнок; не суффикс имени в этом уроке.", "A child, not a name suffix in this lesson."],
    ["Один слог こ, не онное し.", "One syllable こ, not the on reading し."],
    [
      "あの子はよくわらいます。",
      "あのこはよくわらいます。",
      "Тот ребёнок часто смеётся.",
      "That child laughs often.",
    ],
  ),
  word(
    "田",
    "た",
    "1442730",
    ["рисовое поле"],
    ["rice field", "rice paddy"],
    [
      "Рамка с дорожками 田 напоминает затопленные участки рисового поля.",
      "The frame and crossing paths 田 suggest the flooded plots of a rice field.",
    ],
    [
      "Поставьте у рисового поля короткую табличку た: один знак чтения на всё поле.",
      "Put a short た sign beside the rice field: one kana for the whole field.",
    ],
    [
      "Именно поле для выращивания риса, а не любое открытое пространство.",
      "A field for growing rice, not just any open space.",
    ],
    ["Короткое た, не でん.", "A short た, not でん."],
    [
      "田に水をいれます。",
      "たにみずをいれます。",
      "Мы пускаем воду на рисовое поле.",
      "We let water into the rice field.",
    ],
  ),
  word(
    "上",
    "うえ",
    "1352130",
    ["верх", "сверху", "вверху"],
    ["top", "above"],
    [
      "Короткая отметка над опорной линией 上 помогает представить место сверху.",
      "The short mark above the reference line 上 helps you picture the space above.",
    ],
    [
      "Поднимите взгляд по двум ступенькам с надписями う и え: наверху получается うえ.",
      "Look up two steps marked う and え; at the top they form うえ.",
    ],
    [
      "Верхняя часть или положение над чем-то, не глагол подъёма.",
      "A top or a position above something, not a verb meaning to rise.",
    ],
    [
      "Два гласных знака う・え; не читайте じょう.",
      "Two vowel kana, う・え; do not read it as じょう.",
    ],
    [
      "かばんはつくえの上にあります。",
      "かばんはつくえのうえにあります。",
      "Сумка лежит на столе.",
      "The bag is on the desk.",
    ],
  ),
  word(
    "下",
    "した",
    "1184140",
    ["низ", "снизу", "внизу"],
    ["bottom", "below"],
    [
      "Отметка под длинной линией 下 напоминает место снизу.",
      "The mark beneath the long line 下 suggests a position below.",
    ],
    [
      "Спуститесь по двум ступенькам し и た к нижней полке: した.",
      "Step down across し and た to a lower shelf: した.",
    ],
    ["Нижняя часть или положение под чем-то.", "A bottom or a position beneath something."],
    ["Два слога し・た; не か и не げ.", "Two syllables, し・た; neither か nor げ."],
    [
      "いすの下にかばんがあります。",
      "いすのしたにかばんがあります。",
      "Под стулом стоит сумка.",
      "There is a bag under the chair.",
    ],
  ),
  word(
    "右",
    "みぎ",
    "1171010",
    ["право", "правый", "справа", "направо"],
    ["right"],
    [
      "У правой стороны 右 внизу рамка 口; сравните её с балкой 工 у 左.",
      "Right 右 has the frame 口 below; contrast it with the beam 工 in 左.",
    ],
    [
      "Поставьте справа две карточки み и ぎ. Две точки у ぎ остаются на правой карточке.",
      "Place two cards, み and ぎ, on your right; keep the voicing marks on the second card.",
    ],
    ["Правая сторона, не правильность ответа.", "The right-hand side, not correctness."],
    ["みぎ со звонким ぎ, не みき и не う.", "みぎ has voiced ぎ, not みき or う."],
    [
      "つぎのかどを右にまがります。",
      "つぎのかどをみぎにまがります。",
      "На следующем углу мы повернём направо.",
      "We turn right at the next corner.",
    ],
  ),
  word(
    "左",
    "ひだり",
    "1290800",
    ["лево", "левый", "слева", "налево"],
    ["left"],
    [
      "Балка 工 внизу 左 помогает отличить левую сторону от правой 右.",
      "The beam 工 below 左 helps distinguish the left side from the right 右.",
    ],
    [
      "Слева разложите три карточки ひ・だ・り; средняя звучит звонко: ひだり.",
      "Lay out three cards on the left, ひ・だ・り; voice the middle syllable: ひだり.",
    ],
    ["Левая сторона или предмет слева.", "The left-hand side or something on the left."],
    ["Три слога ひ・だ・り; не さ.", "Three syllables, ひ・だ・り; not さ."],
    [
      "左のドアをあけてください。",
      "ひだりのどあをあけてください。",
      "Откройте дверь слева, пожалуйста.",
      "Please open the door on the left.",
    ],
  ),
  word(
    "円",
    "えん",
    "1175570",
    ["иена"],
    ["yen"],
    [
      "Представьте круглую монету и цену рядом с 円. В этом уроке принимается денежное значение.",
      "Picture a round coin and a price followed by 円. This lesson accepts the currency sense.",
    ],
    [
      "На ценнике мысленно оставьте два знака え・ん; конечная ん закрывает слово えん.",
      "Leave two kana on an imaginary price tag, え・ん; final ん closes the word えん.",
    ],
    [
      "Денежная единица Японии, не геометрический круг в этом уроке.",
      "Japan's currency unit, not a geometric circle in this lesson.",
    ],
    [
      "えん с конечной ん; не добавляйте число цены.",
      "えん ends in ん; do not add the price number.",
    ],
    [
      "このパンは百円です。",
      "このぱんはひゃくえんです。",
      "Этот хлеб стоит сто иен.",
      "This bread costs one hundred yen.",
    ],
  ),
  word(
    "力",
    "ちから",
    "1554820",
    ["сила"],
    ["strength", "force", "power"],
    [
      "Вспомните усилие при нажатии на рычаг 力: слово называет саму силу.",
      "Recall the effort of pushing a lever 力: the word names strength itself.",
    ],
    [
      "Перед подъёмом груза отсчитайте три шага ち・か・ら и соедините их в ちから.",
      "Before lifting a load, count three steps, ち・か・ら, and join them as ちから.",
    ],
    ["Сила или усилие, не электричество.", "Strength or force, not electricity."],
    ["Три слога ち・か・ら; не りょく.", "Three syllables, ち・か・ら; not りょく."],
    [
      "ふたりで力をあわせましょう。",
      "ふたりでちからをあわせましょう。",
      "Давайте объединим усилия вдвоём.",
      "Let's join forces, the two of us.",
    ],
  ),
  word(
    "人",
    "ひと",
    "1580640",
    ["человек"],
    ["person", "human"],
    [
      "Две опоры 人 напоминают идущего человека: здесь учится обычное слово о человеке.",
      "The two supports 人 suggest a walking person: this is the everyday word for a person.",
    ],
    [
      "Пусть человек сделает два шага: на первом ひ, на втором と. Получится ひと.",
      "Let a person take two steps, ひ on the first and と on the second: ひと.",
    ],
    [
      "Отдельный человек, без указания профессии или страны.",
      "A person, without specifying a job or country.",
    ],
    ["ひと, а не чтения кандзи じん или にん.", "ひと, not the kanji readings じん or にん."],
    [
      "あそこに人がいます。",
      "あそこにひとがいます。",
      "Там кто-то есть.",
      "There is someone over there.",
    ],
  ),
  word(
    "月",
    "つき",
    "1255430",
    ["луна"],
    ["moon"],
    [
      "Представьте светлую луну 月 в небе. В этом уроке речь не о календарном месяце.",
      "Picture the bright moon 月 in the sky. This lesson is not about a calendar month.",
    ],
    [
      "На двух краях воображаемой луны разместите つ и き: つき.",
      "Put つ and き on two edges of an imaginary moon: つき.",
    ],
    ["Небесное тело, луна.", "The moon as a celestial body."],
    ["Сначала つ, затем き; не げつ.", "First つ, then き; not げつ."],
    [
      "月がよく見えます。",
      "つきがよくみえます。",
      "Луну хорошо видно.",
      "The moon is clearly visible.",
    ],
  ),
];

const FOUNDATION_WORD_BATCH: MainCourseWordBatch = {
  id: "task-127-foundation-words-01",
  version: "1",
  authoredAt: "2026-10-22",
  reviewedAt: "2026-10-22",
  reviewNotes:
    "AI-authored independent RU/EN course copy and original JP/kana/RU/EN examples. Independently reviewed and corrected by the parent agent on 2026-10-22; all twenty exact JMdict pairs and RU/EN availability were checked live. Licensed imported evidence remains separate from original educational copy. Database preflight remains mandatory. This is not a human-review claim or full Task127 completion.",
  sourceFile: "packages/db/src/main-course-word-content.ts",
  courseSlug: "japanese-ru-n2",
  levelNumber: 5,
  words: FOUNDATION_WORDS.map((content, index) => ({ ...content, sortOrder: index + 1 })),
};

export function buildMainCourseWordBatch(): MainCourseWordBatch {
  return FOUNDATION_WORD_BATCH;
}

const FOUNDATION_WORD_BATCH_03: MainCourseWordBatch = {
  id: "task-127-foundation-words-03",
  version: "1",
  authoredAt: "2026-10-22",
  reviewedAt: "2026-10-22",
  reviewNotes:
    "AI-authored independent RU/EN teaching copy and original JP/kana/RU/EN examples. Independently reviewed and corrected by the parent agent on 2026-10-22; all twenty exact spelling/reading pairs have live successful bilingual licensed JMdict evidence. The legacy starter identity for 口 requires the separately tested source-bound migration before application; no provenance exception is allowed. Prerequisite kanji04 was applied with zero quality blockers. Preserves earlier batch/pilot versions and existing target/card identities. Full database preflight remains mandatory. Not a human-review claim or full Task127 completion.",
  sourceFile: "packages/db/src/main-course-word-content.ts",
  courseSlug: "japanese-ru-n2",
  levelNumber: 5,
  sortOrderStart: 41,
  words: [
    word(
      "口",
      "くち",
      "1275640",
      ["рот"],
      ["mouth"],
      [
        "Представьте рамку 口 как рот, который открывается перед словом.",
        "Picture the frame 口 as a mouth opening before a word.",
      ],
      [
        "У одного края рта поставьте く, у другого ち: рот произносит くち.",
        "Put く at one corner of a mouth and ち at the other: the mouth says くち.",
      ],
      [
        "Часть лица; здесь не вход и не счётный суффикс.",
        "The body part, not an entrance or a counter here.",
      ],
      ["く・ち, не онное こう.", "く・ち, not the on reading こう."],
      [
        "口をあけてください。",
        "くちをあけてください。",
        "Откройте рот, пожалуйста.",
        "Please open your mouth.",
      ],
    ),
    word(
      "目",
      "め",
      "1604890",
      ["глаз"],
      ["eye"],
      [
        "Внутренние линии 目 напоминают глаз, который смотрит на страницу.",
        "The inner lines of 目 suggest an eye looking at a page.",
      ],
      [
        "Нарисуйте один глаз и подпишите одним знаком め: короткое имя глаза.",
        "Draw one eye and label it with the single kana め: a short name for an eye.",
      ],
      [
        "Глаз как орган зрения; не порядковый суффикс.",
        "An eye as the organ of sight, not an ordinal suffix.",
      ],
      ["Один короткий め; не もく.", "One short め, not もく."],
      [
        "目をとじてやすみます。",
        "めをとじてやすみます。",
        "Я закрываю глаза и отдыхаю.",
        "I close my eyes and rest.",
      ],
    ),
    word(
      "耳",
      "みみ",
      "1317170",
      ["ухо"],
      ["ear"],
      [
        "Представьте контур 耳 у головы: ухо улавливает тихий звук.",
        "Picture the outline 耳 beside a head: an ear catches a quiet sound.",
      ],
      [
        "Два уха получают одинаковую подпись み: вместе пара напоминает みみ.",
        "Give each of two ears the label み: the pair reminds you of みみ.",
      ],
      ["Орган слуха; не само умение слушать.", "The organ of hearing, not the skill of listening."],
      [
        "Повторите み два раза: みみ, без долгого гласного.",
        "Repeat み twice: みみ, with no long vowel.",
      ],
      [
        "耳をすませると、雨のおとがきこえます。",
        "みみをすませると、あめのおとがきこえます。",
        "Если прислушаться, слышен шум дождя.",
        "If you listen carefully, you can hear the rain.",
      ],
    ),
    word(
      "手",
      "て",
      "1327190",
      ["рука", "кисть руки"],
      ["hand"],
      [
        "Поперечные штрихи 手 становятся пальцами руки, которой держат книгу.",
        "The cross strokes of 手 become fingers of a hand holding a book.",
      ],
      [
        "На ладони поместите единственный знак て: короткая подпись руки.",
        "Place the single kana て on a palm: a short label for a hand.",
      ],
      [
        "Кисть руки; здесь не способ действия и не исполнитель.",
        "A hand, not a method or a person performing an action here.",
      ],
      ["Только て; не しゅ и не длинное てえ.", "Only て, not しゅ or a long てえ."],
      [
        "手をあらってから、ごはんをたべます。",
        "てをあらってから、ごはんをたべます。",
        "Перед едой я мою руки.",
        "I wash my hands before eating.",
      ],
    ),
    word(
      "足",
      "あし",
      "1404630",
      ["нога", "стопа"],
      ["foot", "leg"],
      [
        "Нижняя часть 足 делает шаг: слово называет ногу или стопу.",
        "The lower part of 足 takes a step: the word names a leg or foot.",
      ],
      [
        "Перед шагом отметьте пятку знаком あ, а носок знаком し: あし.",
        "Before a step, label the heel あ and the toes し: あし.",
      ],
      [
        "Часть тела, позволяющая стоять и ходить; не достаточность.",
        "The body part used for standing and walking, not sufficiency.",
      ],
      ["あ・し, а не онное そく.", "あ・し, not the on reading そく."],
      [
        "足がつかれたので、すこしやすみます。",
        "あしがつかれたので、すこしやすみます。",
        "Ноги устали, поэтому я немного отдохну.",
        "My legs are tired, so I will rest a little.",
      ],
    ),
    word(
      "雨",
      "あめ",
      "1171900",
      ["дождь"],
      ["rain"],
      [
        "Капли внутри 雨 падают на землю: речь о дожде, не просто о воде.",
        "The drops inside 雨 fall to the ground: this is rain, not just water.",
      ],
      [
        "Первую каплю подпишите あ, следующую め: дождь напоминает あめ.",
        "Label the first drop あ and the next め: the rain reminds you of あめ.",
      ],
      [
        "Осадки в виде капель воды; не конфета с тем же звучанием.",
        "Water falling as drops, not the candy word with the same kana.",
      ],
      ["あ・め; здесь не онное う.", "あ・め, not the on reading う here."],
      [
        "雨がやむまで、ここでまちましょう。",
        "あめがやむまで、ここでまちましょう。",
        "Давайте подождём здесь, пока дождь не прекратится.",
        "Let's wait here until the rain stops.",
      ],
    ),
    word(
      "空",
      "そら",
      "1245290",
      ["небо"],
      ["sky"],
      [
        "Посмотрите вверх над 山: открытое пространство 空 здесь называется небом.",
        "Look above 山: the open space 空 here is called the sky.",
      ],
      [
        "На одном краю неба мысленно напишите そ, на другом ら: そら.",
        "Write そ at one edge of an imagined sky and ら at the other: そら.",
      ],
      [
        "Небо над нами; не пустой предмет и не воздух.",
        "The sky above us, not an empty object or air.",
      ],
      ["そ・ら; не くう и не から.", "そ・ら, not くう or から."],
      [
        "空に月が出ています。",
        "そらにつきがでています。",
        "На небе видна луна.",
        "The moon is out in the sky.",
      ],
    ),
    word(
      "天気",
      "てんき",
      "1438690",
      ["погода"],
      ["weather"],
      [
        "Небо 天 и его состояние 気 вместе задают погоду за окном.",
        "Sky 天 and its condition 気 together suggest the weather outside.",
      ],
      [
        "Небо даёт てん, состояние добавляет き: てんき.",
        "Sky supplies てん and the condition adds き: てんき.",
      ],
      ["Состояние погоды; здесь не прогноз погоды.", "The weather itself, not a weather forecast."],
      ["てん・き: после ん идёт короткое き.", "てん・き: a short き follows ん."],
      [
        "天気がいいので、山へ行きます。",
        "てんきがいいので、やまへいきます。",
        "Погода хорошая, поэтому я пойду в горы.",
        "The weather is good, so I am going to the mountains.",
      ],
    ),
    word(
      "空気",
      "くうき",
      "1245470",
      ["воздух"],
      ["air"],
      [
        "Между небом 空 и нами движется невидимое 気: представьте окружающий воздух.",
        "Invisible 気 moves between the sky 空 and us: picture the surrounding air.",
      ],
      [
        "Для 空 протяните くう, затем коротко добавьте き: くうき.",
        "Hold くう for 空, then add a short き: くうき.",
      ],
      [
        "Воздух, которым дышат; переносная атмосфера компании здесь не цель.",
        "The air we breathe; a group's figurative atmosphere is not the taught sense here.",
      ],
      [
        "Сохраните две моры く・う перед き; не くき.",
        "Keep two morae く・う before き, not くき.",
      ],
      [
        "山の空気はすずしいです。",
        "やまのくうきはすずしいです。",
        "Горный воздух прохладный.",
        "The mountain air is cool.",
      ],
    ),
    word(
      "先生",
      "せんせい",
      "1387990",
      ["учитель", "преподаватель"],
      ["teacher", "instructor"],
      [
        "Тот, кто прошёл путь раньше 先, помогает другим учиться: представьте своего учителя.",
        "Someone who traveled the path earlier 先 helps others learn: picture your teacher.",
      ],
      [
        "У доски разместите せん, на столе учителя せい: вместе せんせい.",
        "Put せん on the board and せい on the teacher's desk: together, せんせい.",
      ],
      [
        "Человек, который учит; обращение к врачу этим словом здесь не изучается.",
        "A person who teaches; its use as a title for a doctor is not taught here.",
      ],
      ["せん・せい; пишите конечное い, не せんせ.", "せん・せい; write the final い, not せんせ."],
      [
        "先生にこの本をかりました。",
        "せんせいにこのほんをかりました。",
        "Я взял эту книгу у учителя почитать.",
        "I borrowed this book from my teacher.",
      ],
    ),
    word(
      "学生",
      "がくせい",
      "1206900",
      ["студент", "учащийся"],
      ["student"],
      [
        "Учёба 学 становится занятием человека 生: представьте учащегося с книгой.",
        "Study 学 becomes a person's 生 occupation: picture a student with a book.",
      ],
      [
        "На книге напишите がく, на месте учащегося せい: がくせい.",
        "Write がく on a book and せい at the student's seat: がくせい.",
      ],
      [
        "Учащийся, обычно студент; не сам учитель.",
        "A student, commonly at college or university, not the teacher.",
      ],
      ["がく・せい: здесь нет маленькой っ.", "がく・せい: there is no small っ here."],
      [
        "学生たちはここで本をよんでいます。",
        "がくせいたちはここでほんをよんでいます。",
        "Студенты здесь читают книги.",
        "The students are reading books here.",
      ],
    ),
    word(
      "大学",
      "だいがく",
      "1413240",
      ["университет", "вуз"],
      ["university"],
      [
        "Большая 大 учёба 学 напоминает университет, где изучают целые области знаний.",
        "Big 大 study 学 suggests a university where entire fields are studied.",
      ],
      [
        "Соедините большое だい и учебное がく без паузы: だいがく.",
        "Join big だい and study がく without a pause: だいがく.",
      ],
      [
        "Высшее учебное заведение; не любая школа.",
        "An institution of higher education, not just any school.",
      ],
      ["だい・がく, без удвоенной согласной.", "だい・がく, with no doubled consonant."],
      [
        "大学は川のそばにあります。",
        "だいがくはかわのそばにあります。",
        "Университет находится рядом с рекой.",
        "The university is beside the river.",
      ],
    ),
    word(
      "大学生",
      "だいがくせい",
      "1413260",
      ["студент университета", "студент вуза"],
      ["university student", "college student"],
      [
        "К университету 大学 добавьте учащегося 生: получается студент вуза.",
        "Add a student 生 to university 大学: a university student.",
      ],
      [
        "Сначала произнесите университет だいがく, затем добавьте учащегося せい: だいがくせい.",
        "Say university だいがく first, then add the student ending せい: だいがくせい.",
      ],
      [
        "Именно учащийся вуза, не университет как здание.",
        "Specifically a university student, not the university building.",
      ],
      ["だい・がく・せい; сохраните все три части.", "だい・がく・せい; keep all three parts."],
      [
        "あの人は大学生で、ここではたらいています。",
        "あのひとはだいがくせいで、ここではたらいています。",
        "Тот человек — студент университета и работает здесь.",
        "That person is a university student and works here.",
      ],
    ),
    word(
      "小学生",
      "しょうがくせい",
      "1347880",
      ["ученик начальной школы", "ученица начальной школы"],
      ["elementary school student", "primary school pupil"],
      [
        "Маленький 小 учащийся 学生 помогает вспомнить ученика начальной школы.",
        "A small 小 student 学生 helps you remember an elementary school pupil.",
      ],
      [
        "Добавьте маленькое しょう к учащемуся がくせい: しょうがくせい.",
        "Add small しょう to student がくせい: しょうがくせい.",
      ],
      [
        "Учащийся начальной школы, не любой ребёнок.",
        "An elementary school pupil, not just any child.",
      ],
      [
        "しょう・がく・せい: маленькая ょ и следующий う обязательны.",
        "しょう・がく・せい: keep the small ょ and the following う.",
      ],
      [
        "小学生たちが手をあげました。",
        "しょうがくせいたちがてをあげました。",
        "Ученики начальной школы подняли руки.",
        "The elementary school pupils raised their hands.",
      ],
    ),
    word(
      "一年生",
      "いちねんせい",
      "1165580",
      ["первоклассник", "ученик первого класса", "первокурсник"],
      ["first-year student", "first grader"],
      [
        "Один 一 год 年 учёбы у учащегося 生: первый класс или первый курс.",
        "One 一 year 年 of study for a student 生: the first school grade or college year.",
      ],
      [
        "Соедините один いち, год ねん и учащегося せい: いちねんせい.",
        "Join one いち, year ねん and student せい: いちねんせい.",
      ],
      [
        "Учащийся первого года; слово не ограничено только начальной школой.",
        "A student in their first year; the word is not limited to elementary school.",
      ],
      [
        "いち・ねん・せい; не заменяйте начало на ひと.",
        "いち・ねん・せい; do not replace the beginning with ひと.",
      ],
      [
        "一年生に本をよんであげました。",
        "いちねんせいにほんをよんであげました。",
        "Я почитал книгу первокласснику.",
        "I read a book to a first grader.",
      ],
    ),
    word(
      "文学",
      "ぶんがく",
      "1505190",
      ["литература"],
      ["literature"],
      [
        "Тексты 文 становятся областью изучения 学: представьте литературу на книжной полке.",
        "Texts 文 become a field of study 学: picture literature on a bookshelf.",
      ],
      [
        "Текст даёт ぶん, учёба даёт がく: вместе ぶんがく.",
        "Text gives ぶん and study gives がく: together, ぶんがく.",
      ],
      [
        "Литература как искусство или предмет изучения; не отдельное предложение.",
        "Literature as an art or field of study, not a single sentence.",
      ],
      ["ぶん・がく, с ん перед が.", "ぶん・がく, with ん before が."],
      [
        "大学で日本の文学をまなびたいです。",
        "だいがくでにほんのぶんがくをまなびたいです。",
        "Я хочу изучать японскую литературу в университете.",
        "I want to study Japanese literature at university.",
      ],
    ),
    word(
      "四月",
      "しがつ",
      "1307180",
      ["апрель"],
      ["April"],
      [
        "Четыре 四 и месяц 月 ставят апрель на четвёртое место календаря.",
        "Four 四 and month 月 put April fourth in the calendar.",
      ],
      [
        "Для четвёртого месяца выберите し и присоедините がつ: しがつ.",
        "For the fourth month choose し and attach がつ: しがつ.",
      ],
      [
        "Название месяца апреля, не длительность четыре месяца.",
        "The month April, not a duration of four months.",
      ],
      ["し・がつ, не よんがつ.", "し・がつ, not よんがつ."],
      [
        "四月に大学へ行きます。",
        "しがつにだいがくへいきます。",
        "В апреле я пойду в университет.",
        "I will go to university in April.",
      ],
    ),
    word(
      "五月",
      "ごがつ",
      "1268170",
      ["май"],
      ["May"],
      [
        "Пять 五 у календарного месяца 月 отмечает май, пятый месяц года.",
        "Five 五 beside calendar month 月 marks May, the fifth month of the year.",
      ],
      ["Счётное ご соединяется с месяцем がつ: ごがつ.", "Counting ご joins month がつ: ごがつ."],
      [
        "Май как месяц календаря; не пять месяцев подряд.",
        "May as a calendar month, not five months in duration.",
      ],
      [
        "ご・がつ: обе начальные согласные звонкие.",
        "ご・がつ: both initial consonants are voiced.",
      ],
      [
        "五月にこの山をあるきました。",
        "ごがつにこのやまをあるきました。",
        "В мае я гулял по этой горе.",
        "I walked on this mountain in May.",
      ],
    ),
    word(
      "出口",
      "でぐち",
      "1338850",
      ["выход"],
      ["exit"],
      [
        "Выходить 出 через проём 口: представьте выход из здания.",
        "Go out 出 through an opening 口: picture a building's exit.",
      ],
      [
        "Выход даёт で, а рот くち меняет начальную согласную на ぐ: でぐち.",
        "Going out gives で and mouth くち voices its first consonant to ぐ: でぐち.",
      ],
      [
        "Место выхода, не сам глагол выходить.",
        "A place to leave through, not the verb to go out.",
      ],
      ["で・ぐ・ち; середина ぐ, не く.", "で・ぐ・ち; the middle kana is ぐ, not く."],
      [
        "出口は右にあります。",
        "でぐちはみぎにあります。",
        "Выход находится справа.",
        "The exit is on the right.",
      ],
    ),
    word(
      "人口",
      "じんこう",
      "1367300",
      ["население", "численность населения"],
      ["population"],
      [
        "Человек 人 и рот 口 напоминают счёт жителей, а не размер страны.",
        "Person 人 and mouth 口 suggest counting inhabitants, not measuring a country's area.",
      ],
      [
        "Человека прочтите じん, рот в сложении — こう: じんこう.",
        "Read person as じん and mouth in this compound as こう: じんこう.",
      ],
      [
        "Население места или его численность; не площадь территории.",
        "The inhabitants of a place or their number, not its land area.",
      ],
      ["じん・こう, с конечным う; не じんこ.", "じん・こう, with final う, not じんこ."],
      [
        "この国の人口をしらべています。",
        "このくにのじんこうをしらべています。",
        "Я изучаю численность населения этой страны.",
        "I am looking up this country's population.",
      ],
    ),
  ].map((content, index) => ({ ...content, sortOrder: 41 + index })),
};

export function buildMainCourseWordBatches(): readonly MainCourseWordBatch[] {
  return [
    buildMainCourseWordBatch(),
    buildMainCourseWordBatch02(),
    FOUNDATION_WORD_BATCH_03,
    buildMainCourseWordBatch04(),
    buildMainCourseWordBatch05(),
    buildMainCourseWordBatch06(),
    buildMainCourseWordBatch07(),
    buildMainCourseWordBatch08(),
  ];
}

export function mainCourseWordBatchChecksum(batch: MainCourseWordBatch): string {
  return createHash("sha256").update(JSON.stringify(batch), "utf8").digest("hex");
}

export function wordHanCharacters(text: string): readonly string[] {
  return [...new Set([...text].filter((character) => /\p{Script=Han}/u.test(character)))];
}

export function mainCourseWordAcceptedReadings(content: MainCourseWordContent): readonly string[] {
  return [content.reading, ...(content.acceptedReadings ?? [])];
}

export function validateMainCourseWordBatch(batch: MainCourseWordBatch): readonly string[] {
  const issues: string[] = [];
  for (const text of [
    batch.id,
    batch.version,
    batch.authoredAt,
    batch.reviewNotes,
    batch.sourceFile,
    batch.courseSlug,
  ]) {
    if (text.trim() === "") issues.push("Word batch has empty metadata.");
  }
  if (batch.reviewedAt !== null && !/^\d{4}-\d{2}-\d{2}$/u.test(batch.reviewedAt))
    issues.push("Word batch needs an ISO review date or null.");
  if (batch.words.length !== 20) issues.push("Each word batch requires twenty words.");
  if (!buildMainCourseBlueprint().levels.some((level) => level.levelNumber === batch.levelNumber))
    issues.push("Word batch requires a registered course level.");
  const sortOrderStart = batch.sortOrderStart ?? 1;
  if (
    !Number.isSafeInteger(sortOrderStart) ||
    sortOrderStart < 1 ||
    !Number.isSafeInteger(sortOrderStart + 19)
  )
    issues.push("Word batch requires a positive safe placement offset.");
  const identities = new Set<string>();
  const placements = new Set<number>();
  for (const content of batch.words) {
    if (
      content.partOfSpeech !== undefined &&
      !["verb", "i-adjective", "noun"].includes(content.partOfSpeech)
    )
      issues.push(`Invalid authored part of speech for ${content.expression}.`);
    const identity = `${content.expression}:${content.reading}`;
    if (identities.has(identity)) issues.push(`Duplicate word ${identity}.`);
    identities.add(identity);
    if (
      !Number.isInteger(content.sortOrder) ||
      content.sortOrder < sortOrderStart ||
      content.sortOrder > sortOrderStart + 19 ||
      placements.has(content.sortOrder)
    )
      issues.push(`Invalid or duplicate word placement ${content.sortOrder}.`);
    placements.add(content.sortOrder);
    if (
      !/^jmdict:[1-9]\d*$/u.test(content.jmdictEntryId) ||
      wordHanCharacters(content.expression).length === 0 ||
      !/^[ぁ-ゖー]+$/u.test(content.reading)
    )
      issues.push(`Invalid exact word identity ${identity}.`);
    const acceptedReadings = mainCourseWordAcceptedReadings(content);
    if (
      acceptedReadings.some((reading) => !/^[ぁ-ゖー]+$/u.test(reading)) ||
      new Set(acceptedReadings.map(normalizeJapaneseReading)).size !== acceptedReadings.length
    )
      issues.push(`Invalid or duplicate accepted readings for ${identity}.`);
    issues.push(...validateCuratedMeaningBlocks(content.meanings));
    for (const [locale, meanings] of [
      ["ru-RU", content.meanings.ru],
      ["en-US", content.meanings.en],
    ] as const) {
      const normalized = meanings.accepted.map((meaning) => normalizeMeaning(meaning, locale));
      if (
        !meanings.primary.trim() ||
        meanings.accepted[0] !== meanings.primary ||
        normalized.some((meaning) => meaning === "") ||
        new Set(normalized).size !== normalized.length
      )
        issues.push(`Invalid ${locale} accepted meanings for ${identity}.`);
    }
    for (const texts of [
      content.meaningMnemonic,
      content.readingMnemonic,
      content.meaningHint,
      content.readingHint,
    ]) {
      if (!texts.ru.trim() || !texts.en.trim())
        issues.push(`Incomplete bilingual teaching text for ${identity}.`);
    }
    if (
      Object.values(content.example).some((text) => !text.trim()) ||
      !content.example.japaneseText.includes(content.expression) ||
      !content.example.readingText.includes(content.reading) ||
      !/^[ぁ-ゖー、。！？\s]+$/u.test(content.example.readingText)
    )
      issues.push(`Incomplete original example for ${identity}.`);
  }
  return issues;
}

export function validateMainCourseWordBatches(
  batches: readonly MainCourseWordBatch[] = buildMainCourseWordBatches(),
): readonly string[] {
  const issues = batches.flatMap((batch) => validateMainCourseWordBatch(batch));
  if (batches.length === 0) issues.push("Word batch registry must not be empty.");
  const ids = new Set<string>();
  const words = new Set<string>();
  const slots = new Set<string>();
  for (const batch of batches) {
    if (ids.has(batch.id)) issues.push(`Duplicate word batch ID ${batch.id}.`);
    ids.add(batch.id);
    for (const content of batch.words) {
      const identity = `${content.expression}:${content.reading}`;
      if (words.has(identity)) issues.push(`Duplicate registered word ${identity}.`);
      words.add(identity);
      const slot = `${batch.courseSlug}:${batch.levelNumber}:${content.sortOrder}`;
      if (slots.has(slot)) issues.push(`Duplicate registered word slot ${slot}.`);
      slots.add(slot);
    }
  }
  return issues;
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
