"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import {
  SUPPORTED_REVIEW_ORDER_MODES,
  SUPPORTED_TRANSLATION_DISPLAY_MODES,
  type LessonOrderMode,
  type ReviewOrderMode,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import {
  getCurrentUser,
  updateUserSettings,
  type CurrentUserDto,
  type UserSettingsDto,
} from "../../lib/api-client";
import {
  readStoredSession,
  readTranslationDisplayMode,
  storeTranslationDisplayMode,
  updateStoredUser,
} from "../../lib/auth-storage";
import { formatReviewOrderMode, formatTranslationDisplayMode } from "../../lib/dashboard-format";

type SettingsForm = {
  readonly translationDisplayMode: TranslationDisplayMode;
  readonly timezone: string;
  readonly dailyLessonLimit: string;
  readonly lessonBatchSize: string;
  readonly lessonOrderMode: LessonOrderMode;
  readonly reviewBudget: string;
  readonly reviewOrderMode: ReviewOrderMode;
  readonly strictMode: boolean;
};

type RemoteSettingsPayload = Pick<
  UserSettingsDto,
  | "translationDisplayMode"
  | "timezone"
  | "dailyLessonLimit"
  | "lessonBatchSize"
  | "lessonOrderMode"
  | "reviewBudget"
  | "reviewOrderMode"
  | "strictMode"
>;

const DEFAULT_TIMEZONE = "Europe/Moscow";
const DEFAULT_DAILY_LESSON_LIMIT = 10;
const DEFAULT_LESSON_BATCH_SIZE = 5;
const DEFAULT_REVIEW_BUDGET = 20;
const MAX_DAILY_LESSON_LIMIT = 200;
const MAX_LESSON_BATCH_SIZE = 5;
const MAX_REVIEW_BUDGET = 1_000;

