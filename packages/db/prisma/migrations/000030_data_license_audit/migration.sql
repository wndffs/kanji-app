-- Data/license audit provenance fields.

ALTER TABLE "ImportRun"
ADD COLUMN "sourceDownloadedAt" TIMESTAMP(3);

ALTER TABLE "ImportedRecord"
ADD CONSTRAINT "ImportedRecord_sourceRecordId_not_empty"
CHECK (char_length("sourceRecordId") > 0);

ALTER TABLE "Kanji"
ADD COLUMN "kanjidicImportedRecordId" UUID;

ALTER TABLE "Kanji"
ADD CONSTRAINT "Kanji_kanjidicImportedRecordId_fkey"
FOREIGN KEY ("kanjidicImportedRecordId") REFERENCES "ImportedRecord"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Kanji_kanjidicImportedRecordId_idx"
ON "Kanji"("kanjidicImportedRecordId");

ALTER TABLE "KanjiStrokeGraphic"
ADD COLUMN "importedRecordId" UUID;

ALTER TABLE "KanjiStrokeGraphic"
ADD CONSTRAINT "KanjiStrokeGraphic_importedRecordId_fkey"
FOREIGN KEY ("importedRecordId") REFERENCES "ImportedRecord"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "KanjiStrokeGraphic_importedRecordId_idx"
ON "KanjiStrokeGraphic"("importedRecordId");

ALTER TABLE "Word"
ADD COLUMN "jmdictImportedRecordId" UUID;

ALTER TABLE "Word"
ADD CONSTRAINT "Word_jmdictImportedRecordId_fkey"
FOREIGN KEY ("jmdictImportedRecordId") REFERENCES "ImportedRecord"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Word_jmdictImportedRecordId_idx"
ON "Word"("jmdictImportedRecordId");

ALTER TABLE "Sentence"
ADD COLUMN "importedRecordId" UUID;

ALTER TABLE "Sentence"
ADD CONSTRAINT "Sentence_importedRecordId_fkey"
FOREIGN KEY ("importedRecordId") REFERENCES "ImportedRecord"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Sentence_importedRecordId_idx"
ON "Sentence"("importedRecordId");

ALTER TABLE "LearningAnswer"
ADD COLUMN "sourceKind" "ContentSourceKind" NOT NULL DEFAULT 'PROJECT_AUTHORED';

CREATE INDEX "LearningAnswer_sourceKind_idx"
ON "LearningAnswer"("sourceKind");

ALTER TABLE "BlockedAnswer"
ADD COLUMN "sourceKind" "ContentSourceKind" NOT NULL DEFAULT 'PROJECT_AUTHORED';

CREATE INDEX "BlockedAnswer_sourceKind_idx"
ON "BlockedAnswer"("sourceKind");
