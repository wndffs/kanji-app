export const SRS_PACKAGE_NAME = "@kanji-srs/srs";

export type DateInput = Date | string | number;

export type ReviewResult = "correct" | "wrong" | "typo" | "reveal" | "manual-ignore" | "resurrect";

export type ReviewResultType = ReviewResult;

export type ForecastGranularity = "hour" | "day";

export type TypoBehavior = "stay" | "advance";

export type ResurrectAvailability = "now" | "stage-interval";

export type SrsStage = {
  readonly stageIndex: number;
  readonly name: string;
  readonly intervalMinutes: number | null;
  readonly isBurned?: boolean;
};

export type SrsSchedulingRules = {
  readonly earlyWrongDemotionStages: number;
  readonly lateWrongDemotionStages: number;
  readonly lateWrongStageIndex: number;
  readonly minimumStageIndex: number;
  readonly reviewFloorStageIndex: number;
  readonly resurrectStageIndex: number;
  readonly typoBehavior: TypoBehavior;
  readonly resurrectAvailability: ResurrectAvailability;
};

export type SrsStageConfig = {
  readonly stages: readonly SrsStage[];
  readonly rules?: Partial<SrsSchedulingRules>;
};

export type UserSrsStateSnapshot = {
  readonly id?: string;
  readonly learningCardId?: string;
  readonly stageIndex: number;
  readonly availableAt: DateInput | null;
  readonly burnedAt?: DateInput | null;
  readonly resurrectedAt?: DateInput | null;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly lastReviewedAt?: DateInput | null;
};

export type ScheduledUserSrsStateSnapshot = {
  readonly id?: string;
  readonly learningCardId?: string;
  readonly stageIndex: number;
  readonly availableAt: Date | null;
  readonly burnedAt: Date | null;
  readonly resurrectedAt: Date | null;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly lastReviewedAt: Date | null;
};

export type SchedulingInput = {
  readonly state: UserSrsStateSnapshot;
  readonly result: ReviewResult;
  readonly now: DateInput;
  readonly stageConfig?: SrsStageConfig;
};

export type SchedulingResult = {
  readonly result: ReviewResult;
  readonly previousStage: SrsStage;
  readonly nextStage: SrsStage;
  readonly previousState: ScheduledUserSrsStateSnapshot;
  readonly nextState: ScheduledUserSrsStateSnapshot;
  readonly nextAvailableAt: Date | null;
  readonly burned: boolean;
  readonly penaltyApplied: number;
  readonly changed: boolean;
  readonly details: {
    readonly action: "advanced" | "demoted" | "stayed" | "ignored" | "burned" | "resurrected";
    readonly intervalMinutes: number | null;
    readonly wrongCountDelta: number;
    readonly correctStreakDelta: number;
    readonly reason?: string;
  };
};

export type ResurrectCardInput = {
  readonly state: UserSrsStateSnapshot;
  readonly now: DateInput;
  readonly stageConfig?: SrsStageConfig;
  readonly targetStageIndex?: number;
  readonly availability?: ResurrectAvailability;
};

export type ForecastableSrsState = Pick<
  UserSrsStateSnapshot,
  "id" | "learningCardId" | "stageIndex" | "availableAt" | "burnedAt"
>;

export type ReviewForecastInput = {
  readonly states: readonly ForecastableSrsState[];
  readonly now: DateInput;
  readonly timezone?: string;
  readonly granularity?: ForecastGranularity;
  readonly horizonDays?: number;
  readonly includeOverdue?: boolean;
  readonly stageConfig?: SrsStageConfig;
};

export type ReviewForecastBucket = {
  readonly granularity: ForecastGranularity;
  readonly bucketKey: string;
  readonly localDate: string;
  readonly localHour: number | null;
  readonly dueCount: number;
  readonly stateIds: readonly string[];
  readonly learningCardIds: readonly string[];
  readonly firstDueAt: Date;
  readonly lastDueAt: Date;
};

