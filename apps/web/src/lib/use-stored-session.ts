"use client";

import { useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT, readStoredSession, type StoredSession } from "./auth-storage";
import { invalidateDashboardSnapshot } from "./dashboard-snapshot";

export function useStoredSession(): StoredSession | null | undefined {
  const [session, setSession] = useState<StoredSession | null>();
  useEffect(() => {
    const sync = () => setSession(readStoredSession());
    const storage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === "kanji-srs.accessToken" ||
        event.key === "kanji-srs.user"
      ) {
        invalidateDashboardSnapshot();
        sync();
      }
    };
    sync();
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return session;
}

export function ownsSession(token: string): boolean {
  return readStoredSession()?.token === token;
}
