import type { SeedHintType } from "./course-seed";

type BilingualText = { readonly ru: string; readonly en: string };

type StarterEditorialEntry = {
  readonly itemKey: string;
  readonly hints: Partial<Record<SeedHintType, BilingualText>>;
  readonly referenceMeanings?: readonly BilingualText[];
};

export const STARTER_LESSON_EDITORIAL: {
  readonly version: string;
  readonly sourceSnapshotVersion: string;
  readonly entries: readonly StarterEditorialEntry[];
} = {
  version: "starter-lesson-editorial-2026-11-26",
  sourceSnapshotVersion: "2026-10-31",
  entries: [
    {
      itemKey: "component-one-stroke",
      hints: {
        MEANING: {
          ru: "Представьте, что отмечаете на листе один посчитанный предмет. Одна горизонтальная отметка напоминает об одной единице; «черта» описывает форму, а «единица» передаёт учебное значение. Пока мы узнаём форму, чтение здесь не нужно.",
          en: "Imagine making a tally for one object. The horizontal mark is the shape; one unit is the idea it stands for. Here the goal is to recognize the component, not to read it.",
        },
      },
    },
    {
      itemKey: "component-mouth-frame",
      hints: {
        MEANING: {
          ru: "У 口 замкнутый контур и пустая середина. Представьте открытый рот: контур напоминает губы, а середина остаётся пустой. Не путайте 口 с 囗: второй знак служит внешней рамкой, например в 国.",
          en: "Picture an open mouth: the outline of 口 is like the lips, with space inside. Do not confuse it with 囗, the enclosure around the other part of a character such as 国.",
        },
      },
    },
    {
      itemKey: "kanji-one",
      hints: {
        MEANING: {
          ru: "Когда 一 обозначает количество, это «один»: 一人（ひとり） — один человек, 一つ（ひとつ） — один предмет. Число может указывать и место по порядку: 第一（だいいち） означает «первый». В этом уроке проверяется именно количество.",
          en: "When 一 shows a quantity, it means one: 一人（ひとり） is one person, and 一つ（ひとつ） is one item. The number can also mark a place in an order: 第一（だいいち） means first. This lesson tests the quantity sense.",
        },
        READING: {
          ru: "Начните с いち: так можно произнести 一 при счёте. В словах 一つ（ひとつ） и 一人（ひとり） знакомая форма звучит как ひと. Запоминайте чтение вместе со словом: いち нельзя просто подставить вместо ひと.",
          en: "Start with いち when counting. In 一つ（ひとつ） and 一人（ひとり）, the same kanji is read ひと. Learn these readings with the complete words rather than swapping いち and ひと freely.",
        },
      },
      referenceMeanings: [
        { ru: "первый (при указании порядка)", en: "first (when indicating order)" },
      ],
    },
    {
      itemKey: "kanji-mouth",
      hints: {
        MEANING: {
          ru: "Основное значение в этом уроке — «рот», как в 口を開ける（くちをあける） — «открыть рот». В некоторых словах 口 обозначает проём, через который проходят: 入口 — вход, 出口 — выход. Направление задаёт другой кандзи.",
          en: "The main meaning in this lesson is mouth, as in 口を開ける（くちをあける）, to open one's mouth. In words like 入口 (entrance) and 出口 (exit), 口 refers to an opening people pass through. The other kanji supplies the direction.",
        },
        READING: {
          ru: "Запомните くち по отдельному слову 口 — «рот». В 入口（いりぐち） и 出口（でぐち） начало чтения озвончается: くち превращается в ぐち. Это особенность этих слов, не второе чтение отдельного слова 口.",
          en: "Use the standalone word 口, くち, to anchor the reading. In 入口（いりぐち） and 出口（でぐち）, the initial k of くち is voiced to g. Learn ぐち with these compounds, not as the standalone reading of 口.",
        },
      },
      referenceMeanings: [
        { ru: "проём, через который проходят", en: "an opening people pass through" },
      ],
    },
    {
      itemKey: "word-hitotsu",
      hints: {
        USAGE: {
          ru: "一つ（ひとつ） помогает назвать количество, когда речь об одном предмете. Например, りんごを一つ — «одно яблоко». Если предмет уже виден или назван, 一つ можно употребить без названия предмета. Для людей в таком случае используют 一人（ひとり）.",
          en: "一つ（ひとつ） counts one item. For example, りんごを一つ specifies one apple. When everyone already knows the object, 一つ can stand without the noun. To count one person, use 一人（ひとり） instead.",
        },
      },
    },
    {
      itemKey: "word-kuchi",
      hints: {
        USAGE: {
          ru: "В этом уроке 口（くち） означает «рот». В 口を開ける（くちをあける） частица を показывает, что открывают именно рот. Сравните с 一口（ひとくち）: 一口飲む означает «сделать один глоток». Смысл меняется у целого слова, хотя знак тот же.",
          en: "In this lesson, 口（くち） means mouth. In 口を開ける（くちをあける）, を marks what you open. Compare 一口（ひとくち）: 一口飲む means taking a single sip. The same kanji is part of a different word here.",
        },
      },
    },
    {
      itemKey: "sentence-hitotsu-kudasai",
      hints: {
        USAGE: {
          ru: "У прилавка можно указать на яблоко и сказать 一つください（ひとつください） — «Одно, пожалуйста». 一つ задаёт количество, а ください делает это вежливой просьбой. Если предмет неясен, назовите его: りんごを一つください — «Одно яблоко, пожалуйста».",
          en: "At a counter, you can point to an apple and say 一つください（ひとつください）, “One, please.” 一つ gives the quantity, and ください makes it a polite request. Name the object when it is not obvious: りんごを一つください, “One apple, please.”",
        },
      },
    },
  ],
} as const;