export type LeechScoreReason =
  | "wrong-count"
  | "recent-wrong"
  | "stage-instability"
  | "correct-streak-relief"
  | "burned";

export type LeechScoreRules = {
  readonly wrongCountWeight: number;
  readonly recentWrongWeight: number;
  readonly stageDropWeight: number;
  readonly stageDropMagnitudeWeight: number;
  readonly correctStreakRelief: number;
  readonly candidateThreshold: number;
  readonly maximumScore: number;
};

export type LeechScoreInput = {
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly burnedAt?: DateInput | null;
  readonly recentWrongCount?: number;
  readonly stageDropCount?: number;
  readonly stageDropMagnitude?: number;
  readonly rules?: Partial<LeechScoreRules>;
};

export type LeechScoreResult = {
  readonly score: number;
  readonly isCandidate: boolean;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly recentWrongCount: number;
  readonly stageDropCount: number;
  readonly stageDropMagnitude: number;
  readonly reasons: readonly LeechScoreReason[];
};

export type ResolvedSrsStageConfig = {
  readonly stages: readonly SrsStage[];
  readonly rules: SrsSchedulingRules;
};

type LocalDateTimeParts = {
  readonly year: string;
  readonly month: string;
  readonly day: string;
  readonly hour: string;
};

type MutableForecastBucket = {
  granularity: ForecastGranularity;
  bucketKey: string;
  localDate: string;
  localHour: number | null;
  dueCount: number;
  stateIds: string[];
  learningCardIds: string[];
  firstDueAt: Date;
  lastDueAt: Date;
};

const MINUTES_IN_DAY = 24 * 60;

export const DEFAULT_SRS_STAGES = [
  { stageIndex: 1, name: "Apprentice 1", intervalMinutes: 4 * 60, isBurned: false },
  { stageIndex: 2, name: "Apprentice 2", intervalMinutes: 8 * 60, isBurned: false },
  { stageIndex: 3, name: "Apprentice 3", intervalMinutes: MINUTES_IN_DAY, isBurned: false },
  { stageIndex: 4, name: "Apprentice 4", intervalMinutes: 2 * MINUTES_IN_DAY, isBurned: false },
  { stageIndex: 5, name: "Guru 1", intervalMinutes: 7 * MINUTES_IN_DAY, isBurned: false },
  { stageIndex: 6, name: "Guru 2", intervalMinutes: 14 * MINUTES_IN_DAY, isBurned: false },
  { stageIndex: 7, name: "Master", intervalMinutes: 30 * MINUTES_IN_DAY, isBurned: false },
  { stageIndex: 8, name: "Enlightened", intervalMinutes: 120 * MINUTES_IN_DAY, isBurned: false },
  { stageIndex: 9, name: "Burned", intervalMinutes: null, isBurned: true },
] as const satisfies readonly SrsStage[];

export const DEFAULT_SRS_RULES = {
  earlyWrongDemotionStages: 1,
  lateWrongDemotionStages: 2,
  lateWrongStageIndex: 5,
  minimumStageIndex: 1,
  reviewFloorStageIndex: 1,
  resurrectStageIndex: 5,
  typoBehavior: "stay",
  resurrectAvailability: "now",
} as const satisfies SrsSchedulingRules;

export const DEFAULT_SRS_STAGE_CONFIG = {
  stages: DEFAULT_SRS_STAGES,
  rules: DEFAULT_SRS_RULES,
} as const satisfies SrsStageConfig;

export const DEFAULT_LEECH_SCORE_RULES = {
  wrongCountWeight: 2,
  recentWrongWeight: 4,
  stageDropWeight: 3,
  stageDropMagnitudeWeight: 1,
  correctStreakRelief: 2,
  candidateThreshold: 12,
  maximumScore: 100,
} as const satisfies LeechScoreRules;

export type SchedulingPackageStatus = {
  packageName: typeof SRS_PACKAGE_NAME;
  implemented: true;
};

