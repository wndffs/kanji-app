import { createHash } from "node:crypto";

import { normalizeJapaneseReading, normalizeMeaning } from "@kanji-srs/japanese";
import { buildMainCourseWordBatch02 } from "./main-course-word-content-02";

import {
  type MainCourseAcceptedMeanings,
  type MainCourseLocalizedText,
} from "./main-course-content";

export type MainCourseWordContent = {
  readonly expression: string;
  readonly reading: string;
  readonly acceptedReadings?: readonly string[];
  readonly jmdictEntryId: string;
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

export function buildMainCourseWordBatches(): readonly MainCourseWordBatch[] {
  return [buildMainCourseWordBatch(), buildMainCourseWordBatch02()];
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
  if (batch.words.length !== 20 || batch.levelNumber !== 5)
    issues.push("Each Foundation word batch requires twenty words at level 5.");
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
      !/^jmdict:\d+$/u.test(content.jmdictEntryId) ||
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
