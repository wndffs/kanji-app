"use client";

import { useEffect } from "react";

export function OfflineShellRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !window.isSecureContext) return;

    void Promise.resolve()
      .then(() =>
        navigator.serviceWorker?.register("/sw.js", { scope: "/", updateViaCache: "none" }),
      )
      .catch(() => {
        // Offline support is optional; a failed registration must not block study.
      });
  }, []);

  return null;
}