export const schedulingPackageStatus: SchedulingPackageStatus = {
  packageName: SRS_PACKAGE_NAME,
  implemented: true,
};

export function createSrsStageConfig(config?: SrsStageConfig): ResolvedSrsStageConfig {
  return resolveStageConfig(config);
}

export function calculateNextReview(input: SchedulingInput): SchedulingResult {
  if (input.result === "resurrect") {
    return resurrectCard(input);
  }

  const config = resolveStageConfig(input.stageConfig);
  const now = toDate(input.now, "now");
  const previousState = normalizeState(input.state);
  const previousStage = getStage(config.stages, previousState.stageIndex);

  if (isBurnedState(previousState, previousStage)) {
    const nextState = {
      ...previousState,
      availableAt: null,
    };

    return buildResult({
      result: input.result,
      previousStage,
      nextStage: previousStage,
      previousState,
      nextState,
      penaltyApplied: 0,
      action: "burned",
      reason: "burned-card-unchanged",
      intervalMinutes: null,
    });
  }

  if (input.result === "manual-ignore") {
    return buildResult({
      result: input.result,
      previousStage,
      nextStage: previousStage,
      previousState,
      nextState: previousState,
      penaltyApplied: 0,
      action: "ignored",
      reason: "manual-ignore-no-scheduling-change",
      intervalMinutes: previousStage.intervalMinutes,
    });
  }

  const transition = getStageTransition(input.result, previousStage.stageIndex, config);
  const nextStage = getStage(config.stages, transition.nextStageIndex);
  const nextAvailableAt = getNextAvailableAt(nextStage, now);
  const burnedAt = nextStage.isBurned ? now : null;
  const isWrongLike = input.result === "wrong" || input.result === "reveal";
  const isCorrectLike = input.result === "correct" || input.result === "typo";
  const nextState: ScheduledUserSrsStateSnapshot = {
    ...previousState,
    stageIndex: nextStage.stageIndex,
    availableAt: nextAvailableAt,
    burnedAt,
    wrongCount: previousState.wrongCount + (isWrongLike ? 1 : 0),
    correctStreak: isWrongLike ? 0 : previousState.correctStreak + (isCorrectLike ? 1 : 0),
    lastReviewedAt: now,
  };

  return buildResult({
    result: input.result,
    previousStage,
    nextStage,
    previousState,
    nextState,
    penaltyApplied: transition.penaltyApplied,
    action: nextStage.isBurned ? "burned" : transition.action,
    reason: transition.reason,
    intervalMinutes: nextStage.intervalMinutes,
  });
}

export function resurrectCard(input: ResurrectCardInput): SchedulingResult {
  const config = resolveStageConfig(input.stageConfig);
  const now = toDate(input.now, "now");
  const previousState = normalizeState(input.state);
  const previousStage = getStage(config.stages, previousState.stageIndex);
  const targetStageIndex = input.targetStageIndex ?? config.rules.resurrectStageIndex;
  const targetStage = getStage(config.stages, targetStageIndex);

  if (targetStage.isBurned) {
    throw new Error("Resurrection target stage must not be a burned stage.");
  }

  const availability = input.availability ?? config.rules.resurrectAvailability;
  const availableAt = availability === "now" ? now : getNextAvailableAt(targetStage, now);
  const nextState: ScheduledUserSrsStateSnapshot = {
    ...previousState,
    stageIndex: targetStage.stageIndex,
    availableAt,
    burnedAt: null,
    resurrectedAt: now,
    wrongCount: 0,
    correctStreak: 0,
    lastReviewedAt: previousState.lastReviewedAt,
  };

  return buildResult({
    result: "resurrect",
    previousStage,
    nextStage: targetStage,
    previousState,
    nextState,
    penaltyApplied: 0,
    action: "resurrected",
    reason: "card-returned-to-review-queue",
    intervalMinutes: availability === "now" ? 0 : targetStage.intervalMinutes,
  });
}

