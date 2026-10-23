"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, LogOut, MoreHorizontal } from "lucide-react";

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
import { mainNavigation, secondaryNavigation } from "../lib/navigation";
import { ConnectionStatus } from "./ConnectionStatus";
import { StudyFocusContext } from "./StudyFocus";

type AppShellProps = {
  readonly children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mode, setMode] = useState<TranslationDisplayMode>("ru");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("USER");
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [focusTitle, setFocusTitle] = useState<string | null>(null);
  const focusOwner = useRef<object | null>(null);
  const enterStudy = useCallback((title: string) => {
    const owner = {};
    focusOwner.current = owner;
    setFocusTitle(title);
    return () => {
      if (focusOwner.current === owner) {
        focusOwner.current = null;
        setFocusTitle(null);
      }
    };
  }, []);

  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target) &&
        menuRef.current
      )
        menuRef.current.open = false;
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

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
    <StudyFocusContext.Provider value={enterStudy}>
      <div className={`app-shell${focusTitle === null ? "" : " study-focus-shell"}`}>
        <header className="topbar">
          <div className="topbar-inner">
            <Link
              className="brand"
              href="/dashboard"
              title={focusTitle === null ? undefined : "На панель; занятие можно продолжить позже"}
            >
              {focusTitle === null ? (
                APP_NAME
              ) : (
                <>
                  <ArrowLeft aria-hidden="true" size={18} />
                  <span>На панель</span>
                </>
              )}
            </Link>
            {focusTitle === null ? (
              <nav aria-label="Основная навигация" className="nav">
                {mainNavigation
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
            ) : (
              <span className="study-focus-title">{focusTitle}</span>
            )}
            <div className="topbar-actions">
              {focusTitle === null ? (
                <details className="nav-overflow" ref={menuRef}>
                  <summary
                    aria-label="Другие разделы"
                    className="icon-button"
                    title="Другие разделы"
                  >
                    <MoreHorizontal aria-hidden="true" size={20} />
                  </summary>
                  <nav aria-label="Другие разделы" className="nav-menu">
                    {secondaryNavigation
                      .filter((item) => !item.adminOnly || role === "ADMIN")
                      .map((item) => (
                        <Link
                          aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                          href={item.href}
                          key={item.href}
                        >
                          {item.label}
                        </Link>
                      ))}
                  </nav>
                </details>
              ) : null}
              <label className="mode-control">
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
              {focusTitle !== null ? null : isSignedIn ? (
                <button
                  aria-label={`Выйти${displayName === null ? "" : `: ${displayName}`}`}
                  className="icon-button"
                  onClick={handleLogout}
                  title="Выйти из аккаунта"
                  type="button"
                >
                  <LogOut aria-hidden="true" size={18} />
                </button>
              ) : (
                <Link className="auth-link" href="/login">
                  Войти
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="main">
          <ConnectionStatus />
          {children}
        </main>
        <style jsx>{`
          @media (max-width: 920px), (max-height: 600px) {
            .topbar {
              position: static;
            }
          }
        `}</style>
      </div>
    </StudyFocusContext.Provider>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
