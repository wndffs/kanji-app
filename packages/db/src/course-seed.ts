import { createCourseLevelPassPolicy, type CourseLevelPassPolicy } from "./course-level-policy";

export type SeedLocale = "ru-RU" | "en-US";
export type SeedItemKind = "COMPONENT" | "KANJI" | "WORD" | "SENTENCE";
export type SeedPromptType = "MEANING" | "READING" | "RECALL" | "CLOZE" | "RECOGNITION";
export type SeedAnswerType = "MEANING" | "READING";
export type SeedMnemonicType = "MEANING" | "READING" | "STORY";
export type SeedHintType = "MEANING" | "READING" | "USAGE";
export type SeedCourseBand = "FOUNDATION" | "N5" | "N4" | "N3" | "N2";

export type StarterCourseSeed = {
  readonly course: {
    readonly slug: string;
    readonly titleRu: string;
    readonly descriptionRu: string;
    readonly targetLevel: string;
    readonly band: SeedCourseBand;
    readonly levels: readonly StarterCourseSeedLevel[];
  };
  readonly demoUser: {
    readonly email: string;
    readonly displayName: string;
    readonly enrollInCourseSlug: string;
  };
  readonly items: readonly StarterCourseSeedItem[];
};

export type StarterCourseSeedLevel = {
  readonly levelNumber: number;
  readonly band: SeedCourseBand;
  readonly titleRu: string;
  readonly descriptionRu: string;
  readonly passPolicy: CourseLevelPassPolicy;
};

export type StarterCourseSeedItem = {
  readonly key: string;
  readonly kind: SeedItemKind;
  readonly title: string;
  readonly band: SeedCourseBand;
  readonly levelNumber: number;
  readonly sortOrder: number;
  readonly target: StarterCourseSeedTarget;
  readonly cards: readonly StarterCourseSeedCard[];
  readonly dependencies?: readonly StarterCourseSeedDependency[];
  readonly mnemonics?: readonly StarterCourseSeedText[];
  readonly hints?: readonly StarterCourseSeedText[];
};

export type StarterCourseSeedTarget =
  | {
      readonly kind: "COMPONENT";
      readonly symbol: string;
      readonly displayNameRu: string;
      readonly displayNameEn: string;
      readonly shapeDescriptionRu: string;
      readonly shapeDescriptionEn: string;
      readonly meaningRu: string;
      readonly meaningEn: string;
      readonly notes: string;
    }
  | {
      readonly kind: "KANJI";
      readonly character: string;
      readonly strokeCount: number;
      readonly jlptLevel: number;
      readonly components: readonly { readonly componentKey: string; readonly position: string }[];
      readonly readings: readonly {
        readonly reading: string;
        readonly readingType: "ONYOMI" | "KUNYOMI" | "NANORI" | "OTHER";
        readonly priority: number;
      }[];
      readonly meanings: readonly StarterCourseSeedMeaning[];
    }
  | {
      readonly kind: "WORD";
      readonly expression: string;
      readonly reading: string;
      readonly jlptLevel: number;
      readonly senses: readonly StarterCourseSeedSense[];
    }
  | {
      readonly kind: "SENTENCE";
      readonly japaneseText: string;
      readonly readingText: string;
      readonly translationRu: string;
      readonly translationEn: string;
      readonly difficulty: number;
    };

export type StarterCourseSeedMeaning = {
  readonly locale: SeedLocale;
  readonly text: string;
  readonly isPrimary: boolean;
};

export type StarterCourseSeedSense = {
  readonly locale: SeedLocale;
  readonly meaning: string;
  readonly partOfSpeech: string;
};

export type StarterCourseSeedCard = {
  readonly promptType: SeedPromptType;
  readonly answerType: SeedAnswerType;
  readonly sortOrder: number;
  readonly acceptedAnswers: readonly StarterCourseSeedAnswer[];
  readonly blockedAnswers?: readonly StarterCourseSeedBlockedAnswer[];
};

export type StarterCourseSeedAnswer = {
  readonly locale: SeedLocale;
  readonly text: string;
  readonly normalizedText: string;
  readonly answerKind: SeedAnswerType;
  readonly isPrimary: boolean;
};

export type StarterCourseSeedBlockedAnswer = {
  readonly text: string;
  readonly normalizedText: string;
  readonly reason: string;
};

export type StarterCourseSeedDependency = {
  readonly prerequisiteKey: string;
  readonly requiredStage: number;
};

export type StarterCourseSeedText = {
  readonly locale: SeedLocale;
  readonly type: SeedMnemonicType | SeedHintType;
  readonly body: string;
};

