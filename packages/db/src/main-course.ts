import { type SeedCourseBand } from "./course-seed";
import {
  DEFAULT_COURSE_LEVEL_PASS_POLICY,
  type CourseLevelPassPolicy,
} from "./course-level-policy";

export const MAIN_COURSE_LEVEL_COUNT = 60;

export type MainCourseLevelBlueprint = {
  readonly levelNumber: number;
  readonly band: SeedCourseBand;
  readonly titleRu: string;
  readonly descriptionRu: string;
  readonly passPolicy: CourseLevelPassPolicy;
};

export type MainCourseBlueprint = {
  readonly course: {
    readonly slug: string;
    readonly titleRu: string;
    readonly descriptionRu: string;
    readonly targetLevel: string;
    readonly band: SeedCourseBand;
  };
  readonly levels: readonly MainCourseLevelBlueprint[];
};

type CourseBandRange = {
  readonly band: SeedCourseBand;
  readonly firstLevel: number;
  readonly lastLevel: number;
  readonly labelRu: string;
  readonly descriptionRu: string;
};

const COURSE_BAND_RANGES: readonly CourseBandRange[] = [
  {
    band: "FOUNDATION",
    firstLevel: 1,
    lastLevel: 5,
    labelRu: "Основа",
    descriptionRu: "Компоненты, базовые кандзи и частотные слова для первого учебного цикла.",
  },
  {
    band: "N5",
    firstLevel: 6,
    lastLevel: 15,
    labelRu: "JLPT N5",
    descriptionRu: "Базовые кандзи, чтения и повседневная лексика уровня JLPT N5.",
  },
  {
    band: "N4",
    firstLevel: 16,
    lastLevel: 27,
    labelRu: "JLPT N4",
    descriptionRu: "Расширение бытовой лексики и устойчивых чтений уровня JLPT N4.",
  },
  {
    band: "N3",
    firstLevel: 28,
    lastLevel: 43,
    labelRu: "JLPT N3",
    descriptionRu: "Смешанные чтения, составные слова и письменная лексика уровня JLPT N3.",
  },
  {
    band: "N2",
    firstLevel: 44,
    lastLevel: 60,
    labelRu: "JLPT N2",
    descriptionRu: "Частотные письменные кандзи и лексика для чтения материалов уровня JLPT N2.",
  },
];

const MAIN_COURSE_BLUEPRINT: MainCourseBlueprint = {
  course: {
    slug: "japanese-ru-n2",
    titleRu: "Японский: кандзи и лексика до N2",
    descriptionRu:
      "Независимый русскоязычный курс с английскими учебными переводами, рассчитанный на 2 300 кандзи и 8 000 слов.",
    targetLevel: "JLPT N2",
    band: "FOUNDATION",
  },
  levels: COURSE_BAND_RANGES.flatMap((range) =>
    Array.from({ length: range.lastLevel - range.firstLevel + 1 }, (_, index) => ({
      levelNumber: range.firstLevel + index,
      band: range.band,
      passPolicy: DEFAULT_COURSE_LEVEL_PASS_POLICY,
      titleRu: `${range.labelRu} · этап ${index + 1}`,
      descriptionRu: range.descriptionRu,
    })),
  ),
};

export function buildMainCourseBlueprint(): MainCourseBlueprint {
  return MAIN_COURSE_BLUEPRINT;
}

export function validateMainCourseBlueprint(blueprint: MainCourseBlueprint): readonly string[] {
  const issues: string[] = [];

  if (blueprint.course.slug.trim() === "") {
    issues.push("main course slug is required");
  }

  if (blueprint.course.titleRu.trim() === "" || blueprint.course.descriptionRu.trim() === "") {
    issues.push("main course Russian metadata is required");
  }

  if (blueprint.course.targetLevel.trim() === "") {
    issues.push("main course target level is required");
  }

  if (blueprint.course.band !== "FOUNDATION") {
    issues.push("main course must begin in the Foundation band");
  }

  if (blueprint.levels.length !== MAIN_COURSE_LEVEL_COUNT) {
    issues.push(`main course must contain ${MAIN_COURSE_LEVEL_COUNT} levels`);
  }

  const levelNumbers = new Set<number>();

  for (const level of blueprint.levels) {
    if (levelNumbers.has(level.levelNumber)) {
      issues.push(`main course level ${level.levelNumber} is duplicated`);
    }

    levelNumbers.add(level.levelNumber);

    if (level.titleRu.trim() === "" || level.descriptionRu.trim() === "") {
      issues.push(`main course level ${level.levelNumber} is missing Russian metadata`);
    }

    const expectedBand = courseBandForLevel(level.levelNumber);

    if (expectedBand === null) {
      issues.push(`main course level ${level.levelNumber} is outside the supported range`);
    } else if (level.band !== expectedBand) {
      issues.push(
        `main course level ${level.levelNumber} must use ${expectedBand}, received ${level.band}`,
      );
    }
  }

  for (let levelNumber = 1; levelNumber <= MAIN_COURSE_LEVEL_COUNT; levelNumber += 1) {
    if (!levelNumbers.has(levelNumber)) {
      issues.push(`main course level ${levelNumber} is missing`);
    }
  }

  return issues;
}

function courseBandForLevel(levelNumber: number): SeedCourseBand | null {
  const range = COURSE_BAND_RANGES.find(
    (candidate) => levelNumber >= candidate.firstLevel && levelNumber <= candidate.lastLevel,
  );

  return range?.band ?? null;
}
