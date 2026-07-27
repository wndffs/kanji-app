import { type CourseBand } from "@kanji-srs/shared";

export type CharacterHubKanjiSrsRecord = {
  readonly stageIndex: number;
  readonly stageName: string;
  readonly burnedAt: Date | null;
  readonly wrongCount: number;
  readonly correctStreak: number;
};

export type CharacterHubKanjiCardRecord = {
  readonly id: string;
  readonly srs: CharacterHubKanjiSrsRecord | null;
};

export type CharacterHubKanjiRecord = {
  readonly id: string;
  readonly character: string;
  readonly reading: string | null;
  readonly meaningRu: string | null;
  readonly meaningEn: string | null;
  readonly jlptLevel: number | null;
  readonly level: number;
  readonly band: CourseBand;
  readonly sortOrder: number;
  readonly passStageIndex: number;
  readonly cards: readonly CharacterHubKanjiCardRecord[];
};

export type CharacterHubCourseLevelRecord = {
  readonly level: number;
  readonly completedAt: Date | null;
  readonly requiredPercentage: number;
  readonly policyItemCount: number;
  readonly passedPolicyItemCount: number;
  readonly kanji: readonly CharacterHubKanjiRecord[];
};

export type CharacterHubCourseRecord = {
  readonly id: string;
  readonly title: string;
  readonly levels: readonly CharacterHubCourseLevelRecord[];
};
