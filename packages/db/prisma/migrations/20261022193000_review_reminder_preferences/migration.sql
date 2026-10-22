ALTER TABLE "UserSettings"
ADD COLUMN "reviewRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewReminderHour" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN "reviewReminderLastClaimedAt" TIMESTAMP(3);

ALTER TABLE "UserSettings"
ADD CONSTRAINT "UserSettings_reviewReminderHour_check"
CHECK ("reviewReminderHour" >= 0 AND "reviewReminderHour" <= 23);
