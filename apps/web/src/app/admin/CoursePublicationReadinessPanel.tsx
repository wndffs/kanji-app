"use client";

import { useEffect, useState } from "react";

import { type AdminMainCoursePublicationReadinessResponse } from "@kanji-srs/shared";

import { getAdminMainCoursePublicationReadiness } from "../../lib/api-client";

type CoursePublicationReadinessPanelProps = {
  readonly token: string;
  readonly refreshRevision: number;
};

type ReadinessState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly readiness: AdminMainCoursePublicationReadinessResponse;
    };

export function CoursePublicationReadinessPanel({
  token,
  refreshRevision,
}: CoursePublicationReadinessPanelProps) {
  const [state, setState] = useState<ReadinessState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    setState({ status: "loading" });

    void getAdminMainCoursePublicationReadiness(token)
      .then((readiness) => {
        if (active) {
          setState({ status: "ready", readiness });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Не удалось проверить готовность курса к публикации.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [refreshRevision, token]);

  if (state.status === "loading") {
    return (
      <section className="panel" data-testid="admin-course-publication-readiness">
        <p className="muted">Проверка готовности курса...</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="panel" data-testid="admin-course-publication-readiness">
        <h2>Готовность к публикации</h2>
        <p className="form-error" role="alert">
          {state.message}
        </p>
      </section>
    );
  }

  const { readiness } = state;

  return (
    <section
      className="panel admin-course-readiness"
      data-testid="admin-course-publication-readiness"
    >
      <header className="admin-planning-header">
        <div>
          <span className="eyebrow">Audit · {readiness.policyVersion}</span>
          <h2>Готовность к публикации</h2>
          <p>
            {readiness.course.title} ·{" "}
            {readiness.readyToPublish ? "все проверки пройдены" : "публикация заблокирована"}
          </p>
        </div>
        <strong>{readiness.summary.blockedChecks}</strong>
      </header>

      <p className={readiness.readyToPublish ? "success-text" : "muted"}>
        <strong>
          {readiness.readyToPublish
            ? "Курс готов к отдельному подтверждённому этапу публикации."
            : `Пройдено проверок: ${readiness.summary.passedChecks} из ${readiness.checks.length}.`}
        </strong>
      </p>

      <ul className="admin-readiness-list">
        {readiness.checks.map((check) => (
          <li data-passed={check.passed} key={check.code}>
            <div>
              <strong>{check.title}</strong>
              <span>{check.message}</span>
            </div>
            <div className="admin-readiness-result">
              {check.current === null || check.required === null ? null : (
                <span>
                  {formatNumber(check.current)} / {formatNumber(check.required)}
                </span>
              )}
              <b>{check.passed ? "Пройдено" : "Блокер"}</b>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}
