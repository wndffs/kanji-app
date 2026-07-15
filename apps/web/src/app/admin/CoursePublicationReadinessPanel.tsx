"use client";

import { useEffect, useRef, useState } from "react";

import { type AdminMainCoursePublicationReadinessResponse } from "@kanji-srs/shared";

import {
  getAdminMainCoursePublicationReadiness,
  publishAdminMainCourse,
} from "../../lib/api-client";

type CoursePublicationReadinessPanelProps = {
  readonly token: string;
  readonly refreshRevision: number;
  readonly disabled: boolean;
  readonly onPublished: (statusChanged: boolean) => void;
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
  disabled,
  onPublished,
}: CoursePublicationReadinessPanelProps) {
  const [state, setState] = useState<ReadinessState>({ status: "loading" });
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setState({ status: "loading" });
    setConfirmationOpen(false);
    setPublishError(null);

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

  async function handlePublish(): Promise<void> {
    if (state.status !== "ready" || publishing || disabled) {
      return;
    }

    setPublishing(true);
    setPublishError(null);

    try {
      const response = await publishAdminMainCourse(token, {
        readinessVersion: state.readiness.readinessVersion,
      });

      setState({ status: "ready", readiness: response.readiness });
      setConfirmationOpen(false);
      onPublished(response.statusChanged);
    } catch (error: unknown) {
      setConfirmationOpen(false);
      setPublishError(
        error instanceof Error ? error.message : "Не удалось опубликовать основной курс.",
      );

      try {
        const readiness = await getAdminMainCoursePublicationReadiness(token);
        setState({ status: "ready", readiness });
      } catch {
        // Keep the last valid audit visible when a refresh is temporarily unavailable.
      }
    } finally {
      setPublishing(false);
    }
  }

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
  const canPublish =
    !disabled && !publishing && readiness.readyToPublish && readiness.course.status !== "published";

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

      <div className="admin-allocation-action">
        <div>
          <strong>Подтверждённая публикация</strong>
          <span>
            Меняется только статус курса. Зачисления и прогресс пользователей не затрагиваются.
          </span>
        </div>
        <button
          className="primary-action"
          data-testid="admin-publish-main-course"
          disabled={!canPublish}
          onClick={() => {
            setPublishError(null);
            setConfirmationOpen(true);
          }}
          type="button"
        >
          {readiness.course.status === "published" ? "Курс опубликован" : "Опубликовать курс"}
        </button>
      </div>
      {publishError === null ? null : (
        <p className="form-error" role="alert">
          {publishError}
        </p>
      )}

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
      {confirmationOpen ? (
        <MainCoursePublicationConfirmationDialog
          busy={publishing}
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={() => void handlePublish()}
        />
      ) : null}
    </section>
  );
}

function MainCoursePublicationConfirmationDialog({
  busy,
  onCancel,
  onConfirm,
}: {
  readonly busy: boolean;
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
        aria-describedby="main-course-publication-confirmation-description"
        aria-labelledby="main-course-publication-confirmation-title"
        aria-modal="true"
        className="confirmation-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="main-course-publication-confirmation-title">Опубликовать основной курс?</h2>
        <p id="main-course-publication-confirmation-description">
          Курс получит статус «Опубликован». Пользователи не будут зачислены автоматически, а их
          текущий прогресс и расписание повторений не изменятся.
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
            {busy ? "Публикую..." : "Опубликовать"}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}
