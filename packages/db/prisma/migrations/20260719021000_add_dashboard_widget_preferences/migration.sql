ALTER TABLE "UserSettings"
ADD COLUMN "dashboardWidgets" JSONB NOT NULL DEFAULT '[]'::jsonb;