export function buildReviewForecast(input: ReviewForecastInput): ReviewForecastBucket[] {
  const config = resolveStageConfig(input.stageConfig);
  const now = toDate(input.now, "now");
  const timezone = input.timezone ?? "UTC";
  const granularity = input.granularity ?? "hour";
  const horizonDays = input.horizonDays ?? 7;
  const includeOverdue = input.includeOverdue ?? true;
  const horizonEnd = addMinutes(now, horizonDays * MINUTES_IN_DAY);
  const buckets = new Map<string, MutableForecastBucket>();

  input.states.forEach((state, index) => {
    const normalizedState = normalizeForecastState(state);
    const stage = getStage(config.stages, normalizedState.stageIndex);

    if (isBurnedState(normalizedState, stage) || normalizedState.availableAt === null) {
      return;
    }

    if (normalizedState.availableAt.getTime() > horizonEnd.getTime()) {
      return;
    }

    if (!includeOverdue && normalizedState.availableAt.getTime() < now.getTime()) {
      return;
    }

    const dueAt =
      includeOverdue && normalizedState.availableAt.getTime() < now.getTime()
        ? now
        : normalizedState.availableAt;
    const parts = getLocalDateTimeParts(dueAt, timezone);
    const localDate = `${parts.year}-${parts.month}-${parts.day}`;
    const localHour = granularity === "hour" ? Number(parts.hour) : null;
    const bucketKey = granularity === "hour" ? `${localDate}T${parts.hour}:00` : localDate;
    const existing = buckets.get(bucketKey);
    const stateId = normalizedState.id ?? `state-${index}`;

    if (existing === undefined) {
      buckets.set(bucketKey, {
        granularity,
        bucketKey,
        localDate,
        localHour,
        dueCount: 1,
        stateIds: [stateId],
        learningCardIds: normalizedState.learningCardId ? [normalizedState.learningCardId] : [],
        firstDueAt: dueAt,
        lastDueAt: dueAt,
      });
      return;
    }

    existing.dueCount += 1;
    existing.stateIds.push(stateId);

    if (normalizedState.learningCardId) {
      existing.learningCardIds.push(normalizedState.learningCardId);
    }

    if (dueAt.getTime() < existing.firstDueAt.getTime()) {
      existing.firstDueAt = dueAt;
    }

    if (dueAt.getTime() > existing.lastDueAt.getTime()) {
      existing.lastDueAt = dueAt;
    }
  });

  return Array.from(buckets.values())
    .sort((left, right) => left.bucketKey.localeCompare(right.bucketKey))
    .map((bucket) => ({
      granularity: bucket.granularity,
      bucketKey: bucket.bucketKey,
      localDate: bucket.localDate,
      localHour: bucket.localHour,
      dueCount: bucket.dueCount,
      stateIds: bucket.stateIds,
      learningCardIds: bucket.learningCardIds,
      firstDueAt: cloneDate(bucket.firstDueAt),
      lastDueAt: cloneDate(bucket.lastDueAt),
    }));
}

