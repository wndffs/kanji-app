import { createHash } from "node:crypto";

import { buildMainCourseBlueprint } from "@kanji-srs/db";
import {
  type AdminContentStatus,
  type AdminMainCoursePublicationReadinessResponse,
  type AdminMainCourseReadinessCheckDto,
  type CourseBand,
  CURRICULUM_SCALE_TARGETS,
} from "@kanji-srs/shared";

export const MAIN_COURSE_PUBLICATION_READINESS_POLICY_VERSION =
  "main-course-publication-readiness-v1" as const;

export type MainCoursePublicationReadinessInput = {
  readonly course: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly description: string | null;
    readonly targetLevel: string | null;
    readonly band: CourseBand;
    readonly courseType: "structured" | "demo" | "dynamic";
    readonly status: AdminContentStatus;
  };
  readonly levels: readonly {
    readonly levelNumber: number;
    readonly band: CourseBand;
    readonly title: string;
    readonly description: string | null;
    readonly publishedItems: number;
  }[];
  readonly allocation: {
    readonly planVersion: string;
    readonly publishedItems: number;
    readonly existingPlacements: number;
    readonly proposedPlacements: number;
    readonly blockedItems: number;
    readonly issueCount: number;
  };
  readonly stalePlacements: number;
  readonly placedKanji: number;
  readonly placedWords: number;
  readonly initialLessonItems: number;
};

export function buildMainCoursePublicationReadiness(
  input: MainCoursePublicationReadinessInput,
  now = new Date(),
): AdminMainCoursePublicationReadinessResponse {
  const blueprintIssues = findBlueprintIssues(input);
  const populatedLevels = input.levels.filter((level) => level.publishedItems > 0).length;
  const checks: readonly AdminMainCourseReadinessCheckDto[] = [
    check({
      code: "course-state",
      title: "Состояние курса",
      passed: input.course.courseType === "structured" && input.course.status !== "archived",
      message:
        input.course.courseType === "structured" && input.course.status !== "archived"
          ? "Основной курс имеет тип structured и доступен для редакторской подготовки."
          : "Основной курс должен иметь тип structured и не находиться в архиве.",
    }),
    check({
      code: "course-blueprint",
      title: "Blueprint 60 уровней",
      passed: blueprintIssues.length === 0,
      current: input.levels.length,
      required: buildMainCourseBlueprint().levels.length,
      message:
        blueprintIssues.length === 0
          ? "Метаданные, номера, диапазоны и band уровней соответствуют blueprint."
          : `Blueprint требует исправлений: ${blueprintIssues.slice(0, 3).join("; ")}.`,
    }),
    check({
      code: "allocation-complete",
      title: "Распределение завершено",
      passed:
        input.allocation.proposedPlacements === 0 &&
        input.allocation.blockedItems === 0 &&
        input.allocation.issueCount === 0 &&
        input.allocation.existingPlacements === input.allocation.publishedItems,
      current: input.allocation.existingPlacements,
      required: input.allocation.publishedItems,
      message:
        input.allocation.proposedPlacements === 0 &&
        input.allocation.blockedItems === 0 &&
        input.allocation.issueCount === 0 &&
        input.allocation.existingPlacements === input.allocation.publishedItems
          ? "Все опубликованные материалы закреплены без конфликтов."
          : `Осталось предложений: ${input.allocation.proposedPlacements}; заблокировано: ${input.allocation.blockedItems}; конфликтов: ${input.allocation.issueCount}.`,
    }),
    check({
      code: "published-placements-only",
      title: "Только опубликованные материалы",
      passed: input.stalePlacements === 0,
      current: input.stalePlacements,
      required: 0,
      message:
        input.stalePlacements === 0
          ? "В уровнях нет черновых, архивных или ожидающих проверки материалов."
          : `Удалите или опубликуйте неактивные размещения: ${input.stalePlacements}.`,
    }),
    check({
      code: "levels-populated",
      title: "Заполнены все уровни",
      passed: populatedLevels === input.levels.length && input.levels.length > 0,
      current: populatedLevels,
      required: input.levels.length,
      message:
        populatedLevels === input.levels.length && input.levels.length > 0
          ? "В каждом уровне есть хотя бы один опубликованный материал."
          : `Заполнено уровней: ${populatedLevels} из ${input.levels.length}.`,
    }),
    check({
      code: "initial-lesson",
      title: "Доступен первый урок",
      passed: input.initialLessonItems > 0,
      current: input.initialLessonItems,
      required: 1,
      message:
        input.initialLessonItems > 0
          ? "На первом уровне есть материал с карточкой без prerequisites."
          : "Добавьте на первый уровень опубликованный материал с карточкой без prerequisites.",
    }),
    check({
      code: "kanji-target",
      title: "Цель по кандзи",
      passed: input.placedKanji >= CURRICULUM_SCALE_TARGETS.kanji,
      current: input.placedKanji,
      required: CURRICULUM_SCALE_TARGETS.kanji,
      message: `В основном курсе размещено кандзи: ${input.placedKanji} из ${CURRICULUM_SCALE_TARGETS.kanji}.`,
    }),
    check({
      code: "word-target",
      title: "Цель по словам",
      passed: input.placedWords >= CURRICULUM_SCALE_TARGETS.word,
      current: input.placedWords,
      required: CURRICULUM_SCALE_TARGETS.word,
      message: `В основном курсе размещено слов: ${input.placedWords} из ${CURRICULUM_SCALE_TARGETS.word}.`,
    }),
  ];
  const passedChecks = checks.filter((candidate) => candidate.passed).length;

  return {
    policyVersion: MAIN_COURSE_PUBLICATION_READINESS_POLICY_VERSION,
    readinessVersion: buildReadinessVersion(input, checks),
    allocationPlanVersion: input.allocation.planVersion,
    generatedAt: now.toISOString(),
    readyToPublish: passedChecks === checks.length,
    course: {
      id: input.course.id,
      slug: input.course.slug,
      title: input.course.title,
      status: input.course.status,
    },
    summary: {
      passedChecks,
      blockedChecks: checks.length - passedChecks,
    },
    checks,
  };
}

