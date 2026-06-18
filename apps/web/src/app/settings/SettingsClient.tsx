"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import {
  SUPPORTED_TRANSLATION_DISPLAY_MODES,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { getCurrentUser, updateUserSettings, type CurrentUserDto } from "../../lib/api-client";
import {
  readStoredSession,
  readTranslationDisplayMode,
  storeTranslationDisplayMode,
  updateStoredUser,
} from "../../lib/auth-storage";
import { formatTranslationDisplayMode } from "../../lib/dashboard-format";

export function SettingsClient() {
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [mode, setMode] = useState<TranslationDisplayMode>("ru");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = readStoredSession();
    setMode(readTranslationDisplayMode());

    if (session === null) {
      setStatus("idle");
      return;
    }

    getCurrentUser(session.token)
      .then((currentUser) => {
        setUser(currentUser);
        setMode(currentUser.settings.translationDisplayMode);
        updateStoredUser(currentUser);
        setStatus("idle");
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error ? loadError.message : "Не удалось загрузить настройки.",
        );
        setStatus("error");
      });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    storeTranslationDisplayMode(mode);

    const session = readStoredSession();

    if (session === null) {
      setStatus("saved");
      return;
    }

    try {
      const updated = await updateUserSettings(session.token, { translationDisplayMode: mode });
      setUser(updated);
      updateStoredUser(updated);
      setStatus("saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить настройки.");
      setStatus("error");
    }
  }

  return (
    <section className="auth-layout">
      <div className="page-heading">
        <h1>Настройки</h1>
        <p>{user?.email ?? "Локальные параметры интерфейса"}</p>
      </div>
      <form className="form-panel" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          Перевод карточек
          <select
            onChange={(event) => setMode(event.currentTarget.value as TranslationDisplayMode)}
            value={mode}
          >
            {SUPPORTED_TRANSLATION_DISPLAY_MODES.map((item) => (
              <option key={item} value={item}>
                {formatTranslationDisplayMode(item)}
              </option>
            ))}
          </select>
        </label>
        {status === "loading" ? <p className="muted">Загружаю настройки.</p> : null}
        {status === "saved" ? <p className="success-text">Сохранено.</p> : null}
        {error === null ? null : <p className="form-error">{error}</p>}
        <button className="primary-action" disabled={status === "saving"} type="submit">
          {status === "saving" ? "Сохраняю" : "Сохранить"}
        </button>
        {user === null ? (
          <Link className="inline-link" href="/login">
            Войти для синхронизации
          </Link>
        ) : null}
      </form>
    </section>
  );
}