export function calculateLeechScore(input: LeechScoreInput): LeechScoreResult {
  const rules = {
    ...DEFAULT_LEECH_SCORE_RULES,
    ...input.rules,
  };
  validateLeechRules(rules);

  const wrongCount = normalizeMetric(input.wrongCount, "wrongCount");
  const correctStreak = normalizeMetric(input.correctStreak, "correctStreak");
  const recentWrongCount = normalizeMetric(input.recentWrongCount ?? 0, "recentWrongCount");
  const stageDropCount = normalizeMetric(input.stageDropCount ?? 0, "stageDropCount");
  const stageDropMagnitude = normalizeMetric(input.stageDropMagnitude ?? 0, "stageDropMagnitude");
  const isBurned =
    input.burnedAt !== undefined && input.burnedAt !== null
      ? !Number.isNaN(toDate(input.burnedAt, "burnedAt").getTime())
      : false;
  const rawScore =
    wrongCount * rules.wrongCountWeight +
    recentWrongCount * rules.recentWrongWeight +
    stageDropCount * rules.stageDropWeight +
    stageDropMagnitude * rules.stageDropMagnitudeWeight -
    correctStreak * rules.correctStreakRelief;
  const score = isBurned ? 0 : Math.max(0, Math.min(rules.maximumScore, Math.round(rawScore)));
  const reasons: LeechScoreReason[] = [];

  if (isBurned) {
    reasons.push("burned");
  }

  if (wrongCount > 0) {
    reasons.push("wrong-count");
  }

  if (recentWrongCount > 0) {
    reasons.push("recent-wrong");
  }

  if (stageDropCount > 0 || stageDropMagnitude > 0) {
    reasons.push("stage-instability");
  }

  if (correctStreak > 0) {
    reasons.push("correct-streak-relief");
  }

  return {
    score,
    isCandidate: !isBurned && score >= rules.candidateThreshold,
    wrongCount,
    correctStreak,
    recentWrongCount,
    stageDropCount,
    stageDropMagnitude,
    reasons,
  };
}

function resolveStageConfig(config?: SrsStageConfig): ResolvedSrsStageConfig {
  const stages = [...(config?.stages ?? DEFAULT_SRS_STAGES)].sort(
    (left, right) => left.stageIndex - right.stageIndex,
  );

  validateStages(stages);

  const rules = {
    ...DEFAULT_SRS_RULES,
    ...config?.rules,
  };

  validateRules(rules, stages);

  return { stages, rules };
}

function validateLeechRules(rules: LeechScoreRules): void {
  for (const [name, value] of [
    ["wrongCountWeight", rules.wrongCountWeight],
    ["recentWrongWeight", rules.recentWrongWeight],
    ["stageDropWeight", rules.stageDropWeight],
    ["stageDropMagnitudeWeight", rules.stageDropMagnitudeWeight],
    ["correctStreakRelief", rules.correctStreakRelief],
    ["candidateThreshold", rules.candidateThreshold],
    ["maximumScore", rules.maximumScore],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Leech score rule ${name} must be a non-negative number.`);
    }
  }

  if (rules.candidateThreshold > rules.maximumScore) {
    throw new Error("Leech score candidateThreshold must not exceed maximumScore.");
  }
}

function normalizeMetric(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Leech score metric ${name} must be a non-negative number.`);
  }

  return Math.floor(value);
}

function validateStages(stages: readonly SrsStage[]): void {
  if (stages.length === 0) {
    throw new Error("At least one SRS stage is required.");
  }

  const stageIndexes = new Set<number>();

  for (const stage of stages) {
    if (!Number.isInteger(stage.stageIndex) || stage.stageIndex <= 0) {
      throw new Error(`Invalid SRS stage index: ${stage.stageIndex}.`);
    }

    if (stageIndexes.has(stage.stageIndex)) {
      throw new Error(`Duplicate SRS stage index: ${stage.stageIndex}.`);
    }

    if (!stage.isBurned && stage.intervalMinutes === null) {
      throw new Error(`Non-burned stage ${stage.stageIndex} must define an interval.`);
    }

    if (stage.intervalMinutes !== null && stage.intervalMinutes < 0) {
      throw new Error(`Stage ${stage.stageIndex} interval must not be negative.`);
    }

    stageIndexes.add(stage.stageIndex);
  }
}

function validateRules(rules: SrsSchedulingRules, stages: readonly SrsStage[]): void {
  for (const [name, value] of [
    ["earlyWrongDemotionStages", rules.earlyWrongDemotionStages],
    ["lateWrongDemotionStages", rules.lateWrongDemotionStages],
    ["lateWrongStageIndex", rules.lateWrongStageIndex],
    ["minimumStageIndex", rules.minimumStageIndex],
    ["reviewFloorStageIndex", rules.reviewFloorStageIndex],
    ["resurrectStageIndex", rules.resurrectStageIndex],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`SRS rule ${name} must be a non-negative integer.`);
    }
  }

  getStage(stages, rules.minimumStageIndex);
  getStage(stages, rules.reviewFloorStageIndex);
  getStage(stages, rules.resurrectStageIndex);
}

