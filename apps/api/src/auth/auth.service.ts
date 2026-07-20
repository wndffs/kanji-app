import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import {
  DASHBOARD_WIDGET_IDS,
  MAX_SPEECH_RATE,
  MIN_SPEECH_RATE,
  type DashboardWidgetPreferenceDto,
  type LessonOrderMode,
  type ReviewOrderMode,
  type TranslationDisplayMode,
  isDashboardWidgetId,
  isLessonOrderMode,
  isReviewOrderMode,
  isTranslationDisplayMode,
} from "@kanji-srs/shared";

import {
  type AuthSessionDto,
  type CurrentUserDto,
  type LoginRequestDto,
  type RegisterRequestDto,
  type StoredUser,
  type UpdateUserSettingsRequestDto,
  type UserSettingsDto,
  type VacationModeResponseDto,
} from "./auth.types";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { mergeUserSettings } from "./user-settings.defaults";
import { UsersRepository } from "./users.repository";

type UserSettingsUpdate = {
  locale?: UserSettingsDto["locale"];
  translationDisplayMode?: UserSettingsDto["translationDisplayMode"];
  timezone?: UserSettingsDto["timezone"];
  dailyLessonLimit?: UserSettingsDto["dailyLessonLimit"];
  lessonBatchSize?: UserSettingsDto["lessonBatchSize"];
  lessonOrderMode?: UserSettingsDto["lessonOrderMode"];
  reviewBudget?: UserSettingsDto["reviewBudget"];
  reviewOrderMode?: UserSettingsDto["reviewOrderMode"];
  strictMode?: UserSettingsDto["strictMode"];
  speechVoiceUri?: UserSettingsDto["speechVoiceUri"];
  speechRate?: UserSettingsDto["speechRate"];
  speechAutoplay?: UserSettingsDto["speechAutoplay"];
  soundFeedback?: UserSettingsDto["soundFeedback"];
  dashboardWidgets?: UserSettingsDto["dashboardWidgets"];
};

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
const MAX_EMAIL_LENGTH = 254;
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_TIMEZONE_LENGTH = 80;
const MAX_DAILY_LESSON_LIMIT = 200;
const MAX_LESSON_BATCH_SIZE = 5;
const MAX_REVIEW_BUDGET = 1_000;
const MAX_SPEECH_VOICE_URI_LENGTH = 500;

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(TokenService) private readonly tokenService: TokenService,
  ) {}

  async register(body: unknown): Promise<AuthSessionDto> {
    const request = parseRegisterRequest(body);
    const existingUser = await this.usersRepository.findByEmail(request.email);

    if (existingUser !== null) {
      throw new ConflictException("Email is already registered.");
    }

    const passwordHash = await this.passwordService.hashPassword(request.password);
    const user = await this.usersRepository.createUser({
      email: request.email,
      passwordHash,
      displayName: request.displayName ?? null,
      role: "USER",
      settings: mergeUserSettings(request.settings),
    });
    await this.usersRepository.enrollInDefaultCourses(user.id);

    return this.createSession(user);
  }

  async login(body: unknown): Promise<AuthSessionDto> {
    const request = parseLoginRequest(body);
    const user = await this.usersRepository.findByEmail(request.email);

    if (user === null) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const isPasswordValid = await this.passwordService.verifyPassword(
      request.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.createSession(user);
  }

  logout(): { readonly ok: true } {
    return { ok: true };
  }

  async authenticateToken(token: string): Promise<CurrentUserDto> {
    const payload = this.tokenService.verifySessionToken(token);
    const user = await this.usersRepository.findById(payload.sub);

    if (user === null) {
      throw new UnauthorizedException("Session user no longer exists.");
    }

    return toCurrentUser(user);
  }

  async updateSettings(user: CurrentUserDto, body: unknown): Promise<CurrentUserDto> {
    const settings = parseUserSettingsUpdate(body);
    const updatedUser = await this.usersRepository.updateSettings(user.id, settings);

    return toCurrentUser(updatedUser);
  }

  async setVacationMode(
    user: CurrentUserDto,
    body: unknown,
  ): Promise<VacationModeResponseDto> {
    const enabled = parseVacationModeRequest(body);
    const result = await this.usersRepository.setVacationMode(user.id, enabled, new Date());

    return {
      user: toCurrentUser(result.user),
      shiftedReviewCount: result.shiftedReviewCount,
      vacationDurationSeconds: result.vacationDurationSeconds,
    };
  }

  private createSession(user: StoredUser): AuthSessionDto {
    const currentUser = toCurrentUser(user);
    const session = this.tokenService.createSessionToken(currentUser);

    return {
      user: currentUser,
      accessToken: session.token,
      tokenType: "Bearer",
      expiresAt: session.expiresAt.toISOString(),
    };
  }
}

