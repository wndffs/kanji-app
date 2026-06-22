"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import {
  APP_NAME,
  SUPPORTED_TRANSLATION_DISPLAY_MODES,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { updateUserSettings, type UserRole } from "../lib/api-client";
import {
  AUTH_CHANGED_EVENT,
  clearStoredSession,
  readStoredSession,
  readTranslationDisplayMode,
  storeTranslationDisplayMode,
  updateStoredUser,
} from "../lib/auth-storage";
import { formatTranslationDisplayMode } from "../lib/dashboard-format";
import { primaryNavigation } from "../lib/navigation";

type AppShellProps = {
  readonly children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mode, setMode] = useState<TranslationDisplayMode>("ru");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("USER");

  useEffect(() => {
    function syncSessionState(): void {
      const session = readStoredSession();
      setMode(readTranslationDisplayMode());
      setIsSignedIn(session !== null);
      setDisplayName(session?.user.displayName ?? session?.user.email ?? null);
      setRole(session?.user.role ?? "USER");
    }

    syncSessionState();
    window.addEventListener(AUTH_CHANGED_EVENT, syncSessionState);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, syncSessionState);
  }, []);

  async function handleModeChange(nextMode: TranslationDisplayMode): Promise<void> {
    setMode(nextMode);
    storeTranslationDisplayMode(nextMode);

    const session = readStoredSession();

    if (session === null) {
      return;
    }

    try {
      const user = await updateUserSettings(session.token, {
        translationDisplayMode: nextMode,
      });
      updateStoredUser(user);
    } catch {
      setMode(session.user.settings.translationDisplayMode);
      storeTranslationDisplayMode(session.user.settings.translationDisplayMode);
    }
  }

  function handleLogout(): void {
    clearStoredSession();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/dashboard">
            {APP_NAME}
          </Link>
          <nav aria-label="Основная навигация" className="nav">
            {primaryNavigation
              .filter((item) => item.adminOnly !== true || role === "ADMIN")
              .map((item) => (
                <Link
                  aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                  className="nav-link"
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
          </nav>
          <div className="topbar-actions">
            <label className="mode-control">
              <span>Перевод</span>
              <select
                aria-label="Режим перевода карточек"
                onChange={(event) =>
                  void handleModeChange(event.currentTarget.value as TranslationDisplayMode)
                }
                value={mode}
              >
                {SUPPORTED_TRANSLATION_DISPLAY_MODES.map((item) => (
                  <option key={item} value={item}>
                    {formatTranslationDisplayMode(item)}
                  </option>
                ))}
              </select>
            </label>
            {isSignedIn ? (
              <button className="link-button" onClick={handleLogout} type="button">
                Выйти{displayName === null ? "" : `: ${displayName}`}
              </button>
            ) : (
              <Link className="auth-link" href="/login">
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