function getStageTransition(
  result: Exclude<ReviewResult, "manual-ignore" | "resurrect">,
  currentStageIndex: number,
  config: ResolvedSrsStageConfig,
): {
  readonly nextStageIndex: number;
  readonly penaltyApplied: number;
  readonly action: "advanced" | "demoted" | "stayed";
  readonly reason?: string;
} {
  if (result === "correct") {
    const nextStageIndex = getAdjacentStageIndex(config.stages, currentStageIndex, 1);

    return {
      nextStageIndex,
      penaltyApplied: 0,
      action: nextStageIndex === currentStageIndex ? "stayed" : "advanced",
    };
  }

  if (result === "typo") {
    if (config.rules.typoBehavior === "advance") {
      const nextStageIndex = getAdjacentStageIndex(config.stages, currentStageIndex, 1);

      return {
        nextStageIndex,
        penaltyApplied: 0,
        action: nextStageIndex === currentStageIndex ? "stayed" : "advanced",
        reason: "typo-accepted-as-correct",
      };
    }

    return {
      nextStageIndex: currentStageIndex,
      penaltyApplied: 0,
      action: "stayed",
      reason: "typo-accepted-without-advancement",
    };
  }

  const demotion =
    currentStageIndex >= config.rules.lateWrongStageIndex
      ? config.rules.lateWrongDemotionStages
      : config.rules.earlyWrongDemotionStages;
  const currentOffset = getStageOffset(config.stages, currentStageIndex);
  const demotedOffset = getAdjacentStageOffset(config.stages, currentStageIndex, -demotion);
  const minimumOffset = getStageOffset(config.stages, config.rules.minimumStageIndex);
  const reviewFloorOffset = getStageOffset(config.stages, config.rules.reviewFloorStageIndex);
  const floorOffset = Math.min(currentOffset, Math.max(minimumOffset, reviewFloorOffset));
  const nextOffset = Math.max(demotedOffset, floorOffset);
  const nextStageIndex = config.stages[nextOffset].stageIndex;

  return {
    nextStageIndex,
    penaltyApplied: currentOffset - nextOffset,
    action: nextStageIndex === currentStageIndex ? "stayed" : "demoted",
    reason: result === "reveal" ? "answer-revealed" : undefined,
  };
}

function getAdjacentStageIndex(
  stages: readonly SrsStage[],
  currentStageIndex: number,
  distance: number,
): number {
  return stages[getAdjacentStageOffset(stages, currentStageIndex, distance)].stageIndex;
}

function getAdjacentStageOffset(
  stages: readonly SrsStage[],
  currentStageIndex: number,
  distance: number,
): number {
  const currentOffset = getStageOffset(stages, currentStageIndex);
  const nextOffset = Math.max(0, Math.min(currentOffset + distance, stages.length - 1));

  return nextOffset;
}

function getStageOffset(stages: readonly SrsStage[], stageIndex: number): number {
  const currentOffset = stages.findIndex((stage) => stage.stageIndex === stageIndex);

  if (currentOffset === -1) {
    throw new Error(`Unknown SRS stage index: ${stageIndex}.`);
  }

  return currentOffset;
}

function getStage(stages: readonly SrsStage[], stageIndex: number): SrsStage {
  const stage = stages.find((candidate) => candidate.stageIndex === stageIndex);

  if (stage === undefined) {
    throw new Error(`Unknown SRS stage index: ${stageIndex}.`);
  }

  return stage;
}

function getNextAvailableAt(stage: SrsStage, now: Date): Date | null {
  if (stage.isBurned) {
    return null;
  }

  if (stage.intervalMinutes === null) {
    throw new Error(`Stage ${stage.stageIndex} interval is required for scheduling.`);
  }

  return addMinutes(now, stage.intervalMinutes);
}

