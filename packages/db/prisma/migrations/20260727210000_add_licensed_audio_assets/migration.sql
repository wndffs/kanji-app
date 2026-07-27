ALTER TYPE "PromptType" ADD VALUE IF NOT EXISTS 'LISTENING';

CREATE TABLE "AudioAsset" (
    "id" UUID NOT NULL,
    "learningItemId" UUID NOT NULL,
    "mediaUrl" TEXT,
    "storageKey" TEXT,
    "checksumSha256" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "speakerName" TEXT,
    "voiceMetadataJson" JSONB,
    "locale" TEXT NOT NULL DEFAULT 'ja-JP',
    "dataSourceId" UUID NOT NULL,
    "licenseId" UUID NOT NULL,
    "importRunId" UUID,
    "attributionText" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioAsset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LearningCard"
ADD COLUMN "audioAssetId" UUID;

CREATE UNIQUE INDEX "AudioAsset_learningItemId_checksumSha256_key"
ON "AudioAsset"("learningItemId", "checksumSha256");

CREATE INDEX "AudioAsset_learningItemId_status_idx"
ON "AudioAsset"("learningItemId", "status");

CREATE INDEX "AudioAsset_dataSourceId_idx"
ON "AudioAsset"("dataSourceId");

CREATE INDEX "AudioAsset_licenseId_idx"
ON "AudioAsset"("licenseId");

CREATE INDEX "AudioAsset_importRunId_idx"
ON "AudioAsset"("importRunId");

CREATE INDEX "AudioAsset_status_idx"
ON "AudioAsset"("status");

CREATE INDEX "LearningCard_audioAssetId_idx"
ON "LearningCard"("audioAssetId");

ALTER TABLE "AudioAsset"
ADD CONSTRAINT "AudioAsset_learningItemId_fkey"
FOREIGN KEY ("learningItemId") REFERENCES "LearningItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AudioAsset"
ADD CONSTRAINT "AudioAsset_dataSourceId_fkey"
FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AudioAsset"
ADD CONSTRAINT "AudioAsset_licenseId_fkey"
FOREIGN KEY ("licenseId") REFERENCES "License"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AudioAsset"
ADD CONSTRAINT "AudioAsset_importRunId_fkey"
FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LearningCard"
ADD CONSTRAINT "LearningCard_audioAssetId_fkey"
FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