const STARTER_COURSE_SEED: StarterCourseSeed = {
  course: {
    slug: "starter-demo",
    titleRu: "Стартовый демо-курс",
    descriptionRu:
      "Небольшой авторский курс для проверки уроков, повторений и связей компонентов, кандзи, слов и предложений.",
    targetLevel: "N5",
    band: "FOUNDATION",
    levels: [
      {
        levelNumber: 1,
        band: "FOUNDATION",
        passPolicy: createCourseLevelPassPolicy("COMPONENT", 100),
        titleRu: "Первые формы",
        descriptionRu: "Две простые формы, из которых можно объяснить первые знаки.",
      },
      {
        levelNumber: 2,
        band: "FOUNDATION",
        passPolicy: createCourseLevelPassPolicy("KANJI", 100),
        titleRu: "Первые кандзи",
        descriptionRu: "Кандзи для числа один и слова рот.",
      },
      {
        levelNumber: 3,
        band: "N5",
        passPolicy: createCourseLevelPassPolicy("WORD", 100),
        titleRu: "Первые слова",
        descriptionRu: "Короткие слова, основанные на уже изученных кандзи.",
      },
      {
        levelNumber: 4,
        band: "N5",
        passPolicy: createCourseLevelPassPolicy("SENTENCE", 100),
        titleRu: "Первое предложение",
        descriptionRu: "Минимальная фраза для проверки карточки предложения.",
      },
    ],
  },
  demoUser: {
    email: "demo@example.local",
    displayName: "Demo",
    enrollInCourseSlug: "starter-demo",
  },
  items: [
    {
      key: "component-one-stroke",
      kind: "COMPONENT",
      title: "Компонент 一",
      band: "FOUNDATION",
      levelNumber: 1,
      sortOrder: 1,
      target: {
        kind: "COMPONENT",
        symbol: "一",
        displayNameRu: "единица",
        displayNameEn: "one",
        shapeDescriptionRu: "горизонтальная черта",
        shapeDescriptionEn: "horizontal stroke",
        meaningRu: "один",
        meaningEn: "one",
        notes: "Project-authored starter component.",
      },
      cards: [
        {
          promptType: "MEANING",
          answerType: "MEANING",
          sortOrder: 1,
          acceptedAnswers: [
            ruAnswer("единица", "единица", true),
            ruAnswer("один", "один", false),
            enAnswer("one", "one", true),
            enAnswer("unit", "unit", false),
          ],
          blockedAnswers: [
            {
              text: "одна черта",
              normalizedText: "одна черта",
              reason: "Это описание формы, а не значение компонента.",
            },
          ],
        },
      ],
      mnemonics: [
        ruText("STORY", "Одна горизонтальная черта обозначает одну целую единицу."),
        enText("STORY", "One horizontal stroke represents one whole unit."),
      ],
      hints: [
        ruText("MEANING", "Отвечай значением: единица или один. Черта описывает только форму."),
        enText("MEANING", "Answer with one or unit. Stroke only describes the shape."),
      ],
    },
    {
      key: "component-mouth-frame",
      kind: "COMPONENT",
      title: "Компонент 口",
      band: "FOUNDATION",
      levelNumber: 1,
      sortOrder: 2,
      target: {
        kind: "COMPONENT",
        symbol: "口",
        displayNameRu: "рот",
        displayNameEn: "mouth",
        shapeDescriptionRu: "прямоугольная рамка",
        shapeDescriptionEn: "rectangular frame",
        meaningRu: "рот",
        meaningEn: "mouth",
        notes: "Project-authored starter component.",
      },
      cards: [
        {
          promptType: "MEANING",
          answerType: "MEANING",
          sortOrder: 1,
          acceptedAnswers: [ruAnswer("рот", "рот", true), enAnswer("mouth", "mouth", true)],
          blockedAnswers: [
            {
              text: "отверстие",
              normalizedText: "отверстие",
              reason: "Это не значение компонента 口; правильное базовое значение - рот.",
            },
          ],
        },
      ],
      mnemonics: [
        ruText("STORY", "Прямоугольная рамка напоминает открытый рот."),
        enText("STORY", "The rectangular frame resembles an open mouth."),
      ],
    },
    {
      key: "kanji-one",
      kind: "KANJI",
      title: "Кандзи 一",
      band: "FOUNDATION",
      levelNumber: 2,
      sortOrder: 1,
      target: {
        kind: "KANJI",
        character: "一",
        strokeCount: 1,
        jlptLevel: 5,
        components: [{ componentKey: "component-one-stroke", position: "full" }],
        readings: [
          { reading: "いち", readingType: "ONYOMI", priority: 10 },
          { reading: "ひと", readingType: "KUNYOMI", priority: 5 },
        ],
        meanings: [
          { locale: "ru-RU", text: "один", isPrimary: true },
          { locale: "ru-RU", text: "единица", isPrimary: false },
          { locale: "en-US", text: "one", isPrimary: true },
          { locale: "en-US", text: "unit", isPrimary: false },
        ],
      },
      dependencies: [{ prerequisiteKey: "component-one-stroke", requiredStage: 1 }],
      cards: [
        meaningCard(
          [
            ruAnswer("один", "один", true),
            ruAnswer("единица", "единица", false),
            enAnswer("one", "one", true),
            enAnswer("unit", "unit", false),
          ],
          [
            {
              text: "черта",
              normalizedText: "черта",
              reason: "Это компонентный образ, а значение кандзи - число один.",
            },
          ],
        ),
        readingCard([readingAnswer("いち", "いち", true), readingAnswer("ひと", "ひと", false)]),
      ],
      mnemonics: [
        ruText("MEANING", "Одна черта здесь стала самостоятельным числом один."),
        enText("MEANING", "The single stroke becomes the number one."),
      ],
      hints: [ruText("READING", "Для счета чаще всего начни с чтения いち.")],
    },
    {
      key: "kanji-mouth",
      kind: "KANJI",
      title: "Кандзи 口",
      band: "FOUNDATION",
      levelNumber: 2,
      sortOrder: 2,
      target: {
        kind: "KANJI",
        character: "口",
        strokeCount: 3,
        jlptLevel: 5,
        components: [{ componentKey: "component-mouth-frame", position: "full" }],
        readings: [{ reading: "くち", readingType: "KUNYOMI", priority: 10 }],
        meanings: [
          { locale: "ru-RU", text: "рот", isPrimary: true },
          { locale: "en-US", text: "mouth", isPrimary: true },
        ],
      },
      dependencies: [{ prerequisiteKey: "component-mouth-frame", requiredStage: 1 }],
      cards: [
        meaningCard([ruAnswer("рот", "рот", true), enAnswer("mouth", "mouth", true)]),
        readingCard([readingAnswer("くち", "くち", true)]),
      ],
      mnemonics: [
        ruText("MEANING", "Рамка стала знаком рта: пространство внутри как открытый рот."),
        enText("MEANING", "The frame becomes a mouth: the empty center is the opening."),
      ],
    },
    {
      key: "word-hitotsu",
      kind: "WORD",
      title: "Слово 一つ",
      band: "N5",
      levelNumber: 3,
      sortOrder: 1,
      target: {
        kind: "WORD",
        expression: "一つ",
        reading: "ひとつ",
        jlptLevel: 5,
        senses: [
          { locale: "ru-RU", meaning: "одна вещь", partOfSpeech: "counter phrase" },
          { locale: "en-US", meaning: "one thing", partOfSpeech: "counter phrase" },
        ],
      },
      dependencies: [{ prerequisiteKey: "kanji-one", requiredStage: 2 }],
      cards: [
        meaningCard(
          [ruAnswer("одна вещь", "одна вещь", true), enAnswer("one thing", "one thing", true)],
          [
            {
              text: "один",
              normalizedText: "один",
              reason: "Для этого слова нужен предметный смысл: одна вещь.",
            },
          ],
        ),
        readingCard([readingAnswer("ひとつ", "ひとつ", true)]),
      ],
      hints: [ruText("USAGE", "Это удобное слово для просьбы об одном предмете.")],
    },
    {
      key: "word-kuchi",
      kind: "WORD",
      title: "Слово 口",
      band: "N5",
      levelNumber: 3,
      sortOrder: 2,
      target: {
        kind: "WORD",
        expression: "口",
        reading: "くち",
        jlptLevel: 5,
        senses: [
          { locale: "ru-RU", meaning: "рот", partOfSpeech: "noun" },
          { locale: "en-US", meaning: "mouth", partOfSpeech: "noun" },
        ],
      },
      dependencies: [{ prerequisiteKey: "kanji-mouth", requiredStage: 2 }],
      cards: [
        meaningCard([ruAnswer("рот", "рот", true), enAnswer("mouth", "mouth", true)]),
        readingCard([readingAnswer("くち", "くち", true)]),
      ],
    },
    {
      key: "sentence-hitotsu-kudasai",
      kind: "SENTENCE",
      title: "Предложение 一つください。",
      band: "N5",
      levelNumber: 4,
      sortOrder: 1,
      target: {
        kind: "SENTENCE",
        japaneseText: "一つください。",
        readingText: "ひとつください。",
        translationRu: "Дайте один, пожалуйста.",
        translationEn: "One, please.",
        difficulty: 1,
      },
      dependencies: [{ prerequisiteKey: "word-hitotsu", requiredStage: 1 }],
      cards: [
        {
          promptType: "RECOGNITION",
          answerType: "MEANING",
          sortOrder: 1,
          acceptedAnswers: [
            ruAnswer("дайте один пожалуйста", "дайте один пожалуйста", true),
            ruAnswer("один пожалуйста", "один пожалуйста", false),
            enAnswer("one please", "one please", true),
          ],
        },
      ],
      hints: [
        ruText("USAGE", "ください делает фразу вежливой просьбой."),
        enText("USAGE", "ください turns the phrase into a polite request."),
      ],
    },
  ],
};

