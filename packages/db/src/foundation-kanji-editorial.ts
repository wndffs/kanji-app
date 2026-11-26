import type { CourseEditorialEntry } from "./starter-lesson-editorial";

type FoundationKanjiEditorial = Omit<CourseEditorialEntry, "itemKey"> & {
  readonly character: string;
  readonly reading: string;
};

const ENTRIES: readonly FoundationKanjiEditorial[] = [
  {
    character: "日",
    reading: "にち",
    hints: {
      MEANING: {
        ru: "日 может обозначать день или солнце. В 毎日（まいにち） речь о том, что происходит каждый день, а 日光（にっこう） — это солнечный свет. В дате 十日（とおか） означает «десятое число», а при указании длительности — «десять дней».",
        en: "日 can mean a day or the sun. 毎日（まいにち） means every day, while 日光（にっこう） is sunlight. In a date, 十日（とおか） is the tenth of the month. In another context, the same word can mean ten days.",
      },
      READING: {
        ru: "Закрепите にち на слове 毎日（まいにち）. Не переносите это чтение на каждое слово с 日: отдельно «солнце» может читаться ひ, а календарная форма 十日 запоминается целиком как とおか.",
        en: "Use 毎日（まいにち） to remember にち. It is not the reading in every word containing 日: the standalone word for the sun can be ひ, and the calendar word 十日 is learned as とおか.",
      },
    },
    referenceMeanings: [{ ru: "число месяца (в дате)", en: "day of the month (in a date)" }],
  },
  {
    character: "人",
    reading: "じん",
    hints: {
      MEANING: {
        ru: "人 обозначает человека. При названии национальности этот знак можно добавить к названию страны: 日本人（にほんじん） — японец или японка. После числа 人 может показывать, что считают людей: 三人（さんにん） — три человека.",
        en: "人 refers to a person. After a country name it can identify someone by nationality: 日本人（にほんじん） is a Japanese person. After a number, 人 can show that you are counting people: 三人（さんにん） means three people.",
      },
      READING: {
        ru: "Учебное чтение じん слышно в конце 日本人（にほんじん）. Как отдельное слово 人 читается ひと, а в 三人（さんにん） используется にん. Обычные чтения 一人 и 二人 — ひとり и ふたり.",
        en: "You can hear the taught reading じん at the end of 日本人（にほんじん）. On its own, 人 is read ひと; when counting in 三人（さんにん）, use にん. The usual readings of 一人 and 二人 are ひとり and ふたり.",
      },
    },
    referenceMeanings: [
      { ru: "счётный суффикс для людей (にん)", en: "counter for people (にん)" },
    ],
  },
  {
    character: "大",
    reading: "だい",
    hints: {
      MEANING: {
        ru: "大 передаёт большой размер или масштаб. 大きい（おおきい） можно сказать о крупном предмете, а 大雨（おおあめ） — сильный дождь. Не собирайте перевод механически: 大学（だいがく） — это университет, а не просто «большая школа».",
        en: "大 can indicate large size or scale. 大きい（おおきい） describes something big, while 大雨（おおあめ） is heavy rain. Do not translate a compound piece by piece: 大学（だいがく） means a university, not just a big school.",
      },
      READING: {
        ru: "Для этой карточки запомните だい из 大学（だいがく）. В 大きい чтение начинается с おお, а 大人（おとな, взрослый） читается как целое слово. Здесь важна связь с конкретным примером, а не попытка угадать все слова.",
        en: "This card teaches だい, as in 大学（だいがく）. 大きい starts with おお, and 大人, an adult, is read おとな as a whole. Use the example word to anchor the reading instead of assuming it works in every compound.",
      },
    },
  },
  {
    character: "十",
    reading: "じゅう",
    hints: {
      MEANING: {
        ru: "十 — десять. Обратите внимание на порядок знаков: 十三 — десять и ещё три, то есть тринадцать; 三十 — три десятка, то есть тридцать. Перестановка меняет число, хотя знаки те же.",
        en: "十 is ten. Order matters: 十三 is ten plus three, or thirteen; 三十 is three tens, or thirty. The characters stay the same, but switching them changes the number.",
      },
      READING: {
        ru: "Для числа 十 произнесите じゅう: маленькое ゅ соединяется с じ, а う удлиняет звук. Послушайте этот блок в 十三（じゅうさん） и 三十（さんじゅう）. Слово 十日（とおか） не читается по тому же правилу.",
        en: "Read the number 十 as じゅう: the small ゅ combines with じ, and う lengthens the sound. Listen for that unit in 十三（じゅうさん） and 三十（さんじゅう）. 十日（とおか） does not follow that reading pattern.",
      },
    },
  },
  {
    character: "二",
    reading: "に",
    hints: {
      MEANING: {
        ru: "Две горизонтальные черты помогают отличить 二 от 一 и 三. В 二十 двойка стоит перед десятком: это двадцать. В 十二 она стоит после десятка: это двенадцать. Замечайте не только число черт, но и место знака.",
        en: "Two horizontal strokes distinguish 二 from 一 and 三. In 二十, two comes before ten and gives twenty. In 十二, two comes after ten and gives twelve. Notice the position as well as the stroke count.",
      },
      READING: {
        ru: "Число 二 читается に, как в 二十（にじゅう）. Для двух предметов употребляют 二つ（ふたつ）. Для двух человек обычная форма — 二人（ふたり）. Запомните ふたつ и ふたり целиком.",
        en: "Read the number 二 as に, as in 二十（にじゅう）. Use 二つ（ふたつ） for two items. For two people, the usual form is 二人（ふたり）. Learn ふたつ and ふたり as complete words.",
      },
    },
  },
  {
    character: "三",
    reading: "さん",
    hints: {
      MEANING: {
        ru: "У 三 три горизонтальные черты, и знак обозначает число три. 三人 — три человека, а 三日 в календаре — третье число. Сам знак сообщает число; соседний знак подсказывает, что именно считают или обозначают.",
        en: "三 has three horizontal strokes and represents the number three. 三人 is three people, while 三日 in a date is the third day of the month. 三 gives the number; its neighbor tells you what is being counted or identified.",
      },
      READING: {
        ru: "Учите さん на слове 三人（さんにん）. У 三つ（みっつ, три предмета） и 三日（みっか, третье число месяца или три дня） есть маленькое っ. Не заменяйте их на さん, если вопрос просит прочитать целое слово.",
        en: "Use 三人（さんにん） to remember さん. 三つ（みっつ, three items） and 三日（みっか, the third day of the month or three days） contain a small っ. Do not swap in さん when you are asked to read the complete word.",
      },
    },
  },
  {
    character: "月",
    reading: "げつ",
    hints: {
      MEANING: {
        ru: "月 связывает два разных контекста: луну в небе и месяц в календаре. 月が出る（つきがでる） означает «луна появляется». В 一月（いちがつ） 月 обозначает календарный месяц: первый месяц года, январь.",
        en: "月 appears in two contexts: the moon in the sky and a month on the calendar. 月が出る（つきがでる） describes the moon coming out. In 一月（いちがつ）, it marks the first calendar month, January.",
      },
      READING: {
        ru: "Привяжите учебное げつ к 月曜日（げつようび, понедельник）. В названии месяца 一月（いちがつ） читается がつ; отдельно «луна» — つき. Чтения принадлежат этим словам и не заменяют друг друга.",
        en: "Anchor the taught reading げつ in 月曜日（げつようび, Monday）. In the month name 一月（いちがつ）, use がつ; the standalone word for the moon is つき. Learn which reading belongs to each word.",
      },
    },
  },
  {
    character: "本",
    reading: "ほん",
    hints: {
      MEANING: {
        ru: "У 本 есть два учебных значения: «книга» и «основа». Как отдельное слово 本（ほん） обычно означает «книга». В 本店（ほんてん） в значении «главный магазин» знак 本 указывает на главное отделение. После числа 本 считает длинные узкие предметы: 鉛筆一本 — один карандаш. Для книг используют 冊（さつ）.",
        en: "The two learning meanings of 本 are book and origin. The standalone word 本（ほん） can mean a book. In 本店（ほんてん）, in the sense of main store, 本 marks the principal branch. After a number it can count long, thin objects: 鉛筆一本 is one pencil. Use 冊（さつ） for books.",
      },
      READING: {
        ru: "Учебное чтение ほん слышно в 本店（ほんてん）. В счёте длинных предметов это чтение меняет начало в зависимости от числа: 一本 — いっぽん, 三本 — さんぼん. Такие сочетания запоминаются целиком.",
        en: "You can hear the taught reading ほん in 本店（ほんてん）. As a counter for long objects, the first sound can change with the number: 一本 is いっぽん, and 三本 is さんぼん. Learn these combinations as whole words.",
      },
    },
    referenceMeanings: [
      { ru: "главный (в начале сложного слова)", en: "main (as a prefix)" },
      {
        ru: "счётный суффикс для длинных узких предметов",
        en: "counter suffix for long, thin objects",
      },
    ],
  },
  {
    character: "田",
    reading: "でん",
    hints: {
      MEANING: {
        ru: "田 — прежде всего рисовое поле. В 水田（すいでん） 水 напоминает о воде, которой заливают рисовый участок. Сравните с 畑（はたけ）: это поле, где выращивают, например, овощи или пшеницу, а не заливной рис.",
        en: "田 primarily refers to a rice field. In 水田（すいでん）, 水 points to the water that floods the paddy. Contrast this with 畑（はたけ）, a field for crops such as vegetables or wheat rather than a flooded rice paddy.",
      },
      READING: {
        ru: "Для этой карточки нужно чтение でん из 水田（すいでん）. Распространённое слово 田んぼ（たんぼ） тоже означает рисовое поле, но начинается с た. Не переносите чтение из одного слова в другое.",
        en: "This card teaches でん from 水田（すいでん）. The common word 田んぼ（たんぼ） also means a rice field, but starts with た. Keep each reading attached to its own word.",
      },
    },
  },
];

export const FOUNDATION_KANJI_EDITORIAL = {
  version: "foundation-kanji-editorial-2026-11-26",
  sourceSnapshotVersion: "2026-10-31",
  entries: ENTRIES.map((entry) => ({ ...entry, itemKey: `kanji:${entry.character}` })),
};
