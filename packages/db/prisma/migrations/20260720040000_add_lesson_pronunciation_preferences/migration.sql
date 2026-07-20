ALTER TABLE "UserSettings"
ADD COLUMN "lessonPronunciationMode" TEXT NOT NULL DEFAULT 'kana',
ADD COLUMN "lessonRomaji" BOOLEAN NOT NULL DEFAULT false;
