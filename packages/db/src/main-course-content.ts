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
  readonly reviewedAt: string | null;
  readonly authoredAt?: string;
  readonly reviewNotes?: string;
  readonly sourceFile: string;
  readonly courseSlug: string;
  readonly componentLevelNumber: number;
  readonly componentSortOrderStart?: number;
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

const TASK_118_FOUNDATION_BATCH_02: MainCourseContentBatch = {
  id: "task-118-foundation-kanji-02",
  version: "1",
  reviewedAt: "2026-10-22",
  authoredAt: "2026-10-22",
  reviewNotes:
    "AI-authored independent RU/EN learning content, independently reviewed and corrected by the parent agent on 2026-10-22. All 20 taught readings and traced stroke graphics were checked against live source evidence. Visual mnemonics are memory aids, not historical etymologies. Database preflight remains mandatory before application; this is not a human-review claim.",
  sourceFile: "packages/db/src/main-course-content.ts",
  courseSlug: "japanese-ru-n2",
  componentLevelNumber: 1,
  componentSortOrderStart: 27,
  components: [
    component(
      "river",
      "川",
      "река",
      "river",
      "три вытянутые черты рядом",
      "three long strokes side by side",
      "Представьте три потока, которые текут рядом и образуют реку.",
      "Picture three streams flowing side by side to form a river.",
    ),
    component(
      "water",
      "水",
      "вода",
      "water",
      "центральный штрих с крюком и боковые штрихи",
      "a central hooked stroke with strokes on both sides",
      "Для запоминания представьте струю воды, от которой разлетаются брызги.",
      "As a memory aid, picture a jet of water scattering drops to both sides.",
    ),
    component(
      "fire",
      "火",
      "огонь",
      "fire",
      "две длинные опоры и два коротких боковых штриха",
      "two long supports and two short side strokes",
      "Представьте языки огня в центре и две искры по краям.",
      "Picture flames in the center and two sparks at the edges.",
    ),
    component(
      "metal",
      "金",
      "металл",
      "metal",
      "верхние скаты, поперечные линии и две нижние точки",
      "sloping top strokes, crossbars, and two lower dots",
      "Вообразите слитки металла под крышей и две блестящие крупинки внизу.",
      "Imagine metal bars beneath a roof and two shiny grains below.",
    ),
    component(
      "cliff-ledge",
      "厂",
      "уступ",
      "ledge",
      "горизонтальная полка с уходящим вниз левым штрихом",
      "a horizontal shelf with a descending left stroke",
      "Для запоминания представьте плоский уступ и крутой склон под ним.",
      "As a memory aid, picture a flat ledge with a steep slope below it.",
    ),
    component(
      "slanted-crossbar",
      "𠂇",
      "косая перекладина",
      "slanted crossbar",
      "горизонталь, пересечённая штрихом вниз влево",
      "a horizontal stroke crossed by a stroke descending left",
      "Найдите перекладину и косую опору: этот верхний фрагмент общий у 左 и 右.",
      "Find the crossbar and sloping support: this upper fragment is shared by 左 and 右.",
    ),
    component(
      "beam",
      "工",
      "балка",
      "beam",
      "две горизонтали, соединённые вертикалью",
      "two horizontal strokes joined by a vertical stroke",
      "Представьте вид сбоку на балку с верхней и нижней полками.",
      "Picture the side of a beam with an upper and a lower flange.",
    ),
    component(
      "white-mark",
      "白",
      "белый",
      "white",
      "прямоугольник с внутренней линией и коротким верхним штрихом",
      "a rectangle with an inner line and a short stroke above",
      "Представьте белую этикетку с маленьким креплением над ней.",
      "Picture a white label with a small fastener above it.",
    ),
    component(
      "slant-stroke",
      "丿",
      "наклонная черта",
      "slant stroke",
      "один штрих, уходящий вниз влево",
      "one stroke descending to the left",
      "Глаз следует по одной наклонной черте сверху вниз и влево.",
      "Follow a single slanting stroke from the top down toward the left.",
    ),
    component(
      "open-frame",
      "冂",
      "открытая рамка",
      "open frame",
      "верхняя сторона и две боковые стороны без дна",
      "a top and two sides with no bottom",
      "Представьте рамку, у которой сняли нижнюю сторону.",
      "Picture a frame with its lower side removed.",
    ),
    component(
      "strength",
      "力",
      "сила",
      "strength",
      "изогнутый штрих с крюком, пересечённый длинным штрихом",
      "a bent hooked stroke crossed by a long stroke",
      "Для запоминания представьте рычаг: нажим на него передаёт силу.",
      "As a memory aid, picture a lever transferring the force of a push.",
    ),
    component(
      "woman",
      "女",
      "женщина",
      "woman",
      "три пересекающихся штриха с длинной горизонталью",
      "three crossing strokes with a long horizontal stroke",
      "Вообразите женщину, складывающую руки; это только образ для памяти.",
      "Imagine a woman folding her arms; this is only a memory image.",
    ),
    component(
      "child",
      "子",
      "ребёнок",
      "child",
      "верхний изгиб, вертикаль с крюком и поперечная линия",
      "an upper bend, a hooked vertical stroke, and a crossbar",
      "Представьте ребёнка с большой головой и раскинутыми руками.",
      "Picture a child with a large head and outstretched arms.",
    ),
    component(
      "field",
      "田",
      "поле",
      "field",
      "замкнутая рамка с крестом внутри",
      "a closed frame with a cross inside",
      "Представьте поле, которое дорожки делят на четыре участка.",
      "Picture a field divided into four plots by crossing paths.",
    ),
  ],
  kanji: [
    kanji(
      "山",
      2,
      8,
      ["гора"],
      ["mountain"],
      "サン",
      "さん",
      ["mountain"],
      "Три вершины помогают узнать гору. Это зрительная подсказка, а не разбор происхождения знака.",
      "Three peaks help you recognize a mountain. This is a visual aid, not a historical derivation.",
      "Привяжите さん к горе: в слове 火山 (かざん, вулкан) оно озвончается до ざん; здесь учим исходное さん.",
      "Link さん to a mountain: 火山 (かざん, volcano) voices it to ざん; this card teaches the base さん.",
    ),
    kanji(
      "川",
      2,
      9,
      ["река"],
      ["river"],
      "セン",
      "せん",
      ["river"],
      "Три длинные линии напоминают параллельные речные потоки.",
      "The three long lines suggest parallel streams in a river.",
      "В 河川 (かせん, реки) 川 даёт せん. Не подменяйте это онное чтение кунным чтением かわ.",
      "In 河川 (かせん, rivers), 川 contributes せん. Do not replace this on reading with the kun reading かわ.",
    ),
    kanji(
      "木",
      2,
      10,
      ["дерево", "древесина"],
      ["tree", "wood"],
      "ボク",
      "ぼく",
      ["tree"],
      "У дерева найдите вертикальный ствол и расходящиеся ветви.",
      "Find the vertical trunk and spreading branches of a tree.",
      "В 木刀 (ぼくとう, деревянный меч) 木 даёт ぼく. Чтение もく в 木曜日 тоже существует, но эта карточка учит ぼく.",
      "In 木刀 (ぼくとう, wooden sword), 木 contributes ぼく. The reading もく in 木曜日 also exists, but this card teaches ぼく.",
    ),
    kanji(
      "水",
      2,
      11,
      ["вода"],
      ["water"],
      "スイ",
      "すい",
      ["water"],
      "Центральная струя и боковые брызги — образ воды для запоминания формы.",
      "A central jet and side splashes are a memory image for the shape of water.",
      "В 水曜日 (すいようび, среда) 水 читается すい; здесь нужен этот короткий блок.",
      "In 水曜日 (すいようび, Wednesday), 水 is read すい; this card needs that short block.",
    ),
    kanji(
      "火",
      2,
      12,
      ["огонь"],
      ["fire"],
      "カ",
      "か",
      ["fire"],
      "Представьте центральное пламя и две боковые искры, чтобы запомнить огонь.",
      "Picture a central flame and two side sparks to remember fire.",
      "В 火曜日 (かようび, вторник) 火 даёт か. Не добавляйте остальную часть названия дня.",
      "In 火曜日 (かようび, Tuesday), 火 contributes か. Do not add the rest of the weekday name.",
    ),
    kanji(
      "土",
      2,
      13,
      ["земля", "почва"],
      ["earth", "soil"],
      "ド",
      "ど",
      ["earth"],
      "Нижняя линия — поверхность почвы, над которой стоит короткий росток: образ земли.",
      "The lower line is a soil surface with a short shoot above it: an image of earth.",
      "В 土曜日 (どようび, суббота) 土 читается ど. Другое онное чтение と появится в других словах.",
      "In 土曜日 (どようび, Saturday), 土 is read ど. The other on reading と occurs in other words.",
    ),
    kanji(
      "金",
      2,
      14,
      ["золото", "металл"],
      ["gold", "metal"],
      "キン",
      "きん",
      ["metal"],
      "Представьте блестящий металл, сложенный под крышей; золото — один из таких металлов.",
      "Imagine shiny metal stored beneath a roof; gold is one such metal.",
      "В 金曜日 (きんようび, пятница) 金 даёт きん. Здесь не требуется отдельное слово かね.",
      "In 金曜日 (きんようび, Friday), 金 contributes きん. The standalone word かね is not tested here.",
    ),
    kanji(
      "石",
      2,
      15,
      ["камень"],
      ["stone", "rock"],
      "セキ",
      "せき",
      ["cliff-ledge", "mouth-frame"],
      "Под уступом 厂 лежит угловатый камень 口. Это придуманная история формы, не этимология.",
      "An angular stone 口 lies below a ledge 厂. This invented shape story is not an etymology.",
      "В 宝石 (ほうせき, драгоценный камень) 石 читается せき. Сохраните оба слога: せ и き.",
      "In 宝石 (ほうせき, gemstone), 石 is read せき. Keep both syllables: せ and き.",
    ),
    kanji(
      "上",
      3,
      6,
      ["верх", "сверху", "вверх"],
      ["above", "up"],
      "ジョウ",
      "じょう",
      ["one-stroke", "vertical-line"],
      "Длинная горизонталь служит опорой, а короткая отметка стоит над ней: ищите верх.",
      "The long horizontal is a reference line, with a short mark above it: look upward.",
      "В 上下 (じょうげ, верх и низ) 上 даёт じょう. Не пропускайте う: в じょう оно удлиняет звук о.",
      "In 上下 (じょうげ, above and below), 上 contributes じょう. Do not omit う: it lengthens the o sound in じょう.",
    ),
    kanji(
      "下",
      3,
      7,
      ["низ", "снизу", "вниз"],
      ["below", "down"],
      "カ",
      "か",
      ["one-stroke", "vertical-line"],
      "Горизонталь теперь сверху, а короткая отметка ниже неё: направление вниз противоположно 上.",
      "The horizontal is now on top, with the short mark below it: downward is the opposite of 上.",
      "В 地下 (ちか, под землёй) 下 даёт か. В 上下 оно читается иначе; эта карточка учит только か.",
      "In 地下 (ちか, underground), 下 contributes か. It has a different reading in 上下; this card teaches only か.",
    ),
    kanji(
      "右",
      3,
      8,
      ["право", "правый", "справа", "направо"],
      ["right"],
      "ウ",
      "う",
      ["slanted-crossbar", "mouth-frame"],
      "Под общей косой перекладиной найдите рот 口: это отличает правую сторону 右 от левой 左. Образ не объясняет происхождение знака.",
      "Find the mouth 口 beneath the shared slanted crossbar: it distinguishes right 右 from left 左. The image does not explain the character's origin.",
      "В 右折 (うせつ, правый поворот) 右 даёт короткое う. Не удлиняйте его до うう.",
      "In 右折 (うせつ, a right turn), 右 contributes a short う. Do not lengthen it to うう.",
    ),
    kanji(
      "左",
      3,
      9,
      ["лево", "левый", "слева", "налево"],
      ["left"],
      "サ",
      "さ",
      ["slanted-crossbar", "beam"],
      "Балка 工 под косой перекладиной отличает левую сторону 左 от правой 右 с рамкой 口. Это зрительная подсказка.",
      "The beam 工 beneath the slanted crossbar distinguishes left 左 from right 右 with its frame 口. This is a visual aid.",
      "В 左折 (させつ, левый поворот) 左 даёт さ. Сопоставьте его с う в правом повороте 右折.",
      "In 左折 (させつ, a left turn), 左 contributes さ. Contrast it with う in the right turn 右折.",
    ),
    kanji(
      "百",
      3,
      10,
      ["сто", "сотня"],
      ["hundred", "one hundred"],
      "ヒャク",
      "ひゃく",
      ["one-stroke", "white-mark"],
      "Представьте единицу 一 над белой этикеткой 白 на ящике из ста деталей. Это история для памяти, не происхождение числа.",
      "Picture one stroke 一 above a white label 白 on a box of one hundred parts. This is a memory story, not the origin of the number.",
      "Сто — ひゃく: после ひ пишется маленькая ゃ. Не заменяйте сочетание на ひや.",
      "One hundred is ひゃく: write a small ゃ after ひ. Do not replace the combination with ひや.",
    ),
    kanji(
      "千",
      3,
      11,
      ["тысяча"],
      ["thousand", "one thousand"],
      "セン",
      "せん",
      ["slant-stroke", "cross"],
      "Косой верхний штрих 丿 отличает тысячу 千 от креста десяти 十. Представьте дополнительную отметку на большой пачке.",
      "The upper slant 丿 distinguishes thousand 千 from the cross of ten 十. Imagine an extra mark on a large bundle.",
      "Тысяча читается せん. Последняя ん — отдельная мора, её нельзя опускать.",
      "One thousand is read せん. The final ん is a separate mora and must not be omitted.",
    ),
    kanji(
      "円",
      3,
      12,
      ["иена", "круг", "круглый"],
      ["yen", "circle", "round"],
      "エン",
      "えん",
      ["open-frame", "one-stroke", "vertical-line"],
      "В открытой рамке найдите внутренние линии и представьте монету в держателе. Иена и круг связываются этим образом, а не формой современного знака.",
      "Find the inner lines in the open frame and imagine a coin in a holder. This image links yen and circle without claiming the modern shape is round.",
      "После суммы денег 円 читается えん, например 百円 (ひゃくえん). На карточке вводите только えん.",
      "After an amount of money, 円 is read えん, as in 百円 (ひゃくえん). Enter only えん on this card.",
    ),
    kanji(
      "力",
      4,
      9,
      ["сила"],
      ["strength", "power"],
      "リョク",
      "りょく",
      ["strength"],
      "Вообразите нажатие на изогнутый рычаг: действие требует силы. Это только мнемонический образ.",
      "Imagine pressing a bent lever: the action requires strength. This is only a mnemonic image.",
      "В 能力 (のうりょく, способность) 力 даёт りょく. После り нужна маленькая ょ.",
      "In 能力 (のうりょく, ability), 力 contributes りょく. Use a small ょ after り.",
    ),
    kanji(
      "女",
      4,
      10,
      ["женщина"],
      ["woman", "female"],
      "ジョ",
      "じょ",
      ["woman"],
      "Представьте женщину со сложенными руками, чтобы запомнить пересекающиеся линии.",
      "Picture a woman with folded arms to remember the crossing lines.",
      "В 女性 (じょせい, женщина) 女 даёт じょ. Это короткое чтение, в отличие от долгого じょう у 上.",
      "In 女性 (じょせい, woman), 女 contributes じょ. It is short, unlike the long じょう of 上.",
    ),
    kanji(
      "男",
      4,
      11,
      ["мужчина"],
      ["man", "male"],
      "ダン",
      "だん",
      ["field", "strength"],
      "Для памяти вообразите мужчину, поднимающего силой 力 табличку с планом поля 田. Это придуманная сцена для запоминания формы.",
      "As a memory aid, imagine a man using strength 力 to lift a sign showing a field 田. This is an invented scene for remembering the shape.",
      "В 男性 (だんせい, мужчина) 男 даёт だん. Последняя ん сохраняется перед следующим слогом.",
      "In 男性 (だんせい, man), 男 contributes だん. Keep the final ん before the following syllable.",
    ),
    kanji(
      "子",
      4,
      12,
      ["ребёнок"],
      ["child"],
      "シ",
      "し",
      ["child"],
      "Большая голова и поперечная линия рук помогают представить ребёнка. Это условная картинка для памяти.",
      "A large head and a crossbar for arms help you picture a child. This is a simple memory image.",
      "В 子孫 (しそん, потомки) 子 даёт し. Здесь учится это онное чтение, а не отдельное слово こ.",
      "In 子孫 (しそん, descendants), 子 contributes し. This card teaches that on reading, not the standalone word こ.",
    ),
    kanji(
      "田",
      4,
      13,
      ["рисовое поле", "поле"],
      ["rice field", "field"],
      "デン",
      "でん",
      ["enclosure", "cross"],
      "Ограда 囗 и пересекающиеся дорожки 十 делят рисовое поле на четыре участка.",
      "An enclosure 囗 and crossing paths 十 divide a rice field into four plots.",
      "В 水田 (すいでん, заливное рисовое поле) 田 даёт でん. Не заменяйте его кунным чтением た.",
      "In 水田 (すいでん, a flooded rice field), 田 contributes でん. Do not replace it with the kun reading た.",
    ),
  ],
};

