ALTER TABLE "CourseLevel"
ADD COLUMN "passPolicyJson" JSONB NOT NULL
DEFAULT '{"version":1,"itemKind":"KANJI","passStageIndex":5,"requiredPercentage":90}';

CREATE TABLE "UserCourseLevelCompletion" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "courseLevelId" UUID NOT NULL,
    "reviewSessionId" UUID,
    "policyVersion" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCourseLevelCompletion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserUnlockEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "learningItemId" UUID NOT NULL,
    "reviewSessionId" UUID NOT NULL,
    "triggerLearningCardId" UUID NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserUnlockEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCourseLevelCompletion_userId_courseLevelId_key"
ON "UserCourseLevelCompletion"("userId", "courseLevelId");

CREATE INDEX "UserCourseLevelCompletion_courseLevelId_idx"
ON "UserCourseLevelCompletion"("courseLevelId");

CREATE INDEX "UserCourseLevelCompletion_reviewSessionId_idx"
ON "UserCourseLevelCompletion"("reviewSessionId");

CREATE INDEX "UserCourseLevelCompletion_userId_completedAt_idx"
ON "UserCourseLevelCompletion"("userId", "completedAt");

CREATE UNIQUE INDEX "UserUnlockEvent_userId_learningItemId_key"
ON "UserUnlockEvent"("userId", "learningItemId");

CREATE INDEX "UserUnlockEvent_learningItemId_idx"
ON "UserUnlockEvent"("learningItemId");

CREATE INDEX "UserUnlockEvent_reviewSessionId_idx"
ON "UserUnlockEvent"("reviewSessionId");

CREATE INDEX "UserUnlockEvent_userId_unlockedAt_idx"
ON "UserUnlockEvent"("userId", "unlockedAt");

ALTER TABLE "UserCourseLevelCompletion"
ADD CONSTRAINT "UserCourseLevelCompletion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCourseLevelCompletion"
ADD CONSTRAINT "UserCourseLevelCompletion_courseLevelId_fkey"
FOREIGN KEY ("courseLevelId") REFERENCES "CourseLevel"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCourseLevelCompletion"
ADD CONSTRAINT "UserCourseLevelCompletion_reviewSessionId_fkey"
FOREIGN KEY ("reviewSessionId") REFERENCES "ReviewSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserUnlockEvent"
ADD CONSTRAINT "UserUnlockEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserUnlockEvent"
ADD CONSTRAINT "UserUnlockEvent_learningItemId_fkey"
FOREIGN KEY ("learningItemId") REFERENCES "LearningItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserUnlockEvent"
ADD CONSTRAINT "UserUnlockEvent_reviewSessionId_fkey"
FOREIGN KEY ("reviewSessionId") REFERENCES "ReviewSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserUnlockEvent"
ADD CONSTRAINT "UserUnlockEvent_triggerLearningCardId_fkey"
FOREIGN KEY ("triggerLearningCardId") REFERENCES "LearningCard"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
