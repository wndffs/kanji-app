-- Repair only the known starter identity whose linked JMdict import proves the pair.
-- Never change the word/card IDs, raw records, answers, private data or schedules.
UPDATE "Word" AS word
SET "jmdictEntryId" = record."sourceRecordId", "updatedAt" = CURRENT_TIMESTAMP
FROM "ImportedRecord" AS record
JOIN "ImportRun" AS run ON run."id" = record."importRunId"
JOIN "DataSource" AS source ON source."id" = run."dataSourceId"
JOIN "License" AS license ON license."id" = source."licenseId"
WHERE word."expression" = '口'
    AND word."reading" = 'くち'
    AND word."jmdictEntryId" = 'starter:word:word-kuchi'
    AND word."jmdictImportedRecordId" = record."id"
    AND record."recordType" = 'JMDICT_ENTRY'
    AND record."sourceRecordId" = 'jmdict:1275640'
    AND record."rawJson" -> 'sequence' = '"1275640"'::jsonb
    AND record."rawJson" -> 'retainedLocales' IN (
        '["ru-RU", "en-US"]'::jsonb, '["en-US", "ru-RU"]'::jsonb
    )
    AND jsonb_typeof(record."rawJson" -> 'importedWordCount') = 'number'
    AND record."rawJson" ->> 'importedWordCount' ~ '^[1-9][0-9]*$'
    AND run."status" = 'SUCCESS'
    AND lower(btrim(run."sourceVersion")) NOT IN ('', 'unknown')
    AND run."checksumSha256" ~ '^[a-fA-F0-9]{64}$'
    AND source."name" = 'JMdict'
    AND source."homepageUrl" LIKE 'https://%'
    AND btrim(source."attributionText") <> ''
    AND license."scope" = 'OPEN_DATA'
    AND license."spdxLikeId" = 'LicenseRef-JMdict-Multilingual'
    AND license."requiresAttribution" = true
    AND license."url" LIKE 'https://%'
    AND EXISTS (
        SELECT 1 FROM "WordSense" AS sense
        WHERE sense."wordId" = word."id" AND sense."locale" = 'ru-RU'
            AND sense."sourceKind" = 'IMPORTED' AND btrim(sense."meaning") <> ''
    )
    AND EXISTS (
        SELECT 1 FROM "WordSense" AS sense
        WHERE sense."wordId" = word."id" AND sense."locale" = 'en-US'
            AND sense."sourceKind" = 'IMPORTED' AND btrim(sense."meaning") <> ''
    );
