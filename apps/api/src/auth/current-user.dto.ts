import { type AppLocale, type TranslationDisplayMode } from "@kanji-srs/shared";

import { type UserRole } from "../config/app-config.service";

export type CurrentUserDto = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly locale: AppLocale;
  readonly translationDisplayMode: TranslationDisplayMode;
  readonly timezone: string;
};