const TASK_118_FOUNDATION_BATCH_03: MainCourseContentBatch = {
  id: "task-118-foundation-kanji-03",
  version: "1",
  authoredAt: "2026-10-22",
  reviewedAt: "2026-10-22",
  reviewNotes:
    "AI-authored independent RU/EN content for the missing Foundation prerequisite 一. Independently reviewed by the parent agent on 2026-10-22, including live successful KANJIDIC2 evidence, source readings and stroke-graphic availability. Reuses the existing demo target/cards and registered one-stroke component. Database preflight and full quality validation remain mandatory. Not a human-review claim or full Task118 completion.",
  sourceFile: "packages/db/src/main-course-content.ts",
  courseSlug: "japanese-ru-n2",
  componentLevelNumber: 1,
  components: [],
  kanji: [
    kanji(
      "一",
      2,
      21,
      ["один", "единица"],
      ["one"],
      "イチ",
      "いち",
      ["one-stroke"],
      "Одна ровная черта 一 напоминает единственную отметку при счёте: один, одна единица.",
      "One straight line 一 suggests a single tally mark: one whole unit.",
      "У единственной отметки мысленно разместите い и ち: вместе いち. Это начало 一月 (いちがつ, январь).",
      "Place い and ち beside a single imagined tally mark: together, いち. It begins 一月 (いちがつ, January).",
    ),
  ],
};

