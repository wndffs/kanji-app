ALTER TABLE "UserSettings"
ADD COLUMN IF NOT EXISTS "interfaceTheme" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN IF NOT EXISTS "interfaceDensity" TEXT NOT NULL DEFAULT 'comfortable',
ADD COLUMN IF NOT EXISTS "interfaceMotion" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN IF NOT EXISTS "studyTextSize" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS "studyInformationDensity" TEXT NOT NULL DEFAULT 'comfortable';
