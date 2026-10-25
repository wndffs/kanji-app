"use client";

import Link from "next/link";
import { AppearancePreview } from "../../components/AppearancePreview";
import { ViewTabs } from "../../components/ViewTabs";
import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  DEFAULT_SPEECH_RATE,
  MAX_SPEECH_RATE,
  MIN_SPEECH_RATE,
  INTERFACE_PREFERENCE_OPTIONS,
  normalizeInterfacePreferences,
  SUPPORTED_LESSON_PRONUNCIATION_MODES,
  SUPPORTED_REVIEW_ORDER_MODES,
  SUPPORTED_TRANSLATION_DISPLAY_MODES,
  type LessonOrderMode,
  type LessonPronunciationMode,
  type ReviewOrderMode,
  type TranslationDisplayMode,
  type InterfacePreferences,
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
import {
  normalizeReviewReminderSettings,
  parseReviewReminderHour,
  requestReviewReminderPermission,
  reviewReminderPermission,
  reviewReminderPreferencePatch,
  type ReviewReminderPermission,
} from "../../lib/review-reminders";
import {
  applyInterfacePreferences,
  readInterfacePreferences,
  storeInterfacePreferences,
} from "../../lib/interface-preferences";

type SettingsForm = InterfacePreferences & {
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
  readonly lessonPronunciationMode: LessonPronunciationMode;
  readonly lessonRomaji: boolean;
  readonly reviewRemindersEnabled: boolean;
  readonly reviewReminderHour: string;
};

type RemoteSettingsPayload = InterfacePreferences &
  Pick<
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
    | "lessonPronunciationMode"
    | "lessonRomaji"
    | "reviewRemindersEnabled"
    | "reviewReminderHour"
  >;

const DEFAULT_TIMEZONE = "Europe/Moscow";
const DEFAULT_DAILY_LESSON_LIMIT = 10;
const DEFAULT_LESSON_BATCH_SIZE = 5;
const DEFAULT_REVIEW_BUDGET = 20;
const MAX_DAILY_LESSON_LIMIT = 200;
const MAX_LESSON_BATCH_SIZE = 5;
const MAX_REVIEW_BUDGET = 1_000;

