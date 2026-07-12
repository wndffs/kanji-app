"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  type CreateTextDeckResponse,
  type DeckDetailsDto,
  type DeckDto,
  type DeckItemDto,
  type DeckItemReasonDto,
  type TranslationBundleDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import {
  ApiError,
  createTextDeck,
  getDeck,
  listDecks,
  updateDeckStatus,
} from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";

type DecksState =
  | { readonly status: "checking" }
  | { readonly status: "unauthenticated" }
  | {
      readonly status: "ready";
      readonly token: string;
    };

type SavedDecksState =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly decks: readonly DeckDto[] };

type SelectedDeckState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly deckId: string }
  | { readonly status: "error"; readonly deckId: string; readonly message: string }
  | { readonly status: "ready"; readonly deck: DeckDetailsDto };

type DeckStatusUpdateState =
  | { readonly status: "idle" }
  | { readonly status: "updating"; readonly deckId: string }
  | { readonly status: "error"; readonly deckId: string; readonly message: string };

export function DecksClient() {
  const displayMode = useTranslationDisplayMode();
  const [state, setState] = useState<DecksState>({ status: "checking" });
  const [savedDecks, setSavedDecks] = useState<SavedDecksState>({ status: "idle" });
  const [selectedDeck, setSelectedDeck] = useState<SelectedDeckState>({ status: "idle" });
  const [deckStatusUpdate, setDeckStatusUpdate] = useState<DeckStatusUpdateState>({
    status: "idle",
  });
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [maxItems, setMaxItems] = useState(80);
  const [result, setResult] = useState<CreateTextDeckResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedDeckRequest = useRef(0);

  useEffect(() => {
    const session = readStoredSession();

    if (session === null) {
      setState({ status: "unauthenticated" });
      return;
    }

    setState({
      status: "ready",
      token: session.token,
    });
  }, []);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    let isCurrent = true;
    setSavedDecks({ status: "loading" });

    void listDecks(state.token)
      .then((response) => {
        if (isCurrent) {
          setSavedDecks((current) => ({
            status: "ready",
            decks: mergeDeckSummaries(
              current.status === "ready" ? current.decks : [],
              response.decks,
            ),
          }));
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          clearStoredSession();
          setState({ status: "unauthenticated" });
          return;
        }

        setSavedDecks({
          status: "error",
          message:
            error instanceof Error ? error.message : "Не удалось загрузить сохранённые колоды.",
        });
      });

    return () => {
      isCurrent = false;
    };
  }, [state]);

  async function handleOpenDeck(deckId: string): Promise<void> {
    if (state.status !== "ready") {
      return;
    }

    const requestId = selectedDeckRequest.current + 1;
    selectedDeckRequest.current = requestId;
    setResult(null);
    setDeckStatusUpdate({ status: "idle" });
    setSelectedDeck({ status: "loading", deckId });

    try {
      const deck = await getDeck(state.token, deckId);

      if (selectedDeckRequest.current === requestId) {
        setSelectedDeck({ status: "ready", deck });
      }
    } catch (error: unknown) {
      if (selectedDeckRequest.current !== requestId) {
        return;
      }

      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
        return;
      }

      setSelectedDeck({
        status: "error",
        deckId,
        message: error instanceof Error ? error.message : "Не удалось открыть колоду.",
      });
    }
  }

  async function handleDeckStatusChange(deck: DeckDetailsDto): Promise<void> {
    if (state.status !== "ready" || deckStatusUpdate.status === "updating") {
      return;
    }

    const nextStatus = deck.status === "archived" ? "active" : "archived";
    setDeckStatusUpdate({ status: "updating", deckId: deck.id });

    try {
      const updated = await updateDeckStatus(state.token, deck.id, { status: nextStatus });
      setSelectedDeck((current) =>
        current.status === "ready" && current.deck.id === updated.id
          ? { status: "ready", deck: updated }
          : current,
      );
      setResult((current) =>
        current?.deck.id === updated.id ? { ...current, deck: updated } : current,
      );
      setSavedDecks((current) =>
        current.status === "ready"
          ? {
              status: "ready",
              decks: sortDeckSummaries(
                current.decks.map((candidate) =>
                  candidate.id === updated.id ? toDeckSummary(updated) : candidate,
                ),
              ),
            }
          : current,
      );
      setDeckStatusUpdate({ status: "idle" });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
        return;
      }

      setDeckStatusUpdate({
        status: "error",
        deckId: deck.id,
        message: error instanceof Error ? error.message : "Не удалось изменить статус колоды.",
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (state.status !== "ready" || isSubmitting) {
      return;
    }

    const text = sourceText.trim();

    if (text === "") {
      setFormError("Вставьте японский текст.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setResult(null);

    try {
      const response = await createTextDeck(state.token, {
        text,
        title: title.trim() === "" ? null : title.trim(),
        maxItems,
      });
      setResult(response);
      selectedDeckRequest.current += 1;
      setSelectedDeck({ status: "idle" });
      setSavedDecks((current) => ({
        status: "ready",
        decks: [
          toDeckSummary(response.deck),
          ...(current.status === "ready"
            ? current.decks.filter((deck) => deck.id !== response.deck.id)
            : []),
        ],
      }));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
        return;
      }

      setFormError(error instanceof Error ? error.message : "Не удалось создать колоду из текста.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (state.status === "checking") {
    return (
      <section className="page-stack" aria-busy="true">
        <div className="page-heading">
          <h1>Колоды</h1>
          <p>Проверяю вход в аккаунт.</p>
        </div>
        <div className="panel skeleton" />
      </section>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Колоды</h1>
          <p>Нужен вход в аккаунт.</p>
        </div>
        <div className="notice-panel">
          <p>Войдите, чтобы создать личную колоду из японского текста.</p>
          <Link className="primary-action" href="/login">
            Войти
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <div className="page-heading deck-heading">
        <div>
          <h1>Колоды</h1>
          <p>Вставьте японский текст, чтобы собрать учебные элементы и их предпосылки.</p>
        </div>
      </div>

      <SavedDecksPanel
        onOpen={(deckId) => void handleOpenDeck(deckId)}
        selectedDeck={selectedDeck}
        state={savedDecks}
      />

      {selectedDeck.status === "ready" ? (
        <DeckDetailsResult
          deck={selectedDeck.deck}
          displayMode={displayMode}
          isStatusUpdating={
            deckStatusUpdate.status === "updating" &&
            deckStatusUpdate.deckId === selectedDeck.deck.id
          }
          onClose={() => {
            selectedDeckRequest.current += 1;
            setDeckStatusUpdate({ status: "idle" });
            setSelectedDeck({ status: "idle" });
          }}
          onStatusChange={() => void handleDeckStatusChange(selectedDeck.deck)}
          statusError={
            deckStatusUpdate.status === "error" && deckStatusUpdate.deckId === selectedDeck.deck.id
              ? deckStatusUpdate.message
              : null
          }
        />
      ) : null}

      <form className="deck-builder-panel" onSubmit={(event) => void handleSubmit(event)}>
        <div className="deck-form-grid">
          <label>
            <span>Название</span>
            <input
              maxLength={120}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="Например: статья NHK Easy"
              value={title}
            />
          </label>
          <label>
            <span>Максимум элементов</span>
            <input
              max={160}
              min={1}
              onChange={(event) => setMaxItems(Number(event.currentTarget.value))}
              type="number"
              value={maxItems}
            />
          </label>
        </div>

        <label>
          <span>Японский текст</span>
          <textarea
            onChange={(event) => setSourceText(event.currentTarget.value)}
            placeholder="日本語の文章をここに貼り付けます。"
            value={sourceText}
          />
        </label>

        <div className="action-row">
          <button className="primary-action" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Создаю..." : "Создать колоду"}
          </button>
          <button
            className="secondary-action"
            onClick={() => {
              setTitle("");
              setSourceText("");
              setResult(null);
              setFormError(null);
            }}
            type="button"
          >
            Очистить
          </button>
        </div>

        {formError === null ? null : <p className="form-error">{formError}</p>}
      </form>

      {result === null ? null : (
        <TextDeckResult
          displayMode={displayMode}
          isStatusUpdating={
            deckStatusUpdate.status === "updating" && deckStatusUpdate.deckId === result.deck.id
          }
          onStatusChange={() => void handleDeckStatusChange(result.deck)}
          result={result}
          statusError={
            deckStatusUpdate.status === "error" && deckStatusUpdate.deckId === result.deck.id
              ? deckStatusUpdate.message
              : null
          }
        />
      )}
    </section>
  );
}

function SavedDecksPanel({
  state,
  selectedDeck,
  onOpen,
}: {
  readonly state: SavedDecksState;
  readonly selectedDeck: SelectedDeckState;
  readonly onOpen: (deckId: string) => void;
}) {
  return (
    <section className="saved-decks-panel panel" aria-labelledby="saved-decks-title">
      <div className="saved-decks-header">
        <div>
          <span className="eyebrow">Личная библиотека</span>
          <h2 id="saved-decks-title">Сохранённые колоды</h2>
        </div>
        {state.status === "ready" ? <strong>{state.decks.length}</strong> : null}
      </div>

      {state.status === "idle" || state.status === "loading" ? (
        <p className="muted" aria-live="polite">
          Загружаю колоды...
        </p>
      ) : null}

      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}

      {state.status === "ready" && state.decks.length === 0 ? (
        <p className="muted">Здесь появятся колоды, созданные из японских текстов.</p>
      ) : null}

      {state.status === "ready" && state.decks.length > 0 ? (
        <ul className="saved-deck-list">
          {sortDeckSummaries(state.decks).map((deck) => {
            const isSelected =
              (selectedDeck.status === "ready" && selectedDeck.deck.id === deck.id) ||
              (selectedDeck.status === "loading" && selectedDeck.deckId === deck.id) ||
              (selectedDeck.status === "error" && selectedDeck.deckId === deck.id);

            return (
              <li key={deck.id}>
                <div>
                  <strong>{deck.title}</strong>
                  <span>
                    {formatDeckCount(deck.itemCount)} · новых: {deck.newItemCount} ·{" "}
                    {deck.status === "archived" ? "архив" : "активна"}
                  </span>
                </div>
                <button
                  aria-pressed={isSelected}
                  className="secondary-action"
                  disabled={selectedDeck.status === "loading" && selectedDeck.deckId === deck.id}
                  onClick={() => onOpen(deck.id)}
                  type="button"
                >
                  {selectedDeck.status === "loading" && selectedDeck.deckId === deck.id
                    ? "Открываю..."
                    : "Открыть"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {selectedDeck.status === "error" ? (
        <p className="form-error" role="alert">
          {selectedDeck.message}
        </p>
      ) : null}
    </section>
  );
}

function TextDeckResult({
  result,
  displayMode,
  onStatusChange,
  isStatusUpdating,
  statusError,
}: {
  readonly result: CreateTextDeckResponse;
  readonly displayMode: TranslationDisplayMode;
  readonly onStatusChange: () => void;
  readonly isStatusUpdating: boolean;
  readonly statusError: string | null;
}) {
  return (
    <DeckDetailsResult
      deck={result.deck}
      displayMode={displayMode}
      isStatusUpdating={isStatusUpdating}
      onStatusChange={onStatusChange}
      statusError={statusError}
      tokenization={result.tokenization}
    />
  );
}

function DeckDetailsResult({
  deck,
  displayMode,
  tokenization,
  onClose,
  onStatusChange,
  isStatusUpdating = false,
  statusError = null,
}: {
  readonly deck: DeckDetailsDto;
  readonly displayMode: TranslationDisplayMode;
  readonly tokenization?: CreateTextDeckResponse["tokenization"];
  readonly onClose?: () => void;
  readonly onStatusChange?: () => void;
  readonly isStatusUpdating?: boolean;
  readonly statusError?: string | null;
}) {
  return (
    <section className="deck-result" aria-label={`Колода ${deck.title}`}>
      <div className="panel">
        <div className="deck-result-header">
          <div>
            <span className="eyebrow">
              {tokenization === undefined ? "Сохранённая колода" : "Готово"}
            </span>
            <h2>{deck.title}</h2>
          </div>
          <dl className="stats-list">
            <div>
              <dt>Элементов</dt>
              <dd>{deck.itemCount}</dd>
            </div>
            <div>
              <dt>Новых</dt>
              <dd>{deck.newItemCount}</dd>
            </div>
          </dl>
        </div>
        {tokenization === undefined ? null : (
          <p className="muted">
            Найдено материалов: {tokenization.matchedItemCount}. Перекрывающихся слов исключено:{" "}
            {tokenization.discardedOverlapCount}.
          </p>
        )}
        {deck.status === "archived" ? (
          <p className="muted deck-status-note">
            Колода в архиве. Восстановите её, чтобы снова запускать уроки.
          </p>
        ) : null}
        <div className="action-row deck-result-actions">
          {deck.status === "active" ? (
            <Link
              className="primary-action"
              href={`/lessons?deckId=${encodeURIComponent(deck.id)}`}
            >
              Учить колоду
            </Link>
          ) : null}
          {onStatusChange === undefined ? null : (
            <button
              className="secondary-action"
              disabled={isStatusUpdating}
              onClick={onStatusChange}
              type="button"
            >
              {isStatusUpdating
                ? "Сохраняю..."
                : deck.status === "archived"
                  ? "Восстановить"
                  : "Архивировать"}
            </button>
          )}
          {onClose === undefined ? null : (
            <button
              className="secondary-action"
              disabled={isStatusUpdating}
              onClick={onClose}
              type="button"
            >
              Закрыть
            </button>
          )}
        </div>
        {statusError === null ? null : (
          <p className="form-error" role="alert">
            {statusError}
          </p>
        )}
      </div>

      {deck.items.length === 0 ? (
        <div className="notice-panel">
          <p>В тексте не нашлось опубликованных Word/Kanji элементов из базы.</p>
        </div>
      ) : (
        <div className="deck-item-list">
          {deck.items.map((deckItem) => (
            <DeckItemCard deckItem={deckItem} displayMode={displayMode} key={deckItem.item.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function formatDeckCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return `${count} элементов`;
  }

  if (last === 1) {
    return `${count} элемент`;
  }

  if (last >= 2 && last <= 4) {
    return `${count} элемента`;
  }

  return `${count} элементов`;
}

function toDeckSummary(deck: DeckDetailsDto): DeckDto {
  return {
    id: deck.id,
    title: deck.title,
    description: deck.description,
    status: deck.status,
    itemCount: deck.itemCount,
    newItemCount: deck.newItemCount,
    translationDisplayMode: deck.translationDisplayMode,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
  };
}

function mergeDeckSummaries(
  preferred: readonly DeckDto[],
  fallback: readonly DeckDto[],
): readonly DeckDto[] {
  const merged = new Map<string, DeckDto>();

  for (const deck of [...preferred, ...fallback]) {
    if (!merged.has(deck.id)) {
      merged.set(deck.id, deck);
    }
  }

  return [...merged.values()];
}

function sortDeckSummaries(decks: readonly DeckDto[]): readonly DeckDto[] {
  return [...decks].sort(
    (left, right) =>
      Number(left.status === "archived") - Number(right.status === "archived") ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.id.localeCompare(right.id),
  );
}

function DeckItemCard({
  deckItem,
  displayMode,
}: {
  readonly deckItem: DeckItemDto;
  readonly displayMode: TranslationDisplayMode;
}) {
  return (
    <article className="deck-item-card">
      <div>
        <span className="eyebrow">{formatItemType(deckItem.item.itemType)}</span>
        <JapaneseText as="strong">{deckItem.item.japanese}</JapaneseText>
        <p>{formatTranslationBundle(deckItem.item.translations, displayMode)}</p>
      </div>
      <dl className="deck-item-facts">
        <div>
          <dt>Чтение</dt>
          <dd>{deckItem.item.reading ?? "нет"}</dd>
        </div>
        <div>
          <dt>Статус</dt>
          <dd>{deckItem.isNewForUser ? "новый" : "уже начат"}</dd>
        </div>
      </dl>
      <ul className="deck-reason-list" aria-label="Причины включения">
        {deckItem.reasons.map((reason, index) => (
          <li
            key={`${reason.code}-${reason.matchedText ?? ""}-${reason.sourceItemId ?? ""}-${index}`}
          >
            <span>{formatReason(reason)}</span>
            {reason.rank === undefined || reason.rank === null ? null : (
              <small>#{reason.rank}</small>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

function formatTranslationBundle(
  translations: TranslationBundleDto,
  displayMode: TranslationDisplayMode,
): string {
  const parts: string[] = [];

  if ((displayMode === "ru" || displayMode === "ru-en") && translations.primaryRu !== null) {
    parts.push(translations.primaryRu);
  }

  if ((displayMode === "en" || displayMode === "ru-en") && translations.primaryEn !== null) {
    parts.push(translations.primaryEn);
  }

  return parts.length === 0 ? "перевод пока не добавлен" : parts.join(" / ");
}

function formatItemType(itemType: DeckItemDto["item"]["itemType"]): string {
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

function formatReason(reason: DeckItemReasonDto): string {
  switch (reason.code) {
    case "appears-in-text":
      return reason.matchedText === undefined || reason.matchedText === null
        ? "Есть в тексте"
        : `Есть в тексте: ${reason.matchedText}`;
    case "prerequisite-kanji":
      return "Предпосылка: кандзи";
    case "prerequisite-component":
      return "Предпосылка: компонент";
    case "high-frequency":
      return "Высокая частотность";
  }
}