export function buildStarterCourseSeed(): StarterCourseSeed {
  return STARTER_COURSE_SEED;
}

export function validateStarterCourseSeed(seed: StarterCourseSeed): readonly string[] {
  const issues: string[] = [];
  const levelNumbers = new Set(seed.course.levels.map((level) => level.levelNumber));
  const itemKeys = new Set(seed.items.map((item) => item.key));
  const itemByKey = new Map(seed.items.map((item) => [item.key, item]));

  if (seed.course.levels.length < 3 || seed.course.levels.length > 5) {
    issues.push("starter course must contain 3-5 levels");
  }

  if (seed.demoUser.enrollInCourseSlug !== seed.course.slug) {
    issues.push("demo user enrollment must target the starter course");
  }

  for (const item of seed.items) {
    if (!levelNumbers.has(item.levelNumber)) {
      issues.push(`${item.key} points to a missing level ${item.levelNumber}`);
    }

    for (const card of item.cards) {
      if (card.acceptedAnswers.length === 0) {
        issues.push(`${item.key} has a card without accepted answers`);
      }
    }

    for (const dependency of item.dependencies ?? []) {
      if (!itemKeys.has(dependency.prerequisiteKey)) {
        issues.push(`${item.key} depends on missing item ${dependency.prerequisiteKey}`);
      }

      if (dependency.requiredStage < 1) {
        issues.push(`${item.key} has a dependency with a non-positive required stage`);
      }

      const prerequisite = itemByKey.get(dependency.prerequisiteKey);

      if (prerequisite !== undefined && prerequisite.levelNumber > item.levelNumber) {
        issues.push(`${item.key} depends on a later-level item ${dependency.prerequisiteKey}`);
      }
    }

    if (item.target.kind !== item.kind) {
      issues.push(`${item.key} kind does not match its target kind`);
    }

    if (item.target.kind === "COMPONENT") {
      const requiredFields = [
        ["Russian display name", item.target.displayNameRu],
        ["English display name", item.target.displayNameEn],
        ["Russian shape description", item.target.shapeDescriptionRu],
        ["English shape description", item.target.shapeDescriptionEn],
        ["Russian meaning", item.target.meaningRu],
        ["English meaning", item.target.meaningEn],
      ] as const;

      for (const [label, value] of requiredFields) {
        if (value.trim() === "") {
          issues.push(`${item.key} component is missing its ${label.toLowerCase()}`);
        }
      }
    }
  }

  if (getInitialStarterLessonKeys(seed).length === 0) {
    issues.push("demo enrollment must expose at least one initial lesson");
  }

  return issues;
}

