"use client";
import { kanaLessonHref } from "../../lib/kana-route";

import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid, List, X } from "lucide-react";
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
import { KanaContentSummary } from "../../components/KanaContentSummary";
import { CharacterCatalogueSearch } from "../../components/CharacterCatalogueSearch";
import { ViewTabs } from "../../components/ViewTabs";
import { SectionDisclosure } from "../../components/SectionDisclosure";
import { ApiError, getCharacterHub } from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";
import {
  buildCharacterHubHref,
  CHARACTER_CATALOGUE_PAGE_SIZE,
  CHARACTER_CATALOGUE_SORTS,
  characterMeaningRows,
  sortCharacterHubKanji,
  type CharacterCatalogueSort,
  EMPTY_CHARACTER_HUB_FILTERS,
  filterCharacterHubKanji,
  parseCharacterHubQuery,
  type CharacterHubKanjiFilters,
  type CharacterHubTab,
  type CharacterCatalogueOptions,
} from "../../lib/character-hub";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";
import { formatSrsStageName } from "../../lib/dashboard-format";
import { characterCatalogueItemHref } from "../../lib/character-catalogue-context";
import { ownsSession, useStoredSession } from "../../lib/use-stored-session";
import {
  filterKanaUnits,
  KANA_GROUP_LABELS,
  selectKanaResumeUnit,
  findKanaPrerequisite,
  summarizeKanaUnits,
  filterKanaUnitStatus,
  KANA_UNIT_STATUS_LABELS,
  type KanaUnitStatus,
} from "../../lib/kana-unit-groups";

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
  if (session === undefined)
    return (
      <section className="page-stack" aria-busy="true">
        <h1>Символы</h1>
      </section>
    );
  return (
    <CharactersScreen key={session === null ? "guest" : `${session.user.id}:${session.token}`} />
  );
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
    const controller = new AbortController();
    setState({ status: "loading" });

    void getCharacterHub(session.token, controller.signal)
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
      controller.abort();
    };
  }, [retry]);

  function updateKanjiFilters(filters: CharacterHubKanjiFilters): void {
    router.push(buildCharacterHubHref("kanji", filters, query.kanaGroup, query.kanaStatus, { ...query.catalogue, page: 1 }), {
      scroll: false,
    });
  }

  return (
    <section className="page-stack">
      <div className="page-heading character-hub-heading">
        <div>
          <h1>Символы</h1>
        </div>
      </div>

      <ViewTabs
        active={query.tab}
        onChange={(tab) =>
          router.push(
            buildCharacterHubHref(
              tab as CharacterHubTab,
              query.filters,
              query.kanaGroup,
              query.kanaStatus,
              query.catalogue,
            ),
            {
              scroll: false,
            },
          )
        }
        label="Системы письма"
        idPrefix="character-tab"
        panelId={`character-panel-${query.tab}`}
        tabs={(Object.keys(TAB_LABELS) as CharacterHubTab[]).map((id) => ({
          id,
          label: TAB_LABELS[id],
        }))}
      />

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
          <button className="secondary-action" onClick={() => setRetry((value) => value + 1)}>
            Повторить загрузку
          </button>
        </div>
      ) : null}

      {state.status === "ready" && query.tab !== "kanji" ? (
        <KanaCharacterPanel
          key={query.tab}
          group={query.kanaGroup}
          onGroupChange={(group) =>
            router.push(buildCharacterHubHref(query.tab, query.filters, group, query.kanaStatus, query.catalogue), {
              scroll: false,
            })
          }
          status={query.kanaStatus}
          onStatusChange={(status) =>
            router.push(buildCharacterHubHref(query.tab, query.filters, query.kanaGroup, status, query.catalogue), {
              scroll: false,
            })
          }
          section={query.tab === "hiragana" ? state.hub.kana.hiragana : state.hub.kana.katakana}
        />
      ) : null}

      {state.status === "ready" && query.tab === "kanji" ? (
        <KanjiCharacterPanel
          key={JSON.stringify(query.filters)}
          displayMode={displayMode}
          filters={query.filters}
          onFiltersChange={updateKanjiFilters}
          catalogue={query.catalogue}
          catalogueHref={buildCharacterHubHref('kanji', query.filters, query.kanaGroup, query.kanaStatus, query.catalogue)}
          onCatalogueChange={(catalogue, replace = false) => {
            const href = buildCharacterHubHref('kanji', query.filters, query.kanaGroup, query.kanaStatus, catalogue);
            if (replace) router.replace(href, { scroll: false });
            else router.push(href, { scroll: false });
          }}
          section={state.hub.kanji}
        />
      ) : null}
    </section>
  );
}

