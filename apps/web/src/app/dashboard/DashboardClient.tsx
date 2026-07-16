"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { type CourseListResponse, type DashboardDto } from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import { ApiError, getCourses, getDashboard, selectCurrentCourse } from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";
import {
  formatAccuracy,
  formatCount,
  formatForecastBucket,
  formatTranslationDisplayMode,
} from "../../lib/dashboard-format";

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

  return (
    <DashboardView
      coursesState={coursesState}
      dashboard={state.dashboard}
      onCourseChange={(courseId) => void handleCourseChange(courseId)}
    />
  );
}

function DashboardView({
  coursesState,
  dashboard,
  onCourseChange,
}: {
  readonly coursesState: CoursesState;
  readonly dashboard: DashboardDto;
  readonly onCourseChange: (courseId: string) => void;
}) {
  const course = dashboard.currentCourse;

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
        </div>
      </div>

      <section aria-label="Счётчики" className="metric-grid">
        <MetricCard label="К повторению" value={dashboard.counts.dueReviews} />
        <MetricCard label="Доступно уроков" value={dashboard.counts.availableLessons} />
        <MetricCard label="Сожжено" value={dashboard.counts.burnedCards} />
        <MetricCard label="Сложные" value={dashboard.counts.leechCandidates} />
      </section>

      <WorkloadPanel workload={dashboard.workload} />

      <SrsStageSpreadPanel systems={dashboard.srsStageSpread} />

      <div className="dashboard-layout">
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
                          <td>{row.burned}</td>
                          <td className="level-progress-total">{row.totalItems}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Прогноз</h2>
          {dashboard.reviewForecast.length === 0 ? (
            <p className="muted">Нет запланированных повторений.</p>
          ) : (
            <ol className="forecast-list" data-testid="forecast-list">
              {dashboard.reviewForecast.slice(0, 6).map((bucket) => (
                <li data-testid="forecast-bucket" key={bucket.bucketKey}>
                  <span>{formatForecastBucket(bucket)}</span>
                  <strong>
                    {formatCount(bucket.dueCount, "карточка", "карточки", "карточек")}
                  </strong>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="panel">
          <h2>Сложные карточки</h2>
          {dashboard.leechCandidates.length === 0 ? (
            <p className="muted">Нет карточек, которые требуют отдельного внимания.</p>
          ) : (
            <ul className="leech-list">
              {dashboard.leechCandidates.map((candidate) => (
                <li key={candidate.learningCardId}>
                  <div>
                    <span className="eyebrow">{formatItemType(candidate.item.itemType)}</span>
                    <Link className="inline-link" href={`/items/${candidate.item.id}`}>
                      <JapaneseText>{candidate.item.japanese}</JapaneseText>
                    </Link>
                    <small>{formatCandidateTranslation(candidate.item)}</small>
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

        <section className="panel">
          <h2>Последние ответы</h2>
          <dl className="stats-list">
            <div>
              <dt>Всего</dt>
              <dd>{dashboard.recentReviewStats.total}</dd>
            </div>
            <div>
              <dt>Верно</dt>
              <dd>{dashboard.recentReviewStats.correct + dashboard.recentReviewStats.typo}</dd>
            </div>
            <div>
              <dt>Ошибки</dt>
              <dd>{dashboard.recentReviewStats.wrong + dashboard.recentReviewStats.reveal}</dd>
            </div>
            <div>
              <dt>Точность</dt>
              <dd>{formatAccuracy(dashboard.recentReviewStats.accuracy)}</dd>
            </div>
          </dl>
        </section>
      </div>
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

function formatCandidateTranslation(candidate: DashboardDto["leechCandidates"][number]["item"]) {
  const translations = candidate.translations;
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
