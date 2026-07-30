export type MainCourseContentLocale = "ru-RU" | "en-US";

export type MainCourseLocalizedText = {
  readonly ru: string;
  readonly en: string;
};

export type MainCourseAcceptedMeanings = {
  readonly primary: string;
  readonly accepted: readonly string[];
};

export type MainCourseComponentContent = {
  readonly key: string;
  readonly symbol: string;
  readonly displayName: MainCourseLocalizedText;
  readonly shapeDescription: MainCourseLocalizedText;
  readonly meaning: MainCourseLocalizedText;
  readonly mnemonic: MainCourseLocalizedText;
};

export type MainCourseKanjiContent = {
  readonly character: string;
  readonly levelNumber: number;
  readonly sortOrder: number;
  readonly meanings: {
    readonly ru: MainCourseAcceptedMeanings;
    readonly en: MainCourseAcceptedMeanings;
  };
  readonly reading: {
    readonly source: string;
    readonly primary: string;
    readonly accepted: readonly string[];
  };
  readonly componentKeys: readonly string[];
  readonly meaningMnemonic: MainCourseLocalizedText;
  readonly readingMnemonic: MainCourseLocalizedText;
  readonly requireStrokeData: boolean;
};

export type MainCourseContentBatch = {
  readonly id: string;
  readonly version: string;
  readonly reviewedAt: string;
  readonly sourceFile: string;
  readonly courseSlug: string;
  readonly componentLevelNumber: number;
  readonly components: readonly MainCourseComponentContent[];
  readonly kanji: readonly MainCourseKanjiContent[];
};

