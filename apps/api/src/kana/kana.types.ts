import { type KanaScript } from "@kanji-srs/shared";

export type KanaProgressRecord = {
  readonly character: string;
  readonly script: KanaScript;
  readonly attemptCount: number;
  readonly correctCount: number;
  readonly currentStreak: number;
  readonly masteredAt: Date | null;
  readonly lastAnsweredAt: Date | null;
};

export type RecordKanaAttemptInput = {
  readonly userId: string;
  readonly character: string;
  readonly script: KanaScript;
  readonly correct: boolean;
  readonly masteryThreshold: number;
  readonly answeredAt: Date;
};
