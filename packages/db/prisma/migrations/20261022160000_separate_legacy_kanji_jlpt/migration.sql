DO $migration$
BEGIN
    ALTER TABLE "Kanji" ADD COLUMN IF NOT EXISTS "legacyJlptLevel" INTEGER;
    CREATE INDEX IF NOT EXISTS "Kanji_legacyJlptLevel_idx" ON "Kanji"("legacyJlptLevel");
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = '"Kanji"'::regclass AND conname = 'Kanji_legacyJlptLevel_check'
    ) THEN
        ALTER TABLE "Kanji" ADD CONSTRAINT "Kanji_legacyJlptLevel_check"
            CHECK ("legacyJlptLevel" BETWEEN 1 AND 4);
    END IF;

    -- Keep raw records unchanged. JSONB numeric comparisons reject strings and fractions
    -- without casting untrusted text, while accepting integer-valued JSON numbers.
    WITH proven_source_levels AS (
        SELECT kanji."id",
            CASE record."rawJson" #> '{misc,jlptLevel}'
                WHEN '1'::jsonb THEN 1
                WHEN '2'::jsonb THEN 2
                WHEN '3'::jsonb THEN 3
                WHEN '4'::jsonb THEN 4
                ELSE NULL
            END AS legacy_level
        FROM "Kanji" AS kanji
        JOIN "ImportedRecord" AS record ON record."id" = kanji."kanjidicImportedRecordId"
        JOIN "ImportRun" AS run ON run."id" = record."importRunId"
        JOIN "DataSource" AS source ON source."id" = run."dataSourceId"
        WHERE record."recordType" = 'KANJIDIC2_CHARACTER'
            AND run."status" = 'SUCCESS'
            AND source."name" = 'KANJIDIC2'
            AND jsonb_typeof(record."rawJson" -> 'literal') = 'string'
            AND record."rawJson" ->> 'literal' = kanji."character"
            AND record."sourceRecordId" = kanji."kanjidicSourceId"
            AND char_length(kanji."character") = 1
            AND record."sourceRecordId" = 'kanjidic2:' || to_hex(ascii(kanji."character"))
    )
    UPDATE "Kanji" AS kanji
    SET "legacyJlptLevel" = evidence.legacy_level,
        -- On first backfill, a same-value out-of-band modern edit is indistinguishable.
        "jlptLevel" = CASE WHEN kanji."jlptLevel" = evidence.legacy_level
            THEN NULL ELSE kanji."jlptLevel" END,
        "updatedAt" = CURRENT_TIMESTAMP
    FROM proven_source_levels AS evidence
    WHERE kanji."id" = evidence."id"
        AND kanji."legacyJlptLevel" IS NULL
        AND evidence.legacy_level IS NOT NULL;
END;
$migration$;
