CREATE TABLE "KanjiStrokeGraphic" (
    "id" UUID NOT NULL,
    "kanjiId" UUID NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "viewBox" TEXT NOT NULL,
    "strokesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanjiStrokeGraphic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KanjiStrokeGraphic_kanjiId_key" ON "KanjiStrokeGraphic"("kanjiId");
CREATE UNIQUE INDEX "KanjiStrokeGraphic_sourceRecordId_key" ON "KanjiStrokeGraphic"("sourceRecordId");
CREATE INDEX "KanjiStrokeGraphic_sourceRecordId_idx" ON "KanjiStrokeGraphic"("sourceRecordId");

ALTER TABLE "KanjiStrokeGraphic" ADD CONSTRAINT "KanjiStrokeGraphic_kanjiId_fkey"
  FOREIGN KEY ("kanjiId") REFERENCES "Kanji"("id") ON DELETE CASCADE ON UPDATE CASCADE;
