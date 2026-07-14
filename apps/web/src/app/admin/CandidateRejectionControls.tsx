"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  ADMIN_IMPORTED_CANDIDATE_REJECTION_REASONS,
  type AdminImportedCandidateRejectionListItemDto,
  type AdminImportedCandidateRejectionReason,
} from "@kanji-srs/shared";

export type CandidateRejectionTarget = {
  readonly itemType: "kanji" | "word";
  readonly targetId: string;
  readonly japanese: string;
  readonly reading: string | null;
};

type CandidateRejectionControlsProps = {
  readonly candidate: CandidateRejectionTarget | null;
  readonly disabled: boolean;
  readonly rejections: readonly AdminImportedCandidateRejectionListItemDto[];
  readonly restoringId: string | null;
  readonly onReject: (
    candidate: CandidateRejectionTarget,
    reason: AdminImportedCandidateRejectionReason,
    note: string | null,
  ) => Promise<boolean>;
  readonly onRestore: (rejection: AdminImportedCandidateRejectionListItemDto) => Promise<void>;
};

export function CandidateRejectionControls({
  candidate,
  disabled,
  rejections,
  restoringId,
  onReject,
  onRestore,
}: CandidateRejectionControlsProps) {
  const [rejectTarget, setRejectTarget] = useState<CandidateRejectionTarget | null>(null);

  return (
    <section
      aria-label="Решения по импортированным кандидатам"
      className="admin-candidate-decisions"
      data-testid="admin-candidate-decisions"
    >
      <header className="admin-candidate-decisions-heading">
        <h3>Решения по кандидатам</h3>
        {candidate === null ? null : (
          <button
            className="danger-action"
            disabled={disabled}
            onClick={() => setRejectTarget(candidate)}
            type="button"
          >
            Отклонить кандидата
          </button>
        )}
      </header>

      <div className="admin-candidate-rejection-list-heading">
        <h4>Отклонённые</h4>
        <strong>{rejections.length}</strong>
      </div>
      {rejections.length === 0 ? (
        <p className="muted">Отклонённых кандидатов нет.</p>
      ) : (
        <ul className="admin-candidate-rejection-list">
          {rejections.map((rejection) => (
            <li key={rejection.id}>
              <div className="admin-candidate-rejection-target">
                <strong>{rejection.japanese ?? rejection.targetId}</strong>
                <span>{rejection.reading ?? formatTargetType(rejection.targetType)}</span>
              </div>
              <div>
                <strong>{formatReason(rejection.reason)}</strong>
                {rejection.note === null ? null : <span>{rejection.note}</span>}
              </div>
              <time dateTime={rejection.updatedAt}>{formatDate(rejection.updatedAt)}</time>
              <button
                className="secondary-action"
                disabled={disabled}
                onClick={() => void onRestore(rejection)}
                type="button"
              >
                {restoringId === rejection.id ? "Восстанавливаю..." : "Восстановить"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {rejectTarget === null ? null : (
        <RejectCandidateDialog
          busy={disabled}
          candidate={rejectTarget}
          onCancel={() => setRejectTarget(null)}
          onConfirm={async (reason, note) => {
            const rejected = await onReject(rejectTarget, reason, note);

            if (rejected) {
              setRejectTarget(null);
            }
          }}
        />
      )}
    </section>
  );
}

function RejectCandidateDialog({
  busy,
  candidate,
  onCancel,
  onConfirm,
}: {
  readonly busy: boolean;
  readonly candidate: CandidateRejectionTarget;
  readonly onCancel: () => void;
  readonly onConfirm: (
    reason: AdminImportedCandidateRejectionReason,
    note: string | null,
  ) => Promise<void>;
}) {
  const [reason, setReason] = useState<AdminImportedCandidateRejectionReason | "">("");
  const [note, setNote] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);

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

      const controls = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          "select:not(:disabled), textarea:not(:disabled), button:not(:disabled)",
        ),
      ];
      const firstControl = controls[0];
      const lastControl = controls.at(-1);

      if (firstControl === undefined || lastControl === undefined) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (reason === "" || busy) {
      return;
    }

    await onConfirm(reason, note.trim() === "" ? null : note.trim());
  }

  return (
    <div className="dialog-backdrop">
      <form
        aria-describedby="candidate-rejection-description"
        aria-labelledby="candidate-rejection-title"
        aria-modal="true"
        className="confirmation-dialog admin-candidate-rejection-dialog"
        onSubmit={(event) => void handleSubmit(event)}
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="candidate-rejection-title">Отклонить кандидата?</h2>
        <p id="candidate-rejection-description">
          <strong>{candidate.japanese}</strong>
          {candidate.reading === null ? "" : ` · ${candidate.reading}`} исчезнет из новых планов и
          быстрых очередей. Решение можно отменить ниже.
        </p>
        <label>
          Причина
          <select
            disabled={busy}
            onChange={(event) =>
              setReason(event.currentTarget.value as AdminImportedCandidateRejectionReason | "")
            }
            required
            value={reason}
          >
            <option value="">Выберите причину</option>
            {ADMIN_IMPORTED_CANDIDATE_REJECTION_REASONS.map((value) => (
              <option key={value} value={value}>
                {formatReason(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Заметка <span>необязательно</span>
          <textarea
            disabled={busy}
            maxLength={500}
            onChange={(event) => setNote(event.currentTarget.value)}
            placeholder="Что проверить перед восстановлением"
            value={note}
          />
        </label>
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
          <button className="danger-action" disabled={busy || reason === ""} type="submit">
            {busy ? "Отклоняю..." : "Отклонить"}
          </button>
        </div>
      </form>
    </div>
  );
}

function formatReason(reason: AdminImportedCandidateRejectionReason): string {
  switch (reason) {
    case "duplicate":
      return "Дубликат";
    case "out-of-scope":
      return "Вне программы";
    case "data-quality":
      return "Проблема исходных данных";
    case "low-educational-value":
      return "Низкая учебная ценность";
    case "other":
      return "Другое";
  }
}

function formatTargetType(targetType: "kanji" | "word"): string {
  return targetType === "kanji" ? "кандзи" : "слово";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