const MAIN_COURSE_CONTENT_BATCHES: readonly MainCourseContentBatch[] = [
  TASK_118_FOUNDATION_BATCH,
  TASK_118_FOUNDATION_BATCH_02,
  TASK_118_FOUNDATION_BATCH_03,
];

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
  const componentCourses = new Map<string, string>();
  const componentLevels = new Map<string, number>();
  const kanjiCharacters = new Set<string>();
  const placements = new Set<string>();

  for (const batch of batches) {
    if (batchIds.has(batch.id)) {
      issues.push(`duplicate batch id ${batch.id}`);
    }
    batchIds.add(batch.id);

    for (const field of [batch.id, batch.version, batch.sourceFile, batch.courseSlug]) {
      if (field.trim() === "") {
        issues.push(`${batch.id || "unnamed batch"} has empty metadata`);
      }
    }

    if (batch.reviewedAt === null && (!batch.authoredAt?.trim() || !batch.reviewNotes?.trim())) {
      issues.push(`${batch.id} needs authorship and pending-review notes`);
    } else if (batch.reviewedAt !== null && batch.reviewedAt.trim() === "") {
      issues.push(`${batch.id} has empty review metadata`);
    }

    if (!Number.isInteger(batch.componentLevelNumber) || batch.componentLevelNumber < 1) {
      issues.push(`${batch.id} has an invalid component level`);
    }

    const componentStart = batch.componentSortOrderStart ?? 1;
    if (!Number.isInteger(componentStart) || componentStart < 1) {
      issues.push(`${batch.id} has an invalid component sort-order start`);
    }

    for (const [index, item] of batch.components.entries()) {
      if (componentKeys.has(item.key)) {
        issues.push(`duplicate component key ${item.key}`);
      }
      if (componentSymbols.has(item.symbol)) {
        issues.push(`duplicate component symbol ${item.symbol}`);
      }
      componentKeys.add(item.key);
      componentSymbols.add(item.symbol);
      componentCourses.set(item.key, batch.courseSlug);
      componentLevels.set(item.key, batch.componentLevelNumber);
      const placementKey = `${batch.courseSlug}:${batch.componentLevelNumber}:${componentStart + index}`;
      if (placements.has(placementKey)) {
        issues.push(
          `duplicate component placement ${batch.componentLevelNumber}:${componentStart + index}`,
        );
      }
      placements.add(placementKey);

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
      const scopedPlacementKey = `${batch.courseSlug}:${placementKey}`;
      if (placements.has(scopedPlacementKey)) {
        issues.push(`duplicate kanji placement ${placementKey}`);
      }
      placements.add(scopedPlacementKey);

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
        } else if (componentCourses.get(componentKey) !== batch.courseSlug) {
          issues.push(
            `${batch.id} kanji ${item.character} references another course's ${componentKey}`,
          );
        } else if ((componentLevels.get(componentKey) ?? Infinity) >= item.levelNumber) {
          issues.push(`${batch.id} kanji ${item.character} needs earlier ${componentKey}`);
        }
      }

      if (new Set(item.componentKeys).size !== item.componentKeys.length) {
        issues.push(`${batch.id} kanji ${item.character} repeats a component reference`);
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
        normalizeReading(item.reading.source) !== item.reading.primary ||
        item.reading.accepted.some((text) => text !== item.reading.primary)
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