function KanaCharacterPanel({
  section,
  group,
  onGroupChange,
  status,
  onStatusChange,
}: {
  readonly section: CharacterHubKanaSectionDto;
  readonly group: KanaVariant | "all";
  readonly onGroupChange: (group: KanaVariant | "all") => void;
  readonly status: KanaUnitStatus;
  readonly onStatusChange: (status: KanaUnitStatus) => void;
}) {
  const groupedUnits = filterKanaUnits(section.units, group);
  const units = filterKanaUnitStatus(groupedUnits, status);
  const groupProgress = summarizeKanaUnits(groupedUnits);
  const resumeUnit = selectKanaResumeUnit(section.units);
  const resumeItem = resumeUnit?.items.find((item) => !item.mastered) ?? resumeUnit?.items[0];
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
            Освоено {section.masteredCount} из {section.totalCount} учебных элементов, начато{" "}
            {section.attemptedCount}.
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

      <KanaContentSummary items={section.units.flatMap((unit) => unit.items)} />

      <div className="action-row character-hub-actions">
        {resumeUnit && resumeItem ? (
          <Link
            className="primary-action"
            href={kanaLessonHref(section.script, resumeUnit.id, resumeItem.character)}
          >
            {resumeUnit.complete
              ? "Повторить уроки"
              : section.attemptedCount === 0
                ? "Начать уроки"
                : "Продолжить уроки"}
          </Link>
        ) : (
          <span className="muted">Нет доступных уроков.</span>
        )}
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

      <div className="kana-map-controls">
        <label className="catalog-group-control">
          <span>Группа знаков</span>
          <select
            value={group}
            onChange={(event) => onGroupChange(event.currentTarget.value as KanaVariant | "all")}
          >
            {(Object.keys(KANA_GROUP_LABELS) as (KanaVariant | "all")[]).map((id) => (
              <option value={id} key={id}>
                {KANA_GROUP_LABELS[id]} (
                {filterKanaUnits(section.units, id).reduce(
                  (total, unit) => total + unit.totalCount,
                  0,
                )}
                )
              </option>
            ))}
          </select>
        </label>
        <label className="catalog-group-control">
          <span>Состояние уроков</span>
          <select
            value={status}
            onChange={(event) => onStatusChange(event.currentTarget.value as KanaUnitStatus)}
          >
            {(Object.keys(KANA_UNIT_STATUS_LABELS) as KanaUnitStatus[]).map((id) => (
              <option value={id} key={id}>
                {KANA_UNIT_STATUS_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="icon-button"
          title="Сбросить состояние уроков"
          aria-label="Сбросить состояние уроков"
          disabled={status === "all"}
          type="button"
          onClick={() => onStatusChange("all")}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="muted" aria-label="Прогресс выбранной группы">
        Освоено {groupProgress.mastered} из {groupProgress.total} · Начато {groupProgress.started}
      </p>
      {units.length === 0 ? (
        <p className="muted">
          {groupedUnits.length === 0
            ? "В этой группе знаков нет."
            : "Нет уроков с таким состоянием."}
        </p>
      ) : null}
      <ol
        className="character-hub-kana-units"
        aria-label={`Все уроки: ${TAB_LABELS[section.script]}`}
      >
        {units.map((unit) => (
          <li className={unit.unlocked ? undefined : "is-locked"} key={unit.id}>
            <header>
              <div>
                <span>
                  Урок {section.units.findIndex((candidate) => candidate.id === unit.id) + 1}
                </span>
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
            {!unit.unlocked && findKanaPrerequisite(section.units, unit.id) ? (
              <p className="kana-unit-prerequisite">
                После урока «{findKanaPrerequisite(section.units, unit.id)!.title}»
              </p>
            ) : null}
            <div className="character-hub-kana-chart">
              {unit.items.map((item) =>
                unit.unlocked ? (
                  <Link
                    className={item.mastered ? "is-mastered" : undefined}
                    key={item.character}
                    href={kanaLessonHref(section.script, unit.id, item.character)}
                    title={`${item.character} — ${item.romaji}`}
                  >
                    <JapaneseText>{item.character}</JapaneseText>
                    <small>{item.romaji}</small>
                  </Link>
                ) : (
                  <span key={item.character} title={`${item.character} — ${item.romaji}`}>
                    <JapaneseText>{item.character}</JapaneseText>
                    <small>{item.romaji}</small>
                  </span>
                ),
              )}
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
  catalogue,
  catalogueHref,
  onCatalogueChange,
}: {
  readonly displayMode: TranslationDisplayMode;
  readonly filters: CharacterHubKanjiFilters;
  readonly onFiltersChange: (filters: CharacterHubKanjiFilters) => void;
  readonly section: CharacterHubKanjiSectionDto;
  readonly catalogue: CharacterCatalogueOptions;
  readonly catalogueHref: string;
  readonly onCatalogueChange: (options: CharacterCatalogueOptions, replace?: boolean) => void;
}) {
  const items = useMemo(() => sortCharacterHubKanji(filterCharacterHubKanji(section.items, filters, catalogue.q), catalogue.sort, displayMode), [filters, section, catalogue.q, catalogue.sort, displayMode]);
  const pageSize = CHARACTER_CATALOGUE_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(catalogue.page, pageCount);
  useEffect(() => {
    if (page !== catalogue.page) onCatalogueChange({ ...catalogue, page }, true);
  }, [catalogue, page, onCatalogueChange]);
  const visibleItems = items.slice((page - 1) * pageSize, page * pageSize);
  const progressMaximum = Math.max(section.counts.total, 1);
  const completedCount = section.counts.passed + section.counts.burned;
  const filterLabels: Record<keyof CharacterHubKanjiFilters, string> = {
    level: `Уровень ${filters.level}`,
    band: filters.band === "foundation" ? "Основы" : (filters.band?.toUpperCase() ?? ""),
    jlpt: `JLPT ${filters.jlpt?.toUpperCase() ?? ""}`,
    state:
      filters.state === "weak"
        ? "Слабые"
        : filters.state === null
          ? ""
          : STUDY_STATE_LABELS[filters.state],
  };
  const applied = (Object.keys(filters) as (keyof CharacterHubKanjiFilters)[]).filter(
    (key) => filters[key] !== null,
  );

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
          <dt title="Есть хотя бы одна начатая карточка, включая пройденные материалы">Начато</dt>
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

      <div className="character-catalogue-toolbar">
        <CharacterCatalogueSearch key={catalogue.q} value={catalogue.q} onSearch={(q) => onCatalogueChange({ ...catalogue, q, page: 1 })} />
        <label><span>Порядок кандзи</span><select value={catalogue.sort} onChange={(event) => onCatalogueChange({ ...catalogue, sort: event.currentTarget.value as CharacterCatalogueSort, page: 1 })}>
          {(Object.keys(CHARACTER_CATALOGUE_SORTS) as CharacterCatalogueSort[]).map((id) => <option key={id} value={id}>{CHARACTER_CATALOGUE_SORTS[id]}</option>)}
        </select></label>
        <div className="catalogue-view-controls" role="group" aria-label="Вид каталога кандзи">
          <button className="icon-button" type="button" aria-label="Плитки кандзи" title="Плитки" aria-pressed={catalogue.view === 'grid'} onClick={() => onCatalogueChange({ ...catalogue, view: 'grid' })}><LayoutGrid size={18} aria-hidden="true" /></button>
          <button className="icon-button" type="button" aria-label="Список кандзи" title="Список" aria-pressed={catalogue.view === 'list'} onClick={() => onCatalogueChange({ ...catalogue, view: 'list' })}><List size={18} aria-hidden="true" /></button>
        </div>
      </div>
      {section.currentCourse === null ? null : (
        <div className="character-catalogue-shortcuts" role="group" aria-label="Быстрые фильтры кандзи">
          <label><input type="checkbox" aria-label="Текущий уровень" checked={filters.level === section.currentCourse.currentLevel} disabled={!section.filters.levels.includes(section.currentCourse.currentLevel)} onChange={(event) => onFiltersChange({ ...filters, level: event.currentTarget.checked ? section.currentCourse!.currentLevel : null })} />Текущий уровень {section.currentCourse.currentLevel}</label>
          <label><input type="checkbox" checked={filters.state === 'weak'} onChange={(event) => onFiltersChange({ ...filters, state: event.currentTarget.checked ? 'weak' : null })} />Только слабые</label>
        </div>
      )}
      <SectionDisclosure title="Фильтры кандзи" defaultOpen={applied.length > 0}>
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
      </SectionDisclosure>
      {applied.length === 0 ? null : (
        <div className="applied-filters" aria-label="Применённые фильтры кандзи">
          {applied.map((key) => (
            <button
              className="filter-chip"
              type="button"
              key={key}
              aria-label={`Убрать фильтр: ${filterLabels[key]}`}
              onClick={() => onFiltersChange({ ...filters, [key]: null })}
            >
              {filterLabels[key]}
              <X size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <p className="character-hub-result-count">Найдено: {items.length}</p>
      {pageCount <= 1 ? null : (
        <nav className="catalog-pagination" aria-label="Страницы кандзи">
          <button
            className="icon-button"
            aria-label="Назад"
            title="Предыдущая страница"
            disabled={page <= 1}
            onClick={() => onCatalogueChange({ ...catalogue, page: page - 1 })}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span role="status">
            {page} / {pageCount}
          </span>
          <button
            className="icon-button"
            aria-label="Далее"
            title="Следующая страница"
            disabled={page >= pageCount}
            onClick={() => onCatalogueChange({ ...catalogue, page: page + 1 })}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </nav>
      )}

      {items.length === 0 ? (
        <div className="notice-panel">
          <p>По выбранным фильтрам кандзи не найдены.</p>
        </div>
      ) : (
        <ol className="character-hub-kanji-grid" data-view={catalogue.view}>
          {visibleItems.map((item) => (
            <li key={`${item.level}-${item.id}`} data-study-state={item.studyState}>
              <Link href={characterCatalogueItemHref(item.character, catalogueHref)}>
                <JapaneseText className="character-hub-kanji-character" variant="display">
                  {item.character}
                </JapaneseText>
                <div className="character-hub-kanji-copy">
                  <strong>{item.reading ?? "Чтение уточняется"}</strong>
                  <div className="character-hub-meaning-rows">
                    {characterMeaningRows(item, displayMode).map((row) => <span key={row.lang} lang={row.text === null ? 'ru' : row.lang}><small>{row.label}</small><span>{row.text ?? 'Перевод не добавлен'}</span></span>)}
                  </div>
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
                  {item.stageName === null ? null : <span className="catalogue-card-stage" title="Самая ранняя ступень среди начатых карточек материала">Начатые карточки: от {formatSrsStageName(item.stageName)}</span>}
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
      <select
        aria-label={label}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
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

function filtersEqual(left: CharacterHubKanjiFilters, right: CharacterHubKanjiFilters): boolean {
  return (
    left.level === right.level &&
    left.band === right.band &&
    left.jlpt === right.jlpt &&
    left.state === right.state
  );
}