export function getInitialStarterLessonKeys(seed: StarterCourseSeed): readonly string[] {
  const firstLevelNumber = Math.min(...seed.course.levels.map((level) => level.levelNumber));

  return seed.items
    .filter(
      (item) =>
        item.levelNumber === firstLevelNumber &&
        item.cards.length > 0 &&
        (item.dependencies ?? []).length === 0,
    )
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => item.key);
}

function meaningCard(
  acceptedAnswers: readonly StarterCourseSeedAnswer[],
  blockedAnswers: readonly StarterCourseSeedBlockedAnswer[] = [],
): StarterCourseSeedCard {
  return {
    promptType: "MEANING",
    answerType: "MEANING",
    sortOrder: 1,
    acceptedAnswers,
    blockedAnswers,
  };
}

function readingCard(acceptedAnswers: readonly StarterCourseSeedAnswer[]): StarterCourseSeedCard {
  return {
    promptType: "READING",
    answerType: "READING",
    sortOrder: 2,
    acceptedAnswers,
  };
}

function ruAnswer(
  text: string,
  normalizedText: string,
  isPrimary: boolean,
): StarterCourseSeedAnswer {
  return { locale: "ru-RU", text, normalizedText, answerKind: "MEANING", isPrimary };
}

function enAnswer(
  text: string,
  normalizedText: string,
  isPrimary: boolean,
): StarterCourseSeedAnswer {
  return { locale: "en-US", text, normalizedText, answerKind: "MEANING", isPrimary };
}

function readingAnswer(
  text: string,
  normalizedText: string,
  isPrimary: boolean,
): StarterCourseSeedAnswer {
  return { locale: "ru-RU", text, normalizedText, answerKind: "READING", isPrimary };
}

function ruText(type: SeedMnemonicType | SeedHintType, body: string): StarterCourseSeedText {
  return { locale: "ru-RU", type, body };
}

function enText(type: SeedMnemonicType | SeedHintType, body: string): StarterCourseSeedText {
  return { locale: "en-US", type, body };
}
