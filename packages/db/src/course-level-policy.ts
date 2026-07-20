export const COURSE_LEVEL_PASS_POLICY_VERSION = 1;
export const DEFAULT_COURSE_LEVEL_PASS_STAGE_INDEX = 5;
export const DEFAULT_COURSE_LEVEL_REQUIRED_PERCENTAGE = 90;

export const COURSE_LEVEL_PASS_ITEM_KINDS = ["COMPONENT", "KANJI", "WORD", "SENTENCE"] as const;

export type CourseLevelPassItemKind = (typeof COURSE_LEVEL_PASS_ITEM_KINDS)[number];

export type CourseLevelPassPolicy = {
  readonly version: typeof COURSE_LEVEL_PASS_POLICY_VERSION;
  readonly itemKind: CourseLevelPassItemKind;
  readonly passStageIndex: number;
  readonly requiredPercentage: number;
};

export const DEFAULT_COURSE_LEVEL_PASS_POLICY: CourseLevelPassPolicy = {
  version: COURSE_LEVEL_PASS_POLICY_VERSION,
  itemKind: "KANJI",
  passStageIndex: DEFAULT_COURSE_LEVEL_PASS_STAGE_INDEX,
  requiredPercentage: DEFAULT_COURSE_LEVEL_REQUIRED_PERCENTAGE,
};

export function createCourseLevelPassPolicy(
  itemKind: CourseLevelPassItemKind,
  requiredPercentage = DEFAULT_COURSE_LEVEL_REQUIRED_PERCENTAGE,
  passStageIndex = DEFAULT_COURSE_LEVEL_PASS_STAGE_INDEX,
): CourseLevelPassPolicy {
  return {
    version: COURSE_LEVEL_PASS_POLICY_VERSION,
    itemKind,
    passStageIndex,
    requiredPercentage,
  };
}

export function parseCourseLevelPassPolicy(value: unknown): CourseLevelPassPolicy {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_COURSE_LEVEL_PASS_POLICY;
  }

  const candidate = value as Record<string, unknown>;
  const itemKind = candidate.itemKind;
  const passStageIndex = candidate.passStageIndex;
  const requiredPercentage = candidate.requiredPercentage;

  if (
    candidate.version !== COURSE_LEVEL_PASS_POLICY_VERSION ||
    !isCourseLevelPassItemKind(itemKind) ||
    !Number.isInteger(passStageIndex) ||
    (passStageIndex as number) < 1 ||
    !Number.isInteger(requiredPercentage) ||
    (requiredPercentage as number) < 1 ||
    (requiredPercentage as number) > 100
  ) {
    return DEFAULT_COURSE_LEVEL_PASS_POLICY;
  }

  return {
    version: COURSE_LEVEL_PASS_POLICY_VERSION,
    itemKind,
    passStageIndex: passStageIndex as number,
    requiredPercentage: requiredPercentage as number,
  };
}

function isCourseLevelPassItemKind(value: unknown): value is CourseLevelPassItemKind {
  return (
    typeof value === "string" && (COURSE_LEVEL_PASS_ITEM_KINDS as readonly string[]).includes(value)
  );
}
