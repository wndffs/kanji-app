"use client";

import Link from "next/link";
import { X, RotateCcw, ArrowLeft, ArrowRight, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type ItemSummary,
  type SearchResponseDto,
  type TranslationBundleDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import { SectionDisclosure } from "../../components/SectionDisclosure";
import { ApiError, searchItems } from "../../lib/api-client";
import {
  AUTH_CHANGED_EVENT,
  clearStoredSession,
  readStoredSession,
  type StoredSession,
} from "../../lib/auth-storage";
import { formatSrsStageName } from "../../lib/dashboard-format";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";
import { parseSearchFilters, parseSearchPage, searchHref } from "../../lib/search-location";

type SearchState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly query: string }
  | { readonly status: "error"; readonly query: string; readonly message: string }
  | { readonly status: "ready"; readonly result: SearchResponseDto };

export function SearchClient() {
  const [session, setSession] = useState<StoredSession | null | undefined>(undefined);
  useEffect(() => {
    const sync = () => setSession(readStoredSession());
    sync();
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  if (session === undefined)
    return (
      <section className="page-stack" aria-busy="true">
        <h1>Поиск</h1>
      </section>
    );
  return (
    <SearchScreen
      key={session === null ? "guest" : `${session.user.id}:${session.token}`}
      token={session?.token ?? null}
    />
  );
}

function SearchScreen({ token }: { readonly token: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q")?.trim() ?? "";
  const pageFromUrl = parseSearchPage(searchParams.get("page"));
  const { itemType: typeFromUrl, level: levelFromUrl } = parseSearchFilters(
    searchParams.get("itemType"),
    searchParams.get("level"),
  );
  const displayMode = useTranslationDisplayMode();
  const [query, setQuery] = useState(queryFromUrl);
  const [itemType, setItemType] = useState(typeFromUrl ?? "");
  const [level, setLevel] = useState(levelFromUrl === undefined ? "" : String(levelFromUrl));
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);

  const runSearch = useCallback(
    async (nextQuery: string, nextPage = 1): Promise<void> => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      const isCurrent = () =>
        activeRequest.current === controller &&
        !controller.signal.aborted &&
        (readStoredSession()?.token ?? null) === token;
      const normalizedQuery = nextQuery.trim();

      if (normalizedQuery === "") {
        setState({ status: "idle" });
        return;
      }

      setState({ status: "loading", query: normalizedQuery });

      try {
        const result = await searchItems(normalizedQuery, token, {
          page: nextPage,
          itemType: typeFromUrl,
          level: levelFromUrl,
          signal: controller.signal,
        });
        if (!isCurrent()) return;
        setState({ status: "ready", result });
      } catch (error: unknown) {
        if (!isCurrent()) return;
        if (error instanceof ApiError && error.status === 401 && token !== null) {
          clearStoredSession();
          return;
        }

        setState({
          status: "error",
          query: normalizedQuery,
          message: error instanceof Error ? error.message : "Не удалось выполнить поиск.",
        });
      }
    },
    [token, typeFromUrl, levelFromUrl],
  );

  useEffect(() => {
    setQuery(queryFromUrl);
    setItemType(typeFromUrl ?? "");
    setLevel(levelFromUrl === undefined ? "" : String(levelFromUrl));
    void runSearch(queryFromUrl, pageFromUrl);
  }, [queryFromUrl, pageFromUrl, typeFromUrl, levelFromUrl, runSearch]);

  const resultCount = useMemo(() => {
    return state.status === "ready" ? state.result.pagination.total : null;
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (normalizedQuery === "") {
      activeRequest.current?.abort();
      router.push("/search");
      setState({ status: "idle" });
      return;
    }

    const filters = parseSearchFilters(itemType, level);
    if (
      normalizedQuery === queryFromUrl &&
      pageFromUrl === 1 &&
      filters.itemType === typeFromUrl &&
      filters.level === levelFromUrl
    ) {
      void runSearch(normalizedQuery);
      return;
    }

    activeRequest.current?.abort();
    setState({ status: "loading", query: normalizedQuery });
    router.push(searchHref(normalizedQuery, 1, filters));
  }

  return (
    <section className="page-stack search-page">
      <div className="page-heading search-heading">
        <div>
          <h1>Поиск</h1>
          <p>{resultCount === null ? "Словарь" : `Найдено: ${resultCount}`}</p>
        </div>
      </div>

      <form
        className="search-panel search-form"
        onSubmit={handleSubmit}
        onInvalidCapture={(event) => {
          if (event.target instanceof HTMLInputElement) {
            const details = event.target.closest("details");
            if (details !== null) details.open = true;
          }
        }}
      >
        <div className="search-query-row">
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
            <Search size={18} aria-hidden="true" />
            Искать
          </button>
        </div>
        <SectionDisclosure
          title="Фильтры"
          defaultOpen={typeFromUrl !== undefined || levelFromUrl !== undefined}
          className="search-filter-disclosure"
        >
          <div className="search-filter-fields">
            <label>
              <span>Тип материала</span>
              <select
                aria-label="Тип материала"
                value={itemType}
                onChange={(event) => setItemType(event.currentTarget.value as typeof itemType)}
              >
                <option value="">Все типы</option>
                <option value="component">Компоненты</option>
                <option value="kanji">Кандзи</option>
                <option value="word">Слова</option>
                <option value="sentence">Предложения</option>
              </select>
            </label>
            <label>
              <span>Учебный уровень</span>
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                value={level}
                onChange={(event) => setLevel(event.currentTarget.value)}
              />
            </label>
          </div>
        </SectionDisclosure>
      </form>

      {typeFromUrl === undefined && levelFromUrl === undefined ? null : (
        <div className="applied-filters" aria-label="Применённые фильтры">
          {typeFromUrl === undefined ? null : (
            <button
              className="filter-chip"
              aria-label="Убрать тип материала"
              onClick={() => router.push(searchHref(queryFromUrl, 1, { level: levelFromUrl }))}
            >
              {formatItemType(typeFromUrl)}
              <X size={16} aria-hidden="true" />
            </button>
          )}
          {levelFromUrl === undefined ? null : (
            <button
              className="filter-chip"
              aria-label="Убрать учебный уровень"
              onClick={() => router.push(searchHref(queryFromUrl, 1, { itemType: typeFromUrl }))}
            >
              Уровень {levelFromUrl}
              <X size={16} aria-hidden="true" />
            </button>
          )}
          <button
            className="icon-button"
            title="Сбросить фильтры"
            aria-label="Сбросить фильтры"
            onClick={() => router.push(searchHref(queryFromUrl))}
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      <SearchResults state={state} displayMode={displayMode} isAuthenticated={token !== null} />
      {state.status === "ready" &&
      (state.result.pagination.total > state.result.pagination.limit ||
        state.result.pagination.page > 1) ? (
        <nav className="search-pagination" aria-label="Страницы поиска">
          {state.result.pagination.page > 1 ? (
            <Link
              className="secondary-action"
              aria-label="Предыдущая страница"
              title="Предыдущая страница"
              href={searchHref(queryFromUrl, state.result.pagination.page - 1, {
                itemType: typeFromUrl,
                level: levelFromUrl,
              })}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
          <span>
            Страница {state.result.pagination.page} из{" "}
            {Math.max(1, Math.ceil(state.result.pagination.total / state.result.pagination.limit))}
          </span>
          {state.result.pagination.hasNextPage ? (
            <Link
              className="secondary-action"
              aria-label="Следующая страница"
              title="Следующая страница"
              href={searchHref(queryFromUrl, state.result.pagination.page + 1, {
                itemType: typeFromUrl,
                level: levelFromUrl,
              })}
            >
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
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
    <Link
      className="search-result-card"
      data-item-type={item.itemType}
      href={`/items/${encodeURIComponent(item.id)}`}
    >
      <div className="search-result-main">
        <span className="eyebrow">{formatItemType(item.itemType)}</span>
        <JapaneseText as="strong">{item.japanese}</JapaneseText>
        {item.reading === null ? null : (
          <JapaneseText as="p" className="search-result-reading">
            {item.reading}
          </JapaneseText>
        )}
        <p className="search-result-meaning">
          {formatTranslationBundle(item.translations, displayMode)}
        </p>
      </div>
      <dl className="search-result-meta">
        {item.level === null ? null : (
          <div>
            <dt>Уровень</dt>
            <dd>{item.level}</dd>
          </div>
        )}
        {item.jlptLevel === null ? null : (
          <div>
            <dt>JLPT</dt>
            <dd>{item.jlptLevel}</dd>
          </div>
        )}
        {isAuthenticated ? (
          <div>
            <dt>Повторения</dt>
            <dd>{formatSrsStageName(item.srs?.stageName)}</dd>
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
