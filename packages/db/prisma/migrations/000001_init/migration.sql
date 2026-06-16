-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LicenseScope" AS ENUM ('OPEN_DATA', 'PROJECT_AUTHORED', 'USER_PRIVATE');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportedRecordType" AS ENUM ('KANJIDIC2_CHARACTER', 'JMDICT_ENTRY', 'KANJIVG_CHARACTER', 'TATOEBA_SENTENCE', 'PROJECT_AUTHORED');

-- CreateEnum
CREATE TYPE "ContentSourceKind" AS ENUM ('IMPORTED', 'PROJECT_AUTHORED', 'USER_PRIVATE');

-- CreateEnum
CREATE TYPE "KanjiReadingType" AS ENUM ('ONYOMI', 'KUNYOMI', 'NANORI', 'OTHER');

-- CreateEnum
CREATE TYPE "LearningItemKind" AS ENUM ('COMPONENT', 'KANJI', 'WORD', 'SENTENCE');

-- CreateEnum
CREATE TYPE "LearningTargetType" AS ENUM ('COMPONENT', 'KANJI', 'WORD', 'SENTENCE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('LESSON', 'REVIEW');

-- CreateEnum
CREATE TYPE "PromptType" AS ENUM ('MEANING', 'READING', 'RECALL', 'CLOZE', 'RECOGNITION');

-- CreateEnum
CREATE TYPE "AnswerType" AS ENUM ('MEANING', 'READING');

-- CreateEnum
CREATE TYPE "AnswerKind" AS ENUM ('MEANING', 'READING');

-- CreateEnum
CREATE TYPE "MnemonicType" AS ENUM ('MEANING', 'READING', 'STORY');

-- CreateEnum
CREATE TYPE "HintType" AS ENUM ('MEANING', 'READING', 'USAGE');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('COMPONENT_OF', 'PREREQUISITE', 'UNLOCKS');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserOverrideType" AS ENUM ('ACCEPTED_MEANING', 'ACCEPTED_READING', 'BLOCKED_PERSONAL', 'NOTE');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('STRUCTURED', 'GOAL', 'DEMO');

-- CreateEnum
CREATE TYPE "DeckType" AS ENUM ('TEXT_MINING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DeckStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReviewSessionMode" AS ENUM ('REVIEW', 'LESSON_QUIZ', 'EXTRA_PRACTICE');

-- CreateEnum
CREATE TYPE "ReviewResult" AS ENUM ('CORRECT', 'WRONG', 'TYPO', 'REVEAL', 'MANUAL_IGNORE', 'RESURRECT');

-- CreateTable
CREATE TABLE "License" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "spdxLikeId" TEXT,
    "scope" "LicenseScope" NOT NULL DEFAULT 'OPEN_DATA',
    "url" TEXT,
    "requiresAttribution" BOOLEAN NOT NULL DEFAULT false,
    "requiresShareAlike" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "homepageUrl" TEXT,
    "downloadUrl" TEXT,
    "licenseId" UUID NOT NULL,
    "attributionText" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" UUID NOT NULL,
    "dataSourceId" UUID NOT NULL,
    "sourceVersion" TEXT,
    "sourceFileName" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "ImportRunStatus" NOT NULL DEFAULT 'PENDING',
    "statsJson" JSONB,
    "errorText" TEXT,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedRecord" (
    "id" UUID NOT NULL,
    "importRunId" UUID NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "recordType" "ImportedRecordType" NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "displayNameRu" TEXT NOT NULL,
    "meaningRu" TEXT NOT NULL,
    "sourceKind" "ContentSourceKind" NOT NULL DEFAULT 'PROJECT_AUTHORED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kanji" (
    "id" UUID NOT NULL,
    "character" TEXT NOT NULL,
    "strokeCount" INTEGER,
    "grade" INTEGER,
    "jlptLevel" INTEGER,
    "frequencyRank" INTEGER,
    "kanjidicSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kanji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanjiReading" (
    "id" UUID NOT NULL,
    "kanjiId" UUID NOT NULL,
    "reading" TEXT NOT NULL,
    "readingType" "KanjiReadingType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KanjiReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanjiMeaning" (
    "id" UUID NOT NULL,
    "kanjiId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sourceKind" "ContentSourceKind" NOT NULL DEFAULT 'IMPORTED',

    CONSTRAINT "KanjiMeaning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KanjiComponent" (
    "id" UUID NOT NULL,
    "kanjiId" UUID NOT NULL,
    "componentId" UUID NOT NULL,
    "position" TEXT,
    "sourceKind" "ContentSourceKind" NOT NULL DEFAULT 'PROJECT_AUTHORED',
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "KanjiComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Word" (
    "id" UUID NOT NULL,
    "expression" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "commonnessRank" INTEGER,
    "jlptLevel" INTEGER,
    "jmdictEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordSense" (
    "id" UUID NOT NULL,
    "wordId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "partOfSpeech" TEXT NOT NULL,
    "register" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceKind" "ContentSourceKind" NOT NULL DEFAULT 'IMPORTED',

    CONSTRAINT "WordSense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sentence" (
    "id" UUID NOT NULL,
    "japaneseText" TEXT NOT NULL,
    "readingText" TEXT,
    "translationRu" TEXT,
    "translationEn" TEXT,
    "difficulty" INTEGER,
    "sourceId" TEXT,
    "dataSourceId" UUID,
    "licenseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sentence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningItem" (
    "id" UUID NOT NULL,
    "kind" "LearningItemKind" NOT NULL,
    "targetType" "LearningTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "levelHint" INTEGER,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCard" (
    "id" UUID NOT NULL,
    "learningItemId" UUID NOT NULL,
    "cardType" "CardType" NOT NULL,
    "promptType" "PromptType" NOT NULL,
    "answerType" "AnswerType" NOT NULL,
    "locale" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningAnswer" (
    "id" UUID NOT NULL,
    "learningCardId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "answerKind" "AnswerKind" NOT NULL,
    "locale" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LearningAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedAnswer" (
    "id" UUID NOT NULL,
    "learningCardId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "BlockedAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mnemonic" (
    "id" UUID NOT NULL,
    "learningItemId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "mnemonicType" "MnemonicType" NOT NULL,
    "body" TEXT NOT NULL,
    "sourceKind" "ContentSourceKind" NOT NULL DEFAULT 'PROJECT_AUTHORED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mnemonic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hint" (
    "id" UUID NOT NULL,
    "learningItemId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "hintType" "HintType" NOT NULL,
    "body" TEXT NOT NULL,
    "sourceKind" "ContentSourceKind" NOT NULL DEFAULT 'PROJECT_AUTHORED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependency" (
    "id" UUID NOT NULL,
    "learningItemId" UUID NOT NULL,
    "prerequisiteItemId" UUID NOT NULL,
    "dependencyType" "DependencyType" NOT NULL,
    "requiredStage" INTEGER,

    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru-RU',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "dailyLessonLimit" INTEGER NOT NULL DEFAULT 10,
    "reviewBudget" INTEGER NOT NULL DEFAULT 100,
    "strictMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserItemOverride" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "learningCardId" UUID NOT NULL,
    "overrideType" "UserOverrideType" NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserItemOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMnemonic" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "learningItemId" UUID NOT NULL,
    "mnemonicType" "MnemonicType" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMnemonic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEnrollment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "titleRu" TEXT NOT NULL,
    "descriptionRu" TEXT,
    "targetLevel" TEXT,
    "courseType" "CourseType" NOT NULL DEFAULT 'STRUCTURED',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLevel" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "titleRu" TEXT NOT NULL,
    "descriptionRu" TEXT,

    CONSTRAINT "CourseLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseLevelItem" (
    "id" UUID NOT NULL,
    "courseLevelId" UUID NOT NULL,
    "learningItemId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "unlockPolicyJson" JSONB,

    CONSTRAINT "CourseLevelItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "deckType" "DeckType" NOT NULL,
    "sourceText" TEXT,
    "status" "DeckStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckItem" (
    "id" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "learningItemId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "reasonJson" JSONB,

    CONSTRAINT "DeckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SrsSystem" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "configJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SrsSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SrsStage" (
    "id" UUID NOT NULL,
    "srsSystemId" UUID NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "intervalMinutes" INTEGER,
    "isBurned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SrsStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSrsState" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "learningCardId" UUID NOT NULL,
    "srsSystemId" UUID NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "availableAt" TIMESTAMP(3),
    "burnedAt" TIMESTAMP(3),
    "resurrectedAt" TIMESTAMP(3),
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "correctStreak" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSrsState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "mode" "ReviewSessionMode" NOT NULL DEFAULT 'REVIEW',
    "statsJson" JSONB,

    CONSTRAINT "ReviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAnswer" (
    "id" UUID NOT NULL,
    "reviewSessionId" UUID NOT NULL,
    "userSrsStateId" UUID NOT NULL,
    "learningCardId" UUID NOT NULL,
    "answerText" TEXT NOT NULL,
    "normalizedAnswer" TEXT NOT NULL,
    "result" "ReviewResult" NOT NULL,
    "previousStageIndex" INTEGER,
    "nextStageIndex" INTEGER,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detailsJson" JSONB,

    CONSTRAINT "ReviewAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "License_name_key" ON "License"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_name_key" ON "DataSource"("name");

-- CreateIndex
CREATE INDEX "DataSource_licenseId_idx" ON "DataSource"("licenseId");

-- CreateIndex
CREATE INDEX "ImportRun_dataSourceId_startedAt_idx" ON "ImportRun"("dataSourceId", "startedAt");

-- CreateIndex
CREATE INDEX "ImportRun_status_idx" ON "ImportRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRun_dataSourceId_checksumSha256_key" ON "ImportRun"("dataSourceId", "checksumSha256");

-- CreateIndex
CREATE INDEX "ImportedRecord_sourceRecordId_idx" ON "ImportedRecord"("sourceRecordId");

-- CreateIndex
CREATE INDEX "ImportedRecord_recordType_idx" ON "ImportedRecord"("recordType");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedRecord_importRunId_recordType_sourceRecordId_key" ON "ImportedRecord"("importRunId", "recordType", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Component_symbol_key" ON "Component"("symbol");

-- CreateIndex
CREATE INDEX "Component_displayNameRu_idx" ON "Component"("displayNameRu");

-- CreateIndex
CREATE INDEX "Component_meaningRu_idx" ON "Component"("meaningRu");

-- CreateIndex
CREATE UNIQUE INDEX "Kanji_character_key" ON "Kanji"("character");

-- CreateIndex
CREATE UNIQUE INDEX "Kanji_kanjidicSourceId_key" ON "Kanji"("kanjidicSourceId");

-- CreateIndex
CREATE INDEX "Kanji_jlptLevel_idx" ON "Kanji"("jlptLevel");

-- CreateIndex
CREATE INDEX "Kanji_frequencyRank_idx" ON "Kanji"("frequencyRank");

-- CreateIndex
CREATE INDEX "Kanji_kanjidicSourceId_idx" ON "Kanji"("kanjidicSourceId");

-- CreateIndex
CREATE INDEX "KanjiReading_reading_idx" ON "KanjiReading"("reading");

-- CreateIndex
CREATE INDEX "KanjiReading_readingType_idx" ON "KanjiReading"("readingType");

-- CreateIndex
CREATE UNIQUE INDEX "KanjiReading_kanjiId_reading_readingType_key" ON "KanjiReading"("kanjiId", "reading", "readingType");

-- CreateIndex
CREATE INDEX "KanjiMeaning_locale_meaning_idx" ON "KanjiMeaning"("locale", "meaning");

-- CreateIndex
CREATE INDEX "KanjiMeaning_sourceKind_idx" ON "KanjiMeaning"("sourceKind");

-- CreateIndex
CREATE UNIQUE INDEX "KanjiMeaning_kanjiId_locale_meaning_key" ON "KanjiMeaning"("kanjiId", "locale", "meaning");

-- CreateIndex
CREATE INDEX "KanjiComponent_componentId_idx" ON "KanjiComponent"("componentId");

-- CreateIndex
CREATE INDEX "KanjiComponent_sourceKind_idx" ON "KanjiComponent"("sourceKind");

-- CreateIndex
CREATE UNIQUE INDEX "KanjiComponent_kanjiId_componentId_position_key" ON "KanjiComponent"("kanjiId", "componentId", "position");

-- CreateIndex
CREATE INDEX "Word_expression_idx" ON "Word"("expression");

-- CreateIndex
CREATE INDEX "Word_reading_idx" ON "Word"("reading");

-- CreateIndex
CREATE INDEX "Word_jmdictEntryId_idx" ON "Word"("jmdictEntryId");

-- CreateIndex
CREATE INDEX "Word_jlptLevel_idx" ON "Word"("jlptLevel");

-- CreateIndex
CREATE INDEX "Word_commonnessRank_idx" ON "Word"("commonnessRank");

-- CreateIndex
CREATE UNIQUE INDEX "Word_expression_reading_key" ON "Word"("expression", "reading");

-- CreateIndex
CREATE INDEX "WordSense_wordId_locale_idx" ON "WordSense"("wordId", "locale");

-- CreateIndex
CREATE INDEX "WordSense_locale_meaning_idx" ON "WordSense"("locale", "meaning");

-- CreateIndex
CREATE INDEX "WordSense_partOfSpeech_idx" ON "WordSense"("partOfSpeech");

-- CreateIndex
CREATE INDEX "WordSense_sourceKind_idx" ON "WordSense"("sourceKind");

-- CreateIndex
CREATE UNIQUE INDEX "WordSense_wordId_locale_meaning_partOfSpeech_key" ON "WordSense"("wordId", "locale", "meaning", "partOfSpeech");

-- CreateIndex
CREATE INDEX "Sentence_japaneseText_idx" ON "Sentence"("japaneseText");

-- CreateIndex
CREATE INDEX "Sentence_translationRu_idx" ON "Sentence"("translationRu");

-- CreateIndex
CREATE INDEX "Sentence_sourceId_idx" ON "Sentence"("sourceId");

-- CreateIndex
CREATE INDEX "Sentence_licenseId_idx" ON "Sentence"("licenseId");

-- CreateIndex
CREATE UNIQUE INDEX "Sentence_dataSourceId_sourceId_key" ON "Sentence"("dataSourceId", "sourceId");

-- CreateIndex
CREATE INDEX "LearningItem_kind_status_idx" ON "LearningItem"("kind", "status");

-- CreateIndex
CREATE INDEX "LearningItem_levelHint_idx" ON "LearningItem"("levelHint");

-- CreateIndex
CREATE UNIQUE INDEX "LearningItem_targetType_targetId_key" ON "LearningItem"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "LearningCard_locale_idx" ON "LearningCard"("locale");

-- CreateIndex
CREATE INDEX "LearningCard_promptType_answerType_idx" ON "LearningCard"("promptType", "answerType");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCard_learningItemId_promptType_answerType_locale_key" ON "LearningCard"("learningItemId", "promptType", "answerType", "locale");

-- CreateIndex
CREATE INDEX "LearningAnswer_normalizedText_locale_idx" ON "LearningAnswer"("normalizedText", "locale");

-- CreateIndex
CREATE INDEX "LearningAnswer_answerKind_idx" ON "LearningAnswer"("answerKind");

-- CreateIndex
CREATE UNIQUE INDEX "LearningAnswer_learningCardId_normalizedText_answerKind_loc_key" ON "LearningAnswer"("learningCardId", "normalizedText", "answerKind", "locale");

-- CreateIndex
CREATE INDEX "BlockedAnswer_normalizedText_idx" ON "BlockedAnswer"("normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedAnswer_learningCardId_normalizedText_key" ON "BlockedAnswer"("learningCardId", "normalizedText");

-- CreateIndex
CREATE INDEX "Mnemonic_locale_idx" ON "Mnemonic"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "Mnemonic_learningItemId_locale_mnemonicType_version_key" ON "Mnemonic"("learningItemId", "locale", "mnemonicType", "version");

-- CreateIndex
CREATE INDEX "Hint_locale_idx" ON "Hint"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "Hint_learningItemId_locale_hintType_version_key" ON "Hint"("learningItemId", "locale", "hintType", "version");

-- CreateIndex
CREATE INDEX "Dependency_prerequisiteItemId_idx" ON "Dependency"("prerequisiteItemId");

-- CreateIndex
CREATE INDEX "Dependency_dependencyType_idx" ON "Dependency"("dependencyType");

-- CreateIndex
CREATE UNIQUE INDEX "Dependency_learningItemId_prerequisiteItemId_dependencyType_key" ON "Dependency"("learningItemId", "prerequisiteItemId", "dependencyType");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserSettings_locale_idx" ON "UserSettings"("locale");

-- CreateIndex
CREATE INDEX "UserItemOverride_learningCardId_idx" ON "UserItemOverride"("learningCardId");

-- CreateIndex
CREATE INDEX "UserItemOverride_normalizedText_idx" ON "UserItemOverride"("normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "UserItemOverride_userId_learningCardId_overrideType_normali_key" ON "UserItemOverride"("userId", "learningCardId", "overrideType", "normalizedText");

-- CreateIndex
CREATE INDEX "UserMnemonic_learningItemId_idx" ON "UserMnemonic"("learningItemId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMnemonic_userId_learningItemId_mnemonicType_key" ON "UserMnemonic"("userId", "learningItemId", "mnemonicType");

-- CreateIndex
CREATE INDEX "UserEnrollment_courseId_idx" ON "UserEnrollment"("courseId");

-- CreateIndex
CREATE INDEX "UserEnrollment_status_idx" ON "UserEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserEnrollment_userId_courseId_key" ON "UserEnrollment"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex
CREATE INDEX "Course_targetLevel_idx" ON "Course"("targetLevel");

-- CreateIndex
CREATE INDEX "CourseLevel_courseId_idx" ON "CourseLevel"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLevel_courseId_levelNumber_key" ON "CourseLevel"("courseId", "levelNumber");

-- CreateIndex
CREATE INDEX "CourseLevelItem_learningItemId_idx" ON "CourseLevelItem"("learningItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLevelItem_courseLevelId_learningItemId_key" ON "CourseLevelItem"("courseLevelId", "learningItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLevelItem_courseLevelId_sortOrder_key" ON "CourseLevelItem"("courseLevelId", "sortOrder");

-- CreateIndex
CREATE INDEX "Deck_ownerUserId_status_idx" ON "Deck"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "Deck_deckType_idx" ON "Deck"("deckType");

-- CreateIndex
CREATE INDEX "DeckItem_learningItemId_idx" ON "DeckItem"("learningItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DeckItem_deckId_learningItemId_key" ON "DeckItem"("deckId", "learningItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DeckItem_deckId_sortOrder_key" ON "DeckItem"("deckId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SrsSystem_slug_key" ON "SrsSystem"("slug");

-- CreateIndex
CREATE INDEX "SrsStage_isBurned_idx" ON "SrsStage"("isBurned");

-- CreateIndex
CREATE UNIQUE INDEX "SrsStage_srsSystemId_stageIndex_key" ON "SrsStage"("srsSystemId", "stageIndex");

-- CreateIndex
CREATE INDEX "UserSrsState_userId_availableAt_idx" ON "UserSrsState"("userId", "availableAt");

-- CreateIndex
CREATE INDEX "UserSrsState_learningCardId_idx" ON "UserSrsState"("learningCardId");

-- CreateIndex
CREATE INDEX "UserSrsState_srsSystemId_stageIndex_idx" ON "UserSrsState"("srsSystemId", "stageIndex");

-- CreateIndex
CREATE INDEX "UserSrsState_burnedAt_idx" ON "UserSrsState"("burnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSrsState_userId_learningCardId_key" ON "UserSrsState"("userId", "learningCardId");

-- CreateIndex
CREATE INDEX "ReviewSession_userId_startedAt_idx" ON "ReviewSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ReviewSession_mode_idx" ON "ReviewSession"("mode");

-- CreateIndex
CREATE INDEX "ReviewAnswer_reviewSessionId_idx" ON "ReviewAnswer"("reviewSessionId");

-- CreateIndex
CREATE INDEX "ReviewAnswer_userSrsStateId_idx" ON "ReviewAnswer"("userSrsStateId");

-- CreateIndex
CREATE INDEX "ReviewAnswer_learningCardId_idx" ON "ReviewAnswer"("learningCardId");

-- CreateIndex
CREATE INDEX "ReviewAnswer_result_idx" ON "ReviewAnswer"("result");

-- CreateIndex
CREATE INDEX "ReviewAnswer_answeredAt_idx" ON "ReviewAnswer"("answeredAt");

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedRecord" ADD CONSTRAINT "ImportedRecord_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanjiReading" ADD CONSTRAINT "KanjiReading_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanjiMeaning" ADD CONSTRAINT "KanjiMeaning_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanjiComponent" ADD CONSTRAINT "KanjiComponent_kanjiId_fkey" FOREIGN KEY ("kanjiId") REFERENCES "Kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanjiComponent" ADD CONSTRAINT "KanjiComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordSense" ADD CONSTRAINT "WordSense_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sentence" ADD CONSTRAINT "Sentence_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sentence" ADD CONSTRAINT "Sentence_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCard" ADD CONSTRAINT "LearningCard_learningItemId_fkey" FOREIGN KEY ("learningItemId") REFERENCES "LearningItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningAnswer" ADD CONSTRAINT "LearningAnswer_learningCardId_fkey" FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedAnswer" ADD CONSTRAINT "BlockedAnswer_learningCardId_fkey" FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mnemonic" ADD CONSTRAINT "Mnemonic_learningItemId_fkey" FOREIGN KEY ("learningItemId") REFERENCES "LearningItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hint" ADD CONSTRAINT "Hint_learningItemId_fkey" FOREIGN KEY ("learningItemId") REFERENCES "LearningItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_learningItemId_fkey" FOREIGN KEY ("learningItemId") REFERENCES "LearningItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_prerequisiteItemId_fkey" FOREIGN KEY ("prerequisiteItemId") REFERENCES "LearningItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserItemOverride" ADD CONSTRAINT "UserItemOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserItemOverride" ADD CONSTRAINT "UserItemOverride_learningCardId_fkey" FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMnemonic" ADD CONSTRAINT "UserMnemonic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMnemonic" ADD CONSTRAINT "UserMnemonic_learningItemId_fkey" FOREIGN KEY ("learningItemId") REFERENCES "LearningItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEnrollment" ADD CONSTRAINT "UserEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEnrollment" ADD CONSTRAINT "UserEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLevel" ADD CONSTRAINT "CourseLevel_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLevelItem" ADD CONSTRAINT "CourseLevelItem_courseLevelId_fkey" FOREIGN KEY ("courseLevelId") REFERENCES "CourseLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseLevelItem" ADD CONSTRAINT "CourseLevelItem_learningItemId_fkey" FOREIGN KEY ("learningItemId") REFERENCES "LearningItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckItem" ADD CONSTRAINT "DeckItem_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckItem" ADD CONSTRAINT "DeckItem_learningItemId_fkey" FOREIGN KEY ("learningItemId") REFERENCES "LearningItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SrsStage" ADD CONSTRAINT "SrsStage_srsSystemId_fkey" FOREIGN KEY ("srsSystemId") REFERENCES "SrsSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSrsState" ADD CONSTRAINT "UserSrsState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSrsState" ADD CONSTRAINT "UserSrsState_learningCardId_fkey" FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSrsState" ADD CONSTRAINT "UserSrsState_srsSystemId_fkey" FOREIGN KEY ("srsSystemId") REFERENCES "SrsSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSession" ADD CONSTRAINT "ReviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAnswer" ADD CONSTRAINT "ReviewAnswer_reviewSessionId_fkey" FOREIGN KEY ("reviewSessionId") REFERENCES "ReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAnswer" ADD CONSTRAINT "ReviewAnswer_userSrsStateId_fkey" FOREIGN KEY ("userSrsStateId") REFERENCES "UserSrsState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAnswer" ADD CONSTRAINT "ReviewAnswer_learningCardId_fkey" FOREIGN KEY ("learningCardId") REFERENCES "LearningCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

