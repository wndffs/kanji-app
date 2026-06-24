"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  type ItemSummary,
  type SearchResponseDto,
  type TranslationBundleDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { ApiError, searchItems } from "../../lib/api-client";
import {
  clearStoredSession,
  readStoredSession,
  readTranslationDisplayMode,
} from "../../lib/auth-storage";

type SearchState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly query: string }
  | { readonly status: "error"; readonly query: string; readonly message: string }
  | { readonly status: "ready"; readonly result: SearchResponseDto };

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q")?.trim() ?? "";
  const [query, setQuery] = useState(queryFromUrl);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [token, setToken] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<TranslationDisplayMode>("ru");

  useEffect(() => {
    const session = readStoredSession();

    setToken(session?.token ?? null);
    setDisplayMode(session?.user.settings.translationDisplayMode ?? readTranslationDisplayMode());
  }, []);

  const runSearch = useCallback(
    async (nextQuery: string): Promise<void> => {
      const normalizedQuery = nextQuery.trim();

      if (normalizedQuery === "") {
        setState({ status: "idle" });
        return;
      }

      setState({ status: "loading", query: normalizedQuery });

      try {
        const result = await searchItems(normalizedQuery, token);
        setState({ status: "ready", result });
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          clearStoredSession();
          setToken(null);
        }

        setState({
          status: "error",
          query: normalizedQuery,
          message: error instanceof Error ? error.message : "Не удалось выполнить поиск.",
        });
      }
    },
    [token],
  );

  useEffect(() => {
    setQuery(queryFromUrl);
    void runSearch(queryFromUrl);
  }, [queryFromUrl, runSearch]);

  const resultCount = useMemo(() => {
    return state.status === "ready" ? state.result.pagination.total : null;
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (normalizedQuery === "") {
      router.push("/search");
      setState({ status: "idle" });
      return;
    }

    if (normalizedQuery === queryFromUrl) {
      void runSearch(normalizedQuery);
      return;
    }

    router.push(`/search?q=${encodeURIComponent(normalizedQuery)}`);
  }

  return (
    <section className="page-stack">
      <div className="page-heading search-heading">
        <div>
          <h1>Поиск</h1>
          <p>{resultCount === null ? "Словарь" : `Найдено: ${resultCount}`}</p>
        </div>
      </div>

      <form className="search-panel search-form" onSubmit={handleSubmit}>
        <label>
          <span>Запрос</span>
          <input
            autoComplete="off"
            name="q"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="学校, がっこう, школа, school"
            type="search"
            value={query}
          />
        </label>
        <button className="primary-action" type="submit">
          Искать
        </button>
      </form>

      <SearchResults state={state} displayMode={displayMode} isAuthenticated={token !== null} />
    </section>
  );
}

function SearchResults({
  state,
  displayMode,
  isAuthenticated,
}: {
  readonly state: SearchState;
  readonly displayMode: TranslationDisplayMode;
  readonly isAuthenticated: boolean;
}) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "loading") {
    return (
      <section className="search-results" aria-busy="true">
        <div className="search-result-card skeleton" />
        <div className="search-result-card skeleton" />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <div className="notice-panel error-panel">
        <p>{state.message}</p>
      </div>
    );
  }

  if (state.result.items.length === 0) {
    return (
      <div className="notice-panel">
        <p>Ничего не найдено.</p>
      </div>
    );
  }

  return (
    <section className="search-results" aria-label="Результаты поиска">
      {state.result.items.map((item) => (
        <SearchResultCard
          displayMode={displayMode}
          isAuthenticated={isAuthenticated}
          item={item}
          key={item.id}
        />
      ))}
    </section>
  );
}

function SearchResultCard({
  item,
  displayMode,
  isAuthenticated,
}: {
  readonly item: ItemSummary;
  readonly displayMode: TranslationDisplayMode;
  readonly isAuthenticated: boolean;
}) {
  return (
    <Link className="search-result-card" href={`/items/${encodeURIComponent(item.id)}`}>
      <div className="search-result-main">
        <span className="eyebrow">{formatItemType(item.itemType)}</span>
        <strong>{item.japanese}</strong>
        <p>{formatTranslationBundle(item.translations, displayMode)}</p>
      </div>
      <dl className="search-result-meta">
        <div>
          <dt>Чтение</dt>
          <dd>{item.reading ?? "нет"}</dd>
        </div>
        <div>
          <dt>Уровень</dt>
          <dd>{item.level ?? "нет"}</dd>
        </div>
        <div>
          <dt>JLPT</dt>
          <dd>{item.jlptLevel ?? "нет"}</dd>
        </div>
        {isAuthenticated ? (
          <div>
            <dt>SRS</dt>
            <dd>{item.srs?.stageName ?? "не начат"}</dd>
          </div>
        ) : null}
      </dl>
    </Link>
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

function formatItemType(itemType: ItemSummary["itemType"]): string {
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
