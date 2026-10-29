import { createCourseLevelPassPolicy } from "./course-level-policy";

export const FOUNDATION_WAVE07_LEVELS = [
  {
    levelNumber: 8,
    descriptionRu: "Компоненты для темы школы и семьи.",
    passPolicyJson: createCourseLevelPassPolicy("COMPONENT"),
  },
  {
    levelNumber: 9,
    descriptionRu: "Кандзи школы и семьи с отдельными карточками значения и чтения.",
    passPolicyJson: createCourseLevelPassPolicy("KANJI"),
  },
  {
    levelNumber: 10,
    descriptionRu: "Слова школы и семьи, чтения целых слов и оригинальные примеры.",
    passPolicyJson: createCourseLevelPassPolicy("WORD"),
  },
] as const;
