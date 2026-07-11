CREATE TYPE "KanaScript" AS ENUM ('HIRAGANA', 'KATAKANA');

CREATE TABLE "UserKanaProgress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "character" TEXT NOT NULL,
    "script" "KanaScript" NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "masteredAt" TIMESTAMP(3),
    "lastAnsweredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKanaProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserKanaProgress_userId_character_key"
ON "UserKanaProgress"("userId", "character");

CREATE INDEX "UserKanaProgress_userId_script_masteredAt_idx"
ON "UserKanaProgress"("userId", "script", "masteredAt");

ALTER TABLE "UserKanaProgress"
ADD CONSTRAINT "UserKanaProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