const FOUNDATION_COMPONENTS: readonly MainCourseComponentContent[] = [
  component(
    "one-stroke",
    "一",
    "единица",
    "one",
    "горизонтальная черта",
    "horizontal stroke",
    "Одна горизонтальная черта обозначает одну целую единицу.",
    "One horizontal stroke represents one whole unit.",
  ),
  component(
    "mouth-frame",
    "口",
    "рот",
    "mouth",
    "прямоугольная рамка",
    "rectangular frame",
    "Прямоугольная рамка напоминает открытый рот.",
    "The rectangular frame resembles an open mouth.",
  ),
  component(
    "sun-window",
    "日",
    "солнце",
    "sun",
    "прямоугольник с внутренней чертой",
    "rectangle with an inner stroke",
    "Внутренняя черта превращает рамку в яркое окно солнца.",
    "The inner stroke turns the frame into a bright sun window.",
  ),
  component(
    "enclosure",
    "囗",
    "ограда",
    "enclosure",
    "рамка, окружающая другие элементы",
    "frame surrounding other elements",
    "Большая рамка охватывает всё внутри, как прочная ограда.",
    "The large frame surrounds everything inside like a firm enclosure.",
  ),
  component(
    "jewel",
    "玉",
    "драгоценность",
    "jewel",
    "три горизонтали, вертикаль и точка",
    "three horizontal strokes, a vertical stroke, and a dot",
    "Точка отличает драгоценность от обычного камня.",
    "The dot marks a jewel rather than an ordinary stone.",
  ),
  component(
    "person",
    "人",
    "человек",
    "person",
    "две расходящиеся опоры",
    "two spreading supports",
    "Две опоры похожи на идущие ноги человека.",
    "The two supports resemble the walking legs of a person.",
  ),
  component(
    "private",
    "厶",
    "личное",
    "private",
    "угловатая петля",
    "angular loop",
    "Замкнутая петля хранит что-то личное внутри.",
    "The closed loop keeps something private inside.",
  ),
  component(
    "year-marker",
    "年",
    "годовой знак",
    "year marker",
    "перекрещенные горизонтальные и вертикальные штрихи",
    "crossed horizontal and vertical strokes",
    "Перекладины напоминают отметки, которыми считают прошедшие годы.",
    "The crossbars resemble marks used to count passing years.",
  ),
  component(
    "large-shape",
    "大",
    "большой",
    "large",
    "человек с широко разведёнными руками",
    "person with arms spread wide",
    "Человек разводит руки, показывая большой размер.",
    "A person spreads both arms to show a large size.",
  ),
  component(
    "cross",
    "十",
    "крест",
    "cross",
    "пересечение вертикали и горизонтали",
    "crossing vertical and horizontal strokes",
    "Две черты пересекаются и образуют простой крест.",
    "Two strokes intersect to form a simple cross.",
  ),
  component(
    "tree",
    "木",
    "дерево",
    "tree",
    "ствол с ветвями и корнями",
    "trunk with branches and roots",
    "Вертикальный ствол расходится ветвями вверх и корнями вниз.",
    "A vertical trunk spreads into branches above and roots below.",
  ),
  component(
    "long-shape",
    "長",
    "длина",
    "length",
    "вытянутая форма с длинным нижним штрихом",
    "tall form with a long lower stroke",
    "Вытянутый нижний штрих подчёркивает большую длину.",
    "The extended lower stroke emphasizes great length.",
  ),
  component(
    "mountain",
    "山",
    "гора",
    "mountain",
    "три вершины",
    "three peaks",
    "Средняя вершина выше двух соседних, как горный хребет.",
    "The middle peak rises above its neighbors like a mountain ridge.",
  ),
  component(
    "temple",
    "寺",
    "храм",
    "temple",
    "земля над мерной рукой",
    "earth above a measuring hand",
    "Участок земли и точная мера отмечают храмовую территорию.",
    "A plot of earth and a careful measure mark temple grounds.",
  ),
  component(
    "left-step",
    "彳",
    "шаг",
    "step",
    "короткие штрихи слева от пути",
    "short strokes at the left of a path",
    "Короткие штрихи показывают последовательные шаги по пути.",
    "The short strokes show successive steps along a path.",
  ),
  component(
    "street-step",
    "亍",
    "улица",
    "street",
    "перекладины над вертикальным путём",
    "crossbars above a vertical path",
    "Перекладины пересекают прямой путь, как улицы на карте.",
    "Crossbars meet a straight path like streets on a map.",
  ),
  component(
    "spirit",
    "礻",
    "дух",
    "spirit",
    "алтарный знак слева",
    "altar form on the left",
    "Небольшой алтарь напоминает о духах и священных местах.",
    "A small altar recalls spirits and sacred places.",
  ),
  component(
    "earth",
    "土",
    "земля",
    "earth",
    "росток над линией почвы",
    "shoot above a line of soil",
    "Вертикальный росток выходит из горизонтальной земли.",
    "A vertical shoot rises from a horizontal line of earth.",
  ),
  component(
    "eye",
    "目",
    "глаз",
    "eye",
    "прямоугольник с двумя внутренними линиями",
    "rectangle with two inner lines",
    "Внутренние линии делят вытянутую форму, как детали глаза.",
    "The inner lines divide the long shape like details of an eye.",
  ),
  component(
    "legs",
    "儿",
    "ноги",
    "legs",
    "две опоры с расходящимися концами",
    "two supports with spreading ends",
    "Две нижние опоры расходятся, как устойчивые ноги.",
    "The two lower supports spread like steady legs.",
  ),
  component(
    "moon",
    "月",
    "луна",
    "moon",
    "узкая рамка с двумя внутренними штрихами",
    "narrow frame with two inner strokes",
    "Узкая светлая форма напоминает луну в ночном небе.",
    "The narrow bright form resembles the moon in the night sky.",
  ),
  component(
    "eight",
    "八",
    "восемь",
    "eight",
    "два расходящихся штриха",
    "two diverging strokes",
    "Два штриха расходятся в разные стороны, разделяя пространство.",
    "Two strokes diverge and split the space apart.",
  ),
  component(
    "knife",
    "刀",
    "нож",
    "knife",
    "изогнутое лезвие с рукоятью",
    "curved blade with a handle",
    "Длинный изгиб выглядит как острое лезвие ножа.",
    "The long curve looks like the sharp blade of a knife.",
  ),
  component(
    "short-thread",
    "幺",
    "короткая нить",
    "short thread",
    "маленькая скрученная петля",
    "small twisted loop",
    "Маленькая петля похожа на короткий обрывок нити.",
    "The small loop resembles a short piece of thread.",
  ),
  component(
    "trailing-step",
    "夂",
    "следующий шаг",
    "trailing step",
    "диагональные штрихи над расходящимися ногами",
    "diagonal strokes above spreading feet",
    "Ноги завершают движение последним следующим шагом.",
    "The feet finish the movement with one trailing step.",
  ),
  component(
    "vertical-line",
    "丨",
    "вертикаль",
    "vertical line",
    "одна вертикальная черта",
    "single vertical stroke",
    "Одна прямая черта стоит вертикально, как центральная ось.",
    "One straight stroke stands upright like a central axis.",
  ),
];

