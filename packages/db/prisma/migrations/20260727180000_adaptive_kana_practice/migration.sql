CREATE TYPE "KanaPracticeMode" AS ENUM ('HIRAGANA', 'KATAKANA', 'MIXED');

CREATE TYPE "KanaExerciseKind" AS ENUM (
    'TYPING',
    'RECOGNITION_CHOICE',
    'REVERSE_CHOICE',
    'MATCHING',
    'LISTENING_CHOICE',
    'TRACING'
);

CREATE TABLE "KanaPracticeSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mode" "KanaPracticeMode" NOT NULL,
    "queueJson" JSONB NOT NULL,
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanaPracticeSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KanaAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "practiceSessionId" UUID,
    "expectedCharacter" TEXT NOT NULL,
    "script" "KanaScript" NOT NULL,
    "submittedAnswer" TEXT,
    "selectedCharacter" TEXT,
    "exerciseKind" "KanaExerciseKind" NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanaAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KanaPracticeSession_userId_mode_finishedAt_idx"
ON "KanaPracticeSession"("userId", "mode", "finishedAt");

CREATE UNIQUE INDEX "KanaPracticeSession_one_active_mode_key"
ON "KanaPracticeSession"("userId", "mode")
WHERE "finishedAt" IS NULL;

CREATE INDEX "KanaAttempt_userId_answeredAt_idx"
ON "KanaAttempt"("userId", "answeredAt");

CREATE INDEX "KanaAttempt_userId_expectedCharacter_answeredAt_idx"
ON "KanaAttempt"("userId", "expectedCharacter", "answeredAt");

CREATE INDEX "KanaAttempt_userId_selectedCharacter_answeredAt_idx"
ON "KanaAttempt"("userId", "selectedCharacter", "answeredAt");

CREATE INDEX "KanaAttempt_practiceSessionId_idx"
ON "KanaAttempt"("practiceSessionId");

ALTER TABLE "KanaPracticeSession"
ADD CONSTRAINT "KanaPracticeSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KanaAttempt"
ADD CONSTRAINT "KanaAttempt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KanaAttempt"
ADD CONSTRAINT "KanaAttempt_practiceSessionId_fkey"
FOREIGN KEY ("practiceSessionId") REFERENCES "KanaPracticeSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
