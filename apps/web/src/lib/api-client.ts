import { type AppLocale, type DashboardDto, type TranslationDisplayMode } from "@kanji-srs/shared";

export type UserRole = "USER" | "ADMIN";

export type UserSettingsDto = {
  readonly locale: AppLocale;
  readonly translationDisplayMode: TranslationDisplayMode;
  readonly timezone: string;
  readonly dailyLessonLimit: number;
  readonly reviewBudget: number;
  readonly strictMode: boolean;
};

export type CurrentUserDto = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: UserRole;
  readonly settings: UserSettingsDto;
};

export type AuthSessionDto = {
  readonly user: CurrentUserDto;
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly expiresAt: string;
};

export type ApiRequestOptions = {
  readonly method?: "GET" | "POST" | "PATCH" | "DELETE";
  readonly token?: string | null;
  readonly body?: unknown;
  readonly fetchImpl?: typeof fetch;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = new Headers();

  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetchImpl(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

export function login(email: string, password: string): Promise<AuthSessionDto> {
  return apiRequest<AuthSessionDto>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function register(input: {
  readonly email: string;
  readonly password: string;
  readonly displayName: string | null;
}): Promise<AuthSessionDto> {
  return apiRequest<AuthSessionDto>("/auth/register", {
    method: "POST",
    body: input,
  });
}

export function getDashboard(token: string): Promise<DashboardDto> {
  return apiRequest<DashboardDto>("/dashboard", { token });
}

export function getCurrentUser(token: string): Promise<CurrentUserDto> {
  return apiRequest<CurrentUserDto>("/auth/me", { token });
}

export function updateUserSettings(
  token: string,
  settings: Partial<UserSettingsDto>,
): Promise<CurrentUserDto> {
  return apiRequest<CurrentUserDto>("/users/settings", {
    method: "PATCH",
    token,
    body: settings,
  });
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { readonly message?: unknown };
    const message = payload.message;

    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === "string").join(" ");
    }

    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
  } catch {
    return "Не удалось получить ответ API.";
  }

  return "Не удалось выполнить запрос.";
}