const FOUNDATION_KANJI: readonly MainCourseKanjiContent[] = [
  kanji(
    "日",
    2,
    1,
    ["день", "солнце"],
    ["day", "sun"],
    "ニチ",
    "にち",
    ["sun-window"],
    "Солнечное окно задаёт два связанных образа: солнце и день.",
    "The sun window connects the two core ideas: sun and day.",
    "Чтение にち часто встречается в датах, днях недели и словах о днях.",
    "The reading にち commonly appears in dates, weekdays, and day-related words.",
  ),
  kanji(
    "人",
    2,
    2,
    ["человек", "люди"],
    ["person", "people"],
    "ジン",
    "じん",
    ["person"],
    "Форма и значение совпадают: две ноги обозначают человека.",
    "The shape and meaning align: the two legs represent a person.",
    "Чтение じん часто называет человека по стране, группе или занятию.",
    "The reading じん often identifies a person by country, group, or role.",
  ),
  kanji(
    "大",
    2,
    3,
    ["большой", "великий"],
    ["big", "large"],
    "ダイ",
    "だい",
    ["large-shape"],
    "Широко разведённые руки показывают нечто большое.",
    "Arms spread wide show that something is big.",
    "Чтение だい часто используется в составных словах о размере и значимости.",
    "The reading だい is common in compounds about size and importance.",
  ),
  kanji(
    "十",
    2,
    4,
    ["десять"],
    ["ten"],
    "ジュウ",
    "じゅう",
    ["cross"],
    "Крест служит простой отметкой полного десятка.",
    "The cross acts as a simple mark for a complete ten.",
    "В обычном счёте 十 читается じゅう.",
    "In ordinary counting, 十 is read じゅう.",
  ),
  kanji(
    "二",
    2,
    5,
    ["два"],
    ["two"],
    "ニ",
    "に",
    ["one-stroke"],
    "Две горизонтальные единицы дают число два.",
    "Two horizontal units make the number two.",
    "В обычном счёте 二 читается に.",
    "In ordinary counting, 二 is read に.",
  ),
  kanji(
    "三",
    2,
    6,
    ["три"],
    ["three"],
    "サン",
    "さん",
    ["one-stroke"],
    "Три горизонтальные единицы дают число три.",
    "Three horizontal units make the number three.",
    "В обычном счёте 三 читается さん.",
    "In ordinary counting, 三 is read さん.",
  ),
  kanji(
    "月",
    2,
    7,
    ["месяц", "луна"],
    ["month", "moon"],
    "ゲツ",
    "げつ",
    ["moon"],
    "Луна отмечает и небесное тело, и месяц лунного календаря.",
    "The moon represents both the celestial body and a calendar month.",
    "Чтение げつ часто встречается в названиях месяцев и понедельника.",
    "The reading げつ commonly appears in month words and Monday.",
  ),
  kanji(
    "本",
    3,
    1,
    ["книга", "основа"],
    ["book", "origin"],
    "ホン",
    "ほん",
    ["tree", "one-stroke"],
    "Черта у основания дерева отмечает корень; от основы значение перешло к книге.",
    "A stroke marks the tree's root; from origin, the meaning extends to book.",
    "Чтение ほん используется в словах о книгах и во многих составных словах.",
    "The reading ほん is used for books and in many common compounds.",
  ),
  kanji(
    "中",
    3,
    2,
    ["середина", "внутри"],
    ["middle", "inside"],
    "チュウ",
    "ちゅう",
    ["mouth-frame", "vertical-line"],
    "Вертикаль проходит точно через середину рамки.",
    "A vertical line passes exactly through the middle of the frame.",
    "Чтение ちゅう часто передаёт нахождение внутри или действие в процессе.",
    "The reading ちゅう often expresses being inside or in the middle of an action.",
  ),
  kanji(
    "出",
    3,
    3,
    ["выход", "выходить"],
    ["exit", "leave"],
    "シュツ",
    "しゅつ",
    ["mountain"],
    "Одна вершина поднимается из другой: наружу происходит выход.",
    "One peak rises from another, creating the idea of coming out.",
    "Чтение しゅつ часто встречается в составных словах о выходе и отправлении.",
    "The reading しゅつ is common in compounds about exit and departure.",
  ),
  kanji(
    "分",
    3,
    4,
    ["часть", "минута"],
    ["part", "minute"],
    "ブン",
    "ぶん",
    ["eight", "knife"],
    "Нож разделяет целое на расходящиеся части.",
    "A knife divides a whole into separate parts.",
    "Чтение ぶん используется для частей и долей; счёт минут позже добавит ふん.",
    "The reading ぶん is used for parts and shares; minute counting later adds ふん.",
  ),
  kanji(
    "見",
    3,
    5,
    ["видеть", "смотреть"],
    ["see", "look"],
    "ケン",
    "けん",
    ["eye", "legs"],
    "Глаз на ногах движется, чтобы увидеть и рассмотреть.",
    "An eye on legs moves around to see and inspect.",
    "Чтение けん часто встречается в составных словах о взгляде и мнении.",
    "The reading けん often appears in compounds about seeing and opinions.",
  ),
  kanji(
    "国",
    4,
    1,
    ["страна", "государство"],
    ["country", "nation"],
    "コク",
    "こく",
    ["enclosure", "jewel"],
    "Ограда защищает общую драгоценность внутри страны.",
    "An enclosure protects the shared jewel within a country.",
    "Чтение こく часто встречается в названиях стран и международных понятиях.",
    "The reading こく commonly appears in country names and international terms.",
  ),
  kanji(
    "会",
    4,
    2,
    ["встреча", "встречаться"],
    ["meeting", "meet"],
    "カイ",
    "かい",
    ["person", "one-stroke", "private"],
    "Люди сходятся под общей линией и делятся личным на встрече.",
    "People gather under one line and share something private at a meeting.",
    "Чтение かい часто встречается в словах о встречах, собраниях и организациях.",
    "The reading かい is common in words for meetings, gatherings, and organizations.",
  ),
  kanji(
    "年",
    4,
    3,
    ["год"],
    ["year"],
    "ネン",
    "ねん",
    ["year-marker"],
    "Повторяющиеся отметки годового знака отсчитывают один завершённый год.",
    "Repeated marks on the year sign count one completed year.",
    "Чтение ねん ставится после числа при подсчёте лет.",
    "The reading ねん follows a number when counting years.",
  ),
  kanji(
    "長",
    4,
    4,
    ["длинный", "руководитель"],
    ["long", "leader"],
    "チョウ",
    "ちょう",
    ["long-shape"],
    "Вытянутая форма прямо передаёт длину; старший руководитель ведёт дольше других.",
    "The extended form conveys length; a senior leader has served longer.",
    "Чтение ちょう часто встречается в названиях руководителей и словах о длине.",
    "The reading ちょう is common in titles for leaders and words about length.",
  ),
  kanji(
    "行",
    4,
    5,
    ["идти", "действие"],
    ["go", "action"],
    "コウ",
    "こう",
    ["left-step", "street-step"],
    "Шаги идут по пересекающимся улицам, создавая движение и действие.",
    "Steps move through crossing streets, creating motion and action.",
    "Чтение こう часто встречается в составных словах о движении и выполнении.",
    "The reading こう often appears in compounds about movement and execution.",
  ),
  kanji(
    "社",
    4,
    6,
    ["компания", "святилище"],
    ["company", "shrine"],
    "シャ",
    "しゃ",
    ["spirit", "earth"],
    "Священный знак стоит на земле общего места; позже это стало и объединением людей.",
    "A sacred sign stands on shared ground; the idea later extends to an organization.",
    "Чтение しゃ часто встречается в названиях компаний и организаций.",
    "The reading しゃ commonly appears in company and organization names.",
  ),
  kanji(
    "時",
    4,
    7,
    ["время", "час"],
    ["time", "hour"],
    "ジ",
    "じ",
    ["sun-window", "temple"],
    "Положение солнца у храма помогает отмечать время и часы.",
    "The sun's position by a temple helps mark time and hours.",
    "Чтение じ ставится после числа при назывании часа.",
    "The reading じ follows a number when stating an hour.",
  ),
  kanji(
    "後",
    4,
    8,
    ["после", "позади"],
    ["after", "behind"],
    "ゴ",
    "ご",
    ["left-step", "short-thread", "trailing-step"],
    "Короткая нить и следующий шаг остаются позади после движения.",
    "A short thread and a trailing step remain behind after the movement.",
    "Чтение ご часто встречается в составных словах со значением после или позднее.",
    "The reading ご commonly appears in compounds meaning after or later.",
  ),
];

