import {
  type AppLocale,
  type DashboardWidgetPreferenceDto,
  type InterfacePreferences,
  type LessonOrderMode,
  type LessonPronunciationMode,
  type ReviewOrderMode,
  type ReviewReminderPreferencesDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

export type UserRole = "USER" | "ADMIN";

export type UserSettingsDto = {
  readonly locale: AppLocale;
  readonly translationDisplayMode: TranslationDisplayMode;
  readonly timezone: string;
  readonly dailyLessonLimit: number;
  readonly lessonBatchSize?: number;
  readonly lessonOrderMode?: LessonOrderMode;
  readonly reviewBudget: number;
  readonly reviewOrderMode?: ReviewOrderMode;
  readonly strictMode: boolean;
  readonly vacationStartedAt?: string | null;
  readonly speechVoiceUri?: string | null;
  readonly speechRate?: number;
  readonly speechAutoplay?: boolean;
  readonly soundFeedback?: boolean;
  readonly lessonPronunciationMode?: LessonPronunciationMode;
  readonly lessonRomaji?: boolean;
  readonly dashboardWidgets?: readonly DashboardWidgetPreferenceDto[];
} & Partial<InterfacePreferences> &
  ReviewReminderPreferencesDto;

export type PublicUserSettingsDto = UserSettingsDto;
export type LegacyUserSettings = Omit<UserSettingsDto, keyof ReviewReminderPreferencesDto> &
  Partial<ReviewReminderPreferencesDto>;

export type CurrentUserDto = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: UserRole;
  readonly settings: LegacyUserSettings;
};

export type PublicUserDto = Omit<CurrentUserDto, "settings"> & {
  readonly settings: PublicUserSettingsDto;
};

export type AuthSessionDto = {
  readonly user: PublicUserDto;
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly expiresAt: string;
};

export type RegisterRequestDto = {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string | null;
  readonly settings?: Partial<UserSettingsDto>;
};

export type LoginRequestDto = {
  readonly email: string;
  readonly password: string;
};

export type UpdateUserSettingsRequestDto = Partial<UserSettingsDto>;

export type VacationModeResponseDto = {
  readonly user: PublicUserDto;
  readonly shiftedReviewCount: number;
  readonly vacationDurationSeconds: number;
};

export type StoredUser = {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string | null;
  readonly role: UserRole;
  readonly settings: LegacyUserSettings;
};

export type CreateUserInput = {
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string | null;
  readonly role: UserRole;
  readonly settings: UserSettingsDto;
};

export type TokenPayload = {
  readonly sub: string;
  readonly email: string;
  readonly role: UserRole;
  readonly iat: number;
  readonly exp: number;
};

export type RequestWithCurrentUser = {
  readonly headers?: Record<string, string | string[] | undefined>;
  currentUser?: CurrentUserDto;
};
