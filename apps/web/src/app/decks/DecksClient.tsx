"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  type CreateTextDeckResponse,
  type TextDeckPreviewResponse,
  type DeckDetailsDto,
  type DeckDto,
  type DeckItemDto,
  type DeckItemReasonDto,
  type TranslationBundleDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import { ViewTabs } from "../../components/ViewTabs";
import { SectionDisclosure } from "../../components/SectionDisclosure";
import { DeckDictionaryPicker } from "./DeckDictionaryPicker";
import { deckLessonHref, filterDeckContents } from "../../lib/deck-browser";
import {
  ApiError,
  createTextDeck,
  createCustomDeck,
  previewTextDeck,
  getDeck,
  listDecks,
  updateDeckStatus,
} from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";
import { ownsSession, useStoredSession } from "../../lib/use-stored-session";

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
  const session = useStoredSession();
  if (session === undefined)
    return (
      <section className="page-stack" aria-busy="true">
        <h1>Колоды</h1>
      </section>
    );
  return <DecksScreen key={session === null ? "guest" : `${session.user.id}:${session.token}`} />;
}

function DecksScreen() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const builderButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (builderOpen) titleInput.current?.focus();
  }, [builderOpen]);
  const displayMode = useTranslationDisplayMode();
  const [state, setState] = useState<DecksState>({ status: "checking" });
  const [savedDecks, setSavedDecks] = useState<SavedDecksState>({ status: "idle" });
  const [libraryRevision, setLibraryRevision] = useState(0);
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
  const [preview, setPreview] = useState<TextDeckPreviewResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const selectedDeckRequest = useRef(0);

  function acceptUpdatedDeck(deck: DeckDetailsDto) {
    selectedDeckRequest.current += 1;
    setResult(null);
    setSelectedDeck({ status: "ready", deck });
    setSavedDecks((current) => ({
      status: "ready",
      decks: sortDeckSummaries([
        toDeckSummary(deck),
        ...(current.status === "ready"
          ? current.decks.filter((entry) => entry.id !== deck.id)
          : []),
      ]),
    }));
  }

  async function createEmptyDeck() {
    if (state.status !== "ready" || isSubmitting || !ownsSession(state.token)) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const deck = await createCustomDeck(state.token, title.trim() || "Личная колода");
      if (!ownsSession(state.token)) return;
      acceptUpdatedDeck(deck);
      setBuilderOpen(false);
      setPreview(null);
    } catch (cause) {
      if (ownsSession(state.token))
        setFormError(cause instanceof Error ? cause.message : "Не удалось создать колоду.");
    } finally {
      setIsSubmitting(false);
    }
  }

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
        if (isCurrent && ownsSession(state.token)) {
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
        if (!isCurrent || !ownsSession(state.token)) {
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
  }, [state, libraryRevision]);

  async function handleOpenDeck(deckId: string): Promise<void> {
    if (state.status !== "ready" || !ownsSession(state.token)) {
      return;
    }

    const requestId = selectedDeckRequest.current + 1;
    selectedDeckRequest.current = requestId;
    setResult(null);
    setDeckStatusUpdate({ status: "idle" });
    setSelectedDeck({ status: "loading", deckId });

    try {
      const deck = await getDeck(state.token, deckId);

      if (selectedDeckRequest.current === requestId && ownsSession(state.token)) {
        setSelectedDeck({ status: "ready", deck });
      }
    } catch (error: unknown) {
      if (selectedDeckRequest.current !== requestId || !ownsSession(state.token)) {
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
    if (
      state.status !== "ready" ||
      !ownsSession(state.token) ||
      deckStatusUpdate.status === "updating"
    ) {
      return;
    }

    const nextStatus = deck.status === "archived" ? "active" : "archived";
    setDeckStatusUpdate({ status: "updating", deckId: deck.id });

    try {
      const updated = await updateDeckStatus(state.token, deck.id, { status: nextStatus });
      if (!ownsSession(state.token)) return;
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
      if (!ownsSession(state.token)) return;
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

    if (state.status !== "ready" || !ownsSession(state.token) || isSubmitting) {
      return;
    }

    const text = sourceText.trim();

    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 160) {
      setFormError("Максимум элементов должен быть целым числом от 1 до 160.");
      return;
    }

    if (text === "") {
      setFormError("Вставьте японский текст.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setResult(null);

    try {
      const input = {
        text,
        title: title.trim() === "" ? null : title.trim(),
        maxItems,
      };
      if (
        preview === null ||
        preview.selectedItemIds.length !== selectedIds.length ||
        preview.selectedItemIds.some((id) => !selectedIds.includes(id))
      ) {
        const response = await previewTextDeck(state.token, {
          ...input,
          ...(preview === null ? {} : { selectedItemIds: selectedIds }),
        });
        if (!ownsSession(state.token)) return;
        setPreview(response);
        setSelectedIds(response.selectedItemIds);
        return;
      }
      const response = await createTextDeck(state.token, {
        ...input,
        selectedItemIds: selectedIds,
      });
      if (!ownsSession(state.token)) return;
      setResult(response);
      setBuilderOpen(false);
      setPreview(null);
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
      if (!ownsSession(state.token)) return;
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
        return;
      }

      if (ownsSession(state.token))
        setFormError(
          error instanceof Error ? error.message : "Не удалось создать колоду из текста.",
        );
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
    <section className="page-stack decks-page">
      <div className="page-heading deck-heading">
        <div>
          <h1>Колоды</h1>
        </div>
        <button
          className="primary-action"
          ref={builderButton}
          aria-expanded={builderOpen}
          aria-controls="deck-builder"
          onClick={() => setBuilderOpen((value) => !value)}
          disabled={isSubmitting}
        >
          <Plus size={18} aria-hidden="true" />
          Новая колода
        </button>
      </div>

      <SavedDecksPanel
        onOpen={(deckId) => void handleOpenDeck(deckId)}
        onRetry={() => setLibraryRevision((value) => value + 1)}
        selectedDeck={selectedDeck}
        state={savedDecks}
      />

      {selectedDeck.status === "ready" ? (
        <DeckDetailsResult
          key={`details:${selectedDeck.deck.id}`}
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

      <form
        id="deck-builder"
        hidden={!builderOpen}
        className="deck-builder-panel"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="deck-form-grid">
          <label>
            <span>Название</span>
            <input
              ref={titleInput}
              disabled={isSubmitting}
              maxLength={120}
              onChange={(event) => {
                setTitle(event.currentTarget.value);
                setPreview(null);
              }}
              placeholder="Например: статья NHK Easy"
              value={title}
            />
          </label>
          <label>
            <span>Максимум элементов</span>
            <input
              disabled={isSubmitting}
              max={160}
              min={1}
              onChange={(event) => {
                setMaxItems(Number(event.currentTarget.value));
                setPreview(null);
              }}
              type="number"
              value={maxItems}
            />
          </label>
        </div>

        <label>
          <span>Японский текст</span>
          <textarea
            disabled={isSubmitting}
            onChange={(event) => {
              setSourceText(event.currentTarget.value);
              setPreview(null);
            }}
            placeholder="日本語の文章をここに貼り付けます。"
            value={sourceText}
          />
        </label>

        <div className="action-row">
          <button
            className="primary-action"
            disabled={
              isSubmitting ||
              (preview !== null && (selectedIds.length === 0 || selectedIds.length > maxItems))
            }
            type="submit"
          >
            {isSubmitting
              ? "Обрабатываю..."
              : preview === null
                ? "Проверить текст"
                : preview.selectedItemIds.length !== selectedIds.length ||
                    preview.selectedItemIds.some((id) => !selectedIds.includes(id))
                  ? "Обновить разбор"
                  : "Сохранить колоду"}
          </button>
          <button
            className="secondary-action"
            type="button"
            disabled={isSubmitting}
            onClick={() => void createEmptyDeck()}
          >
            <Plus size={18} />
            Пустая колода
          </button>
          <button
            className="secondary-action"
            disabled={isSubmitting}
            onClick={() => {
              setTitle("");
              setSourceText("");
              setResult(null);
              setPreview(null);
              setFormError(null);
            }}
            type="button"
          >
            Очистить
          </button>
          <button
            className="icon-button"
            title="Скрыть форму"
            aria-label="Скрыть форму"
            disabled={isSubmitting}
            type="button"
            onClick={() => {
              setBuilderOpen(false);
              builderButton.current?.focus();
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {preview === null ? null : (
          <section className="page-stack" aria-label="Предварительный разбор">
            <h2>
              Выбрано: {selectedIds.length} / {maxItems}
            </h2>
            <p className="muted">
              {preview.tokenization.analyzer === "icu-word-boundaries"
                ? "Границы слов ICU · точные словарные совпадения"
                : "Точные словарные совпадения · резервный разбор"}
            </p>
            {preview.selectedItemIds.length !== selectedIds.length ||
            preview.selectedItemIds.some((id) => !selectedIds.includes(id)) ? (
              <p role="status">Выбор изменён. Требуется обновить разбор.</p>
            ) : preview.externalPrerequisiteCount > 0 ? (
              <p role="status">
                За пределами лимита: {preview.externalPrerequisiteCount} предпосылок. Они могут
                потребоваться в основном курсе до начала уроков.
              </p>
            ) : null}
            <ul className="saved-deck-list">
              {preview.candidates.map(({ item }) => (
                <li key={item.id}>
                  <label className="action-row">
                    <input
                      type="checkbox"
                      disabled={isSubmitting}
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setSelectedIds((ids) =>
                          checked ? [...ids, item.id] : ids.filter((id) => id !== item.id),
                        );
                      }}
                    />
                    <JapaneseText>{item.japanese}</JapaneseText>
                    <span>
                      {item.reading} ·{" "}
                      {item.translations === undefined
                        ? ""
                        : formatTranslationBundle(item.translations, displayMode)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}
        {formError === null ? null : (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
      </form>

      {(selectedDeck.status === "ready" ? selectedDeck.deck : result?.deck)?.status === "active" ? (
        <DeckDictionaryPicker
          key={`dictionary:${(selectedDeck.status === "ready" ? selectedDeck.deck : result!.deck).id}`}
          token={state.token}
          deck={selectedDeck.status === "ready" ? selectedDeck.deck : result!.deck}
          onUpdated={acceptUpdatedDeck}
        />
      ) : null}
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
  onRetry,
}: {
  readonly state: SavedDecksState;
  readonly selectedDeck: SelectedDeckState;
  readonly onOpen: (deckId: string) => void;
  readonly onRetry: () => void;
}) {
  const [status, setStatus] = useState("active");
  const [query, setQuery] = useState("");
  const visibleDecks =
    state.status === "ready"
      ? sortDeckSummaries(state.decks).filter(
          (deck) =>
            (status === "all" ||
              (status === "archived" ? deck.status === "archived" : deck.status !== "archived")) &&
            deck.title.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")),
        )
      : [];
  return (
    <section className="saved-decks-panel panel" aria-labelledby="saved-decks-title">
      <div className="saved-decks-header">
        <div>
          <span className="eyebrow">Личная библиотека</span>
          <h2 id="saved-decks-title">Сохранённые колоды</h2>
        </div>
        {state.status === "ready" ? <strong>{state.decks.length}</strong> : null}
      </div>
      <ViewTabs
        active={status}
        onChange={setStatus}
        label="Библиотека колод"
        idPrefix="deck-library"
        panelId="deck-library-results"
        tabs={[
          { id: "active", label: "Активные" },
          { id: "archived", label: "Архив" },
          { id: "all", label: "Все" },
        ]}
      />
      <label className="library-search">
        <span>Найти колоду</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>

      {state.status === "idle" || state.status === "loading" ? (
        <p className="muted" aria-live="polite">
          Загружаю колоды...
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="notice-panel error-panel">
          <p role="alert">{state.message}</p>
          <button className="secondary-action" type="button" onClick={onRetry}>
            Повторить загрузку колод
          </button>
        </div>
      ) : null}

      {state.status === "ready" && visibleDecks.length === 0 ? (
        <p className="muted">
          {state.decks.length === 0
            ? "Здесь появятся колоды, созданные из японских текстов."
            : "Колоды не найдены."}
        </p>
      ) : null}

      <div id="deck-library-results" role="tabpanel" aria-labelledby={`deck-library-${status}`}>
        {state.status === "ready" &&
        state.decks.length > 0 &&
        visibleDecks.length === 0 &&
        (query !== "" || status !== "all") ? (
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
          >
            Сбросить поиск колод
          </button>
        ) : null}
        {state.status === "ready" && visibleDecks.length > 0 ? (
          <ul className="saved-deck-list">
            {visibleDecks.map((deck) => {
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
      </div>

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
      key={result.deck.id}
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
  const [kind, setKind] = useState<DeckItemDto["item"]["itemType"] | "">("");
  const [learningState, setLearningState] = useState("all");
  const [query, setQuery] = useState("");
  const [grouped, setGrouped] = useState(true);
  const visibleItems = filterDeckContents(deck.items, { kind, state: learningState, query });
  const groups = grouped
    ? (["component", "kanji", "word", "sentence"] as const)
        .map((type) => ({
          id: type,
          title: formatItemType(type),
          items: visibleItems.filter((entry) => entry.item.itemType === type),
        }))
        .filter((group) => group.items.length > 0)
    : [{ id: "all", title: "Материалы", items: visibleItems }];
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
          <SectionDisclosure title="Разбор текста">
            <p className="muted">
              Найдено материалов: {tokenization.matchedItemCount}. Перекрывающихся слов исключено:{" "}
              {tokenization.discardedOverlapCount}.
            </p>
          </SectionDisclosure>
        )}
        {deck.status === "archived" ? (
          <p className="muted deck-status-note">
            Колода в архиве. Восстановите её, чтобы снова запускать уроки.
          </p>
        ) : null}
        <div className="action-row deck-result-actions">
          {deck.status === "active" ? (
            <Link className="primary-action" href={deckLessonHref(deck.id, kind, query)}>
              Выбрать урок
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
          <p>В колоде пока нет материалов.</p>
        </div>
      ) : (
        <>
          <div className="deck-path-filters">
            <label>
              <span>Поиск в колоде</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                maxLength={100}
              />
            </label>
            <label>
              <span>Тип в колоде</span>
              <select
                value={kind}
                onChange={(event) => setKind(event.currentTarget.value as typeof kind)}
              >
                <option value="">Все типы</option>
                {(["component", "kanji", "word", "sentence"] as const).map((id) => (
                  <option key={id} value={id}>
                    {formatItemType(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="action-row">
              <input
                type="checkbox"
                checked={grouped}
                onChange={(event) => setGrouped(event.currentTarget.checked)}
              />
              Группировать по типу
            </label>
            <label>
              <span>Изучение в колоде</span>
              <select
                value={learningState}
                onChange={(event) => setLearningState(event.currentTarget.value)}
              >
                <option value="all">Все материалы</option>
                <option value="new">Новые</option>
                <option value="started">Уже начатые</option>
              </select>
            </label>
            <span role="status">
              Материалов: {visibleItems.length} / {deck.items.length}
            </span>
          </div>
          {visibleItems.length === 0 ? <p className="muted">Материалы не найдены.</p> : null}
          {groups.map((group) => (
            <section className="page-stack" key={group.id} aria-label={group.title}>
              <h3>
                {group.title} · {group.items.length}
              </h3>
              <div className="deck-item-list">
                {group.items.map((deckItem) => (
                  <DeckItemCard
                    deckItem={deckItem}
                    displayMode={displayMode}
                    key={deckItem.item.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
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
    <article className="deck-item-card" data-item-type={deckItem.item.itemType}>
      <div>
        <span className="eyebrow">{formatItemType(deckItem.item.itemType)}</span>
        <Link className="deck-item-link" href={`/items/${encodeURIComponent(deckItem.item.id)}`}>
          <JapaneseText as="strong">{deckItem.item.japanese}</JapaneseText>
        </Link>
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
      <SectionDisclosure title="Почему в колоде">
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
      </SectionDisclosure>
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
