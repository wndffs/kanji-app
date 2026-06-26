# Data model direction

## Source and attribution

- `License`: id, name, spdxLikeId, url, requiresAttribution, requiresShareAlike, notes.
- `DataSource`: id, name, homepageUrl, downloadUrl, licenseId, attributionText, notes.
- `ImportRun`: id, dataSourceId, sourceVersion, sourceFileName, sourceDownloadedAt, checksumSha256, startedAt, finishedAt, status, statsJson, errorText.
- `ImportedRecord`: id, importRunId, sourceRecordId, recordType, rawJson.
- Imported target rows keep exact provenance with nullable `ImportedRecord` links in addition to source-record IDs. These links should be filled by importers as they are upgraded.

## Linguistic graph

- `Component`: id, symbol, displayNameRu, displayNameEn, meaningRu, meaningEn, sourceKind, notes.
- `Kanji`: id, character, strokeCount, grade, jlptLevel, frequencyRank, kanjidicSourceId, kanjidicImportedRecordId.
- `KanjiReading`: id, kanjiId, reading, readingType, priority.
- `KanjiMeaning`: id, kanjiId, locale, meaning, isPrimary, sourceKind.
- `KanjiComponent`: id, kanjiId, componentId, position, sourceKind, confidence.
- `Word`: id, expression, reading, commonnessRank, jlptLevel, jmdictEntryId, jmdictImportedRecordId.
- `WordSense`: id, wordId, locale, meaning, partOfSpeech, register, tags, sourceKind.
- `Sentence`: id, japaneseText, readingText, translationRu, translationEn, difficulty, sourceId, importedRecordId, licenseId.

## Pedagogical layer

- `LearningItem`: id, kind, targetType, targetId, title, levelHint, status.
- `LearningCard`: id, learningItemId, cardType, promptType, answerType, locale/displayMode, sortOrder. Cards should be able to present Russian only, English only, or both translation sets.
- `LearningAnswer`: id, learningCardId, text, normalizedText, answerKind, locale, isPrimary, sourceKind.
- `BlockedAnswer`: id, learningCardId, text, normalizedText, reason, sourceKind.
- `Mnemonic`: id, learningItemId, locale, mnemonicType, body, sourceKind, version.
- `Hint`: id, learningItemId, locale, hintType, body, sourceKind, version.
- `Dependency`: id, learningItemId, prerequisiteItemId, dependencyType, requiredStage.

## User layer

- `User`: id, email, passwordHash, displayName, role, createdAt.
- `UserSettings`: id, userId, locale, translationDisplayMode, timezone, dailyLessonLimit, reviewBudget, strictMode.
- `UserItemOverride`: id, userId, learningCardId, overrideType, text, normalizedText, note, createdAt, updatedAt.
- `UserMnemonic`: id, userId, learningItemId, mnemonicType, body, createdAt, updatedAt.
- `UserEnrollment`: id, userId, courseId, status, startedAt.

## Curriculum layer

- `Course`: id, slug, titleRu, descriptionRu, targetLevel, courseType, status.
- `CourseLevel`: id, courseId, levelNumber, titleRu, descriptionRu.
- `CourseLevelItem`: id, courseLevelId, learningItemId, sortOrder, unlockPolicyJson.
- `Deck`: id, ownerUserId, title, deckType, sourceText, status.
- `DeckItem`: id, deckId, learningItemId, sortOrder, reasonJson.

## SRS layer

- `SrsSystem`: id, slug, title, configJson.
- `SrsStage`: id, srsSystemId, stageIndex, name, intervalMinutes, isBurned.
- `UserSrsState`: id, userId, learningCardId, srsSystemId, stageIndex, availableAt, burnedAt, resurrectedAt, wrongCount, correctStreak, lastReviewedAt.
- `ReviewSession`: id, userId, startedAt, finishedAt, mode, statsJson.
- `ReviewAnswer`: id, reviewSessionId, userSrsStateId, learningCardId, answerText, normalizedAnswer, result, previousStageIndex, nextStageIndex, answeredAt, detailsJson.
