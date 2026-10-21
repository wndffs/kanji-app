"use client";

import { useEffect } from "react";

import { AUTH_CHANGED_EVENT } from "../lib/auth-storage";
import { applyInterfacePreferences, readInterfacePreferences } from "../lib/interface-preferences";

export function InterfacePreferencesSync() {
  useEffect(() => {
    const sync = () => applyInterfacePreferences(readInterfacePreferences());
    sync();
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return null;
}