function buildResult(input: {
  readonly result: ReviewResult;
  readonly previousStage: SrsStage;
  readonly nextStage: SrsStage;
  readonly previousState: ScheduledUserSrsStateSnapshot;
  readonly nextState: ScheduledUserSrsStateSnapshot;
  readonly penaltyApplied: number;
  readonly action: SchedulingResult["details"]["action"];
  readonly reason?: string;
  readonly intervalMinutes: number | null;
}): SchedulingResult {
  return {
    result: input.result,
    previousStage: input.previousStage,
    nextStage: input.nextStage,
    previousState: input.previousState,
    nextState: input.nextState,
    nextAvailableAt: input.nextState.availableAt,
    burned: Boolean(input.nextStage.isBurned || input.nextState.burnedAt),
    penaltyApplied: input.penaltyApplied,
    changed: !statesEqual(input.previousState, input.nextState),
    details: {
      action: input.action,
      intervalMinutes: input.intervalMinutes,
      wrongCountDelta: input.nextState.wrongCount - input.previousState.wrongCount,
      correctStreakDelta: input.nextState.correctStreak - input.previousState.correctStreak,
      reason: input.reason,
    },
  };
}

function normalizeState(state: UserSrsStateSnapshot): ScheduledUserSrsStateSnapshot {
  return {
    id: state.id,
    learningCardId: state.learningCardId,
    stageIndex: state.stageIndex,
    availableAt: state.availableAt === null ? null : toDate(state.availableAt, "availableAt"),
    burnedAt:
      state.burnedAt === undefined || state.burnedAt === null
        ? null
        : toDate(state.burnedAt, "burnedAt"),
    resurrectedAt:
      state.resurrectedAt === undefined || state.resurrectedAt === null
        ? null
        : toDate(state.resurrectedAt, "resurrectedAt"),
    wrongCount: state.wrongCount,
    correctStreak: state.correctStreak,
    lastReviewedAt:
      state.lastReviewedAt === undefined || state.lastReviewedAt === null
        ? null
        : toDate(state.lastReviewedAt, "lastReviewedAt"),
  };
}

function normalizeForecastState(state: ForecastableSrsState): ScheduledUserSrsStateSnapshot {
  return normalizeState({
    ...state,
    wrongCount: 0,
    correctStreak: 0,
  });
}

function isBurnedState(state: ScheduledUserSrsStateSnapshot, stage: SrsStage): boolean {
  return Boolean(stage.isBurned || state.burnedAt !== null);
}

function statesEqual(
  left: ScheduledUserSrsStateSnapshot,
  right: ScheduledUserSrsStateSnapshot,
): boolean {
  return (
    left.id === right.id &&
    left.learningCardId === right.learningCardId &&
    left.stageIndex === right.stageIndex &&
    datesEqual(left.availableAt, right.availableAt) &&
    datesEqual(left.burnedAt, right.burnedAt) &&
    datesEqual(left.resurrectedAt, right.resurrectedAt) &&
    left.wrongCount === right.wrongCount &&
    left.correctStreak === right.correctStreak &&
    datesEqual(left.lastReviewedAt, right.lastReviewedAt)
  );
}

function datesEqual(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime();
}

function toDate(value: DateInput, fieldName: string): Date {
  const date = value instanceof Date ? cloneDate(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName} date.`);
  }

  return date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

function getLocalDateTimeParts(date: Date, timezone: string): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);

  return {
    year: getDateTimePart(parts, "year"),
    month: getDateTimePart(parts, "month"),
    day: getDateTimePart(parts, "day"),
    hour: getDateTimePart(parts, "hour"),
  };
}

function getDateTimePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const part = parts.find((candidate) => candidate.type === type);

  if (part === undefined) {
    throw new Error(`Unable to read ${type} from formatted date.`);
  }

  return part.value;
}
