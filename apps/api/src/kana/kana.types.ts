import {
  type AdaptiveKanaExercise,
  type AdaptiveKanaExerciseKind,
  type AdaptiveKanaScriptMode,
  type KanaAttemptEvidence,
} from "@kanji-srs/japanese";
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
  readonly submittedAnswer: string | null;
  readonly selectedCharacter: string | null;
  readonly exerciseKind: AdaptiveKanaExerciseKind;
  readonly masteryThreshold: number;
  readonly answeredAt: Date;
};

export type KanaAttemptRecord = KanaAttemptEvidence & {
  readonly id: string;
  readonly script: KanaScript;
};

export type KanaPracticeSessionRecord = {
  readonly id: string;
  readonly userId: string;
  readonly script: AdaptiveKanaScriptMode;
  readonly items: readonly AdaptiveKanaExercise[];
  readonly currentIndex: number;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
};

export type CreateKanaPracticeSessionInput = {
  readonly userId: string;
  readonly script: AdaptiveKanaScriptMode;
  readonly items: readonly AdaptiveKanaExercise[];
  readonly startedAt: Date;
};

export type RecordKanaPracticeAttemptInput = RecordKanaAttemptInput & {
  readonly sessionId: string;
  readonly expectedSessionIndex: number;
  readonly sessionItemCount: number;
};

export type RecordKanaPracticeAttemptResult = {
  readonly progress: KanaProgressRecord;
  readonly session: KanaPracticeSessionRecord;
};

export class KanaPracticeSessionConflictError extends Error {
  constructor() {
    super("Kana practice session has already advanced.");
    this.name = "KanaPracticeSessionConflictError";
  }
}
