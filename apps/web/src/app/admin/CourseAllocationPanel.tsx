"use client";

import { useEffect, useRef, useState } from "react";

import {
  type AdminContentStatus,
  type AdminCourseAllocationIssueCode,
  type AdminCourseAllocationPreviewResponse,
  type CourseBand,
  type ItemKind,
} from "@kanji-srs/shared";

import { applyAdminCourseAllocation, getAdminCourseAllocationPreview } from "../../lib/api-client";

type CourseAllocationPanelProps = {
  readonly token: string;
  readonly refreshRevision: number;
  readonly disabled: boolean;
  readonly onApplied: (createdPlacements: number) => void;
};

type AllocationState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly preview: AdminCourseAllocationPreviewResponse };

export function CourseAllocationPanel({
  token,
  refreshRevision,
  disabled,
  onApplied,
}: CourseAllocationPanelProps) {
  const [state, setState] = useState<AllocationState>({ status: "loading" });
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setState({ status: "loading" });
    setConfirmationOpen(false);
    setApplyError(null);

    void getAdminCourseAllocationPreview(token)
      .then((preview) => {
        if (active) {
          setState({ status: "ready", preview });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Не удалось рассчитать уровни курса.",
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
      const response = await applyAdminCourseAllocation(token, {
        planVersion: state.preview.planVersion,
      });

      setState({ status: "ready", preview: response.preview });
      setConfirmationOpen(false);
      onApplied(response.createdPlacements);
    } catch (error: unknown) {
      setConfirmationOpen(false);
      setApplyError(
        error instanceof Error ? error.message : "Не удалось применить распределение курса.",
      );

      try {
        const preview = await getAdminCourseAllocationPreview(token);
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
      <section className="panel" data-testid="admin-course-allocation">
        <p className="muted">Расчёт распределения по уровням...</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="panel" data-testid="admin-course-allocation">
        <h2>Распределение по уровням</h2>
        <p className="form-error" role="alert">
          {state.message}
        </p>
      </section>
    );
  }

  const { preview } = state;
  const canApply =
    !disabled &&
    !applying &&
    preview.course.status !== "archived" &&
    preview.summary.proposedPlacements > 0 &&
    preview.issues.length === 0;

  return (
    <section className="panel admin-course-allocation" data-testid="admin-course-allocation">
      <header className="admin-planning-header">
        <div>
          <span className="eyebrow">Preview · {preview.policyVersion}</span>
          <h2>Распределение по уровням</h2>
          <p>
            {preview.course.title} · {preview.course.levelCount} уровней ·{" "}
            {formatStatus(preview.course.status)}
          </p>
        </div>
        <strong>{preview.summary.proposedPlacements}</strong>
      </header>

      <dl className="admin-allocation-summary">
        <div>
          <dt>Опубликовано</dt>
          <dd>{preview.summary.publishedItems}</dd>
        </div>
        <div>
          <dt>Уже размещено</dt>
          <dd>{preview.summary.existingPlacements}</dd>
        </div>
        <div>
          <dt>Предложено</dt>
          <dd>{preview.summary.proposedPlacements}</dd>
        </div>
        <div>
          <dt>Заблокировано</dt>
          <dd>{preview.summary.blockedItems}</dd>
        </div>
        <div>
          <dt>Лимит уровня</dt>
          <dd>{preview.maxItemsPerLevel}</dd>
        </div>
      </dl>

      <div className="admin-allocation-action">
        <div>
          <strong>Подтверждённое применение</strong>
          <span>Добавятся только новые размещения. Уже закреплённые материалы не изменятся.</span>
        </div>
        <button
          className="primary-action"
          data-testid="admin-apply-course-allocation"
          disabled={!canApply}
          onClick={() => {
            setApplyError(null);
            setConfirmationOpen(true);
          }}
          type="button"
        >
          Применить {preview.summary.proposedPlacements}
        </button>
      </div>
      {applyError === null ? null : (
        <p className="form-error" role="alert">
          {applyError}
        </p>
      )}

      <div className="admin-table-scroll">
        <table className="admin-planning-table admin-allocation-band-table">
          <thead>
            <tr>
              <th>Band</th>
              <th>Уровни</th>
              <th>Материалы</th>
              <th>Закреплено</th>
              <th>Предложено</th>
              <th>Блокеры</th>
            </tr>
          </thead>
          <tbody>
            {preview.bands.map((band) => (
              <tr key={band.band}>
                <td>{formatBand(band.band)}</td>
                <td>{band.levelCount}</td>
                <td>{band.publishedItems}</td>
                <td>{band.existingPlacements}</td>
                <td>{band.proposedPlacements}</td>
                <td>{band.blockedItems}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.issues.length === 0 ? (
        <p className="success-text">Блокирующих конфликтов не найдено.</p>
      ) : (
        <div className="admin-allocation-issues">
          <h3>Конфликты{preview.issuesTruncated ? ": первые 100" : ""}</h3>
          <ul className="quality-list">
            {preview.issues.map((issue) => (
              <li key={issue.learningItemId + ":" + issue.code}>
                <strong>{formatIssue(issue.code)}</strong>
                <span>{issue.title}</span>
                <p>{issue.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-table-scroll">
        <table className="admin-planning-table">
          <thead>
            <tr>
              <th>Материал</th>
              <th>Тип</th>
              <th>Band</th>
              <th>Уровень</th>
              <th>Prerequisite floor</th>
              <th>Решение</th>
            </tr>
          </thead>
          <tbody>
            {preview.items.map((item) => (
              <tr key={item.learningItemId}>
                <td>{item.title}</td>
                <td>{formatItemType(item.itemType)}</td>
                <td>{item.band === null ? "—" : formatBand(item.band)}</td>
                <td>{item.levelNumber}</td>
                <td>{item.prerequisiteLevelFloor || "—"}</td>
                <td>{formatPlacement(item.placement)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.itemsTruncated ? <p className="muted">Показаны первые 100 назначений.</p> : null}
      {confirmationOpen ? (
        <CourseAllocationConfirmationDialog
          busy={applying}
          count={preview.summary.proposedPlacements}
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={() => void handleApply()}
        />
      ) : null}
    </section>
  );
}

function CourseAllocationConfirmationDialog({
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
        aria-describedby="course-allocation-confirmation-description"
        aria-labelledby="course-allocation-confirmation-title"
        aria-modal="true"
        className="confirmation-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="course-allocation-confirmation-title">Применить распределение?</h2>
        <p id="course-allocation-confirmation-description">
          Будет создано размещений: {count}. Операция добавит материалы в рассчитанные уровни и
          сохранит все существующие размещения без изменений.
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
            {busy ? "Применяю..." : "Применить"}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatBand(band: CourseBand): string {
  return band === "foundation" ? "Foundation" : band.toUpperCase();
}

function formatStatus(status: AdminContentStatus): string {
  switch (status) {
    case "draft":
      return "черновик";
    case "needs-review":
      return "нужна проверка";
    case "published":
      return "опубликован";
    case "archived":
      return "архив";
  }
}

function formatItemType(itemType: ItemKind): string {
  switch (itemType) {
    case "component":
      return "компонент";
    case "kanji":
      return "кандзи";
    case "word":
      return "слово";
    case "sentence":
      return "предложение";
  }
}

function formatPlacement(
  placement: AdminCourseAllocationPreviewResponse["items"][number]["placement"],
): string {
  switch (placement) {
    case "existing":
      return "закреплено";
    case "level-hint":
      return "level hint";
    case "balanced":
      return "баланс";
  }
}

function formatIssue(code: AdminCourseAllocationIssueCode): string {
  switch (code) {
    case "missing-band":
      return "Нет band";
    case "missing-prerequisite":
      return "Нет prerequisite";
    case "prerequisite-unavailable":
      return "Prerequisite заблокирован";
    case "prerequisite-cycle":
      return "Цикл связей";
    case "prerequisite-after-band":
      return "Prerequisite позже band";
    case "capacity-exhausted":
      return "Нет места";
    case "multiple-placements":
      return "Несколько уровней";
    case "placement-band-mismatch":
      return "Уровень вне band";
    case "placement-prerequisite-order":
      return "Нарушен порядок";
  }
}
