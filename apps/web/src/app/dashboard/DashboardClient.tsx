"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { type DashboardDto } from "@kanji-srs/shared";

import { ApiError, getDashboard } from "../../lib/api-client";
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

export function DashboardClient() {
  const [state, setState] = useState<DashboardState>({ status: "checking" });

  useEffect(() => {
    const session = readStoredSession();

    if (session === null) {
      setState({ status: "unauthenticated" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

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

  return <DashboardView dashboard={state.dashboard} />;
}

function DashboardView({ dashboard }: { readonly dashboard: DashboardDto }) {
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
        </div>
      </div>

      <section aria-label="Счётчики" className="metric-grid">
        <MetricCard label="К повторению" value={dashboard.counts.dueReviews} />
        <MetricCard label="Доступно уроков" value={dashboard.counts.availableLessons} />
        <MetricCard label="Сожжено" value={dashboard.counts.burnedCards} />
        <MetricCard label="Пиявки" value={dashboard.counts.leechCandidates} />
      </section>

      <div className="dashboard-layout">
        <section className="panel">
          <h2>Курс</h2>
          {course === null ? (
            <p className="muted">Активный курс не выбран.</p>
          ) : (
            <div className="course-progress">
              <div>
                <strong>{course.title}</strong>
                <span>Уровень {course.currentLevel}</span>
              </div>
              <div
                aria-label={`Прогресс уровня ${course.levelProgress.percent}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={course.levelProgress.percent}
                className="progress-track"
                role="progressbar"
              >
                <span style={{ width: `${course.levelProgress.percent}%` }} />
              </div>
              <p className="muted">
                {course.levelProgress.completedItems} из {course.levelProgress.totalItems} ·{" "}
                {course.levelProgress.completedCards} карточек из {course.levelProgress.totalCards}
              </p>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Прогноз</h2>
          {dashboard.reviewForecast.length === 0 ? (
            <p className="muted">Нет запланированных повторений.</p>
          ) : (
            <ol className="forecast-list">
              {dashboard.reviewForecast.slice(0, 6).map((bucket) => (
                <li key={bucket.bucketKey}>
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

function MetricCard({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
