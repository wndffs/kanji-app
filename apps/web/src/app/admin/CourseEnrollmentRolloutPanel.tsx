"use client";

import { useEffect, useState } from "react";

import { type AdminMainCourseEnrollmentRolloutPreviewResponse } from "@kanji-srs/shared";

import { getAdminMainCourseEnrollmentRolloutPreview } from "../../lib/api-client";

type CourseEnrollmentRolloutPanelProps = {
  readonly token: string;
  readonly refreshRevision: number;
};

type RolloutState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly preview: AdminMainCourseEnrollmentRolloutPreviewResponse;
    };

export function CourseEnrollmentRolloutPanel({
  token,
  refreshRevision,
}: CourseEnrollmentRolloutPanelProps) {
  const [state, setState] = useState<RolloutState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    setState({ status: "loading" });

    void getAdminMainCourseEnrollmentRolloutPreview(token)
      .then((preview) => {
        if (active) {
          setState({ status: "ready", preview });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "Не удалось рассчитать переход учащихся.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [refreshRevision, token]);

  if (state.status === "loading") {
    return (
      <section className="panel" data-testid="admin-course-enrollment-rollout">
        <p className="muted">Расчёт перехода учащихся...</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="panel" data-testid="admin-course-enrollment-rollout">
        <h2>Переход учащихся</h2>
        <p className="form-error" role="alert">
          {state.message}
        </p>
      </section>
    );
  }

  const { preview } = state;

  return (
    <section className="panel admin-course-rollout" data-testid="admin-course-enrollment-rollout">
      <header className="admin-planning-header">
        <div>
          <span className="eyebrow">Preview · {preview.policyVersion}</span>
          <h2>Переход учащихся</h2>
          <p>{preview.course.title} · add-only</p>
        </div>
        <strong>{formatNumber(preview.summary.newEnrollments)}</strong>
      </header>

      <p className={preview.readyToApply ? "success-text" : "muted"}>
        <strong>
          {preview.readyToApply
            ? "Preview готов к отдельному подтверждённому применению."
            : "Переход заблокирован до публикации полностью готового курса."}
        </strong>
      </p>

      <dl className="admin-allocation-summary">
        <div>
          <dt>Учащиеся</dt>
          <dd>{formatNumber(preview.summary.learnerAccounts)}</dd>
        </div>
        <div>
          <dt>Новые зачисления</dt>
          <dd>{formatNumber(preview.summary.newEnrollments)}</dd>
        </div>
        <div>
          <dt>Уже активны</dt>
          <dd>{formatNumber(preview.summary.existingActiveEnrollments)}</dd>
        </div>
        <div>
          <dt>Неактивные сохранены</dt>
          <dd>{formatNumber(preview.summary.preservedInactiveEnrollments)}</dd>
        </div>
        <div>
          <dt>Активны в демо-курсе</dt>
          <dd>{formatNumber(preview.summary.activeStarterEnrollments)}</dd>
        </div>
      </dl>

      <div className="admin-allocation-action">
        <div>
          <strong>Только просмотр</strong>
          <span>
            Будущее применение добавит только отсутствующие зачисления. Демо-курс, неактивные
            статусы и весь SRS-прогресс останутся без изменений.
          </span>
        </div>
        <strong>{preview.strategy}</strong>
      </div>
    </section>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}
