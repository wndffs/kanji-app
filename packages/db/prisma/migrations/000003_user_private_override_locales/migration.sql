ALTER TABLE "UserItemOverride" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ru-RU';
ALTER TABLE "UserMnemonic" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ru-RU';

DROP INDEX "UserItemOverride_userId_learningCardId_overrideType_normali_key";
DROP INDEX "UserMnemonic_userId_learningItemId_mnemonicType_key";

CREATE UNIQUE INDEX "UserItemOverride_user_card_type_locale_text_key"
  ON "UserItemOverride"("userId", "learningCardId", "overrideType", "locale", "normalizedText");
CREATE INDEX "UserItemOverride_locale_idx" ON "UserItemOverride"("locale");

CREATE UNIQUE INDEX "UserMnemonic_user_item_locale_type_key"
  ON "UserMnemonic"("userId", "learningItemId", "locale", "mnemonicType");
CREATE INDEX "UserMnemonic_locale_idx" ON "UserMnemonic"("locale");
