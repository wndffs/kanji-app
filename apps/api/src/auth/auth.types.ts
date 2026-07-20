import {
  type AppLocale,
  type DashboardWidgetPreferenceDto,
  type LessonOrderMode,
  type ReviewOrderMode,
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
  readonly dashboardWidgets?: readonly DashboardWidgetPreferenceDto[];
};

export type CurrentUserDto = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: UserRole;
  readonly settings: UserSettingsDto;
};

export type PublicUserDto = CurrentUserDto;

export type AuthSessionDto = {
  readonly user: CurrentUserDto;
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
  readonly user: CurrentUserDto;
  readonly shiftedReviewCount: number;
  readonly vacationDurationSeconds: number;
};

export type StoredUser = {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string | null;
  readonly role: UserRole;
  readonly settings: UserSettingsDto;
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
