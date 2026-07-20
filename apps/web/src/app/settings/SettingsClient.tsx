"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import {
  DEFAULT_SPEECH_RATE,
  MAX_SPEECH_RATE,
  MIN_SPEECH_RATE,
  SUPPORTED_REVIEW_ORDER_MODES,
  SUPPORTED_TRANSLATION_DISPLAY_MODES,
  type LessonOrderMode,
  type ReviewOrderMode,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import {
  getCurrentUser,
  updateVacationMode,
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
import { useJapaneseSpeech } from "../../lib/use-japanese-speech";

type SettingsForm = {
  readonly translationDisplayMode: TranslationDisplayMode;
  readonly timezone: string;
  readonly dailyLessonLimit: string;
  readonly lessonBatchSize: string;
  readonly lessonOrderMode: LessonOrderMode;
  readonly reviewBudget: string;
  readonly reviewOrderMode: ReviewOrderMode;
  readonly strictMode: boolean;
  readonly speechVoiceUri: string;
  readonly speechRate: string;
  readonly speechAutoplay: boolean;
  readonly soundFeedback: boolean;
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
  | "speechVoiceUri"
  | "speechRate"
  | "speechAutoplay"
  | "soundFeedback"
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
  const [isVacationUpdating, setIsVacationUpdating] = useState(false);
  const [pendingVacationEnabled, setPendingVacationEnabled] = useState<boolean | null>(null);
  const [vacationMessage, setVacationMessage] = useState<string | null>(null);
  const speechPreview = useJapaneseSpeech({
    rate: Number(form.speechRate),
    voiceUri: form.speechVoiceUri === "" ? null : form.speechVoiceUri,
  });

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

  async function handleVacationChange(enabled: boolean): Promise<void> {
    const session = readStoredSession();

    if (session === null || isVacationUpdating) {
      return;
    }

    setIsVacationUpdating(true);
    setPendingVacationEnabled(enabled);
    setVacationMessage(null);
    setError(null);

    try {
      const result = await updateVacationMode(session.token, enabled);
      setUser(result.user);
      setForm(createSettingsForm(result.user.settings));
      updateStoredUser(result.user);
      setVacationMessage(
        enabled
          ? "Режим отпуска включён."
          : `Режим отпуска выключен. Расписание сдвинуто для ${result.shiftedReviewCount} карточек.`,
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Не удалось изменить режим отпуска.",
      );
    } finally {
      setPendingVacationEnabled(null);
      setIsVacationUpdating(false);
    }
  }

  const vacationStartedAt = user?.settings.vacationStartedAt ?? null;
  const selectedVoiceAvailable = speechPreview.voices.some(
    (voice) => voice.voiceUri === form.speechVoiceUri,
  );
  const remoteControlsDisabled =
    user === null || status === "loading" || status === "saving" || isVacationUpdating;

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
        <fieldset className="settings-fieldset" disabled={remoteControlsDisabled}>
          <legend>Звук и произношение</legend>
          <div className="settings-grid">
            <label>
              Японский голос
              <select
                onChange={(event) => updateForm("speechVoiceUri", event.currentTarget.value)}
                value={form.speechVoiceUri}
              >
                <option value="">Автоматический выбор</option>
                {form.speechVoiceUri !== "" && !selectedVoiceAvailable ? (
                  <option value={form.speechVoiceUri}>Сохранённый голос недоступен</option>
                ) : null}
                {speechPreview.voices.map((voice) => (
                  <option key={voice.voiceUri} value={voice.voiceUri}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </label>
            <div className="speech-rate-control">
              <div>
                <label htmlFor="speech-rate">Скорость речи</label>
                <output htmlFor="speech-rate">{formatSpeechRate(form.speechRate)}</output>
              </div>
              <input
                id="speech-rate"
                max={MAX_SPEECH_RATE}
                min={MIN_SPEECH_RATE}
                onChange={(event) => updateForm("speechRate", event.currentTarget.value)}
                step={0.1}
                type="range"
                value={form.speechRate}
              />
            </div>
          </div>
          <label className="checkbox-row">
            <input
              checked={form.speechAutoplay}
              onChange={(event) => updateForm("speechAutoplay", event.currentTarget.checked)}
              type="checkbox"
            />
            <span>Автоматически озвучивать учебные материалы</span>
          </label>
          <label className="checkbox-row">
            <input
              checked={form.soundFeedback}
              onChange={(event) => updateForm("soundFeedback", event.currentTarget.checked)}
              type="checkbox"
            />
            <span>Звуковые сигналы правильных и неправильных ответов</span>
          </label>
          <button
            className="secondary-action"
            disabled={!speechPreview.available}
            onClick={() => void speechPreview.speak("日本語の発音")}
            type="button"
          >
            Прослушать голос
          </button>
        </fieldset>
        <fieldset className="settings-fieldset" disabled={remoteControlsDisabled}>
          <legend>Режим отпуска</legend>
          <label className="checkbox-row">
            <input
              checked={pendingVacationEnabled ?? vacationStartedAt !== null}
              onChange={(event) => void handleVacationChange(event.currentTarget.checked)}
              type="checkbox"
            />
            <span>Приостановить расписание повторений</span>
          </label>
          {vacationStartedAt === null ? null : (
            <p className="muted">
              Включён с {formatVacationStartedAt(vacationStartedAt)}.
            </p>
          )}
          {isVacationUpdating ? <p className="muted">Обновляю режим отпуска.</p> : null}
          {vacationMessage === null ? null : (
            <p className="success-text" role="status">
              {vacationMessage}
            </p>
          )}
        </fieldset>
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
    speechVoiceUri: "",
    speechRate: String(DEFAULT_SPEECH_RATE),
    speechAutoplay: false,
    soundFeedback: false,
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
    speechVoiceUri: settings.speechVoiceUri ?? "",
    speechRate: String(settings.speechRate ?? DEFAULT_SPEECH_RATE),
    speechAutoplay: settings.speechAutoplay ?? false,
    soundFeedback: settings.soundFeedback ?? false,
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
    speechVoiceUri: form.speechVoiceUri === "" ? null : form.speechVoiceUri,
    speechRate: parseSpeechRate(form.speechRate),
    speechAutoplay: form.speechAutoplay,
    soundFeedback: form.soundFeedback,
  };
}

function parseSpeechRate(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < MIN_SPEECH_RATE || parsed > MAX_SPEECH_RATE) {
    throw new Error(
      `Скорость речи должна быть числом от ${MIN_SPEECH_RATE} до ${MAX_SPEECH_RATE}.`,
    );
  }

  return parsed;
}

function formatSpeechRate(value: string): string {
  return `${parseSpeechRate(value).toFixed(1)}×`;
}

function parseBoundedInteger(value: string, label: string, max: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${label} должен быть целым числом от 1 до ${max}.`);
  }

  return parsed;
}

function formatVacationStartedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
