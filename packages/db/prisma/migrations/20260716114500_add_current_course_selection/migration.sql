ALTER TABLE "UserSettings" ADD COLUMN "currentCourseId" UUID;

CREATE INDEX "UserSettings_currentCourseId_idx" ON "UserSettings"("currentCourseId");

ALTER TABLE "UserSettings"
ADD CONSTRAINT "UserSettings_currentCourseId_fkey"
FOREIGN KEY ("currentCourseId") REFERENCES "Course"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
