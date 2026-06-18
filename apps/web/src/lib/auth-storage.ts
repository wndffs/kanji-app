import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  isTranslationDisplayMode,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { type CurrentUserDto } from "./api-client";

const TOKEN_KEY = "kanji-srs.accessToken";
const USER_KEY = "kanji-srs.user";
const MODE_KEY = "kanji-srs.translationDisplayMode";
export const AUTH_CHANGED_EVENT = "kanji-srs.auth-changed";

export type StoredSession = {
  readonly token: string;
  readonly user: CurrentUserDto;
};

export function readStoredSession(): StoredSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const token = window.localStorage.getItem(TOKEN_KEY);
  const rawUser = window.localStorage.getItem(USER_KEY);

  if (token === null || rawUser === null) {
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(rawUser) as CurrentUserDto,
    };
  } catch {
    clearStoredSession();
    return null;
  }
}

export function storeSession(session: StoredSession): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  storeTranslationDisplayMode(session.user.settings.translationDisplayMode);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function updateStoredUser(user: CurrentUserDto): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  storeTranslationDisplayMode(user.settings.translationDisplayMode);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearStoredSession(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function readTranslationDisplayMode(): TranslationDisplayMode {
  if (!canUseStorage()) {
    return DEFAULT_TRANSLATION_DISPLAY_MODE;
  }

  const value = window.localStorage.getItem(MODE_KEY);

  return value !== null && isTranslationDisplayMode(value)
    ? value
    : DEFAULT_TRANSLATION_DISPLAY_MODE;
}

export function storeTranslationDisplayMode(mode: TranslationDisplayMode): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(MODE_KEY, mode);
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && window.localStorage !== undefined;
}
