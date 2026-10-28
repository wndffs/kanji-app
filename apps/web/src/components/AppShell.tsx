"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  LogOut,
  MoreHorizontal,
  LayoutDashboard,
  BookOpen,
  RotateCw,
  Grid2X2,
  Search,
  Languages,
  LibraryBig,
  Layers,
  Settings,
  Dumbbell,
  ShieldCheck,
} from "lucide-react";

import {
  APP_NAME,
  SUPPORTED_TRANSLATION_DISPLAY_MODES,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { getCurrentUser, updateUserSettings, type UserRole } from "../lib/api-client";
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
import { ownsSession } from "../lib/use-stored-session";

type AppShellProps = {
  readonly children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const [mode, setMode] = useState<TranslationDisplayMode>("ru");
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const modeRequest = useRef<object | null>(null);
  const modeRead = useRef<AbortController | null>(null);
  const modeSelect = useRef<HTMLSelectElement>(null);
  const modeRetry = useRef<HTMLButtonElement>(null);
  const restoreModeFocus = useRef(false);
  const shellOwner = useRef<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("USER");
  const [mobileNavigation, setMobileNavigation] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [focusTitle, setFocusTitle] = useState<string | null>(null);
  const [focusReturnHref, setFocusReturnHref] = useState("/dashboard");
  const focusOwner = useRef<object | null>(null);
  const enterStudy = useCallback((title: string, returnHref = "/dashboard") => {
    const owner = {};
    focusOwner.current = owner;
    setFocusTitle(title);
    setFocusReturnHref(returnHref);
    return () => {
      if (focusOwner.current === owner) {
        focusOwner.current = null;
        setFocusTitle(null);
      }
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const sync = () => setMobileNavigation(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
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
      const owner = session === null ? null : `${session.user.id}:${session.token}`;
      if (owner !== shellOwner.current) {
        restoreModeFocus.current = false;
        modeRead.current?.abort();
        shellOwner.current = owner;
        modeRequest.current = null;
        setIsSavingMode(false);
        setModeError(null);
      }
      setMode(readTranslationDisplayMode());
      setIsSignedIn(session !== null);
      setDisplayName(session?.user.displayName ?? session?.user.email ?? null);
      setRole(session?.user.role ?? "USER");
    }

    syncSessionState();
    window.addEventListener(AUTH_CHANGED_EVENT, syncSessionState);
    window.addEventListener("storage", syncSessionState);
    return () => {
      modeRead.current?.abort();
      modeRequest.current = null;
      window.removeEventListener(AUTH_CHANGED_EVENT, syncSessionState);
      window.removeEventListener("storage", syncSessionState);
    };
  }, []);

  useEffect(() => {
    if (isSavingMode || !restoreModeFocus.current) return;
    restoreModeFocus.current = false;
    if (
      document.activeElement === document.body ||
      document.activeElement === modeSelect.current ||
      document.activeElement === modeRetry.current
    ) {
      (modeError ? modeRetry.current : modeSelect.current)?.focus();
    }
  }, [isSavingMode, modeError]);

  async function handleModeChange(nextMode: TranslationDisplayMode): Promise<void> {
    if (modeRequest.current !== null || modeError !== null) return;
    restoreModeFocus.current = document.activeElement === modeSelect.current;
    setModeError(null);
    setMode(nextMode);
    storeTranslationDisplayMode(nextMode);

    const session = readStoredSession();

    if (session === null) {
      return;
    }
    const request = {};
    modeRequest.current = request;
    setIsSavingMode(true);
    try {
      const user = await updateUserSettings(session.token, {
        translationDisplayMode: nextMode,
      });
      if (modeRequest.current !== request || !ownsSession(session.token)) return;
      if (user.id !== session.user.id) throw new Error("Неверный владелец настроек.");
      updateStoredUser(user);
    } catch {
      if (modeRequest.current !== request || !ownsSession(session.token)) return;
      setMode(session.user.settings.translationDisplayMode);
      storeTranslationDisplayMode(session.user.settings.translationDisplayMode);
      setModeError("Сохранение режима не подтверждено.");
    } finally {
      if (modeRequest.current === request) {
        modeRequest.current = null;
        setIsSavingMode(false);
      }
    }
  }

  async function reconcileMode(): Promise<void> {
    if (modeRequest.current !== null) return;
    restoreModeFocus.current = document.activeElement === modeRetry.current;
    const session = readStoredSession();
    if (session === null) return;
    const request = {};
    const controller = new AbortController();
    modeRequest.current = request;
    modeRead.current = controller;
    setIsSavingMode(true);
    try {
      const user = await getCurrentUser(session.token, controller.signal);
      if (
        controller.signal.aborted ||
        modeRequest.current !== request ||
        !ownsSession(session.token)
      )
        return;
      if (user.id !== session.user.id) throw new Error("Неверный владелец настроек.");
      updateStoredUser(user);
      setModeError(null);
    } catch {
      if (
        !controller.signal.aborted &&
        modeRequest.current === request &&
        ownsSession(session.token)
      ) {
        setModeError("Не удалось сверить режим с сервером.");
      }
    } finally {
      if (modeRequest.current === request) {
        modeRequest.current = null;
        modeRead.current = null;
        setIsSavingMode(false);
      }
    }
  }

  function handleLogout(): void {
    clearStoredSession();
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDetailsElement>): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const menu = event.currentTarget;
    const links = Array.from(menu.querySelectorAll<HTMLAnchorElement>("nav a"));
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (!links.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (!menu.open && (event.key === "Home" || event.key === "End")) return;
    event.preventDefault();
    menu.open = true;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? links.length - 1
          : event.key === "ArrowDown"
            ? (index + 1) % links.length
            : (index <= 0 ? links.length : index) - 1;
    links[next]?.focus();
  }

  return (
    <StudyFocusContext.Provider value={enterStudy}>
      <div
        className={`app-shell${focusTitle === null ? "" : " study-focus-shell"}${isAuthPage ? " auth-shell" : ""}`}
      >
        <a className="skip-to-content" href="#main-content">
          К содержимому
        </a>
        {focusTitle === null && !isAuthPage ? (
          <aside className="app-rail">
            <Link className="brand rail-brand" href="/dashboard">
              <Image src="/icons/app-192.png" width={32} height={32} alt="" />
              {APP_NAME}
            </Link>
            <nav aria-label="Основная навигация" className="nav">
              <span className="rail-section-label">Учёба</span>
              {mainNavigation
                .filter((item) => !item.adminOnly || role === "ADMIN")
                .map((item) => {
                  const Icon = NAV_ICONS[item.href] ?? BookOpen;
                  return (
                    <Link
                      aria-current={
                        isActivePath(pathname, item.href) ||
                        (mobileNavigation &&
                          item.href === "/characters" &&
                          pathname.startsWith("/kana"))
                          ? "page"
                          : undefined
                      }
                      className="nav-link"
                      href={item.href}
                      key={item.href}
                    >
                      <Icon size={19} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </nav>
            <nav className="rail-library" aria-label="Библиотека и настройки">
              <span className="rail-section-label">Библиотека</span>
              {secondaryNavigation
                .filter((item) => !item.adminOnly || role === "ADMIN")
                .map((item) => {
                  const Icon = NAV_ICONS[item.href] ?? BookOpen;
                  return (
                    <Link
                      className="nav-link"
                      href={item.href}
                      key={item.href}
                      aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </nav>
          </aside>
        ) : null}
        <header className="topbar">
          <div className="topbar-inner">
            <Link
              className="brand brand-mobile"
              href={focusTitle === null ? "/dashboard" : focusReturnHref}
              title={focusTitle === null ? undefined : "Вернуться; занятие можно продолжить позже"}
            >
              {focusTitle === null ? (
                <>
                  <Image src="/icons/app-192.png" width={28} height={28} alt="" />
                  <span>{APP_NAME}</span>
                </>
              ) : (
                <>
                  <ArrowLeft aria-hidden="true" size={18} />
                  <span>{focusReturnHref.startsWith("/courses/") ? "К курсу" : "На панель"}</span>
                </>
              )}
            </Link>
            {focusTitle === null ? (
              <span className="shell-location">{navigationTitle(pathname)}</span>
            ) : (
              <span className="study-focus-title">{focusTitle}</span>
            )}
            <div className="topbar-actions">
              {focusTitle === null ? (
                <details
                  className="nav-overflow"
                  ref={menuRef}
                  onKeyDown={handleMenuKeyDown}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget))
                      event.currentTarget.open = false;
                  }}
                >
                  <summary
                    role="button"
                    aria-label="Другие разделы"
                    className="icon-button"
                    title="Другие разделы"
                  >
                    <MoreHorizontal aria-hidden="true" size={20} />
                  </summary>
                  <nav aria-label="Другие разделы" className="nav-menu">
                    {secondaryNavigation
                      .filter((item) => !item.adminOnly || role === "ADMIN")
                      .map((item) => {
                        const Icon = NAV_ICONS[item.href] ?? BookOpen;
                        return (
                          <Link
                            aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                            href={item.href}
                            key={item.href}
                          >
                            <Icon size={17} aria-hidden="true" />
                            {item.label}
                          </Link>
                        );
                      })}
                  </nav>
                </details>
              ) : null}
              <label className="mode-control">
                <select
                  ref={modeSelect}
                  disabled={isSavingMode || modeError !== null}
                  aria-label="Режим перевода карточек"
                  title={formatTranslationDisplayMode(mode)}
                  onChange={(event) =>
                    void handleModeChange(event.currentTarget.value as TranslationDisplayMode)
                  }
                  value={mode}
                >
                  {SUPPORTED_TRANSLATION_DISPLAY_MODES.map((item) => (
                    <option key={item} value={item}>
                      {item === "ru-en" ? "RU + EN" : formatTranslationDisplayMode(item)}
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
        <main
          className="main"
          id="main-content"
          tabIndex={-1}
          data-page={pathname.split("/")[1] || "home"}
        >
          <ConnectionStatus />
          {modeError ? (
            <div className="shell-mode-status">
              <p className="form-error" role="alert">
                {modeError}
              </p>
              <button
                ref={modeRetry}
                type="button"
                className="secondary-action"
                disabled={isSavingMode}
                onClick={() => void reconcileMode()}
              >
                Сверить режим
              </button>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </StudyFocusContext.Provider>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const NAV_ICONS: Record<string, typeof BookOpen> = {
  "/dashboard": LayoutDashboard,
  "/lessons": BookOpen,
  "/reviews": RotateCw,
  "/characters": Grid2X2,
  "/search": Search,
  "/kana": Languages,
  "/courses": LibraryBig,
  "/decks": Layers,
  "/settings": Settings,
  "/practice": Dumbbell,
  "/admin": ShieldCheck,
};
function navigationTitle(path: string) {
  return (
    [...mainNavigation, ...secondaryNavigation].find(
      (item) => path === item.href || path.startsWith(`${item.href}/`),
    )?.label ??
    (path.startsWith("/kana")
      ? "Кана"
      : path.startsWith("/items") || path.startsWith("/kanji")
        ? "Учебный материал"
        : APP_NAME)
  );
}
