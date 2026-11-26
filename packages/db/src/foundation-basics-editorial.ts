import type { CourseEditorialEntry } from "./starter-lesson-editorial";

type Text = { readonly ru: string; readonly en: string };
type Entry = CourseEditorialEntry &
  (
    | { readonly kind: "COMPONENT"; readonly componentKey: string; readonly symbol: string }
    | { readonly kind: "KANJI"; readonly character: string; readonly reading: string }
  );

function component(componentKey: string, symbol: string, ru: string, en: string): Entry {
  return {
    itemKey: `component:${componentKey}`,
    kind: "COMPONENT",
    componentKey: `component-${componentKey}`,
    symbol,
    hints: { MEANING: { ru, en } },
  };
}

function kanji(
  character: string,
  reading: string,
  meaning: Text,
  readingHint: Text,
  referenceMeanings: readonly Text[] = [],
): Entry {
  return {
    itemKey: `kanji:${character}`,
    kind: "KANJI",
    character,
    reading,
    hints: { MEANING: meaning, READING: readingHint },
    referenceMeanings,
  };
}

export const FOUNDATION_BASICS_EDITORIAL = {
  version: "foundation-basics-editorial-01",
  sourceSnapshotVersion: "2026-10-31",
  entries: [
    component(
      "one-stroke",
      "一",
      "Представьте одну отметку за один посчитанный предмет. У 二 видно уже две горизонтали, но каждая отдельная горизонталь напоминает ту же отметку. В уроке компонента запоминайте «единица»: «черта» описывает форму, а не учебное значение.",
      "Picture a tally for one object. 二 has two horizontal marks, and either one looks like the single mark here. The course answer is “one”; horizontal stroke describes the shape.",
    ),
    component(
      "mouth-frame",
      "口",
      "Рамка 口 похожа на контур открытого рта. В 品 можно найти три такие отдельные рамки: одну наверху и две внизу. Не путайте этот образ с 囗 в 国: там внешняя ограда охватывает другую часть знака.",
      "The outline of 口 suggests an open mouth. In 品 you can spot three separate examples, one above two. Contrast it with the enclosing 囗 in 国, which surrounds another part of the character.",
    ),
    component(
      "sun-window",
      "日",
      "У рамки 日 одна внутренняя перекладина. Найдите её слева в 明; справа стоит 月 с двумя короткими внутренними штрихами. Это способ заметить «солнце» даже тогда, когда компонент стал уже.",
      "日 has one inner bar inside its outline. Find it on the left of 明; 月 on the right has two short inner marks. That contrast helps you recognize the sun component even when its shape is squeezed.",
    ),
    component(
      "enclosure",
      "囗",
      "У 囗 важен не абсолютный размер, а роль рамки. Посмотрите на 国: ограда образует внешний контур, а внутри видна другая группа черт. Пустой 口 такой внутренней части не содержит.",
      "For 囗, look at what the frame does rather than how big it is. In 国 it forms the outer boundary around another group of strokes. An empty 口 does not enclose a separate part like that.",
    ),
    component(
      "jewel",
      "玉",
      "У 玉 есть маленькая точка рядом с перекладинами. Внутри 国 заметить её важнее, чем оценить длину черт: без точки рисунок легко спутать с 王. Представьте, что точка — блеск драгоценности.",
      "Look for the small dot beside the crossbars in 玉. Inside 国, the dot is a better clue than the lengths of the lines: without it, the shape can look like 王. Picture the dot as a jewel's glint.",
    ),
    component(
      "person",
      "人",
      "У 人 две расходящиеся опоры. Слева в 休 вместо широкой формы виден вариант 亻: его второй штрих почти вертикален. Узнавайте эту деталь рядом с 木, но не пытайтесь по ней вывести произношение всего знака.",
      "人 has two spreading strokes. On the left of 休 it takes the narrow form 亻 beside 木, with an almost vertical second stroke. Use that shape to recognize the variant, not to predict the reading of the whole character.",
    ),
    component(
      "private",
      "厶",
      "У 厶 видны угол и короткий наклонный штрих. Найдите их справа в 私. Представьте, что в этом уголке спрятано что-то личное. Сходство с катаканой ム только внешнее и не задаёт чтения.",
      "Look for the angle and short slanted stroke of 厶 on the right of 私. Imagine keeping something private in that corner. Its resemblance to the katakana ム is visual and does not tell you how to read it.",
    ),
    component(
      "year-marker",
      "年",
      "Смотрите на вертикаль, которая связывает несколько горизонтальных отметок. В слове 年末 первым стоит знак 年, затем 末. Учебный образ «годовой знак» напоминает о календарных отметках, а не требует читать это слово.",
      "Look for the vertical stroke that links several horizontal marks. In 年末 the whole shape 年 sits before 末. The year marker mnemonic suggests marks on a calendar without requiring you to read the compound.",
    ),
    component(
      "large-shape",
      "大",
      "Различайте силуэт 人 и 大 по поперечной черте: у 大 она похожа на широко разведённые руки. В 天 над похожей широкой формой видна ещё одна горизонталь. Сначала замечайте основной силуэт, затем добавленную черту.",
      "Distinguish 人 from 大 by the crossbar: it suggests arms spread wide in 大. In 天 you can see another horizontal stroke above that broad figure. Notice the main silhouette first and then the extra line.",
    ),
    component(
      "cross",
      "十",
      "В форме 十 вертикальная черта проходит через горизонтальную. Сравните с 丁: там вертикаль начинается у верхней перекладины, а не пересекает её. На карточке компонента запоминайте пересечение как «крест».",
      "In 十 the vertical crosses the horizontal. Compare 丁, where the vertical hangs from the top bar instead of passing through it. The component cue cross names the point where the two directions meet.",
    ),
    component(
      "tree",
      "木",
      "Проследите центральный ствол 木 и два расходящихся нижних штриха. В 林 рядом два дерева, и у левого правый нижний штрих укорочен. В 本 видна другая деталь: короткая отметка у основания одного дерева.",
      "Trace the central trunk of 木 and the two lower strokes that spread out. 林 places two trees side by side and shortens the lower right stroke of the left one. 本 instead has a short mark at the base of one tree.",
    ),
    component(
      "long-shape",
      "長",
      "У 長 несколько перекладин наверху и заметный вытянутый штрих внизу. Поищите эту комбинацию в правой части 張: соседний 弓 занимает левую половину. В тесном составном знаке важнее рисунок черт, чем их точная ширина.",
      "長 combines several upper bars with a long, sweeping lower stroke. Look for that pattern on the right of 張, with 弓 on the left. In a packed character, the arrangement matters more than the exact width.",
    ),
    component(
      "mountain",
      "山",
      "У 山 три вершины, средняя выше боковых. В 岩 компонент 山 находится над 石 и сжат по высоте. Средняя вершина всё равно остаётся удобной точкой для узнавания.",
      "山 has three peaks, with the middle one higher than its neighbors. In 岩, the mountain sits above 石 and is squashed vertically. The middle peak is still the quickest clue.",
    ),
    component(
      "temple",
      "寺",
      "У 寺 две хорошо различимые части: 土 наверху и 寸 внизу. В 時 весь этот рисунок занимает правую сторону, а 日 остаётся слева. Ищите обе части вместе, чтобы не принять один верхний 土 за весь компонент.",
      "寺 has two recognizable parts, 土 above 寸. In 時 that whole stack is on the right, with 日 on the left. Look for both parts together so you do not mistake the upper 土 for the entire component.",
    ),
    component(
      "left-step",
      "彳",
      "У 彳 две наклонные черты и вертикаль, которая начинается у второй. Найдите их в левой половине 行. Этот край похож на следы шагов в мнемонике; чтение знака по нему не определяется.",
      "彳 has two slanting strokes and a vertical that starts at the second one. Find the group on the left of 行. A trail of footsteps recalls its outline, not the reading of the whole character.",
    ),
    component(
      "street-step",
      "亍",
      "Правая половина 行 похожа на 亍: две горизонтали и вертикаль с крючком. Слева у 行 — 彳 с наклонными штрихами. «Улица» помогает запомнить рисунок 亍; сходство форм не задаёт чтение или значение 行.",
      "The right half of 行 resembles 亍: two bars and a vertical hook. Its left half, 彳, has slanting strokes. Street is the course's memory cue for 亍; the visual resemblance does not determine how 行 is read or what it means.",
    ),
    component(
      "spirit",
      "礻",
      "Научитесь узнавать 礻 в левой части 社 по короткой верхней точке и узкой группе черт под ней. Похожий левый элемент 衤 имеет дополнительную короткую черту. Образ алтаря здесь помогает запомнить «дух», а не переводить весь знак.",
      "Recognize 礻 on the left of 社 by its short top dot and the narrow group of strokes below. The similar left-hand form 衤 has an extra short stroke. The altar image helps recall spirit, not translate the whole character.",
    ),
    component(
      "earth",
      "土",
      "Сравните отдельные 土 и 士: у 土 нижняя горизонталь длиннее верхней, а у 士 наоборот. В 社 земля находится справа и становится компактнее. На первой карточке держите в уме широкую нижнюю линию как почву.",
      "Compare 土 and 士 on their own: 土 has the longer bar at the bottom; 士 has it at the top. The earth component fits into the right side of 社. Picture the wide bottom line as the ground.",
    ),
    component(
      "eye",
      "目",
      "У 目 внутри вытянутой рамки две горизонтальные линии. У 日 внутри другая подсказка: одна перекладина. В 見 глаз расположен над двумя опорами, и его внутренние линии всё ещё можно различить.",
      "目 has two horizontal lines within its tall outline. 日 has a different clue, a single inner bar. In 見 the eye sits above two supports, and the inner lines are still recognizable.",
    ),
    component(
      "legs",
      "儿",
      "Две нижние опоры уходят в разные стороны; правая заканчивается заметным изгибом. В 見 они стоят под 目. Читайте это сочетание как целый кандзи: «ноги» здесь название нижней детали, а не часть произношения.",
      "The two lower supports spread apart, and the right one ends in a visible curve. In 見 they sit below 目. Read the result as a whole character: legs is the name of the lower part, not part of its pronunciation.",
    ),
    component(
      "moon",
      "月",
      "У 月 вытянутая форма с двумя короткими чертами внутри. Сравните две половины 明: слева 日 с одной перекладиной, справа 月 с двумя. Запомните этот контраст, а не только внешний прямоугольник.",
      "月 has a tall outline with two short marks inside. Compare the halves of 明: 日 on the left has one inner bar, while 月 on the right has two. Remember that contrast rather than relying on the outer shape alone.",
    ),
    component(
      "eight",
      "八",
      "Два штриха 八 расходятся и оставляют место между собой. В учебном начертании их верхушки раздельны, в отличие от соединённых черт 人. В 分 этот расходящийся рисунок находится над ножом 刀.",
      "The two strokes of 八 spread apart and leave space between them. In the study form their upper ends are separate, unlike the joined strokes of 人. In 分 the spreading pair sits above the knife form 刀.",
    ),
    component(
      "knife",
      "刀",
      "У 刀 сначала заметен угловатый контур, затем длинная уходящая влево черта. В 分 найдите этот рисунок внизу, под двумя расходящимися штрихами. Так видно, где заканчивается верхний компонент и начинается нож.",
      "In 刀, notice the angled outline and the long stroke that sweeps down to the left. Find that shape under the two spreading strokes in 分. The contrast makes the boundary between the upper part and the knife clear.",
    ),
    component(
      "short-thread",
      "幺",
      "У 幺 маленькие угловатые изгибы занимают немного места. В 後 ищите эту группу сверху справа, над расходящимися чертами. Образ обрывка нити помогает отделить маленькую верхнюю форму от нижнего шага.",
      "The compact bends of 幺 fit into a small space. Look for that group at the upper right of 後, above the spreading strokes. The image of a thread end helps separate the little upper shape from the lower step.",
    ),
    component(
      "trailing-step",
      "夂",
      "У 夂 внизу две длинные черты расходятся в стороны. В 後 этот рисунок находится под 幺 справа. Узнавайте его по раскрытому низу и положению; «следующий шаг» — имя образа в курсе, а не перевод всего кандзи.",
      "Two long lower strokes fan out in 夂. In 後, that pattern is below 幺 on the right. Use the open base and its position to recognize it. Trailing step is the course cue, not a translation of the whole kanji.",
    ),
    component(
      "vertical-line",
      "丨",
      "Представьте прямую вертикальную отметку. В 中 она проходит через середину рамки и выступает с двух сторон, поэтому её легко проследить целиком. Здесь запоминаем направление штриха, а не число или чтение.",
      "Picture a straight vertical mark. In 中 it passes through the center of the frame and extends beyond it at both ends, so you can follow the entire stroke. The cue is the direction, not a number or a reading.",
    ),
    kanji(
      "中",
      "ちゅう",
      {
        ru: "中 показывает середину или то, что находится внутри. В 中心（ちゅうしん） речь о центре. После названия действия 中 может указывать на время: 授業中（じゅぎょうちゅう） — «во время занятия». Читайте выражение целиком.",
        en: "中 can refer to the middle or the inside. 中心（ちゅうしん） is a center. After a word for an activity, 中 can mean during or in progress: 授業中（じゅぎょうちゅう） is during class. Read the whole expression.",
      },
      {
        ru: "Учебное ちゅう слышно в 中心（ちゅうしん） и в конце 授業中（じゅぎょうちゅう）. Отдельное «внутри» может читаться なか. В 世界中（せかいじゅう） конечный 中 читается じゅう: речь о всём мире.",
        en: "Hear the taught ちゅう in 中心（ちゅうしん） and at the end of 授業中（じゅぎょうちゅう）. The standalone word for inside can be なか. 世界中（せかいじゅう） has the voiced reading and means throughout the world.",
      },
      [
        {
          ru: "во время, в процессе (после названия действия)",
          en: "during, in progress (after an activity)",
        },
      ],
    ),
    kanji(
      "出",
      "しゅつ",
      {
        ru: "Основная идея 出 — движение наружу. 出口（でぐち） обозначает место выхода, а 出発（しゅっぱつ） — отправление, начало пути. Если видите в форме две вершины, используйте их как подсказку: это не разбор знака на две горы.",
        en: "The central idea in 出 is going out. 出口（でぐち） is an exit, while 出発（しゅっぱつ） is departure or setting off. You can picture two peaks as a visual cue, not as a breakdown of the character into two mountains.",
      },
      {
        ru: "Для карточки 出 запомните しゅつ из 出場（しゅつじょう） — «участие в соревновании». В 出発 сочетание しゅつ＋はつ даёт しゅっぱつ: появились маленькое っ и ぱ. У отдельного глагола 出る другое чтение: でる.",
        en: "Anchor しゅつ in 出場（しゅつじょう）, taking part in an event. In 出発, しゅつ plus はつ becomes しゅっぱつ, with the small っ and ぱ. The standalone verb 出る has a different reading, でる.",
      },
    ),
    kanji(
      "分",
      "ぶん",
      {
        ru: "Разделите яблоко пополам: 半分（はんぶん） обозначит половину, а 分 в этом слове передаёт идею части. Сравните с あと五分（あとごふん） — «ещё пять минут». Здесь соседние слова подсказывают, что речь о длительности.",
        en: "Split an apple in two: 半分（はんぶん） means one half, with 分 giving the idea of a part. Compare あと五分（あとごふん）, five more minutes. Here the context tells you that 分 measures time.",
      },
      {
        ru: "Учебное ぶん лучше услышать в 半分（はんぶん）. В счёте минут 分 даёт ふん или ぷん: 五分（ごふん）, 一分（いっぷん）. Чтение зависит от слова и числа, а не только от формы знака.",
        en: "Anchor the taught reading ぶん in 半分（はんぶん）. As a minute counter, 分 uses ふん or ぷん: 五分（ごふん）, 一分（いっぷん）. The word and the number determine the reading, not just the written shape.",
      },
    ),
    kanji(
      "見",
      "けん",
      {
        ru: "В 見る（みる） речь о том, чтобы увидеть или посмотреть. В 意見（いけん） тот же знак связан уже со взглядом на вопрос: это мнение. Не подставляйте перевод «видеть» в каждое слово с 見.",
        en: "見る（みる） is to see or look. In 意見（いけん）, 見 relates to someone's view of an issue: an opinion. Do not substitute the verb see into every word written with 見.",
      },
      {
        ru: "Для урока связывайте けん с концом слова 意見（いけん）. В 見る знак 見 читается み, а る уже написано хираганой. Сравнивайте полные слова: для отдельной карточки здесь нужен けん.",
        en: "Associate the taught けん with the end of 意見（いけん）. In 見る, 見 is read み and る is already written in hiragana. Compare the full words; this kanji card teaches けん.",
      },
      [
        {
          ru: "мнение, взгляд на вопрос (в сочетаниях)",
          en: "opinion or point of view (in compounds)",
        },
      ],
    ),
    kanji(
      "国",
      "こく",
      {
        ru: "国 обычно обозначает страну или государство. 国旗（こっき） — государственный флаг, а 母国（ぼこく） — родная страна. В словах про страну соседний знак уточняет, идёт ли речь о флаге, происхождении или чём-то ещё.",
        en: "国 commonly means a country or nation. 国旗（こっき） is a national flag, while 母国（ぼこく） is one's home country. The other character specifies whether the word is about a flag, a place of origin, or something else.",
      },
      {
        ru: "Учебное こく слышно в конце 母国（ぼこく）. В 国旗 соединение こく＋き даёт こっき, с маленьким っ вместо く. Отдельное слово «страна» может читаться くに.",
        en: "Hear the taught こく at the end of 母国（ぼこく）. In 国旗, こく plus き becomes こっき, with a small っ in place of く. The standalone word for country can be read くに.",
      },
    ),
    kanji(
      "会",
      "かい",
      {
        ru: "会 связано со встречами людей. 会う（あう） — встречаться с кем-то; 会議（かいぎ） — собрание для обсуждения. В названии 町内会（ちょうないかい） знак обозначает уже объединение жителей района, а не одну встречу.",
        en: "会 is associated with people meeting. 会う（あう） is to meet someone, and 会議（かいぎ） is a meeting for discussion. In 町内会（ちょうないかい） it instead refers to a neighborhood association, not one meeting.",
      },
      {
        ru: "На карточке учим かい: оно стоит в начале 会議（かいぎ） и в конце 町内会（ちょうないかい）. Не переносите かい на глагол 会う（あう）: у него своё звучание.",
        en: "The card teaches かい, at the start of 会議（かいぎ） and the end of 町内会（ちょうないかい）. Do not carry it over to the verb 会う（あう）, which has its own reading.",
      },
      [{ ru: "общество, объединение (в названиях)", en: "association or society (in names)" }],
    ),
    kanji(
      "年",
      "ねん",
      {
        ru: "今年（ことし） — этот год. 三年（さんねん） может обозначать срок в три года, а в учебном контексте — третий год обучения. Смотрите на предложение, чтобы отличить длительность от номера года.",
        en: "今年（ことし） means this year. 三年（さんねん） can mean a period of three years or, in an educational context, the third year of study. Use the sentence to distinguish a duration from a numbered year.",
      },
      {
        ru: "Для карточки 年 привяжите ねん к 三年（さんねん） или 来年（らいねん, следующий год）. Отдельное «год» может читаться とし, а 今年 обычно читается целиком как ことし.",
        en: "Attach the taught ねん to 三年（さんねん） or 来年（らいねん, next year）. The standalone word for year can be とし, and 今年 is usually read as the whole word ことし.",
      },
    ),
    kanji(
      "長",
      "ちょう",
      {
        ru: "У 長 есть два разных контекста. 長い（ながい） описывает что-то длинное, в том числе долгое ожидание. В 校長（こうちょう） знак указывает на того, кто руководит школой; так говорят о должности, а не о длине.",
        en: "長 appears in two different contexts. 長い（ながい） can describe something long, including a long wait. In 校長（こうちょう） it identifies the head of a school, a role rather than a measurement.",
      },
      {
        ru: "Для карточки учите ちょう: оно звучит в 校長（こうちょう, директор школы） и в 全長（ぜんちょう, общая длина）. В слове 長い（ながい） знак 長 передаёт なが, а い уже написано.",
        en: "The taught ちょう occurs in 校長（こうちょう, school principal） and 全長（ぜんちょう, total length）. In 長い（ながい）, 長 supplies なが and い is already written.",
      },
    ),
    kanji(
      "行",
      "こう",
      {
        ru: "行 может обозначать движение или выполнение: 旅行（りょこう） — поездка, 実行（じっこう） — выполнение, осуществление. Есть и отдельное употребление в тексте: 一行（いちぎょう） может означать одну строку.",
        en: "行 can refer to going or carrying something out: 旅行（りょこう） is travel, and 実行（じっこう） is execution or putting a plan into effect. There is a separate use in writing: 一行（いちぎょう） can be one line of text.",
      },
      {
        ru: "Учебное こう слышно в 旅行（りょこう）, а 行く（いく, идти） начинается с い. Одну и ту же запись 一行 читайте по контексту: いちぎょう — одна строка текста; いっこう — группа людей, например путешественников.",
        en: "Hear the taught こう in 旅行（りょこう）; 行く（いく, go） starts with い. Context decides how you read 一行: いちぎょう is one line of text, while いっこう is a party of people, such as travelers.",
      },
      [{ ru: "строка текста (ぎょう)", en: "line of text (ぎょう)" }],
    ),
    kanji(
      "社",
      "しゃ",
      {
        ru: "社 входит и в 会社（かいしゃ, компания）, и в 神社（じんじゃ, синтоистское святилище）. Смотрите на слово целиком, чтобы различить эти два смысла. Если речь о фирмах, 三社（さんしゃ） означает «три компании».",
        en: "社 appears in both 会社（かいしゃ, a company） and 神社（じんじゃ, a Shinto shrine）. Read the whole word to tell the senses apart. In a business context, 三社（さんしゃ） can mean three companies.",
      },
      {
        ru: "Для этой карточки запомните しゃ в 会社（かいしゃ）. В 神社（じんじゃ） знак 社 читается じゃ. Не путайте 神社 со словом 寺（てら）: последнее обычно обозначает буддийский храм.",
        en: "The taught reading is しゃ, as in 会社（かいしゃ）. In 神社（じんじゃ）, 社 has the voiced reading じゃ. Do not confuse 神社 with 寺（てら）, the usual word for a Buddhist temple.",
      },
      [{ ru: "счётный суффикс для компаний", en: "counter for companies" }],
    ),
  ] satisfies readonly Entry[],
};