function toCurrentUser(user: StoredUser): CurrentUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    settings: user.settings,
  };
}

function parseRegisterRequest(body: unknown): RegisterRequestDto {
  const record = parseBodyRecord(body);
  const email = normalizeEmail(readRequiredString(record, "email"));
  const password = readRequiredString(record, "password");
  const displayName = readOptionalTrimmedString(record, "displayName");
  const settings = parseOptionalUserSettings(record.settings);

  assertValidEmail(email);
  assertValidPassword(password);

  return {
    email,
    password,
    displayName,
    settings,
  };
}

function parseLoginRequest(body: unknown): LoginRequestDto {
  const record = parseBodyRecord(body);
  const email = normalizeEmail(readRequiredString(record, "email"));
  const password = readRequiredString(record, "password");

  assertValidEmail(email);
  assertPasswordWithinHashLimit(password);

  return { email, password };
}

function parseUserSettingsUpdate(body: unknown): UpdateUserSettingsRequestDto {
  return parseUserSettings(parseBodyRecord(body), { allowEmpty: false });
}

function parseVacationModeRequest(body: unknown): boolean {
  const enabled = parseBodyRecord(body).enabled;

  if (typeof enabled !== "boolean") {
    throw new BadRequestException("Поле enabled должно быть логическим значением.");
  }

  return enabled;
}

function parseOptionalUserSettings(value: unknown): Partial<UserSettingsDto> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return parseUserSettings(parseRecord(value, "settings"), { allowEmpty: true });
}

function parseUserSettings(
  record: Record<string, unknown>,
  options: { readonly allowEmpty: boolean },
): Partial<UserSettingsDto> {
  const settings: UserSettingsUpdate = {};

  if (record.locale !== undefined) {
    const locale = readRequiredString(record, "locale");

    if (locale !== "ru-RU") {
      throw new BadRequestException("locale must be ru-RU.");
    }

    settings.locale = locale;
  }

  if (record.translationDisplayMode !== undefined) {
    settings.translationDisplayMode = parseTranslationDisplayMode(
      readRequiredString(record, "translationDisplayMode"),
    );
  }

  if (record.timezone !== undefined) {
    settings.timezone = parseTimezone(readRequiredString(record, "timezone"));
  }

  if (record.dailyLessonLimit !== undefined) {
    settings.dailyLessonLimit = parseBoundedInteger(
      record.dailyLessonLimit,
      "dailyLessonLimit",
      1,
      MAX_DAILY_LESSON_LIMIT,
    );
  }

  if (record.lessonBatchSize !== undefined) {
    settings.lessonBatchSize = parseBoundedInteger(
      record.lessonBatchSize,
      "lessonBatchSize",
      1,
      MAX_LESSON_BATCH_SIZE,
    );
  }

  if (record.lessonOrderMode !== undefined) {
    settings.lessonOrderMode = parseLessonOrderMode(record.lessonOrderMode);
  }

  if (record.reviewBudget !== undefined) {
    settings.reviewBudget = parseBoundedInteger(
      record.reviewBudget,
      "reviewBudget",
      1,
      MAX_REVIEW_BUDGET,
    );
  }

  if (record.reviewOrderMode !== undefined) {
    settings.reviewOrderMode = parseReviewOrderMode(record.reviewOrderMode);
  }

  if (record.strictMode !== undefined) {
    if (typeof record.strictMode !== "boolean") {
      throw new BadRequestException("strictMode must be a boolean.");
    }

    settings.strictMode = record.strictMode;
  }

  if (record.speechVoiceUri !== undefined) {
    settings.speechVoiceUri = parseNullableString(
      record.speechVoiceUri,
      "speechVoiceUri",
      MAX_SPEECH_VOICE_URI_LENGTH,
    );
  }

  if (record.speechRate !== undefined) {
    settings.speechRate = parseSpeechRate(record.speechRate);
  }

  if (record.speechAutoplay !== undefined) {
    settings.speechAutoplay = parseBoolean(record.speechAutoplay, "speechAutoplay");
  }

  if (record.soundFeedback !== undefined) {
    settings.soundFeedback = parseBoolean(record.soundFeedback, "soundFeedback");
  }

  if (record.dashboardWidgets !== undefined) {
    settings.dashboardWidgets = parseDashboardWidgets(record.dashboardWidgets);
  }

  if (!options.allowEmpty && Object.keys(settings).length === 0) {
    throw new BadRequestException("At least one setting must be provided.");
  }

  return settings;
}

