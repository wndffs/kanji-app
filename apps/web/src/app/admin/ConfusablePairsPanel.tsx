"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  type AdminConfusablePairDto,
  type AdminCreateConfusablePairRequest,
  type ConfusableRelationKind,
} from "@kanji-srs/shared";

import {
  createAdminConfusablePair,
  getAdminConfusablePairs,
  publishAdminConfusablePair,
  updateAdminConfusablePair,
} from "../../lib/api-client";

type Draft = {
  readonly leftItemId: string;
  readonly rightItemId: string;
  readonly visual: boolean;
  readonly semantic: boolean;
  readonly strength: string;
  readonly explanationRu: string;
  readonly explanationEn: string;
  readonly sourceNote: string;
};

const EMPTY_DRAFT: Draft = {
  leftItemId: "",
  rightItemId: "",
  visual: true,
  semantic: false,
  strength: "50",
  explanationRu: "",
  explanationEn: "",
  sourceNote: "",
};

export function ConfusablePairsPanel({ token }: { readonly token: string }) {
  const [pairs, setPairs] = useState<readonly AdminConfusablePairDto[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setPairs((await getAdminConfusablePairs(token)).pairs);
    } catch (requestError: unknown) {
      setError(toMessage(requestError, "Не удалось загрузить пары кандзи."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (busyKey !== null) {
      return;
    }

    const strength = Number(draft.strength);
    const kinds = [
      ...(draft.visual ? (["visual"] as const) : []),
      ...(draft.semantic ? (["semantic"] as const) : []),
    ] satisfies readonly ConfusableRelationKind[];

    if (kinds.length === 0 || !Number.isInteger(strength) || strength < 1 || strength > 100) {
      setError("Выберите тип связи и силу от 1 до 100.");
      return;
    }

    const content = {
      kinds,
      strength,
      explanationRu: draft.explanationRu.trim() || null,
      explanationEn: draft.explanationEn.trim() || null,
      sourceNote: draft.sourceNote.trim(),
    };

    setBusyKey("save");
    setError(null);
    setMessage(null);

    try {
      if (editingId === null) {
        const request: AdminCreateConfusablePairRequest = {
          leftItemId: draft.leftItemId.trim(),
          rightItemId: draft.rightItemId.trim(),
          ...content,
        };
        await createAdminConfusablePair(token, request);
        setMessage("Черновик пары создан.");
      } else {
        await updateAdminConfusablePair(token, editingId, content);
        setMessage("Пара сохранена и ожидает повторной проверки.");
      }

      setDraft(EMPTY_DRAFT);
      setEditingId(null);
      await load();
    } catch (requestError: unknown) {
      setError(toMessage(requestError, "Не удалось сохранить пару."));
    } finally {
      setBusyKey(null);
    }
  }

  async function handlePublish(pair: AdminConfusablePairDto): Promise<void> {
    if (busyKey !== null) {
      return;
    }

    setBusyKey(`publish:${pair.id}`);
    setError(null);
    setMessage(null);

    try {
      await publishAdminConfusablePair(token, pair.id);
      setMessage(`Пара ${pair.kanji[0].character} / ${pair.kanji[1].character} опубликована.`);
      await load();
    } catch (requestError: unknown) {
      setError(toMessage(requestError, "Не удалось опубликовать пару."));
    } finally {
      setBusyKey(null);
    }
  }

  function edit(pair: AdminConfusablePairDto): void {
    setEditingId(pair.id);
    setDraft({
      leftItemId: pair.kanji[0].itemId,
      rightItemId: pair.kanji[1].itemId,
      visual: pair.kinds.includes("visual"),
      semantic: pair.kinds.includes("semantic"),
      strength: String(pair.strength),
      explanationRu: pair.explanationRu ?? "",
      explanationEn: pair.explanationEn ?? "",
      sourceNote: pair.sourceNote,
    });
    setError(null);
    setMessage(null);
  }

  return (
    <section className="panel admin-confusable-panel" data-testid="admin-confusable-pairs">
      <header className="admin-planning-header">
        <div>
          <span className="eyebrow">Curated · RU + EN</span>
          <h2>Похожие кандзи</h2>
        </div>
        <strong>{pairs.length}</strong>
      </header>

      {message === null ? null : <p className="success-text">{message}</p>}
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <form className="admin-form" onSubmit={(event) => void handleSave(event)}>
        <div className="admin-two-column">
          <label>
            Первый item ID
            <input
              disabled={editingId !== null}
              onChange={(event) => setDraft({ ...draft, leftItemId: event.currentTarget.value })}
              value={draft.leftItemId}
            />
          </label>
          <label>
            Второй item ID
            <input
              disabled={editingId !== null}
              onChange={(event) => setDraft({ ...draft, rightItemId: event.currentTarget.value })}
              value={draft.rightItemId}
            />
          </label>
        </div>
        <div className="admin-two-column">
          <div className="admin-filter-flags">
            <label className="checkbox-row">
              <input
                checked={draft.visual}
                onChange={(event) => setDraft({ ...draft, visual: event.currentTarget.checked })}
                type="checkbox"
              />
              Внешнее сходство
            </label>
            <label className="checkbox-row">
              <input
                checked={draft.semantic}
                onChange={(event) => setDraft({ ...draft, semantic: event.currentTarget.checked })}
                type="checkbox"
              />
              Смысловое сходство
            </label>
          </div>
          <label>
            Сила связи
            <input
              max="100"
              min="1"
              onChange={(event) => setDraft({ ...draft, strength: event.currentTarget.value })}
              type="number"
              value={draft.strength}
            />
          </label>
        </div>
        <div className="admin-two-column">
          <label>
            Объяснение RU
            <textarea
              onChange={(event) => setDraft({ ...draft, explanationRu: event.currentTarget.value })}
              value={draft.explanationRu}
            />
          </label>
          <label>
            Explanation EN
            <textarea
              onChange={(event) => setDraft({ ...draft, explanationEn: event.currentTarget.value })}
              value={draft.explanationEn}
            />
          </label>
        </div>
        <label>
          Источник решения
          <textarea
            onChange={(event) => setDraft({ ...draft, sourceNote: event.currentTarget.value })}
            required
            value={draft.sourceNote}
          />
        </label>
        <div className="action-row">
          <button className="primary-action" disabled={busyKey !== null} type="submit">
            {busyKey === "save"
              ? "Сохраняю..."
              : editingId === null
                ? "Создать черновик"
                : "Сохранить правки"}
          </button>
          {editingId === null ? null : (
            <button
              className="secondary-action"
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY_DRAFT);
              }}
              type="button"
            >
              Отмена
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="muted">Загружаю пары...</p>
      ) : pairs.length === 0 ? (
        <p className="muted">Черновиков пока нет.</p>
      ) : (
        <ul className="admin-confusable-list">
          {pairs.map((pair) => (
            <li key={pair.id}>
              <strong>
                {pair.kanji[0].character} / {pair.kanji[1].character}
              </strong>
              <span>
                {formatStatus(pair.status)} · {pair.kinds.join(" + ")} · {pair.strength}
              </span>
              <div className="action-row">
                <button
                  className="secondary-action"
                  disabled={busyKey !== null}
                  onClick={() => edit(pair)}
                  type="button"
                >
                  Редактировать
                </button>
                {pair.status === "draft" || pair.status === "needs-review" ? (
                  <button
                    className="primary-action"
                    disabled={busyKey !== null}
                    onClick={() => void handlePublish(pair)}
                    type="button"
                  >
                    {busyKey === `publish:${pair.id}` ? "Публикую..." : "Одобрить"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatStatus(status: AdminConfusablePairDto["status"]): string {
  if (status === "published") return "Опубликовано";
  if (status === "needs-review") return "Нужна проверка";
  if (status === "archived") return "Архив";
  return "Черновик";
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
