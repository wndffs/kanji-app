"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type CourseListResponse,
  type DashboardDto,
  type DashboardWidgetId,
  type DashboardWidgetPreferenceDto,
  type ItemSummary,
  normalizeDashboardWidgetPreferences,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import {
  ApiError,
  getCourses,
  getDashboard,
  selectCurrentCourse,
  updateUserSettings,
} from "../../lib/api-client";
import { clearStoredSession, readStoredSession, updateStoredUser } from "../../lib/auth-storage";
import {
  formatAccuracy,
  formatCount,
  formatForecastBucket,
  formatTranslationDisplayMode,
} from "../../lib/dashboard-format";
import {
  type NewLearnerGuideState,
  type NewLearnerStepStatus,
  resolveNewLearnerGuideState,
} from "../../lib/new-learner-guide";

type DashboardState =
  | { readonly status: "checking" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly dashboard: DashboardDto }
  | { readonly status: "error"; readonly message: string };

type ReadyCoursesState = {
  readonly status: "ready";
  readonly data: CourseListResponse;
  readonly saving: boolean;
  readonly message: string | null;
  readonly error: string | null;
  readonly activeLessonConflict: boolean;
};

type CoursesState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | ReadyCoursesState;

export function DashboardClient() {
  const [state, setState] = useState<DashboardState>({ status: "checking" });
  const [coursesState, setCoursesState] = useState<CoursesState>({ status: "loading" });

  useEffect(() => {
    const session = readStoredSession();

    if (session === null) {
      setState({ status: "unauthenticated" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    setCoursesState({ status: "loading" });

    getDashboard(session.token)
      .then((dashboard) => {
        if (!cancelled) {
          setState({ status: "ready", dashboard });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          clearStoredSession();
          setState({ status: "unauthenticated" });
          return;
        }

        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Не удалось загрузить панель.",
        });
      });

    getCourses(session.token)
      .then((courses) => {
        if (!cancelled) {
          setCoursesState(createReadyCoursesState(courses));
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          clearStoredSession();
          setState({ status: "unauthenticated" });
          return;
        }

        setCoursesState({
          status: "error",
          message: error instanceof Error ? error.message : "Не удалось загрузить список курсов.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "checking" || state.status === "loading") {
    return (
      <section className="page-stack" aria-busy="true">
        <div className="page-heading">
          <h1>Панель</h1>
          <p>Загружаю данные.</p>
        </div>
        <div className="metric-grid">
          <div className="metric-card skeleton" />
          <div className="metric-card skeleton" />
          <div className="metric-card skeleton" />
        </div>
      </section>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Панель</h1>
          <p>Нужен вход в аккаунт.</p>
        </div>
        <div className="notice-panel">
          <p>Войдите в локальный demo-аккаунт, чтобы открыть очередь уроков и повторений.</p>
          <Link className="primary-action" href="/login">
            Войти
          </Link>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Панель</h1>
          <p>API недоступен.</p>
        </div>
        <div className="notice-panel error-panel">
          <p>{state.message}</p>
          <Link className="secondary-action" href="/login">
            Обновить вход
          </Link>
        </div>
      </section>
    );
  }

  async function handleCourseChange(courseId: string): Promise<void> {
    const session = readStoredSession();

    if (session === null || coursesState.status !== "ready") {
      return;
    }

    setCoursesState({
      ...coursesState,
      saving: true,
      message: null,
      error: null,
      activeLessonConflict: false,
    });

    try {
      const courses = await selectCurrentCourse(session.token, { courseId });
      const selectedTitle = courses.courses.find(({ id }) => id === courses.currentCourseId)?.title;

      setCoursesState({
        ...createReadyCoursesState(courses),
        message:
          selectedTitle === undefined ? "Курс переключён." : `Выбран курс «${selectedTitle}».`,
      });

      try {
        const dashboard = await getDashboard(session.token);
        setState({ status: "ready", dashboard });
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          clearStoredSession();
          setState({ status: "unauthenticated" });
          return;
        }

        setCoursesState((current) =>
          current.status === "ready"
            ? {
                ...current,
                message: null,
                error: "Курс выбран, но прогресс не обновился. Перезагрузите страницу.",
              }
            : current,
        );
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
        return;
      }

      const activeLessonConflict = error instanceof ApiError && error.status === 409;
      setCoursesState((current) =>
        current.status === "ready"
          ? {
              ...current,
              saving: false,
              error: activeLessonConflict
                ? "Завершите или покиньте текущий урок перед сменой курса."
                : error instanceof Error
                  ? error.message
                  : "Не удалось переключить курс.",
              activeLessonConflict,
            }
          : current,
      );
    }
  }

  async function handleDashboardWidgetsChange(
    dashboardWidgets: readonly DashboardWidgetPreferenceDto[],
  ): Promise<void> {
    const session = readStoredSession();

    if (session === null) {
      throw new Error("Сессия завершена. Войдите снова.");
    }

    try {
      const updatedUser = await updateUserSettings(session.token, { dashboardWidgets });
      const normalizedWidgets = normalizeDashboardWidgetPreferences(
        updatedUser.settings.dashboardWidgets ?? dashboardWidgets,
      );

      updateStoredUser(updatedUser);
      setState((current) =>
        current.status === "ready"
          ? {
              status: "ready",
              dashboard: {
                ...current.dashboard,
                user: {
                  ...current.dashboard.user,
                  dashboardWidgets: normalizedWidgets,
                },
              },
            }
          : current,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
      }

      throw error;
    }
  }

  return (
    <DashboardView
      coursesState={coursesState}
      dashboard={state.dashboard}
      onCourseChange={(courseId) => void handleCourseChange(courseId)}
      onDashboardWidgetsChange={handleDashboardWidgetsChange}
    />
  );
}

function DashboardView({
  coursesState,
  dashboard,
  onCourseChange,
  onDashboardWidgetsChange,
}: {
  readonly coursesState: CoursesState;
  readonly dashboard: DashboardDto;
  readonly onCourseChange: (courseId: string) => void;
  readonly onDashboardWidgetsChange: (
    preferences: readonly DashboardWidgetPreferenceDto[],
  ) => Promise<void>;
}) {
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState(dashboard.user.dashboardWidgets);
  const [customizationStatus, setCustomizationStatus] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [customizationError, setCustomizationError] = useState<string | null>(null);
  const activeWidgets = customizationOpen ? draftWidgets : dashboard.user.dashboardWidgets;
  const visibleWidgets = activeWidgets.filter((widget) => widget.visible);
  const newLearnerGuide = resolveNewLearnerGuideState(
    dashboard.newLearnerGuide,
    dashboard.counts.dueReviews,
  );

  useEffect(() => {
    setDraftWidgets(dashboard.user.dashboardWidgets);
  }, [dashboard.user.dashboardWidgets]);

  function toggleCustomization(): void {
    setDraftWidgets(dashboard.user.dashboardWidgets);
    setCustomizationStatus("idle");
    setCustomizationError(null);
    setCustomizationOpen((current) => !current);
  }

  async function saveCustomization(): Promise<void> {
    setCustomizationStatus("saving");
    setCustomizationError(null);

    try {
      await onDashboardWidgetsChange(draftWidgets);
      setCustomizationStatus("idle");
      setCustomizationOpen(false);
    } catch (error) {
      setCustomizationStatus("error");
      setCustomizationError(
        error instanceof Error ? error.message : "Не удалось сохранить настройки панели.",
      );
    }
  }

  return (
    <section className="page-stack">
      <div className="page-heading dashboard-heading">
        <div>
          <h1>Панель</h1>
          <p>
            {dashboard.user.displayName ?? dashboard.user.id} ·{" "}
            {formatTranslationDisplayMode(dashboard.user.translationDisplayMode)}
          </p>
        </div>
        <div className="action-row">
          <Link className="primary-action" href="/reviews">
            Повторять
          </Link>
          <Link className="secondary-action" href="/lessons">
            Учить
          </Link>
          <Link className="secondary-action" href="/practice">
            Практика
          </Link>
          <button
            aria-expanded={customizationOpen}
            className="secondary-action"
            disabled={customizationStatus === "saving"}
            onClick={toggleCustomization}
            type="button"
          >
            Настроить панель
          </button>
        </div>
      </div>

      {newLearnerGuide.visible ? (
        <NewLearnerGuide dashboard={dashboard} state={newLearnerGuide} />
      ) : null}

      {customizationOpen ? (
        <DashboardWidgetEditor
          error={customizationError}
          onCancel={toggleCustomization}
          onChange={setDraftWidgets}
          onSave={() => void saveCustomization()}
          preferences={draftWidgets}
          saving={customizationStatus === "saving"}
        />
      ) : null}

      {visibleWidgets.length === 0 ? (
        <div className="notice-panel">
          <p>Все виджеты скрыты. Откройте настройку панели, чтобы вернуть нужные блоки.</p>
        </div>
      ) : (
        <div className="dashboard-widget-grid">
          {visibleWidgets.map((widget) => (
            <div
              className={`dashboard-widget dashboard-widget-${widget.presentation}`}
              data-dashboard-widget={widget.id}
              key={widget.id}
            >
              <DashboardWidgetContent
                coursesState={coursesState}
                dashboard={dashboard}
                id={widget.id}
                onCourseChange={onCourseChange}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NewLearnerGuide({
  dashboard,
  state,
}: {
  readonly dashboard: DashboardDto;
  readonly state: NewLearnerGuideState;
}) {
  const guide = dashboard.newLearnerGuide;
  const nextReview = dashboard.reviewForecast.find((bucket) => bucket.dueCount > 0) ?? null;

  return (
    <section
      aria-labelledby="new-learner-guide-heading"
      className="panel new-learner-guide"
      data-testid="new-learner-guide"
    >
      <header>
        <div>
          <span className="eyebrow">Старт</span>
          <h2 id="new-learner-guide-heading">Первый учебный цикл</h2>
        </div>
        <p>
          Освойте базовую хирагану, завершите первый урок и вернитесь к карточкам по расписанию SRS.
          Катакану можно продолжать параллельно.
        </p>
      </header>

      <ol className="new-learner-steps">
        <li aria-current={state.kana === "current" ? "step" : undefined} data-status={state.kana}>
          <StepMarker number={1} status={state.kana} />
          <div className="new-learner-step-body">
            <StepHeading status={state.kana} title="Кана для старта" />
            <p>
              Базовая хирагана нужна для чтений кандзи. Катакана остаётся отдельной параллельной
              практикой.
            </p>
            <div className="new-learner-kana-progress">
              <KanaReadinessProgress label="Хирагана" progress={guide.kana.hiragana} />
              <KanaReadinessProgress label="Катакана" progress={guide.kana.katakana} />
            </div>
            {state.kana === "current" || state.kana === "parallel" ? (
              <Link className="secondary-action" href="/kana">
                {guide.kana.hiragana.masteredCount === 0 ? "Начать хирагану" : "Продолжить кану"}
              </Link>
            ) : null}
          </div>
        </li>

        <li
          aria-current={state.lesson === "current" ? "step" : undefined}
          data-status={state.lesson}
        >
          <StepMarker number={2} status={state.lesson} />
          <div className="new-learner-step-body">
            <StepHeading status={state.lesson} title="Первый урок" />
            {state.lesson === "complete" ? (
              <p>Карточки созданы и получили первый интервал SRS.</p>
            ) : state.lesson === "current" ? (
              dashboard.counts.availableLessons > 0 ? (
                <>
                  <p>
                    Изучите значения и чтения, затем правильно ответьте на обязательные вопросы.
                  </p>
                  <Link className="secondary-action" href="/lessons">
                    Начать первый урок
                  </Link>
                </>
              ) : (
                <p>Доступных материалов пока нет. Проверьте выбранный курс и его первый уровень.</p>
              )
            ) : (
              <p>Первый урок станет рекомендуемым шагом после базовой хираганы.</p>
            )}
          </div>
        </li>

        <li
          aria-current={
            state.review === "current" || state.review === "waiting" ? "step" : undefined
          }
          data-status={state.review}
        >
          <StepMarker number={3} status={state.review} />
          <div className="new-learner-step-body">
            <StepHeading status={state.review} title="Первое повторение" />
            {state.review === "current" ? (
              <>
                <p>Карточки готовы. Завершите очередь, чтобы пройти первый полный цикл.</p>
                <Link className="primary-action" href="/reviews">
                  Начать первое повторение
                </Link>
              </>
            ) : state.review === "waiting" ? (
              <p>
                Первый урок завершён.{" "}
                {nextReview === null
                  ? "Повторение появится после первого интервала SRS."
                  : `Ближайшее повторение: ${formatForecastBucket(nextReview)}.`}
              </p>
            ) : (
              <p>После урока карточки появятся здесь согласно интервалу SRS.</p>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}

function StepMarker({
  number,
  status,
}: {
  readonly number: number;
  readonly status: NewLearnerStepStatus;
}) {
  return (
    <span aria-hidden="true" className="new-learner-step-marker">
      {status === "complete" ? "✓" : number}
    </span>
  );
}

function StepHeading({
  status,
  title,
}: {
  readonly status: NewLearnerStepStatus;
  readonly title: string;
}) {
  return (
    <div className="new-learner-step-heading">
      <h3>{title}</h3>
      <span>{formatNewLearnerStepStatus(status)}</span>
    </div>
  );
}

function KanaReadinessProgress({
  label,
  progress,
}: {
  readonly label: string;
  readonly progress: DashboardDto["newLearnerGuide"]["kana"]["hiragana"];
}) {
  const percent =
    progress.totalCount === 0
      ? 0
      : Math.round((progress.masteredCount / progress.totalCount) * 100);

  return (
    <div>
      <div>
        <span>{label}</span>
        <strong>
          {progress.masteredCount} / {progress.totalCount}
        </strong>
      </div>
      <div
        aria-label={`${label}: освоено ${progress.masteredCount} из ${progress.totalCount}`}
        aria-valuemax={progress.totalCount}
        aria-valuemin={0}
        aria-valuenow={progress.masteredCount}
        className="progress-track"
        role="progressbar"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function formatNewLearnerStepStatus(status: NewLearnerStepStatus): string {
  switch (status) {
    case "complete":
      return "Готово";
    case "current":
      return "Сейчас";
    case "parallel":
      return "Параллельно";
    case "waiting":
      return "Ожидание";
    case "upcoming":
      return "Далее";
  }
}

function DashboardWidgetEditor({
  error,
  onCancel,
  onChange,
  onSave,
  preferences,
  saving,
}: {
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onChange: (preferences: readonly DashboardWidgetPreferenceDto[]) => void;
  readonly onSave: () => void;
  readonly preferences: readonly DashboardWidgetPreferenceDto[];
  readonly saving: boolean;
}) {
  return (
    <section
      aria-labelledby="dashboard-widget-editor-heading"
      className="panel dashboard-widget-editor"
    >
      <header>
        <div>
          <span className="eyebrow">Макет</span>
          <h2 id="dashboard-widget-editor-heading">Настройка панели</h2>
        </div>
      </header>

      <ol className="dashboard-widget-editor-list">
        {preferences.map((preference, index) => {
          const title = formatDashboardWidgetTitle(preference.id);

          return (
            <li data-testid="dashboard-widget-setting" key={preference.id}>
              <div className="dashboard-widget-order">
                <button
                  aria-label={`Переместить «${title}» выше`}
                  disabled={saving || index === 0}
                  onClick={() => onChange(moveDashboardWidget(preferences, index, -1))}
                  title="Переместить выше"
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`Переместить «${title}» ниже`}
                  disabled={saving || index === preferences.length - 1}
                  onClick={() => onChange(moveDashboardWidget(preferences, index, 1))}
                  title="Переместить ниже"
                  type="button"
                >
                  ↓
                </button>
              </div>

              <label className="dashboard-widget-visibility">
                <input
                  checked={preference.visible}
                  disabled={saving}
                  onChange={(event) =>
                    onChange(
                      updateDashboardWidget(preferences, preference.id, {
                        visible: event.currentTarget.checked,
                      }),
                    )
                  }
                  type="checkbox"
                />
                <span>{title}</span>
              </label>

              <div
                aria-label={`Размер виджета «${title}»`}
                className="dashboard-widget-presentation"
                role="group"
              >
                <button
                  aria-pressed={preference.presentation === "compact"}
                  disabled={saving}
                  onClick={() =>
                    onChange(
                      updateDashboardWidget(preferences, preference.id, {
                        presentation: "compact",
                      }),
                    )
                  }
                  type="button"
                >
                  Компактно
                </button>
                <button
                  aria-pressed={preference.presentation === "expanded"}
                  disabled={saving}
                  onClick={() =>
                    onChange(
                      updateDashboardWidget(preferences, preference.id, {
                        presentation: "expanded",
                      }),
                    )
                  }
                  type="button"
                >
                  Развёрнуто
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="action-row">
        <button className="primary-action" disabled={saving} onClick={onSave} type="button">
          {saving ? "Сохраняю" : "Сохранить макет"}
        </button>
        <button className="secondary-action" disabled={saving} onClick={onCancel} type="button">
          Отмена
        </button>
      </div>
    </section>
  );
}

function moveDashboardWidget(
  preferences: readonly DashboardWidgetPreferenceDto[],
  index: number,
  offset: -1 | 1,
): readonly DashboardWidgetPreferenceDto[] {
  const targetIndex = index + offset;

  if (targetIndex < 0 || targetIndex >= preferences.length) {
    return preferences;
  }

  const next = [...preferences];
  const current = next[index];
  const target = next[targetIndex];

  if (current === undefined || target === undefined) {
    return preferences;
  }

  next[index] = target;
  next[targetIndex] = current;
  return next;
}

function updateDashboardWidget(
  preferences: readonly DashboardWidgetPreferenceDto[],
  id: DashboardWidgetId,
  update: Partial<Omit<DashboardWidgetPreferenceDto, "id">>,
): readonly DashboardWidgetPreferenceDto[] {
  return preferences.map((preference) =>
    preference.id === id ? { ...preference, ...update } : preference,
  );
}

function formatDashboardWidgetTitle(id: DashboardWidgetId): string {
  const titles: Readonly<Record<DashboardWidgetId, string>> = {
    summary: "Главные показатели",
    workload: "Баланс нагрузки",
    "study-activity": "Активность за год",
    "srs-stage-spread": "Этапы SRS",
    "recent-activity": "Последние изменения",
    "course-progress": "Прогресс курса",
    "review-forecast": "Прогноз повторений",
    "leech-candidates": "Сложные карточки",
    "recent-review-stats": "Последние ответы",
  };

  return titles[id];
}

function DashboardWidgetContent({
  coursesState,
  dashboard,
  id,
  onCourseChange,
}: {
  readonly coursesState: CoursesState;
  readonly dashboard: DashboardDto;
  readonly id: DashboardWidgetId;
  readonly onCourseChange: (courseId: string) => void;
}) {
  switch (id) {
    case "summary":
      return <DashboardSummary counts={dashboard.counts} />;
    case "workload":
      return <WorkloadPanel workload={dashboard.workload} />;
    case "study-activity":
      return <StudyActivityPanel activity={dashboard.studyActivity} />;
    case "srs-stage-spread":
      return <SrsStageSpreadPanel systems={dashboard.srsStageSpread} />;
    case "recent-activity":
      return (
        <RecentActivityPanel
          activity={dashboard.recentActivity}
          timezone={dashboard.user.timezone}
        />
      );
    case "course-progress":
      return (
        <CourseProgressPanel
          course={dashboard.currentCourse}
          coursesState={coursesState}
          onCourseChange={onCourseChange}
          timezone={dashboard.user.timezone}
        />
      );
    case "review-forecast":
      return <ReviewForecastPanel forecast={dashboard.reviewForecast} />;
    case "leech-candidates":
      return <LeechCandidatesPanel candidates={dashboard.leechCandidates} />;
    case "recent-review-stats":
      return <RecentReviewStatsPanel stats={dashboard.recentReviewStats} />;
  }

  return assertUnknownDashboardWidget(id);
}

function assertUnknownDashboardWidget(id: never): never {
  throw new Error(`Unknown dashboard widget: ${String(id)}`);
}

function DashboardSummary({ counts }: { readonly counts: DashboardDto["counts"] }) {
  return (
    <section aria-label="Счётчики" className="metric-grid">
      <MetricCard label="К повторению" value={counts.dueReviews} />
      <MetricCard label="Доступно уроков" value={counts.availableLessons} />
      <MetricCard label="Сожжено" value={counts.burnedCards} />
      <MetricCard label="Сложные" value={counts.leechCandidates} />
    </section>
  );
}

function CourseProgressPanel({
  course,
  coursesState,
  onCourseChange,
  timezone,
}: {
  readonly course: DashboardDto["currentCourse"];
  readonly coursesState: CoursesState;
  readonly onCourseChange: (courseId: string) => void;
  readonly timezone: string;
}) {
  return (
    <section className="panel">
      <h2>Курс</h2>
      <CourseSelector coursesState={coursesState} onCourseChange={onCourseChange} />
      {course === null ? (
        <p className="muted">Активный курс не выбран.</p>
      ) : (
        <div className="course-progress">
          <div>
            <strong>{course.title}</strong>
            <span>Уровень {course.currentLevel}</span>
          </div>
          <CourseNextAction course={course} timezone={timezone} />
          <div className="course-pass-progress">
            <div className="course-progress-row">
              <span>
                Порог уровня: {formatItemType(course.levelProgress.pass.itemType)} до{" "}
                {course.levelProgress.pass.stageName}
              </span>
              <strong>{course.levelProgress.pass.percent}%</strong>
            </div>
            <div
              aria-label={`Порог уровня выполнен на ${course.levelProgress.pass.percent}%`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={course.levelProgress.pass.percent}
              className="progress-track"
              role="progressbar"
            >
              <span style={{ width: `${course.levelProgress.pass.percent}%` }} />
            </div>
            <p className="muted">
              {course.levelProgress.pass.passedItems} из {course.levelProgress.pass.requiredItems}{" "}
              требуемых · {course.levelProgress.pass.requiredPercentage}% из{" "}
              {course.levelProgress.pass.totalItems}
            </p>
            {course.levelProgress.pass.completedAt === null ? null : (
              <p className="course-pass-status">
                Уровень завершён
                {course.levelProgress.pass.currentlyPassed
                  ? "."
                  : "; текущие этапы карточек могли снизиться после ошибок."}
              </p>
            )}
          </div>
          <div className="course-progress-row">
            <span>Материалы уровня</span>
            <strong>{course.levelProgress.percent}%</strong>
          </div>
          <div
            aria-label={`Материалы уровня ${course.levelProgress.percent}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={course.levelProgress.percent}
            className="progress-track"
            role="progressbar"
          >
            <span style={{ width: `${course.levelProgress.percent}%` }} />
          </div>
          <div className="course-progress-row">
            <span>Карточки уровня</span>
            <strong>{course.levelProgress.cardPercent}%</strong>
          </div>
          <div
            aria-label={`Карточки уровня ${course.levelProgress.cardPercent}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={course.levelProgress.cardPercent}
            className="progress-track progress-track-secondary"
            role="progressbar"
          >
            <span style={{ width: `${course.levelProgress.cardPercent}%` }} />
          </div>
          <p className="muted">
            {course.levelProgress.completedItems} из {course.levelProgress.totalItems} ·{" "}
            {course.levelProgress.completedCards} карточек из {course.levelProgress.totalCards}
          </p>
          {course.levelProgress.itemsByType.length === 0 ? null : (
            <div className="level-progress-scroll">
              <table aria-label={`Состояния материалов уровня ${course.currentLevel}`}>
                <thead>
                  <tr>
                    <th scope="col">Тип</th>
                    <th scope="col">Закрыто</th>
                    <th scope="col">Уроки</th>
                    <th scope="col">В SRS</th>
                    <th scope="col">Пройдено</th>
                    <th scope="col">Закреплено</th>
                    <th scope="col">Всего</th>
                  </tr>
                </thead>
                <tbody>
                  {course.levelProgress.itemsByType.map((row) => (
                    <tr data-testid="level-progress-type" key={row.itemType}>
                      <th scope="row">{formatItemType(row.itemType)}</th>
                      <td>{row.locked}</td>
                      <td>{row.available}</td>
                      <td>{row.inProgress}</td>
                      <td>{row.passed}</td>
                      <td>{row.burned}</td>
                      <td className="level-progress-total">{row.totalItems}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <CourseJourneyDetails course={course} />
        </div>
      )}
    </section>
  );
}

function CourseNextAction({
  course,
  timezone,
}: {
  readonly course: NonNullable<DashboardDto["currentCourse"]>;
  readonly timezone: string;
}) {
  const action = course.journey.nextAction;

  switch (action.kind) {
    case "review":
      return (
        <p className="course-next-action">
          Следующий шаг: <Link href="/reviews">повторения</Link>.
        </p>
      );
    case "lesson":
      return (
        <p className="course-next-action">
          Следующий шаг: <Link href="/lessons">доступный урок</Link>.
        </p>
      );
    case "prerequisite": {
      const prerequisite = course.journey.nextLocked?.shortestPath[0];

      return prerequisite === undefined ? null : (
        <p className="course-next-action">
          Следующий шаг: изучить{" "}
          <Link href={`/items/${encodeURIComponent(prerequisite.item.id)}`}>
            <JapaneseText>{prerequisite.item.japanese}</JapaneseText>
          </Link>
          .
        </p>
      );
    }
    case "wait":
      return (
        <p className="course-next-action">
          {action.availableAt === null
            ? "Следующий шаг появится после текущего учебного окна."
            : `Следующий шаг: дождаться повторения до ${formatJourneyDate(
                action.availableAt,
                timezone,
              )}.`}
        </p>
      );
    case "course-complete":
      return <p className="course-next-action">Все доступные уровни завершены.</p>;
  }
}

function CourseJourneyDetails({
  course,
}: {
  readonly course: NonNullable<DashboardDto["currentCourse"]>;
}) {
  const newlyUnlocked = course.journey.newlyUnlocked;
  const nextLocked = course.journey.nextLocked;

  if (newlyUnlocked === null && nextLocked === null) {
    return null;
  }

  return (
    <div className="course-journey">
      {newlyUnlocked === null ? null : (
        <section aria-labelledby="newly-unlocked-heading">
          <h3 id="newly-unlocked-heading">Открыто последними повторениями</h3>
          {newlyUnlocked.groups.map((group) => (
            <div className="journey-unlock-group" key={group.itemType}>
              <strong>{formatItemType(group.itemType)}</strong>
              <div className="journey-item-links">
                {group.items.map((item) => (
                  <Link href={`/items/${encodeURIComponent(item.id)}`} key={item.id}>
                    <JapaneseText>{item.japanese}</JapaneseText>
                    <span>{formatItemTranslation(item)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      {nextLocked === null ? null : (
        <section aria-labelledby="next-locked-heading">
          <h3 id="next-locked-heading">
            Путь к{" "}
            <Link href={`/items/${encodeURIComponent(nextLocked.target.id)}`}>
              <JapaneseText>{nextLocked.target.japanese}</JapaneseText>
            </Link>
          </h3>
          <ol className="journey-prerequisites">
            {nextLocked.unmetPrerequisites.map((prerequisite) => (
              <li key={prerequisite.item.id}>
                <Link href={`/items/${encodeURIComponent(prerequisite.item.id)}`}>
                  <JapaneseText>{prerequisite.item.japanese}</JapaneseText>
                </Link>
                <span>{formatItemTranslation(prerequisite.item)}</span>
                <small>
                  этап {prerequisite.currentStage} из {prerequisite.requiredStage}
                </small>
              </li>
            ))}
          </ol>
          {nextLocked.shortestPath.length <= 1 ? null : (
            <p className="journey-shortest-path">
              Кратчайший путь:{" "}
              {nextLocked.shortestPath.map((prerequisite, index) => (
                <span key={prerequisite.item.id}>
                  {index === 0 ? "" : " → "}
                  <Link href={`/items/${encodeURIComponent(prerequisite.item.id)}`}>
                    <JapaneseText>{prerequisite.item.japanese}</JapaneseText>
                  </Link>
                </span>
              ))}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function formatJourneyDate(value: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function ReviewForecastPanel({ forecast }: { readonly forecast: DashboardDto["reviewForecast"] }) {
  return (
    <section className="panel">
      <h2>Прогноз</h2>
      {forecast.length === 0 ? (
        <p className="muted">Нет запланированных повторений.</p>
      ) : (
        <ol className="forecast-list" data-testid="forecast-list">
          {forecast.slice(0, 6).map((bucket) => (
            <li data-testid="forecast-bucket" key={bucket.bucketKey}>
              <span>{formatForecastBucket(bucket)}</span>
              <strong>{formatCount(bucket.dueCount, "карточка", "карточки", "карточек")}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function LeechCandidatesPanel({
  candidates,
}: {
  readonly candidates: DashboardDto["leechCandidates"];
}) {
  return (
    <section className="panel">
      <h2>Сложные карточки</h2>
      {candidates.length === 0 ? (
        <p className="muted">Нет карточек, которые требуют отдельного внимания.</p>
      ) : (
        <ul className="leech-list">
          {candidates.map((candidate) => (
            <li key={candidate.learningCardId}>
              <div>
                <span className="eyebrow">{formatItemType(candidate.item.itemType)}</span>
                <Link className="inline-link" href={`/items/${candidate.item.id}`}>
                  <JapaneseText>{candidate.item.japanese}</JapaneseText>
                </Link>
                <small>{formatItemTranslation(candidate.item)}</small>
              </div>
              <dl>
                <div>
                  <dt>Балл</dt>
                  <dd>{candidate.leech.score}</dd>
                </div>
                <div>
                  <dt>Ошибок</dt>
                  <dd>{candidate.leech.wrongCount}</dd>
                </div>
                <div>
                  <dt>Недавно</dt>
                  <dd>{candidate.leech.recentWrongCount}</dd>
                </div>
              </dl>
              <p>{formatLeechReasons(candidate.leech.reasons)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentReviewStatsPanel({ stats }: { readonly stats: DashboardDto["recentReviewStats"] }) {
  return (
    <section className="panel">
      <h2>Последние ответы</h2>
      <dl className="stats-list">
        <div>
          <dt>Всего</dt>
          <dd>{stats.total}</dd>
        </div>
        <div>
          <dt>Верно</dt>
          <dd>{stats.correct + stats.typo}</dd>
        </div>
        <div>
          <dt>Ошибки</dt>
          <dd>{stats.wrong + stats.reveal}</dd>
        </div>
        <div>
          <dt>Точность</dt>
          <dd>{formatAccuracy(stats.accuracy)}</dd>
        </div>
      </dl>
    </section>
  );
}

function CourseSelector({
  coursesState,
  onCourseChange,
}: {
  readonly coursesState: CoursesState;
  readonly onCourseChange: (courseId: string) => void;
}) {
  if (coursesState.status === "loading") {
    return <p className="muted course-selector-status">Загружаю доступные курсы.</p>;
  }

  if (coursesState.status === "error") {
    return (
      <p className="course-selector-status course-selector-error" role="alert">
        {coursesState.message}
      </p>
    );
  }

  const activeCourses = coursesState.data.courses.filter(
    ({ enrollmentStatus }) => enrollmentStatus === "active",
  );

  if (activeCourses.length === 0) {
    return <p className="muted course-selector-status">Нет доступных опубликованных курсов.</p>;
  }

  return (
    <div className="course-selector">
      <label>
        Текущий курс
        <select
          aria-busy={coursesState.saving}
          disabled={coursesState.saving || activeCourses.length < 2}
          onChange={(event) => onCourseChange(event.currentTarget.value)}
          value={coursesState.data.currentCourseId ?? ""}
        >
          {activeCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </label>
      <div aria-live="polite" className="course-selector-feedback">
        {coursesState.saving ? <span>Переключаю курс.</span> : null}
        {coursesState.message === null ? null : <span>{coursesState.message}</span>}
        {coursesState.error === null ? null : (
          <span className="course-selector-error" role="alert">
            {coursesState.error}{" "}
            {coursesState.activeLessonConflict ? <Link href="/lessons">Открыть урок</Link> : null}
          </span>
        )}
      </div>
    </div>
  );
}

function createReadyCoursesState(data: CourseListResponse): ReadyCoursesState {
  return {
    status: "ready",
    data,
    saving: false,
    message: null,
    error: null,
    activeLessonConflict: false,
  };
}

function WorkloadPanel({ workload }: { readonly workload: DashboardDto["workload"] }) {
  const reviewsBeforeTomorrow = workload.reviews.dueNow + workload.reviews.next24Hours;

  return (
    <section className="panel workload-panel" aria-labelledby="workload-heading">
      <header>
        <div>
          <span className="eyebrow">Сегодня</span>
          <h2 id="workload-heading">Баланс нагрузки</h2>
        </div>
        <Link className="inline-link" href="/settings">
          Настроить лимиты
        </Link>
      </header>
      <div className="workload-grid">
        <div className="workload-block">
          <div className="workload-value">
            <span>Повторения до завтра</span>
            <strong>{reviewsBeforeTomorrow}</strong>
          </div>
          <div
            aria-label={`Нагрузка повторений ${workload.reviews.pressurePercent}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={workload.reviews.pressurePercent}
            className="progress-track workload-track"
            role="progressbar"
          >
            <span style={{ width: `${workload.reviews.pressurePercent}%` }} />
          </div>
          <dl className="workload-facts">
            <div>
              <dt>Сейчас</dt>
              <dd>{workload.reviews.dueNow}</dd>
            </div>
            <div>
              <dt>24 часа</dt>
              <dd>{workload.reviews.next24Hours}</dd>
            </div>
            <div>
              <dt>Позже за 7 дней</dt>
              <dd>{workload.reviews.laterThisWeek}</dd>
            </div>
            <div>
              <dt>Лимит сессии</dt>
              <dd>{workload.reviews.budget}</dd>
            </div>
          </dl>
        </div>

        <div className="workload-block">
          <div className="workload-value">
            <span>Новые материалы сегодня</span>
            <strong>
              {workload.lessons.completedToday} / {workload.lessons.dailyLimit}
            </strong>
          </div>
          <div
            aria-label={`Дневной лимит уроков ${workload.lessons.percent}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={workload.lessons.percent}
            className="progress-track progress-track-secondary workload-track"
            role="progressbar"
          >
            <span style={{ width: `${workload.lessons.percent}%` }} />
          </div>
          <dl className="workload-facts workload-lesson-facts">
            <div>
              <dt>Пройдено</dt>
              <dd>{workload.lessons.completedToday}</dd>
            </div>
            <div>
              <dt>Осталось</dt>
              <dd>{workload.lessons.remainingToday}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function StudyActivityPanel({ activity }: { readonly activity: DashboardDto["studyActivity"] }) {
  const calendar = buildStudyActivityCalendar(activity);
  const firstDayOffset = getMondayFirstWeekday(activity.rangeStart);
  const maxDailyCount = Math.max(0, ...calendar.map((day) => day.totalCount));

  return (
    <section aria-labelledby="study-activity-heading" className="panel study-activity-panel">
      <header className="study-activity-heading">
        <div>
          <span className="eyebrow">365 дней</span>
          <h2 id="study-activity-heading">Активность за год</h2>
        </div>
        <span>
          {formatStudyActivityDate(activity.rangeStart)} –{" "}
          {formatStudyActivityDate(activity.rangeEnd)}
        </span>
      </header>

      <dl className="study-activity-stats">
        <div>
          <dt>Текущая серия</dt>
          <dd data-testid="study-current-streak">{activity.currentStreak}</dd>
          <span>дней</span>
        </div>
        <div>
          <dt>Лучшая серия</dt>
          <dd>{activity.longestStreak}</dd>
          <span>дней</span>
        </div>
        <div>
          <dt>Активные дни</dt>
          <dd>{activity.activeDays}</dd>
          <span>из 365</span>
        </div>
        <div>
          <dt>Повторения</dt>
          <dd>{activity.totalReviews}</dd>
          <span>карточек</span>
        </div>
        <div>
          <dt>Уроки</dt>
          <dd>{activity.totalLessons}</dd>
          <span>материалов</span>
        </div>
      </dl>

      <div className="study-activity-scroll">
        <div className="study-activity-chart">
          <div aria-hidden="true" className="study-activity-weekdays">
            <span>Пн</span>
            <span />
            <span>Ср</span>
            <span />
            <span>Пт</span>
            <span />
            <span>Вс</span>
          </div>
          <div
            aria-label="Календарь учебной активности"
            className="study-activity-grid"
            role="grid"
          >
            {Array.from({ length: firstDayOffset }, (_, index) => (
              <span aria-hidden="true" className="study-activity-placeholder" key={index} />
            ))}
            {calendar.map((day) => {
              const level = getStudyActivityLevel(day.totalCount, maxDailyCount);
              const label = formatStudyActivityDayLabel(day);

              return (
                <span
                  aria-label={label}
                  className={`study-activity-cell study-activity-level-${level}`}
                  data-activity-level={level}
                  data-local-date={day.localDate}
                  data-testid="study-activity-day"
                  key={day.localDate}
                  role="gridcell"
                  title={label}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div aria-label="Интенсивность активности" className="study-activity-legend">
        <span>Меньше</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            aria-hidden="true"
            className={`study-activity-cell study-activity-level-${level}`}
            key={level}
          />
        ))}
        <span>Больше</span>
      </div>
    </section>
  );
}

function buildStudyActivityCalendar(
  activity: DashboardDto["studyActivity"],
): DashboardDto["studyActivity"]["days"] {
  const activityByDate = new Map(activity.days.map((day) => [day.localDate, day]));
  const days: DashboardDto["studyActivity"]["days"][number][] = [];
  let cursor = activity.rangeStart;

  while (cursor <= activity.rangeEnd) {
    days.push(
      activityByDate.get(cursor) ?? {
        localDate: cursor,
        reviewCount: 0,
        lessonCount: 0,
        totalCount: 0,
      },
    );
    cursor = addLocalCalendarDays(cursor, 1);
  }

  return days;
}

function getStudyActivityLevel(totalCount: number, maxDailyCount: number): number {
  if (totalCount === 0 || maxDailyCount === 0) {
    return 0;
  }

  return Math.max(1, Math.ceil((totalCount / maxDailyCount) * 4));
}

function getMondayFirstWeekday(localDate: string): number {
  return (new Date(`${localDate}T00:00:00.000Z`).getUTCDay() + 6) % 7;
}

function addLocalCalendarDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatStudyActivityDate(localDate: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${localDate}T00:00:00.000Z`));
}

function formatStudyActivityDayLabel(day: DashboardDto["studyActivity"]["days"][number]): string {
  return [
    formatStudyActivityDate(day.localDate),
    formatCount(day.reviewCount, "повторение", "повторения", "повторений"),
    formatCount(day.lessonCount, "урок", "урока", "уроков"),
  ].join(": ");
}

function SrsStageSpreadPanel({ systems }: { readonly systems: DashboardDto["srsStageSpread"] }) {
  return (
    <section aria-labelledby="srs-spread-heading" className="panel srs-spread-panel">
      <header className="srs-spread-heading">
        <div>
          <span className="eyebrow">Прогресс</span>
          <h2 id="srs-spread-heading">Этапы SRS</h2>
        </div>
        <strong>{formatCount(sumSrsCards(systems), "карточка", "карточки", "карточек")}</strong>
      </header>

      {systems.length === 0 ? (
        <p className="muted">Карточки появятся после первого завершённого урока.</p>
      ) : (
        systems.map((system) => (
          <div className="srs-spread-system" key={system.srsSystemId}>
            <div className="srs-spread-system-heading">
              <h3>{system.srsSystemTitle}</h3>
              <span>{system.totalCards}</span>
            </div>
            <div className="srs-spread-scroll">
              <table aria-label={`Распределение карточек: ${system.srsSystemTitle}`}>
                <thead>
                  <tr>
                    <th scope="col">Этап</th>
                    <th scope="col">Компоненты</th>
                    <th scope="col">Кандзи</th>
                    <th scope="col">Слова</th>
                    <th scope="col">Фразы</th>
                    <th scope="col">Всего</th>
                  </tr>
                </thead>
                <tbody>
                  {system.stages.map((stage) => (
                    <tr data-testid="srs-spread-stage" key={stage.stageIndex}>
                      <th scope="row">
                        <span
                          className={
                            stage.isBurned ? "srs-stage-marker is-burned" : "srs-stage-marker"
                          }
                        />
                        {formatSrsStageName(stage.name)}
                      </th>
                      <td>{stage.cardsByItemType.component}</td>
                      <td>{stage.cardsByItemType.kanji}</td>
                      <td>{stage.cardsByItemType.word}</td>
                      <td>{stage.cardsByItemType.sentence}</td>
                      <td className="srs-spread-total">{stage.totalCards}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function sumSrsCards(systems: DashboardDto["srsStageSpread"]): number {
  return systems.reduce((sum, system) => sum + system.totalCards, 0);
}

function formatSrsStageName(name: string): string {
  const labels: Readonly<Record<string, string>> = {
    "Apprentice 1": "Ученик 1",
    "Apprentice 2": "Ученик 2",
    "Apprentice 3": "Ученик 3",
    "Apprentice 4": "Ученик 4",
    "Guru 1": "Знаток 1",
    "Guru 2": "Знаток 2",
    Master: "Мастер",
    Enlightened: "Просветлённый",
    Burned: "Закреплено",
  };

  return labels[name] ?? name;
}

function RecentActivityPanel({
  activity,
  timezone,
}: {
  readonly activity: DashboardDto["recentActivity"];
  readonly timezone: string;
}) {
  const groups = [
    {
      key: "mistakes",
      title: "Недавние ошибки",
      empty: "За последние 30 дней ошибок нет.",
      href: "/practice?source=recent-mistakes",
      action: "Практиковать",
      meta: "Ошибка",
      items: activity.mistakes,
    },
    {
      key: "available",
      title: "Новые уроки",
      empty: "Новых доступных материалов пока нет.",
      href: "/lessons",
      action: "К урокам",
      meta: "Доступно",
      items: activity.availableLessons,
    },
    {
      key: "burned",
      title: "Недавно закреплено",
      empty: "Закреплённых материалов пока нет.",
      href: "/practice?source=burned",
      action: "Практиковать",
      meta: "Закреплено",
      items: activity.burned,
    },
  ] as const;

  return (
    <section aria-labelledby="recent-activity-heading" className="panel recent-activity-panel">
      <div>
        <span className="eyebrow">Материалы</span>
        <h2 id="recent-activity-heading">Последние изменения</h2>
      </div>
      <div className="recent-activity-grid">
        {groups.map((group) => (
          <section className="recent-activity-group" key={group.key}>
            <header>
              <h3>{group.title}</h3>
              <Link className="inline-link" href={group.href}>
                {group.action}
              </Link>
            </header>
            {group.items.length === 0 ? (
              <p className="muted">{group.empty}</p>
            ) : (
              <ul className="recent-activity-list">
                {group.items.map((record) => (
                  <li data-testid={`recent-${group.key}-item`} key={record.item.id}>
                    <div>
                      <span className="eyebrow">{formatItemType(record.item.itemType)}</span>
                      <Link className="inline-link" href={`/items/${record.item.id}`}>
                        <JapaneseText>{record.item.japanese}</JapaneseText>
                      </Link>
                      <small>{formatItemTranslation(record.item)}</small>
                      {group.key === "mistakes" && record.item.itemType === "kanji" ? (
                        <Link
                          className="inline-link recent-confusable-link"
                          href={`/practice/confusables?itemId=${encodeURIComponent(record.item.id)}`}
                        >
                          Сравнить похожие
                        </Link>
                      ) : null}
                    </div>
                    <span>{formatRecentActivityMeta(group.meta, record.occurredAt, timezone)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

function formatRecentActivityMeta(
  label: string,
  occurredAt: string | null,
  timezone: string,
): string {
  if (occurredAt === null) {
    return `${label} сейчас`;
  }

  try {
    const date = new Intl.DateTimeFormat("ru-RU", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
    }).format(new Date(occurredAt));

    return `${label} ${date}`;
  } catch {
    return label;
  }
}

function formatItemTranslation(item: ItemSummary) {
  const translations = item.translations;
  const parts = [translations.primaryRu, translations.primaryEn].filter(
    (part): part is string => part !== null,
  );

  return parts.length === 0 ? "перевод не задан" : parts.join(" / ");
}

function formatLeechReasons(reasons: DashboardDto["leechCandidates"][number]["leech"]["reasons"]) {
  return reasons.map(formatLeechReason).join(" · ");
}

function formatLeechReason(
  reason: DashboardDto["leechCandidates"][number]["leech"]["reasons"][number],
) {
  switch (reason) {
    case "wrong-count":
      return "накопленные ошибки";
    case "recent-wrong":
      return "недавние ошибки";
    case "stage-instability":
      return "нестабильная стадия";
    case "correct-streak-relief":
      return "есть серия верных ответов";
    case "burned":
      return "сожжено";
  }
}

function formatItemType(itemType: DashboardDto["leechCandidates"][number]["item"]["itemType"]) {
  switch (itemType) {
    case "component":
      return "Компонент";
    case "kanji":
      return "Кандзи";
    case "word":
      return "Слово";
    case "sentence":
      return "Предложение";
  }
}

function MetricCard({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
