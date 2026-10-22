"use client";

import { useEffect, useState } from "react";

import { API_RESPONSE_CONFIRMED_EVENT } from "../lib/api-client";

export function ConnectionStatus() {
  const [state, setState] = useState<"unknown" | "offline" | "reconnecting">("unknown");

  useEffect(() => {
    function offline(): void {
      setState("offline");
    }
    function online(): void {
      setState("reconnecting");
    }
    function confirmed(): void {
      setState("unknown");
    }
    if (!navigator.onLine) offline();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener(API_RESPONSE_CONFIRMED_EVENT, confirmed);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener(API_RESPONSE_CONFIRMED_EVENT, confirmed);
    };
  }, []);

  if (state === "unknown") return null;

  return (
    <p className="notice" role="status" aria-label="Состояние сети">
      {state === "offline"
        ? "Браузер сообщает: нет сети. Доступность сервера не подтверждена."
        : "Сеть снова доступна по данным браузера. Соединение с сервером ещё не подтверждено."}
    </p>
  );
}