function parseNullableString(value: unknown, key: string, maxLength: number): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestException(`${key} должен быть строкой или null.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${key} не должен быть длиннее ${maxLength} символов.`);
  }

  return trimmed === "" ? null : trimmed;
}

function parseSpeechRate(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < MIN_SPEECH_RATE ||
    value > MAX_SPEECH_RATE
  ) {
    throw new BadRequestException(
      `speechRate должен быть числом от ${MIN_SPEECH_RATE} до ${MAX_SPEECH_RATE}.`,
    );
  }

  return value;
}

function parseBoolean(value: unknown, key: string): boolean {
  if (typeof value !== "boolean") {
    throw new BadRequestException(`${key} должен быть логическим значением.`);
  }

  return value;
}

function parseBodyRecord(body: unknown): Record<string, unknown> {
  return parseRecord(body, "Request body");
}

function parseRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestException(`${key} must be a non-empty string.`);
  }

  return value;
}

function readOptionalTrimmedString(
  record: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = record[key];

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestException(`${key} must be a string or null.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new BadRequestException(`${key} is too long.`);
  }

  return trimmed === "" ? null : trimmed;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function assertValidEmail(email: string): void {
  const isLikelyEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!isLikelyEmail || email.length > MAX_EMAIL_LENGTH) {
    throw new BadRequestException("email must be a valid email address.");
  }
}

function assertValidPassword(password: string): void {
  assertPasswordWithinHashLimit(password);

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(`password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

function assertPasswordWithinHashLimit(password: string): void {
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new BadRequestException(`password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }
}

function parseTranslationDisplayMode(value: string): TranslationDisplayMode {
  if (!isTranslationDisplayMode(value)) {
    throw new BadRequestException("translationDisplayMode must be ru, en, or ru-en.");
  }

  return value;
}

function parseDashboardWidgets(value: unknown): readonly DashboardWidgetPreferenceDto[] {
  if (!Array.isArray(value) || value.length !== DASHBOARD_WIDGET_IDS.length) {
    throw new BadRequestException(
      "dashboardWidgets must contain every dashboard widget exactly once.",
    );
  }

  const seen = new Set<string>();
  const preferences = value.map((entry): DashboardWidgetPreferenceDto => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new BadRequestException("dashboardWidgets contains an invalid widget.");
    }

    const record = entry as Record<string, unknown>;
    const id = record.id;
    const visible = record.visible;
    const presentation = record.presentation;

    if (
      !isDashboardWidgetId(id) ||
      seen.has(id) ||
      typeof visible !== "boolean" ||
      (presentation !== "compact" && presentation !== "expanded")
    ) {
      throw new BadRequestException("dashboardWidgets contains an invalid widget.");
    }

    seen.add(id);

    return {
      id,
      visible,
      presentation,
    };
  });

  return preferences;
}

function parseLessonOrderMode(value: unknown): LessonOrderMode {
  if (!isLessonOrderMode(value)) {
    throw new BadRequestException("lessonOrderMode must be course or interleaved.");
  }

  return value;
}

function parseReviewOrderMode(value: unknown): ReviewOrderMode {
  if (!isReviewOrderMode(value)) {
    throw new BadRequestException(
      "reviewOrderMode must be shuffled, oldest-first, or lower-levels-first.",
    );
  }

  return value;
}

function parseTimezone(value: string): string {
  const timezone = value.trim();

  if (timezone.length === 0 || timezone.length > MAX_TIMEZONE_LENGTH) {
    throw new BadRequestException("timezone is invalid.");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new BadRequestException("timezone is invalid.");
  }

  return timezone;
}

function parseBoundedInteger(value: unknown, key: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${key} must be an integer between ${min} and ${max}.`);
  }

  return value;
}
