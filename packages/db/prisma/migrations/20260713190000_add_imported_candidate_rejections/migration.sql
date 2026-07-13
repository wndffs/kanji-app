CREATE TYPE "ImportedCandidateTargetType" AS ENUM ('KANJI', 'WORD');

CREATE TYPE "ImportedCandidateRejectionReason" AS ENUM (
  'DUPLICATE',
  'OUT_OF_SCOPE',
  'DATA_QUALITY',
  'LOW_EDUCATIONAL_VALUE',
  'OTHER'
);

CREATE TABLE "ImportedCandidateRejection" (
  "id" UUID NOT NULL,
  "targetType" "ImportedCandidateTargetType" NOT NULL,
  "targetId" UUID NOT NULL,
  "reason" "ImportedCandidateRejectionReason" NOT NULL,
  "note" TEXT,
  "rejectedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ImportedCandidateRejection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportedCandidateRejection_targetType_targetId_key"
ON "ImportedCandidateRejection"("targetType", "targetId");

CREATE INDEX "ImportedCandidateRejection_targetType_updatedAt_idx"
ON "ImportedCandidateRejection"("targetType", "updatedAt");

CREATE INDEX "ImportedCandidateRejection_rejectedByUserId_idx"
ON "ImportedCandidateRejection"("rejectedByUserId");

ALTER TABLE "ImportedCandidateRejection"
ADD CONSTRAINT "ImportedCandidateRejection_rejectedByUserId_fkey"
FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