export function SettingsClient() {
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [form, setForm] = useState<SettingsForm>(() => createLocalSettingsForm());
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = readStoredSession();
    setForm(createLocalSettingsForm());

    if (session === null) {
      setStatus("idle");
      return;
    }

    setUser(session.user);
    setForm(createSettingsForm(session.user.settings));

    getCurrentUser(session.token)
      .then((currentUser) => {
        setUser(currentUser);
        setForm(createSettingsForm(currentUser.settings));
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

  function updateForm<Key extends keyof SettingsForm>(key: Key, value: SettingsForm[Key]): void {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    storeTranslationDisplayMode(form.translationDisplayMode);

    const session = readStoredSession();

    if (session === null) {
      setStatus("saved");
      return;
    }

    try {
      const updated = await updateUserSettings(session.token, parseRemoteSettingsPayload(form));
      setUser(updated);
      setForm(createSettingsForm(updated.settings));
      updateStoredUser(updated);
      setStatus("saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить настройки.");
      setStatus("error");
    }
  }

  const remoteControlsDisabled = user === null || status === "loading" || status === "saving";

  return (
    <section className="settings-layout">
      <div className="page-heading">
        <h1>Настройки</h1>
        <p>{user?.email ?? "Локальные параметры интерфейса"}</p>
      </div>
      <form className="form-panel" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          Перевод карточек
          <select
            disabled={status === "saving"}
            onChange={(event) =>
              updateForm(
                "translationDisplayMode",
                event.currentTarget.value as TranslationDisplayMode,
              )
            }
            value={form.translationDisplayMode}
          >
            {SUPPORTED_TRANSLATION_DISPLAY_MODES.map((item) => (
              <option key={item} value={item}>
                {formatTranslationDisplayMode(item)}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-grid">
          <label>
            Новых материалов в день
            <input
              disabled={remoteControlsDisabled}
              inputMode="numeric"
              max={MAX_DAILY_LESSON_LIMIT}
              min={1}
              onChange={(event) => updateForm("dailyLessonLimit", event.currentTarget.value)}
              type="number"
              value={form.dailyLessonLimit}
            />
          </label>
          <label>
            Размер группы урока
            <input
              disabled={remoteControlsDisabled}
              inputMode="numeric"
              max={MAX_LESSON_BATCH_SIZE}
              min={1}
              onChange={(event) => updateForm("lessonBatchSize", event.currentTarget.value)}
              type="number"
              value={form.lessonBatchSize}
            />
          </label>
          <label>
            Бюджет повторений
            <input
              disabled={remoteControlsDisabled}
              inputMode="numeric"
              max={MAX_REVIEW_BUDGET}
              min={1}
              onChange={(event) => updateForm("reviewBudget", event.currentTarget.value)}
              type="number"
              value={form.reviewBudget}
            />
          </label>
        </div>
        <fieldset className="settings-fieldset" disabled={remoteControlsDisabled}>
          <legend>Порядок новых материалов</legend>
          <div className="lesson-order-control" role="group" aria-label="Порядок новых материалов">
            <button
              aria-pressed={form.lessonOrderMode === "course"}
              onClick={() => updateForm("lessonOrderMode", "course")}
              type="button"
            >
              Порядок курса
            </button>
            <button
              aria-pressed={form.lessonOrderMode === "interleaved"}
              onClick={() => updateForm("lessonOrderMode", "interleaved")}
              type="button"
            >
              Чередовать типы
            </button>
          </div>
        </fieldset>
        <label>
          Порядок повторений
          <select
            disabled={remoteControlsDisabled}
            onChange={(event) =>
              updateForm("reviewOrderMode", event.currentTarget.value as ReviewOrderMode)
            }
            value={form.reviewOrderMode}
          >
            {SUPPORTED_REVIEW_ORDER_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {formatReviewOrderMode(mode)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Часовой пояс
          <input
            disabled={remoteControlsDisabled}
            list="timezone-options"
            onChange={(event) => updateForm("timezone", event.currentTarget.value)}
            value={form.timezone}
          />
          <datalist id="timezone-options">
            <option value="Europe/Moscow" />
            <option value="Europe/London" />
            <option value="America/New_York" />
            <option value="America/Los_Angeles" />
            <option value="Asia/Tokyo" />
          </datalist>
        </label>
        <label className="checkbox-row">
          <input
            checked={form.strictMode}
            disabled={remoteControlsDisabled}
            onChange={(event) => updateForm("strictMode", event.currentTarget.checked)}
            type="checkbox"
          />
          <span>Строгая проверка</span>
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

function createLocalSettingsForm(): SettingsForm {
  return {
    translationDisplayMode: readTranslationDisplayMode(),
    timezone: DEFAULT_TIMEZONE,
    dailyLessonLimit: String(DEFAULT_DAILY_LESSON_LIMIT),
    lessonBatchSize: String(DEFAULT_LESSON_BATCH_SIZE),
    lessonOrderMode: "course",
    reviewBudget: String(DEFAULT_REVIEW_BUDGET),
    reviewOrderMode: "shuffled",
    strictMode: false,
  };
}

function createSettingsForm(settings: UserSettingsDto): SettingsForm {
  return {
    translationDisplayMode: settings.translationDisplayMode,
    timezone: settings.timezone,
    dailyLessonLimit: String(settings.dailyLessonLimit),
    lessonBatchSize: String(settings.lessonBatchSize ?? DEFAULT_LESSON_BATCH_SIZE),
    lessonOrderMode: settings.lessonOrderMode ?? "course",
    reviewBudget: String(settings.reviewBudget),
    reviewOrderMode: settings.reviewOrderMode ?? "shuffled",
    strictMode: settings.strictMode,
  };
}

function parseRemoteSettingsPayload(form: SettingsForm): RemoteSettingsPayload {
  const timezone = form.timezone.trim();

  if (timezone === "") {
    throw new Error("Часовой пояс обязателен.");
  }

  try {
    new Intl.DateTimeFormat("ru-RU", { timeZone: timezone }).format();
  } catch {
    throw new Error("Часовой пояс должен быть валидным IANA значением.");
  }

  return {
    translationDisplayMode: form.translationDisplayMode,
    timezone,
    dailyLessonLimit: parseBoundedInteger(
      form.dailyLessonLimit,
      "Лимит уроков в день",
      MAX_DAILY_LESSON_LIMIT,
    ),
    lessonBatchSize: parseBoundedInteger(
      form.lessonBatchSize,
      "Размер группы урока",
      MAX_LESSON_BATCH_SIZE,
    ),
    lessonOrderMode: form.lessonOrderMode,
    reviewBudget: parseBoundedInteger(form.reviewBudget, "Бюджет повторений", MAX_REVIEW_BUDGET),
    reviewOrderMode: form.reviewOrderMode,
    strictMode: form.strictMode,
  };
}

function parseBoundedInteger(value: string, label: string, max: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${label} должен быть целым числом от 1 до ${max}.`);
  }

  return parsed;
}
