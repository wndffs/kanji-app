-- Curriculum expansion framework for Foundation -> N2 course planning.

CREATE TYPE "CourseBand" AS ENUM ('FOUNDATION', 'N5', 'N4', 'N3', 'N2');

ALTER TABLE "Component"
ADD COLUMN "meaningEn" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Component_meaningEn_idx"
ON "Component"("meaningEn");

ALTER TABLE "LearningItem"
ADD COLUMN "curriculumBand" "CourseBand";

CREATE INDEX "LearningItem_curriculumBand_idx"
ON "LearningItem"("curriculumBand");

ALTER TABLE "Course"
ADD COLUMN "band" "CourseBand" NOT NULL DEFAULT 'FOUNDATION';

CREATE INDEX "Course_band_idx"
ON "Course"("band");

ALTER TABLE "CourseLevel"
ADD COLUMN "band" "CourseBand" NOT NULL DEFAULT 'FOUNDATION';

CREATE INDEX "CourseLevel_band_idx"
ON "CourseLevel"("band");
