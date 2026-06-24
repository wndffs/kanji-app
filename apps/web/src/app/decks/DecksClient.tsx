"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import {
  type CreateTextDeckResponse,
  type DeckItemDto,
  type DeckItemReasonDto,
  type TranslationBundleDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { ApiError, createTextDeck } from "../../lib/api-client";
import {
  clearStoredSession,
  readStoredSession,
  readTranslationDisplayMode,
} from "../../lib/auth-storage";

type DecksState =
  | { readonly status: "checking" }
  | { readonly status: "unauthenticated" }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly displayMode: TranslationDisplayMode;
    };

export function DecksClient() {
  const [state, setState] = useState<DecksState>({ status: "checking" });
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [maxItems, setMaxItems] = useState(80);
  const [result, setResult] = useState<CreateTextDeckResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const session = readStoredSession();

    if (session === null) {
      setState({ status: "unauthenticated" });
      return;
    }

    setState({
      status: "ready",
      token: session.token,
      displayMode: session.user.settings.translationDisplayMode ?? readTranslationDisplayMode(),
    });
  }, []);

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

      {result === null ? null : <TextDeckResult result={result} displayMode={state.displayMode} />}
    </section>
  );
}

function TextDeckResult({
  result,
  displayMode,
}: {
  readonly result: CreateTextDeckResponse;
  readonly displayMode: TranslationDisplayMode;
}) {
  return (
    <section className="deck-result">
      <div className="panel">
        <div className="deck-result-header">
          <div>
            <span className="eyebrow">Готово</span>
            <h2>{result.deck.title}</h2>
          </div>
          <dl className="stats-list">
            <div>
              <dt>Элементов</dt>
              <dd>{result.deck.itemCount}</dd>
            </div>
            <div>
              <dt>Новых</dt>
              <dd>{result.deck.newItemCount}</dd>
            </div>
          </dl>
        </div>
        <p className="muted">
          Кандидатов: {result.tokenization.candidateCount}. Совпадений с базой:{" "}
          {result.tokenization.matchedItemCount}.
        </p>
      </div>

      {result.deck.items.length === 0 ? (
        <div className="notice-panel">
          <p>В тексте не нашлось опубликованных Word/Kanji элементов из базы.</p>
        </div>
      ) : (
        <div className="deck-item-list">
          {result.deck.items.map((deckItem) => (
            <DeckItemCard deckItem={deckItem} displayMode={displayMode} key={deckItem.item.id} />
          ))}
        </div>
      )}
    </section>
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
        <strong>{deckItem.item.japanese}</strong>
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