const TASK_118_FOUNDATION_BATCH: MainCourseContentBatch = {
  id: "task-118-foundation-kanji-01",
  version: "1",
  reviewedAt: "2026-07-29",
  sourceFile: "packages/db/src/main-course-content.ts",
  courseSlug: "japanese-ru-n2",
  componentLevelNumber: 1,
  components: FOUNDATION_COMPONENTS,
  kanji: FOUNDATION_KANJI,
};

const MAIN_COURSE_CONTENT_BATCHES: readonly MainCourseContentBatch[] = [TASK_118_FOUNDATION_BATCH];

export function buildMainCourseContentBatches(): readonly MainCourseContentBatch[] {
  return MAIN_COURSE_CONTENT_BATCHES;
}

export function validateMainCourseContentBatches(
  batches: readonly MainCourseContentBatch[],
): readonly string[] {
  const issues: string[] = [];
  const batchIds = new Set<string>();
  const componentKeys = new Set<string>();
  const componentSymbols = new Set<string>();
  const kanjiCharacters = new Set<string>();
  const placements = new Set<string>();

  for (const batch of batches) {
    if (batchIds.has(batch.id)) {
      issues.push(`duplicate batch id ${batch.id}`);
    }
    batchIds.add(batch.id);

    for (const field of [
      batch.id,
      batch.version,
      batch.reviewedAt,
      batch.sourceFile,
      batch.courseSlug,
    ]) {
      if (field.trim() === "") {
        issues.push(`${batch.id || "unnamed batch"} has empty metadata`);
      }
    }

    if (!Number.isInteger(batch.componentLevelNumber) || batch.componentLevelNumber < 1) {
      issues.push(`${batch.id} has an invalid component level`);
    }

    for (const item of batch.components) {
      if (componentKeys.has(item.key)) {
        issues.push(`duplicate component key ${item.key}`);
      }
      if (componentSymbols.has(item.symbol)) {
        issues.push(`duplicate component symbol ${item.symbol}`);
      }
      componentKeys.add(item.key);
      componentSymbols.add(item.symbol);

      for (const text of [
        item.symbol,
        item.displayName.ru,
        item.displayName.en,
        item.shapeDescription.ru,
        item.shapeDescription.en,
        item.meaning.ru,
        item.meaning.en,
        item.mnemonic.ru,
        item.mnemonic.en,
      ]) {
        if (text.trim() === "") {
          issues.push(`${batch.id} component ${item.key} has empty bilingual content`);
          break;
        }
      }
    }

    for (const item of batch.kanji) {
      if (kanjiCharacters.has(item.character)) {
        issues.push(`duplicate kanji ${item.character}`);
      }
      kanjiCharacters.add(item.character);

      const placementKey = `${item.levelNumber}:${item.sortOrder}`;
      if (placements.has(placementKey)) {
        issues.push(`duplicate kanji placement ${placementKey}`);
      }
      placements.add(placementKey);

      if (
        !Number.isInteger(item.levelNumber) ||
        item.levelNumber <= batch.componentLevelNumber ||
        !Number.isInteger(item.sortOrder) ||
        item.sortOrder < 1
      ) {
        issues.push(`${batch.id} kanji ${item.character} has an invalid placement`);
      }

      for (const componentKey of item.componentKeys) {
        if (!componentKeys.has(componentKey)) {
          issues.push(`${batch.id} kanji ${item.character} references missing ${componentKey}`);
        }
      }

      if (item.componentKeys.length === 0) {
        issues.push(`${batch.id} kanji ${item.character} has no components`);
      }

      for (const [locale, meanings] of Object.entries(item.meanings)) {
        if (
          meanings.primary.trim() === "" ||
          meanings.accepted.length === 0 ||
          !meanings.accepted.includes(meanings.primary)
        ) {
          issues.push(`${batch.id} kanji ${item.character} has invalid ${locale} meanings`);
        }
      }

      if (
        item.reading.source.trim() === "" ||
        item.reading.primary.trim() === "" ||
        item.reading.accepted.length === 0 ||
        !item.reading.accepted.includes(item.reading.primary) ||
        normalizeReading(item.reading.source) !== normalizeReading(item.reading.primary)
      ) {
        issues.push(`${batch.id} kanji ${item.character} has an invalid taught reading`);
      }

      for (const text of [
        item.meaningMnemonic.ru,
        item.meaningMnemonic.en,
        item.readingMnemonic.ru,
        item.readingMnemonic.en,
      ]) {
        if (text.trim() === "") {
          issues.push(`${batch.id} kanji ${item.character} has incomplete mnemonics`);
          break;
        }
      }
    }
  }

  return issues;
}