function findBlueprintIssues(input: MainCoursePublicationReadinessInput): readonly string[] {
  const expected = buildMainCourseBlueprint();
  const issues: string[] = [];

  if (
    input.course.slug !== expected.course.slug ||
    input.course.title !== expected.course.titleRu ||
    input.course.description !== expected.course.descriptionRu ||
    input.course.targetLevel !== expected.course.targetLevel ||
    input.course.band !== toApiBand(expected.course.band)
  ) {
    issues.push("метаданные курса отличаются");
  }

  if (input.levels.length !== expected.levels.length) {
    issues.push(`ожидалось уровней ${expected.levels.length}, получено ${input.levels.length}`);
  }

  const levelByNumber = new Map(input.levels.map((level) => [level.levelNumber, level]));

  for (const expectedLevel of expected.levels) {
    const level = levelByNumber.get(expectedLevel.levelNumber);

    if (level === undefined) {
      issues.push(`нет уровня ${expectedLevel.levelNumber}`);
      continue;
    }

    if (
      level.band !== toApiBand(expectedLevel.band) ||
      level.title !== expectedLevel.titleRu ||
      level.description !== expectedLevel.descriptionRu
    ) {
      issues.push(`уровень ${expectedLevel.levelNumber} отличается`);
    }
  }

  return issues;
}

function buildReadinessVersion(
  input: MainCoursePublicationReadinessInput,
  checks: readonly AdminMainCourseReadinessCheckDto[],
): string {
  const payload = {
    policyVersion: MAIN_COURSE_PUBLICATION_READINESS_POLICY_VERSION,
    course: input.course,
    levels: [...input.levels].sort((left, right) => left.levelNumber - right.levelNumber),
    allocation: input.allocation,
    stalePlacements: input.stalePlacements,
    placedKanji: input.placedKanji,
    placedWords: input.placedWords,
    initialLessonItems: input.initialLessonItems,
    checks: checks.map(({ code, passed, current, required }) => ({
      code,
      passed,
      current,
      required,
    })),
  };
  const checksum = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

  return `main-course-readiness:${checksum}`;
}

function check(
  value: Omit<AdminMainCourseReadinessCheckDto, "current" | "required"> &
    Partial<Pick<AdminMainCourseReadinessCheckDto, "current" | "required">>,
): AdminMainCourseReadinessCheckDto {
  return {
    ...value,
    current: value.current ?? null,
    required: value.required ?? null,
  };
}

function toApiBand(band: string): CourseBand {
  return band.toLowerCase() as CourseBand;
}
