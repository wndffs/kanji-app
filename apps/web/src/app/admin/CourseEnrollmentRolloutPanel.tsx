"use client";

import { useEffect, useRef, useState } from "react";

import { type AdminMainCourseEnrollmentRolloutPreviewResponse } from "@kanji-srs/shared";

import {
  applyAdminMainCourseEnrollmentRollout,
  getAdminMainCourseEnrollmentRolloutPreview,
} from "../../lib/api-client";

type CourseEnrollmentRolloutPanelProps = {
  readonly token: string;
  readonly refreshRevision: number;
  readonly disabled: boolean;
  readonly onApplied: (createdEnrollments: number) => void;
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
  disabled,
  onApplied,
}: CourseEnrollmentRolloutPanelProps) {
  const [state, setState] = useState<RolloutState>({ status: "loading" });
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setState({ status: "loading" });
    setConfirmationOpen(false);
    setApplyError(null);

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

  async function handleApply(): Promise<void> {
    if (state.status !== "ready" || applying || disabled) {
      return;
    }

    setApplying(true);
    setApplyError(null);

    try {
      const response = await applyAdminMainCourseEnrollmentRollout(token, {
        rolloutVersion: state.preview.rolloutVersion,
      });

      setState({ status: "ready", preview: response.preview });
      setConfirmationOpen(false);
      onApplied(response.createdEnrollments);
    } catch (error: unknown) {
      setConfirmationOpen(false);
      setApplyError(
        error instanceof Error ? error.message : "Не удалось зачислить учащихся на основной курс.",
      );

      try {
        const preview = await getAdminMainCourseEnrollmentRolloutPreview(token);
        setState({ status: "ready", preview });
      } catch {
        // Keep the last valid preview visible when a refresh is temporarily unavailable.
      }
    } finally {
      setApplying(false);
    }
  }

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
  const canApply =
    !disabled && !applying && preview.readyToApply && preview.summary.newEnrollments > 0;

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
          <strong>Подтверждённое add-only зачисление</strong>
          <span>
            Добавятся только отсутствующие зачисления. Демо-курс, неактивные статусы и весь
            SRS-прогресс останутся без изменений.
          </span>
        </div>
        <button
          className="primary-action"
          data-testid="admin-apply-course-enrollment-rollout"
          disabled={!canApply}
          onClick={() => {
            setApplyError(null);
            setConfirmationOpen(true);
          }}
          type="button"
        >
          {preview.summary.newEnrollments === 0
            ? "Все зачислены"
            : `Зачислить ${formatNumber(preview.summary.newEnrollments)}`}
        </button>
      </div>
      {applyError === null ? null : (
        <p className="form-error" role="alert">
          {applyError}
        </p>
      )}
      {confirmationOpen ? (
        <CourseEnrollmentRolloutConfirmationDialog
          busy={applying}
          count={preview.summary.newEnrollments}
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={() => void handleApply()}
        />
      ) : null}
    </section>
  );
}

function CourseEnrollmentRolloutConfirmationDialog({
  busy,
  count,
  onCancel,
  onConfirm,
}: {
  readonly busy: boolean;
  readonly count: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onCancel();
        return;
      }

      if (event.key !== "Tab" || dialogRef.current === null) {
        return;
      }

      const buttons = [
        ...dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      ];
      const firstButton = buttons[0];
      const lastButton = buttons.at(-1);

      if (firstButton === undefined || lastButton === undefined) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        firstButton.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="dialog-backdrop">
      <section
        aria-describedby="course-enrollment-rollout-confirmation-description"
        aria-labelledby="course-enrollment-rollout-confirmation-title"
        aria-modal="true"
        className="confirmation-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="course-enrollment-rollout-confirmation-title">
          Зачислить учащихся на основной курс?
        </h2>
        <p id="course-enrollment-rollout-confirmation-description">
          Новых зачислений: {formatNumber(count)}. Демо-курс останется активным, статусы paused и
          completed не изменятся, весь учебный прогресс сохранится.
        </p>
        <div className="dialog-actions">
          <button
            className="secondary-action"
            disabled={busy}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            Отмена
          </button>
          <button className="primary-action" disabled={busy} onClick={onConfirm} type="button">
            {busy ? "Зачисляю..." : "Зачислить"}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}
