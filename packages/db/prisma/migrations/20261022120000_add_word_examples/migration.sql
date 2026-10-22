CREATE TABLE IF NOT EXISTS "WordExample" (
    "id" UUID NOT NULL,
    "wordId" UUID NOT NULL,
    "sentenceId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WordExample_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WordExample_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WordExample_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WordExample_wordId_sentenceId_key" ON "WordExample"("wordId", "sentenceId");
CREATE INDEX IF NOT EXISTS "WordExample_wordId_status_sortOrder_id_idx" ON "WordExample"("wordId", "status", "sortOrder", "id");
CREATE INDEX IF NOT EXISTS "WordExample_sentenceId_idx" ON "WordExample"("sentenceId");