function component(
  key: string,
  symbol: string,
  displayNameRu: string,
  displayNameEn: string,
  shapeDescriptionRu: string,
  shapeDescriptionEn: string,
  mnemonicRu: string,
  mnemonicEn: string,
): MainCourseComponentContent {
  return {
    key: `component-${key}`,
    symbol,
    displayName: { ru: displayNameRu, en: displayNameEn },
    shapeDescription: { ru: shapeDescriptionRu, en: shapeDescriptionEn },
    meaning: { ru: displayNameRu, en: displayNameEn },
    mnemonic: { ru: mnemonicRu, en: mnemonicEn },
  };
}

function kanji(
  character: string,
  levelNumber: number,
  sortOrder: number,
  meaningsRu: readonly string[],
  meaningsEn: readonly string[],
  sourceReading: string,
  primaryReading: string,
  componentKeys: readonly string[],
  meaningMnemonicRu: string,
  meaningMnemonicEn: string,
  readingMnemonicRu: string,
  readingMnemonicEn: string,
): MainCourseKanjiContent {
  const primaryRu = meaningsRu[0];
  const primaryEn = meaningsEn[0];

  if (primaryRu === undefined || primaryEn === undefined) {
    throw new Error(`Kanji ${character} must have RU and EN meanings.`);
  }

  return {
    character,
    levelNumber,
    sortOrder,
    meanings: {
      ru: { primary: primaryRu, accepted: meaningsRu },
      en: { primary: primaryEn, accepted: meaningsEn },
    },
    reading: {
      source: sourceReading,
      primary: primaryReading,
      accepted: [primaryReading],
    },
    componentKeys: componentKeys.map((key) => `component-${key}`),
    meaningMnemonic: { ru: meaningMnemonicRu, en: meaningMnemonicEn },
    readingMnemonic: { ru: readingMnemonicRu, en: readingMnemonicEn },
    requireStrokeData: true,
  };
}

function normalizeReading(value: string): string {
  return [...value.normalize("NFKC").trim()]
    .filter((character) => character !== "." && character !== "-")
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && codePoint >= 0x30a1 && codePoint <= 0x30f6
        ? String.fromCodePoint(codePoint - 0x60)
        : character;
    })
    .join("");
}
