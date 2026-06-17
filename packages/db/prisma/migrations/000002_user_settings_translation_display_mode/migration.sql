ALTER TABLE "UserSettings" ADD COLUMN "translationDisplayMode" TEXT NOT NULL DEFAULT 'ru';

CREATE INDEX "UserSettings_translationDisplayMode_idx" ON "UserSettings"("translationDisplayMode");
