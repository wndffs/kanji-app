"use client";

import { type FormEvent, useEffect, useState } from "react";

import {
  type AdminCurationItemDto,
  type AdminPrerequisiteCandidateDto,
  type AdminPrerequisiteCandidateListResponse,
  type AdminUpdatePrerequisitesRequest,
} from "@kanji-srs/shared";

import { getAdminPrerequisiteCandidates } from "../../lib/api-client";

type PrerequisiteDraft = {
  readonly selected: boolean;
  readonly requiredStage: string;
};

type PrerequisiteEditorProps = {
  readonly token: string;
  readonly item: AdminCurationItemDto;
  readonly disabled: boolean;
  readonly onSave: (request: AdminUpdatePrerequisitesRequest) => Promise<void>;
};

export function PrerequisiteEditor({ token, item, disabled, onSave }: PrerequisiteEditorProps) {
  const [candidates, setCandidates] = useState<AdminPrerequisiteCandidateListResponse | null>(null);
  const [drafts, setDrafts] = useState<Readonly<Record<string, PrerequisiteDraft>>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setCandidates(null);
    setDrafts({});
    setStatus("loading");
    setError(null);

    void getAdminPrerequisiteCandidates(token, item.id)
      .then((response) => {
        if (!active) {
          return;
        }

        setCandidates(response);
        setDrafts(buildDrafts(response.candidates));
        setStatus("ready");
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить предварительные связи.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [item.id, item.updatedAt, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (candidates === null || status !== "ready" || disabled) {
      return;
    }

    const prerequisites: Array<AdminUpdatePrerequisitesRequest["prerequisites"][number]> = [];

    for (const candidate of candidates.candidates) {
      const draft = drafts[candidate.prerequisiteItemId];

      if (draft?.selected !== true) {
        continue;
      }

      const stageText = draft.requiredStage.trim();
      const requiredStage = stageText === "" ? null : Number(stageText);

      if (requiredStage !== null && (!Number.isInteger(requiredStage) || requiredStage <= 0)) {
        setError("Порог SRS должен быть положительным целым числом.");
        return;
      }

      prerequisites.push({
        prerequisiteItemId: candidate.prerequisiteItemId,
        requiredStage,
      });
    }

    setStatus("saving");
    setError(null);

    try {
      await onSave({ prerequisites });
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить предварительные связи.",
      );
      setStatus("ready");
    }
  }

  const currentCandidates = candidates?.candidates ?? [];

  return (
    <section className="panel admin-prerequisite-editor" data-testid="admin-prerequisite-editor">
      <div className="admin-prerequisite-heading">
        <div>
          <span className="eyebrow">Учебный путь</span>
          <h2>Предварительные материалы</h2>
        </div>
        <strong>
          {
            currentCandidates.filter((candidate) => drafts[candidate.prerequisiteItemId]?.selected)
              .length
          }
        </strong>
      </div>

      {status === "loading" ? <p className="muted">Загрузка связей...</p> : null}
      {status !== "loading" && currentCandidates.length === 0 ? (
        <p className="muted">Опубликованных структурных связей пока нет.</p>
      ) : null}

      {currentCandidates.length === 0 ? null : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <ul className="admin-prerequisite-list">
            {currentCandidates.map((candidate) => {
              const draft = drafts[candidate.prerequisiteItemId] ?? {
                selected: false,
                requiredStage: "",
              };

              return (
                <li key={candidate.prerequisiteItemId}>
                  <label className="checkbox-row">
                    <input
                      aria-label={`Связать ${candidate.prerequisiteTitle}`}
                      checked={draft.selected}
                      disabled={
                        disabled ||
                        status === "saving" ||
                        (candidate.prerequisiteStatus !== "published" && !draft.selected)
                      }
                      onChange={(event) => {
                        const selected = event.currentTarget.checked;
                        setDrafts((current) => ({
                          ...current,
                          [candidate.prerequisiteItemId]: { ...draft, selected },
                        }));
                      }}
                      type="checkbox"
                    />
                    <span>
                      <strong>{candidate.prerequisiteTitle}</strong>
                      <small>
                        {formatSuggestionReason(candidate.suggestionReason)} ·{" "}
                        {formatItemType(candidate.prerequisiteItemType)} ·{" "}
                        {formatStatus(candidate.prerequisiteStatus)}
                      </small>
                    </span>
                  </label>
                  <label>
                    Порог SRS
                    <input
                      aria-label={`Порог SRS для ${candidate.prerequisiteTitle}`}
                      disabled={!draft.selected || disabled || status === "saving"}
                      inputMode="numeric"
                      min="1"
                      onChange={(event) => {
                        const requiredStage = event.currentTarget.value;
                        setDrafts((current) => ({
                          ...current,
                          [candidate.prerequisiteItemId]: { ...draft, requiredStage },
                        }));
                      }}
                      type="number"
                      value={draft.requiredStage}
                    />
                  </label>
                </li>
              );
            })}
          </ul>

          <button
            className="primary-action"
            disabled={disabled || status === "saving"}
            type="submit"
          >
            {status === "saving" ? "Сохраняю..." : "Сохранить связи"}
          </button>
        </form>
      )}

      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function buildDrafts(
  candidates: readonly AdminPrerequisiteCandidateDto[],
): Readonly<Record<string, PrerequisiteDraft>> {
  return Object.fromEntries(
    candidates.map((candidate) => [
      candidate.prerequisiteItemId,
      {
        selected: candidate.selected,
        requiredStage: candidate.requiredStage?.toString() ?? "",
      },
    ]),
  );
}

function formatSuggestionReason(reason: AdminPrerequisiteCandidateDto["suggestionReason"]): string {
  switch (reason) {
    case "component":
      return "компонент кандзи";
    case "kanji":
      return "кандзи из слова";
    case "existing":
      return "текущая связь";
  }
}

function formatItemType(itemType: AdminPrerequisiteCandidateDto["prerequisiteItemType"]): string {
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

function formatStatus(status: AdminPrerequisiteCandidateDto["prerequisiteStatus"]): string {
  switch (status) {
    case "draft":
      return "черновик";
    case "needs-review":
      return "нужна проверка";
    case "published":
      return "опубликовано";
    case "archived":
      return "архив";
  }
}
