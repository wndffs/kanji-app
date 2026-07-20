CREATE TABLE "KanjiConfusablePair" (
    "id" UUID NOT NULL,
    "leftKanjiId" UUID NOT NULL,
    "rightKanjiId" UUID NOT NULL,
    "visual" BOOLEAN NOT NULL DEFAULT false,
    "semantic" BOOLEAN NOT NULL DEFAULT false,
    "strength" INTEGER NOT NULL DEFAULT 50,
    "explanationRu" TEXT,
    "explanationEn" TEXT,
    "sourceKind" "ContentSourceKind" NOT NULL DEFAULT 'PROJECT_AUTHORED',
    "sourceNote" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" UUID NOT NULL,
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KanjiConfusablePair_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KanjiConfusablePair_distinct_kanji_check"
      CHECK ("leftKanjiId" < "rightKanjiId"),
    CONSTRAINT "KanjiConfusablePair_relation_kind_check"
      CHECK ("visual" OR "semantic"),
    CONSTRAINT "KanjiConfusablePair_strength_check"
      CHECK ("strength" BETWEEN 1 AND 100),
    CONSTRAINT "KanjiConfusablePair_project_source_check"
      CHECK ("sourceKind" = 'PROJECT_AUTHORED'),
    CONSTRAINT "KanjiConfusablePair_published_approval_check"
      CHECK (
        "status" <> 'PUBLISHED'
        OR ("approvedByUserId" IS NOT NULL AND "approvedAt" IS NOT NULL)
      )
);

CREATE UNIQUE INDEX "KanjiConfusablePair_leftKanjiId_rightKanjiId_key"
ON "KanjiConfusablePair"("leftKanjiId", "rightKanjiId");

CREATE INDEX "KanjiConfusablePair_rightKanjiId_idx"
ON "KanjiConfusablePair"("rightKanjiId");

CREATE INDEX "KanjiConfusablePair_status_strength_idx"
ON "KanjiConfusablePair"("status", "strength");

CREATE INDEX "KanjiConfusablePair_createdByUserId_idx"
ON "KanjiConfusablePair"("createdByUserId");

CREATE INDEX "KanjiConfusablePair_approvedByUserId_idx"
ON "KanjiConfusablePair"("approvedByUserId");

ALTER TABLE "KanjiConfusablePair"
ADD CONSTRAINT "KanjiConfusablePair_leftKanjiId_fkey"
FOREIGN KEY ("leftKanjiId") REFERENCES "Kanji"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KanjiConfusablePair"
ADD CONSTRAINT "KanjiConfusablePair_rightKanjiId_fkey"
FOREIGN KEY ("rightKanjiId") REFERENCES "Kanji"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KanjiConfusablePair"
ADD CONSTRAINT "KanjiConfusablePair_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KanjiConfusablePair"
ADD CONSTRAINT "KanjiConfusablePair_approvedByUserId_fkey"
FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