export function SettingsClient() {
  const [section, setSection] = useState("appearance");
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [form, setForm] = useState<SettingsForm>(() => createLocalSettingsForm());
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [isVacationUpdating, setIsVacationUpdating] = useState(false);
  const [pendingVacationEnabled, setPendingVacationEnabled] = useState<boolean | null>(null);
  const [vacationMessage, setVacationMessage] = useState<string | null>(null);
  const [reminderPermission, setReminderPermission] = useState<ReviewReminderPermission>("default");
  const [permissionPending, setPermissionPending] = useState(false);
  const permissionRequest = useRef(0);
  const speechPreview = useJapaneseSpeech({
    rate: Number(form.speechRate),
    voiceUri: form.speechVoiceUri === "" ? null : form.speechVoiceUri,
  });

  useEffect(() => {
    if (readStoredSession()?.user.id !== user?.id) return;
    applyInterfacePreferences({
      interfaceTheme: form.interfaceTheme,
      interfaceDensity: form.interfaceDensity,
      interfaceMotion: form.interfaceMotion,
      studyTextSize: form.studyTextSize,
      studyInformationDensity: form.studyInformationDensity,
    });
    return () => applyInterfacePreferences(readInterfacePreferences());
  }, [
    form.interfaceTheme,
    form.interfaceDensity,
    form.interfaceMotion,
    form.studyTextSize,
    form.studyInformationDensity,
    user?.id,
  ]);

  useEffect(() => {
    const session = readStoredSession();
    setReminderPermission(reviewReminderPermission());
    setForm(createLocalSettingsForm());

    if (session === null) {
      setStatus("idle");
      return () => {
        permissionRequest.current++;
      };
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
    return () => {
      permissionRequest.current++;
    };
  }, []);

  function updateForm<Key extends keyof SettingsForm>(key: Key, value: SettingsForm[Key]): void {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (permissionPending) return;
    setReminderPermission(reviewReminderPermission());
    setStatus("saving");
    setError(null);

    const session = readStoredSession();

    if (session === null) {
      storeTranslationDisplayMode(form.translationDisplayMode);
      storeInterfacePreferences(form);
      setStatus("saved");
      return;
    }

    try {
      if (session.user.id !== user?.id) {
        throw new Error("Аккаунт изменился. Обновите страницу настроек.");
      }
      const updated = await updateUserSettings(session.token, {
        ...parseRemoteSettingsPayload(form),
        ...reviewReminderPreferencePatch(
          form.reviewRemindersEnabled,
          normalizeReviewReminderSettings(user.settings).reviewRemindersEnabled,
          reviewReminderPermission(),
        ),
      });
      setUser(updated);
      setForm(createSettingsForm(updated.settings));
      updateStoredUser(updated);
      setStatus("saved");
    } catch (saveError) {
      if (saveError instanceof SettingsValidationError) setSection(saveError.section);
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить настройки.");
      setStatus("error");
    }
  }

  async function handleReminderChange(enabled: boolean): Promise<void> {
    const requestId = ++permissionRequest.current;
    if (!enabled) {
      updateForm("reviewRemindersEnabled", false);
      return;
    }
    const session = readStoredSession();
    if (session === null) return;
    setPermissionPending(true);
    // This invocation stays in the checkbox gesture, before any awaited work.
    const permission = await requestReviewReminderPermission();
    const current = readStoredSession();
    if (permissionRequest.current !== requestId) return;
    setPermissionPending(false);
    setReminderPermission(permission);
    updateForm(
      "reviewRemindersEnabled",
      permission === "granted" &&
        current?.user.id === session.user.id &&
        current.token === session.token,
    );
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
        updateError instanceof Error ? updateError.message : "Не удалось изменить режим отпуска.",
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
    user === null ||
    status === "loading" ||
    status === "saving" ||
    isVacationUpdating ||
    permissionPending;

  return (
    <section className="settings-layout">
      <div className="page-heading">
        <h1>Настройки</h1>
        <p>{user?.email ?? "Локальные параметры интерфейса"}</p>
      </div>
      <ViewTabs
        active={section}
        onChange={setSection}
        label="Разделы настроек"
        idPrefix="settings-view"
        panelId="settings-panel"
        tabs={[
          { id: "appearance", label: "Внешний вид" },
          { id: "study", label: "Обучение" },
          { id: "audio", label: "Произношение" },
          { id: "schedule", label: "Расписание" },
        ]}
      />
      <form
        className="form-panel settings-form"
        data-settings-view={section}
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`settings-view-${section}`}
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <fieldset
          data-settings-group="appearance"
          className="settings-fieldset"
          disabled={status === "loading" || status === "saving"}
        >
          <legend>Внешний вид</legend>
          <div className="settings-grid">
            {(Object.keys(INTERFACE_PREFERENCE_OPTIONS) as (keyof InterfacePreferences)[]).map(
              (key) => (
                <label key={key}>
                  {PREFERENCE_LABELS[key]}
                  <select
                    aria-label={PREFERENCE_LABELS[key]}
                    onChange={(event) =>
                      updateForm(key, event.currentTarget.value as InterfacePreferences[typeof key])
                    }
                    value={form[key]}
                  >
                    {INTERFACE_PREFERENCE_OPTIONS[key].map((value) => (
                      <option key={value} value={value}>
                        {PREFERENCE_VALUE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
              ),
            )}
          </div>
        </fieldset>
        <label data-settings-group="appearance">
          Перевод карточек
          <select
            aria-label="Перевод карточек"
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
        <AppearancePreview mode={form.translationDisplayMode} />
        <div className="settings-grid" data-settings-group="study">
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
        <fieldset
          className="settings-fieldset"
          data-settings-group="study"
          disabled={remoteControlsDisabled}
        >
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
        <label data-settings-group="study">
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
        <label data-settings-group="schedule">
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
        <label className="checkbox-row" data-settings-group="study">
          <input
            checked={form.strictMode}
            disabled={remoteControlsDisabled}
            onChange={(event) => updateForm("strictMode", event.currentTarget.checked)}
            type="checkbox"
          />
          <span>Строгая проверка</span>
        </label>
        <fieldset
          className="settings-fieldset"
          data-settings-group="schedule"
          disabled={remoteControlsDisabled}
        >
          <legend>Напоминания в открытой вкладке</legend>
          <label className="checkbox-row">
            <input
              checked={form.reviewRemindersEnabled}
              onChange={(event) => void handleReminderChange(event.currentTarget.checked)}
              type="checkbox"
            />
            <span>Напоминать о повторениях</span>
          </label>
          <label>
            Час напоминания
            <input
              type="number"
              min={0}
              max={23}
              inputMode="numeric"
              value={form.reviewReminderHour}
              onChange={(event) => updateForm("reviewReminderHour", event.currentTarget.value)}
            />
          </label>
          {reminderPermission === "unsupported" ? (
            <p className="muted">Уведомления недоступны в этом браузере.</p>
          ) : reminderPermission === "denied" ? (
            <p className="muted">Уведомления заблокированы в браузере.</p>
          ) : reminderPermission === "default" ? (
            <p className="muted">Разрешение на уведомления не выдано.</p>
          ) : null}
        </fieldset>
        <fieldset
          className="settings-fieldset"
          data-settings-group="audio"
          disabled={remoteControlsDisabled}
        >
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
        <fieldset
          className="settings-fieldset"
          data-settings-group="audio"
          disabled={remoteControlsDisabled}
        >
          <legend>Чтение в учебных этапах урока</legend>
          <div
            aria-label="Способ показа чтения в уроках"
            className="lesson-order-control"
            role="group"
          >
            {SUPPORTED_LESSON_PRONUNCIATION_MODES.map((mode) => (
              <button
                aria-pressed={form.lessonPronunciationMode === mode}
                key={mode}
                onClick={() => updateForm("lessonPronunciationMode", mode)}
                type="button"
              >
                {mode === "kana" ? "Кана строкой" : "Фуригана над текстом"}
              </button>
            ))}
          </div>
          <label className="checkbox-row">
            <input
              checked={form.lessonRomaji}
              onChange={(event) => updateForm("lessonRomaji", event.currentTarget.checked)}
              type="checkbox"
            />
            <span>Показывать ромадзи в уроках</span>
          </label>
        </fieldset>
        <fieldset
          className="settings-fieldset"
          data-settings-group="schedule"
          disabled={remoteControlsDisabled}
        >
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
            <p className="muted">Включён с {formatVacationStartedAt(vacationStartedAt)}.</p>
          )}
          {isVacationUpdating ? <p className="muted">Обновляю режим отпуска.</p> : null}
          {vacationMessage === null ? null : (
            <p className="success-text" role="status">
              {vacationMessage}
            </p>
          )}
        </fieldset>
        <div className="settings-save-bar">
          {status === "loading" ? <p className="muted">Загружаю настройки.</p> : null}
          {status === "saved" ? <p className="success-text">Сохранено.</p> : null}
          {error === null ? null : (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-action"
            disabled={status === "loading" || status === "saving" || permissionPending}
            type="submit"
          >
            {status === "saving" ? "Сохраняю" : "Сохранить"}
          </button>
          {user === null ? (
            <Link className="inline-link" href="/login">
              Войти для синхронизации
            </Link>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function createLocalSettingsForm(): SettingsForm {
  return {
    ...readInterfacePreferences(),
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
    lessonPronunciationMode: "kana",
    lessonRomaji: false,
    reviewRemindersEnabled: false,
    reviewReminderHour: "9",
  };
}

function createSettingsForm(settings: UserSettingsDto): SettingsForm {
  return {
    ...normalizeInterfacePreferences(settings),
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
    lessonPronunciationMode: settings.lessonPronunciationMode ?? "kana",
    lessonRomaji: settings.lessonRomaji ?? false,
    reviewRemindersEnabled: normalizeReviewReminderSettings(settings).reviewRemindersEnabled,
    reviewReminderHour: String(normalizeReviewReminderSettings(settings).reviewReminderHour),
  };
}

class SettingsValidationError extends Error {
  constructor(
    message: string,
    readonly section: string,
  ) {
    super(message);
  }
}

function parseRemoteSettingsPayload(form: SettingsForm): RemoteSettingsPayload {
  const timezone = form.timezone.trim();

  if (timezone === "") {
    throw new SettingsValidationError("Часовой пояс обязателен.", "schedule");
  }

  try {
    new Intl.DateTimeFormat("ru-RU", { timeZone: timezone }).format();
  } catch {
    throw new SettingsValidationError(
      "Часовой пояс должен быть валидным IANA значением.",
      "schedule",
    );
  }

  return {
    ...normalizeInterfacePreferences(form),
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
    lessonPronunciationMode: form.lessonPronunciationMode,
    lessonRomaji: form.lessonRomaji,
    reviewReminderHour: validateReminderHour(form.reviewReminderHour),
  };
}

const PREFERENCE_LABELS: Record<keyof InterfacePreferences, string> = {
  interfaceTheme: "Тема",
  interfaceDensity: "Плотность интерфейса",
  interfaceMotion: "Анимация",
  studyTextSize: "Размер японского текста",
  studyInformationDensity: "Плотность учебных блоков",
};

const PREFERENCE_VALUE_LABELS: Record<InterfacePreferences[keyof InterfacePreferences], string> = {
  system: "Как в системе",
  light: "Светлая",
  dark: "Тёмная",
  comfortable: "Просторная",
  compact: "Компактная",
  reduced: "Минимальная",
  full: "Полная",
  standard: "Обычный",
  large: "Крупный",
  "extra-large": "Очень крупный",
};

function parseSpeechRate(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < MIN_SPEECH_RATE || parsed > MAX_SPEECH_RATE) {
    throw new SettingsValidationError(
      `Скорость речи должна быть числом от ${MIN_SPEECH_RATE} до ${MAX_SPEECH_RATE}.`,
      "audio",
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
    throw new SettingsValidationError(`${label} должен быть целым числом от 1 до ${max}.`, "study");
  }

  return parsed;
}

function validateReminderHour(value: string): number {
  try {
    return parseReviewReminderHour(value);
  } catch (error) {
    throw new SettingsValidationError(
      error instanceof Error ? error.message : "Неверный час напоминания.",
      "schedule",
    );
  }
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
