"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  type CharacterHubKanaSectionDto,
  type CharacterHubKanjiItemDto,
  type CharacterHubKanjiSectionDto,
  type CharacterHubResponseDto,
  type TranslationDisplayMode,
  type KanaVariant,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import { ViewTabs } from "../../components/ViewTabs";
import { ApiError, getCharacterHub } from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";
import {
  buildCharacterHubHref,
  EMPTY_CHARACTER_HUB_FILTERS,
  filterCharacterHubKanji,
  parseCharacterHubQuery,
  type CharacterHubKanjiFilters,
  type CharacterHubTab,
} from "../../lib/character-hub";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";
import { ownsSession, useStoredSession } from "../../lib/use-stored-session";
import { filterKanaUnits, KANA_GROUP_LABELS } from "../../lib/kana-unit-groups";

type CharactersState =
  | { readonly status: "loading" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly hub: CharacterHubResponseDto };

const TAB_LABELS: Readonly<Record<CharacterHubTab, string>> = {
  hiragana: "Хирагана",
  katakana: "Катакана",
  kanji: "Кандзи",
};

const STUDY_STATE_LABELS: Readonly<Record<CharacterHubKanjiItemDto["studyState"], string>> = {
  "not-started": "Не начато",
  learning: "В изучении",
  passed: "Пройдено",
  burned: "Закреплено",
};

export function CharactersClient() {
  const session = useStoredSession();
  if (session === undefined) return <section className="page-stack" aria-busy="true"><h1>Символы</h1></section>;
  return <CharactersScreen key={session === null ? "guest" : `${session.user.id}:${session.token}`} />;
}

function CharactersScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = useMemo(() => parseCharacterHubQuery(searchParams), [searchParams]);
  const displayMode = useTranslationDisplayMode();
  const [state, setState] = useState<CharactersState>({ status: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const session = readStoredSession();

    if (session === null) {
      setState({ status: "unauthenticated" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void getCharacterHub(session.token)
      .then((hub) => {
        if (!cancelled && ownsSession(session.token)) {
          setState({ status: "ready", hub });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || !ownsSession(session.token)) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          clearStoredSession();
          setState({ status: "unauthenticated" });
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Не удалось загрузить прогресс по символам.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [retry]);

  function updateKanjiFilters(filters: CharacterHubKanjiFilters): void {
    router.push(buildCharacterHubHref("kanji", filters), { scroll: false });
  }

  return (
    <section className="page-stack">
      <div className="page-heading character-hub-heading">
        <div>
          <h1>Символы</h1>
          <p>Кана изучается в отдельных уроках, кандзи продвигаются по карточкам SRS.</p>
        </div>
      </div>

      <ViewTabs active={query.tab} onChange={(tab) => router.push(buildCharacterHubHref(tab as CharacterHubTab, query.filters), { scroll: false })} label="Системы письма" idPrefix="character-tab" panelId={`character-panel-${query.tab}`} tabs={(Object.keys(TAB_LABELS) as CharacterHubTab[]).map((id) => ({ id, label: TAB_LABELS[id] }))} />

      {state.status === "loading" ? (
        <div className="character-hub-loading" aria-busy="true">
          <div className="metric-card skeleton" />
          <div className="metric-card skeleton" />
          <div className="metric-card skeleton" />
        </div>
      ) : null}

      {state.status === "unauthenticated" ? (
        <div className="notice-panel">
          <p>Для просмотра учебного прогресса войдите в аккаунт.</p>
          <Link className="primary-action" href="/login">
            Войти
          </Link>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="notice-panel error-panel">
          <p>{state.message}</p>
          <button className="secondary-action" onClick={() => setRetry((value) => value + 1)}>Повторить загрузку</button>
        </div>
      ) : null}

      {state.status === "ready" && query.tab !== "kanji" ? (
        <KanaCharacterPanel
          key={query.tab}
          section={query.tab === "hiragana" ? state.hub.kana.hiragana : state.hub.kana.katakana}
        />
      ) : null}

      {state.status === "ready" && query.tab === "kanji" ? (
        <KanjiCharacterPanel
          key={JSON.stringify(query.filters)}
          displayMode={displayMode}
          filters={query.filters}
          onFiltersChange={updateKanjiFilters}
          section={state.hub.kanji}
        />
      ) : null}
    </section>
  );
}

function KanaCharacterPanel({ section }: { readonly section: CharacterHubKanaSectionDto }) {
  const [group, setGroup] = useState<KanaVariant | "all">("basic");
  const units = filterKanaUnits(section.units, group);
  const percentage =
    section.totalCount === 0 ? 0 : Math.round((section.masteredCount / section.totalCount) * 100);

  return (
    <section
      aria-labelledby={`character-tab-${section.script}`}
      className="character-hub-panel"
      id={`character-panel-${section.script}`}
      role="tabpanel"
    >
      <header className="character-hub-section-heading">
        <div>
          <p className="character-hub-model">Прогресс каны: освоение в уроках, не SRS</p>
          <h2>{TAB_LABELS[section.script]}</h2>
          <p>
            Освоено {section.masteredCount} из {section.totalCount}, начато {section.attemptedCount}
            .
          </p>
        </div>
        <div
          aria-label={`Освоено ${percentage}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percentage}
          className="character-hub-progress"
          role="progressbar"
        >
          <span style={{ width: `${percentage}%` }} />
        </div>
      </header>

      <div className="action-row character-hub-actions">
        <Link className="primary-action" href={section.actions.lessonsHref}>
          Продолжить уроки
        </Link>
        <Link className="secondary-action" href={section.actions.practiceHref}>
          Адаптивная практика
        </Link>
        <Link className="secondary-action" href={section.actions.assessmentHref}>
          Проверка
        </Link>
      </div>

      <section className="character-hub-weak" aria-labelledby={`${section.script}-weak-heading`}>
        <div>
          <h3 id={`${section.script}-weak-heading`}>Требуют внимания</h3>
          <p>Знаки с ошибками или неустойчивой серией ответов.</p>
        </div>
        {section.weakSymbols.length === 0 ? (
          <p className="character-hub-empty">Слабых знаков пока нет.</p>
        ) : (
          <ul>
            {section.weakSymbols.map((symbol) => (
              <li key={symbol.character}>
                <JapaneseText>{symbol.character}</JapaneseText>
                <span>{symbol.romaji}</span>
                <small>{Math.round(symbol.recentAccuracy * 100)}%</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <label className="catalog-group-control"><span>Группа знаков</span><select value={group} onChange={(event) => setGroup(event.currentTarget.value as KanaVariant | "all")}>
        {(Object.keys(KANA_GROUP_LABELS) as (KanaVariant | "all")[]).map((id) => <option value={id} key={id}>{KANA_GROUP_LABELS[id]} ({filterKanaUnits(section.units, id).reduce((total, unit) => total + unit.totalCount, 0)})</option>)}
      </select></label>
      {units.length === 0 ? <p className="muted">В этой группе знаков нет.</p> : null}
      <ol
        className="character-hub-kana-units"
        aria-label={`Все уроки: ${TAB_LABELS[section.script]}`}
      >
        {units.map((unit) => (
          <li className={unit.unlocked ? undefined : "is-locked"} key={unit.id}>
            <header>
              <div>
                <span>Урок {unit.order}</span>
                <h3>{unit.title}</h3>
              </div>
              <strong>
                {unit.complete
                  ? "Освоено"
                  : unit.unlocked
                    ? `${unit.masteredCount}/${unit.totalCount}`
                    : "Закрыто"}
              </strong>
            </header>
            <div className="character-hub-kana-chart">
              {unit.items.map((item) => (
                <span
                  className={item.mastered ? "is-mastered" : undefined}
                  key={item.character}
                  title={`${item.character} — ${item.romaji}`}
                >
                  <JapaneseText>{item.character}</JapaneseText>
                  <small>{item.romaji}</small>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function KanjiCharacterPanel({
  displayMode,
  filters,
  onFiltersChange,
  section,
}: {
  readonly displayMode: TranslationDisplayMode;
  readonly filters: CharacterHubKanjiFilters;
  readonly onFiltersChange: (filters: CharacterHubKanjiFilters) => void;
  readonly section: CharacterHubKanjiSectionDto;
}) {
  const items = useMemo(() => filterCharacterHubKanji(section.items, filters), [filters, section]);
  const [page, setPage] = useState(1);
  const pageSize = 60;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = items.slice((page - 1) * pageSize, page * pageSize);
  const progressMaximum = Math.max(section.counts.total, 1);
  const completedCount = section.counts.passed + section.counts.burned;

  return (
    <section
      aria-labelledby="character-tab-kanji"
      className="character-hub-panel"
      id="character-panel-kanji"
      role="tabpanel"
    >
      <header className="character-hub-section-heading">
        <div>
          <p className="character-hub-model">Прогресс кандзи: учебные карточки SRS</p>
          <h2>{section.currentCourse?.title ?? "Курс не выбран"}</h2>
          <p>
            {section.currentCourse === null
              ? "Выберите структурированный курс, чтобы увидеть его кандзи."
              : `Текущий уровень: ${section.currentCourse.currentLevel}`}
          </p>
        </div>
        <div
          aria-label={`Пройдено ${completedCount} из ${section.counts.total}`}
          aria-valuemax={progressMaximum}
          aria-valuemin={0}
          aria-valuenow={completedCount}
          className="character-hub-progress"
          role="progressbar"
        >
          <span style={{ width: `${(completedCount / progressMaximum) * 100}%` }} />
        </div>
      </header>

      <dl className="character-hub-kanji-stats">
        <div>
          <dt>Всего</dt>
          <dd>{section.counts.total}</dd>
        </div>
        <div>
          <dt>Изучается</dt>
          <dd>{section.counts.learned}</dd>
        </div>
        <div>
          <dt>Пройдено</dt>
          <dd>{section.counts.passed}</dd>
        </div>
        <div>
          <dt>Закреплено</dt>
          <dd>{section.counts.burned}</dd>
        </div>
        <div>
          <dt>Слабые</dt>
          <dd>{section.counts.weak}</dd>
        </div>
      </dl>

      <div className="character-hub-filters" aria-label="Фильтры кандзи">
        <FilterSelect
          label="Уровень"
          onChange={(value) =>
            onFiltersChange({ ...filters, level: value === "" ? null : Number(value) })
          }
          options={section.filters.levels.map((level) => ({
            label: `Уровень ${level}`,
            value: String(level),
          }))}
          value={filters.level === null ? "" : String(filters.level)}
        />
        <FilterSelect
          label="Диапазон"
          onChange={(value) =>
            onFiltersChange({
              ...filters,
              band: value === "" ? null : (value as NonNullable<typeof filters.band>),
            })
          }
          options={section.filters.bands.map((band) => ({
            label: band === "foundation" ? "Основы" : band.toUpperCase(),
            value: band,
          }))}
          value={filters.band ?? ""}
        />
        <FilterSelect
          label="JLPT"
          onChange={(value) =>
            onFiltersChange({
              ...filters,
              jlpt: value === "" ? null : (value as NonNullable<typeof filters.jlpt>),
            })
          }
          options={section.filters.jlptLevels.map((jlpt) => ({
            label: jlpt.toUpperCase(),
            value: jlpt,
          }))}
          value={filters.jlpt ?? ""}
        />
        <FilterSelect
          label="Состояние"
          onChange={(value) =>
            onFiltersChange({
              ...filters,
              state: value === "" ? null : (value as NonNullable<typeof filters.state>),
            })
          }
          options={[
            { label: "Не начато", value: "not-started" },
            { label: "В изучении", value: "learning" },
            { label: "Пройдено", value: "passed" },
            { label: "Закреплено", value: "burned" },
            { label: "Слабые", value: "weak" },
          ]}
          value={filters.state ?? ""}
        />
        <button
          className="secondary-action"
          disabled={filtersEqual(filters, EMPTY_CHARACTER_HUB_FILTERS)}
          onClick={() => onFiltersChange(EMPTY_CHARACTER_HUB_FILTERS)}
          type="button"
        >
          Сбросить
        </button>
      </div>

      <p className="character-hub-result-count">Показано: {items.length}</p>
      {pageCount <= 1 ? null : <nav className="catalog-pagination" aria-label="Страницы кандзи">
        <button className="secondary-action" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Назад</button>
        <span role="status">{page} / {pageCount}</span>
        <button className="secondary-action" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Далее</button>
      </nav>}

      {items.length === 0 ? (
        <div className="notice-panel">
          <p>По выбранным фильтрам кандзи не найдены.</p>
        </div>
      ) : (
        <ol className="character-hub-kanji-grid">
          {visibleItems.map((item) => (
            <li key={`${item.level}-${item.id}`}>
              <Link href={item.href}>
                <JapaneseText className="character-hub-kanji-character" variant="display">
                  {item.character}
                </JapaneseText>
                <div className="character-hub-kanji-copy">
                  <strong>{item.reading ?? "Чтение уточняется"}</strong>
                  <span>{formatMeanings(item, displayMode)}</span>
                </div>
                <div className="character-hub-kanji-meta">
                  <span>Ур. {item.level}</span>
                  <span>
                    {item.jlptLevel?.toUpperCase() ??
                      (item.legacyJlptLevel == null
                        ? "JLPT —"
                        : `JLPT до 2010: ${item.legacyJlptLevel}`)}
                  </span>
                  <span className={`state-${item.studyState}`}>
                    {STUDY_STATE_LABELS[item.studyState]}
                  </span>
                  {item.weak ? <span className="is-weak">Слабый</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly { readonly label: string; readonly value: string }[];
  readonly value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <select onChange={(event) => onChange(event.currentTarget.value)} value={value}>
        <option value="">Все</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatMeanings(
  item: CharacterHubKanjiItemDto,
  displayMode: TranslationDisplayMode,
): string {
  const values = [
    ...(displayMode === "ru" || displayMode === "ru-en" ? [item.meaningRu] : []),
    ...(displayMode === "en" || displayMode === "ru-en" ? [item.meaningEn] : []),
  ].filter((value): value is string => value !== null);

  return values.length === 0 ? "Значение уточняется" : values.join(" · ");
}

function filtersEqual(left: CharacterHubKanjiFilters, right: CharacterHubKanjiFilters): boolean {
  return (
    left.level === right.level &&
    left.band === right.band &&
    left.jlpt === right.jlpt &&
    left.state === right.state
  );
}
