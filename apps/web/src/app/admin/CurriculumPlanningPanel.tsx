"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  ADMIN_CANDIDATE_PLAN_COVERAGE_FILTERS,
  type AdminCandidatePlanCoverageFilter,
  type AdminCurriculumCandidatePlanItemDto,
  type AdminCurriculumCandidatePlanResponse,
  type AdminCurriculumScaleReadinessDto,
  SUPPORTED_COURSE_BANDS,
  type CourseBand,
} from "@kanji-srs/shared";

import {
  ApiError,
  enqueueAdminCandidatePlan,
  getAdminCandidatePlan,
  getAdminScaleReadiness,
} from "../../lib/api-client";

const CANDIDATE_PAGE_LIMIT = 20;

type ResourceState<T> = {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly data: T | null;
  readonly error: string | null;
};

const EMPTY_RESOURCE = {
  status: "idle",
  data: null,
  error: null,
} as const;

type CurriculumPlanningPanelProps = {
  readonly token: string;
  readonly disabled: boolean;
  readonly refreshRevision: number;
  readonly selectedCandidateKey: string | null;
  readonly onQueueChanged: () => Promise<void>;
  readonly onReviewCandidate: (candidate: AdminCurriculumCandidatePlanItemDto) => Promise<void>;
};

type CandidatePlanViewFilters = {
  readonly search: string | null;
  readonly band: CourseBand | null;
  readonly coverage: AdminCandidatePlanCoverageFilter | null;
};

const EMPTY_CANDIDATE_PLAN_FILTERS: CandidatePlanViewFilters = {
  search: null,
  band: null,
  coverage: null,
};

export function CurriculumPlanningPanel({
  token,
  disabled,
  refreshRevision,
  selectedCandidateKey,
  onQueueChanged,
  onReviewCandidate,
}: CurriculumPlanningPanelProps) {
  const initializedToken = useRef<string | null>(null);
  const initializedRevision = useRef<number | null>(null);
  const currentItemType = useRef<"kanji" | "word">("kanji");
  const currentFilters = useRef<CandidatePlanViewFilters>(EMPTY_CANDIDATE_PLAN_FILTERS);
  const selectPageRef = useRef<HTMLInputElement>(null);
  const [readiness, setReadiness] =
    useState<ResourceState<AdminCurriculumScaleReadinessDto>>(EMPTY_RESOURCE);
  const [candidatePlan, setCandidatePlan] =
    useState<ResourceState<AdminCurriculumCandidatePlanResponse>>(EMPTY_RESOURCE);
  const [itemType, setItemType] = useState<"kanji" | "word">("kanji");
  const [searchDraft, setSearchDraft] = useState("");
  const [bandFilter, setBandFilter] = useState<"" | CourseBand>("");
  const [coverageFilter, setCoverageFilter] = useState<"" | AdminCandidatePlanCoverageFilter>("");
  const [loadingCandidateKey, setLoadingCandidateKey] = useState<string | null>(null);
  const [candidateSelectionError, setCandidateSelectionError] = useState<string | null>(null);
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState<readonly string[]>([]);
  const [enqueuePageKey, setEnqueuePageKey] = useState<string | null>(null);
  const [enqueueStatus, setEnqueueStatus] = useState<"idle" | "submitting">("idle");
  const [enqueueError, setEnqueueError] = useState<string | null>(null);
  const [enqueueFeedback, setEnqueueFeedback] = useState<string | null>(null);

  const loadReadiness = useCallback(async (accessToken: string) => {
    setReadiness((previous) => ({ status: "loading", data: previous.data, error: null }));

    try {
      const data = await getAdminScaleReadiness(accessToken);

      if (initializedToken.current !== accessToken) {
        return;
      }

      setReadiness({ status: "ready", data, error: null });
    } catch (error: unknown) {
      if (initializedToken.current !== accessToken) {
        return;
      }

      setReadiness((previous) => ({
        status: "error",
        data: previous.data,
        error: error instanceof Error ? error.message : "Не удалось загрузить готовность корпуса.",
      }));
    }
  }, []);

  const loadCandidatePage = useCallback(
    async (
      accessToken: string,
      nextItemType: "kanji" | "word",
      offset: number,
      planVersion?: string,
      filters: CandidatePlanViewFilters = currentFilters.current,
    ) => {
      currentItemType.current = nextItemType;
      currentFilters.current = filters;
      setItemType(nextItemType);
      setCandidateSelectionError(null);
      setEnqueuePageKey(null);
      setCandidatePlan((previous) => ({
        status: "loading",
        data:
          previous.data?.page.itemType === nextItemType &&
          sameCandidatePlanFilters(previous.data.page, filters)
            ? previous.data
            : null,
        error: null,
      }));

      try {
        const data = await getAdminCandidatePlan(accessToken, {
          itemType: nextItemType,
          offset,
          limit: CANDIDATE_PAGE_LIMIT,
          ...(planVersion === undefined ? {} : { planVersion }),
          ...(filters.search === null ? {} : { search: filters.search }),
          ...(filters.band === null ? {} : { band: filters.band }),
          ...(filters.coverage === null ? {} : { coverage: filters.coverage }),
        });

        if (initializedToken.current !== accessToken) {
          return;
        }

        setCandidatePlan({ status: "ready", data, error: null });
        setSelectedCandidateKeys(data.candidates.map(candidatePlanItemKey));
      } catch (error: unknown) {
        if (initializedToken.current !== accessToken) {
          return;
        }

        const snapshotExpired = error instanceof ApiError && error.status === 409;

        setCandidatePlan((previous) => ({
          status: "error",
          data: snapshotExpired ? null : previous.data,
          error:
            error instanceof Error ? error.message : "Не удалось загрузить план учебного корпуса.",
        }));
      }
    },
    [],
  );

  useEffect(() => {
    if (initializedToken.current === token && initializedRevision.current === refreshRevision) {
      return;
    }

    const tokenChanged = initializedToken.current !== token;
    initializedToken.current = token;
    initializedRevision.current = refreshRevision;

    if (tokenChanged) {
      currentFilters.current = EMPTY_CANDIDATE_PLAN_FILTERS;
      setSearchDraft("");
      setBandFilter("");
      setCoverageFilter("");
    }

    void loadReadiness(token);
    void loadCandidatePage(token, tokenChanged ? "kanji" : currentItemType.current, 0);
  }, [loadCandidatePage, loadReadiness, refreshRevision, token]);

  const plan = candidatePlan.data;
  const selectedCandidateKeySet = new Set(selectedCandidateKeys);
  const selectedCandidates =
    plan?.candidates.filter((candidate) =>
      selectedCandidateKeySet.has(candidatePlanItemKey(candidate)),
    ) ?? [];
  const allPageCandidatesSelected =
    plan !== null &&
    plan.candidates.length > 0 &&
    selectedCandidates.length === plan.candidates.length;
  const currentSelectionKey =
    plan === null || selectedCandidates.length === 0
      ? null
      : candidatePlanSelectionKey(plan, selectedCandidates);
  const confirmingEnqueue = currentSelectionKey !== null && enqueuePageKey === currentSelectionKey;

  useEffect(() => {
    if (selectPageRef.current !== null) {
      selectPageRef.current.indeterminate =
        selectedCandidates.length > 0 && !allPageCandidatesSelected;
    }
  }, [allPageCandidatesSelected, selectedCandidates.length]);

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const search = searchDraft.trim() || null;
    const filters: CandidatePlanViewFilters = {
      search,
      band: bandFilter === "" ? null : bandFilter,
      coverage: coverageFilter === "" ? null : coverageFilter,
    };

    currentFilters.current = filters;
    setSearchDraft(search ?? "");
    setEnqueuePageKey(null);
    setEnqueueError(null);
    setEnqueueFeedback(null);
    void loadCandidatePage(token, itemType, 0, plan?.planVersion, filters);
  }

  function clearSearch(): void {
    currentFilters.current = EMPTY_CANDIDATE_PLAN_FILTERS;
    setSearchDraft("");
    setBandFilter("");
    setCoverageFilter("");
    setEnqueuePageKey(null);
    setEnqueueError(null);
    setEnqueueFeedback(null);
    void loadCandidatePage(token, itemType, 0, plan?.planVersion, EMPTY_CANDIDATE_PLAN_FILTERS);
  }

  async function handleReviewCandidate(
    candidate: AdminCurriculumCandidatePlanItemDto,
  ): Promise<void> {
    const candidateKey = `${candidate.itemType}:${candidate.targetId}`;

    setLoadingCandidateKey(candidateKey);
    setCandidateSelectionError(null);

    try {
      await onReviewCandidate(candidate);
    } catch (error: unknown) {
      setCandidateSelectionError(
        error instanceof Error ? error.message : "Не удалось открыть исходные данные кандидата.",
      );
    } finally {
      setLoadingCandidateKey(null);
    }
  }

  function openEnqueueConfirmation(): void {
    if (currentSelectionKey === null) {
      return;
    }

    setEnqueueError(null);
    setEnqueueFeedback(null);
    setEnqueuePageKey(currentSelectionKey);
  }

  function toggleCandidateSelection(
    candidate: AdminCurriculumCandidatePlanItemDto,
    checked: boolean,
  ): void {
    const candidateKey = candidatePlanItemKey(candidate);

    setSelectedCandidateKeys((current) =>
      checked
        ? current.includes(candidateKey)
          ? current
          : [...current, candidateKey]
        : current.filter((key) => key !== candidateKey),
    );
    setEnqueuePageKey(null);
    setEnqueueError(null);
  }

  function togglePageSelection(checked: boolean): void {
    setSelectedCandidateKeys(
      checked && plan !== null ? plan.candidates.map(candidatePlanItemKey) : [],
    );
    setEnqueuePageKey(null);
    setEnqueueError(null);
  }

  async function handleEnqueueSelectedCandidates(
    currentPlan: AdminCurriculumCandidatePlanResponse,
    candidates: readonly AdminCurriculumCandidatePlanItemDto[],
  ): Promise<void> {
    if (candidates.length === 0) {
      return;
    }

    setEnqueueStatus("submitting");
    setEnqueueError(null);
    setEnqueueFeedback(null);

    try {
      const result = await enqueueAdminCandidatePlan(token, {
        planVersion: currentPlan.planVersion,
        candidates: candidates.map((candidate) => ({
          itemType: candidate.itemType,
          targetId: candidate.targetId,
        })),
      });

      if (initializedToken.current !== token) {
        return;
      }

      setEnqueuePageKey(null);
      setEnqueueFeedback(formatEnqueueResult(result.enqueuedCount, result.alreadyQueuedCount));
      await Promise.all([
        loadReadiness(token),
        loadCandidatePage(token, currentPlan.page.itemType, 0),
        onQueueChanged(),
      ]);
    } catch (error: unknown) {
      if (initializedToken.current !== token) {
        return;
      }

      const snapshotExpired = error instanceof ApiError && error.status === 409;

      setEnqueueError(
        snapshotExpired
          ? "План изменился. Список кандидатов обновлён, повторите постановку выбранных материалов."
          : error instanceof Error
            ? error.message
            : "Не удалось добавить выбранные материалы в очередь проверки.",
      );

      if (snapshotExpired) {
        setEnqueuePageKey(null);
        await loadCandidatePage(token, currentPlan.page.itemType, 0);
      }
    } finally {
      if (initializedToken.current === token) {
        setEnqueueStatus("idle");
      }
    }
  }

  return (
    <section className="panel admin-curriculum-planning" aria-label="Масштаб учебного корпуса">
      <header className="admin-planning-header">
        <div>
          <span className="eyebrow">2 300 + 8 000</span>
          <h2>План учебного корпуса</h2>
        </div>
        <button
          className="secondary-action"
          disabled={
            readiness.status === "loading" ||
            candidatePlan.status === "loading" ||
            enqueueStatus === "submitting"
          }
          onClick={() => {
            void loadReadiness(token);
            void loadCandidatePage(token, itemType, 0);
          }}
          type="button"
        >
          Обновить
        </button>
      </header>

      <div className="admin-readiness" data-testid="admin-scale-readiness">
        <h3>Готовность источников</h3>
        {readiness.error === null ? null : <p className="form-error">{readiness.error}</p>}
        {readiness.data === null ? (
          <p className="muted" aria-live="polite">
            {readiness.status === "loading" ? "Считаю покрытие корпуса..." : "Данные недоступны."}
          </p>
        ) : (
          <div className="admin-table-scroll" aria-busy={readiness.status === "loading"}>
            <table className="admin-planning-table">
              <thead>
                <tr>
                  <th scope="col">Материал</th>
                  <th scope="col">Цель</th>
                  <th scope="col">Опубликовано</th>
                  <th scope="col">В редактуре</th>
                  <th scope="col">Кандидаты</th>
                  <th scope="col">Дефицит</th>
                  <th scope="col">RU + EN</th>
                  <th scope="col">Чтение</th>
                  <th scope="col">KanjiVG</th>
                </tr>
              </thead>
              <tbody>
                {readiness.data.items.map((item) => (
                  <tr key={item.itemType}>
                    <th scope="row">{formatItemType(item.itemType)}</th>
                    <td>{formatNumber(item.targetItems)}</td>
                    <td>{formatNumber(item.publishedItems)}</td>
                    <td>{formatNumber(item.inCurationItems)}</td>
                    <td>{formatNumber(item.importedCandidates)}</td>
                    <td>{formatNumber(item.capacityShortfall)}</td>
                    <td>{formatNumber(item.candidateCoverage.withBilingualMeanings)}</td>
                    <td>{formatNumber(item.candidateCoverage.withReading)}</td>
                    <td>
                      {item.candidateCoverage.withStrokeData === null
                        ? "не применяется"
                        : formatNumber(item.candidateCoverage.withStrokeData)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-candidate-plan" data-testid="admin-candidate-plan">
        <div className="admin-candidate-plan-heading">
          <h3>Отобранные кандидаты</h3>
          <div className="admin-plan-segment" aria-label="Тип кандидатов" role="group">
            <button
              aria-pressed={itemType === "kanji"}
              disabled={candidatePlan.status === "loading" || enqueueStatus === "submitting"}
              onClick={() => void loadCandidatePage(token, "kanji", 0, plan?.planVersion)}
              type="button"
            >
              Кандзи
            </button>
            <button
              aria-pressed={itemType === "word"}
              disabled={candidatePlan.status === "loading" || enqueueStatus === "submitting"}
              onClick={() => void loadCandidatePage(token, "word", 0, plan?.planVersion)}
              type="button"
            >
              Слова
            </button>
          </div>
        </div>

        <form className="admin-plan-search" onSubmit={handleSearch} role="search">
          <div className="admin-plan-filter-grid">
            <label htmlFor="admin-candidate-plan-search">
              Поиск в плане
              <input
                disabled={
                  disabled ||
                  candidatePlan.status === "loading" ||
                  loadingCandidateKey !== null ||
                  enqueueStatus === "submitting"
                }
                id="admin-candidate-plan-search"
                maxLength={80}
                onChange={(event) => setSearchDraft(event.currentTarget.value)}
                placeholder="Кандзи, слово, чтение или target ID"
                type="search"
                value={searchDraft}
              />
            </label>
            <label>
              Диапазон курса
              <select
                disabled={
                  disabled ||
                  candidatePlan.status === "loading" ||
                  loadingCandidateKey !== null ||
                  enqueueStatus === "submitting"
                }
                onChange={(event) => setBandFilter(event.currentTarget.value as "" | CourseBand)}
                value={bandFilter}
              >
                <option value="">Все</option>
                {SUPPORTED_COURSE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {formatBand(band)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Покрытие данных
              <select
                disabled={
                  disabled ||
                  candidatePlan.status === "loading" ||
                  loadingCandidateKey !== null ||
                  enqueueStatus === "submitting"
                }
                onChange={(event) =>
                  setCoverageFilter(
                    event.currentTarget.value as "" | AdminCandidatePlanCoverageFilter,
                  )
                }
                value={coverageFilter}
              >
                <option value="">Любое</option>
                {ADMIN_CANDIDATE_PLAN_COVERAGE_FILTERS.map((coverage) => (
                  <option key={coverage} value={coverage}>
                    {formatCoverageFilter(coverage)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-plan-filter-actions">
            <button
              className="primary-action"
              disabled={
                disabled ||
                candidatePlan.status === "loading" ||
                loadingCandidateKey !== null ||
                enqueueStatus === "submitting"
              }
              type="submit"
            >
              Применить
            </button>
            {searchDraft === "" &&
            bandFilter === "" &&
            coverageFilter === "" &&
            (plan?.page.search ?? null) === null &&
            (plan?.page.band ?? null) === null &&
            (plan?.page.coverage ?? null) === null ? null : (
              <button
                className="secondary-action"
                disabled={
                  disabled ||
                  candidatePlan.status === "loading" ||
                  loadingCandidateKey !== null ||
                  enqueueStatus === "submitting"
                }
                onClick={clearSearch}
                type="button"
              >
                Сбросить
              </button>
            )}
          </div>
        </form>

        {candidatePlan.error === null ? null : (
          <div className="admin-plan-error">
            <p className="form-error">{candidatePlan.error}</p>
            <button
              className="secondary-action"
              onClick={() => void loadCandidatePage(token, itemType, 0)}
              type="button"
            >
              Начать заново
            </button>
          </div>
        )}

        {candidateSelectionError === null ? null : (
          <p className="form-error" data-testid="admin-plan-candidate-error">
            {candidateSelectionError}
          </p>
        )}

        {enqueueError === null || confirmingEnqueue ? null : (
          <p className="form-error" data-testid="admin-plan-enqueue-error" role="alert">
            {enqueueError}
          </p>
        )}

        {enqueueFeedback === null ? null : (
          <p
            aria-live="polite"
            className="success-text"
            data-testid="admin-plan-enqueue-success"
            role="status"
          >
            {enqueueFeedback}
          </p>
        )}

        {plan === null ? (
          <p className="muted" aria-live="polite">
            {candidatePlan.status === "loading"
              ? "Формирую стабильный план..."
              : "План недоступен."}
          </p>
        ) : (
          <>
            <dl className="admin-plan-summary" aria-busy={candidatePlan.status === "loading"}>
              <div>
                <dt>Уже в курсе</dt>
                <dd>{formatNumber(plan.summary.existingItems[itemType])}</dd>
              </div>
              <div>
                <dt>Отобрано</dt>
                <dd>{formatNumber(plan.summary.selectedItems[itemType])}</dd>
              </div>
              <div>
                <dt>Незаполнено</dt>
                <dd>{formatNumber(plan.summary.unfilledSlots[itemType])}</dd>
              </div>
              <div>
                <dt>Пул ограничен</dt>
                <dd>{plan.summary.poolTruncated[itemType] ? "да" : "нет"}</dd>
              </div>
              <div>
                <dt>{itemType === "word" ? "Слова без кандзи" : "Пул кандидатов"}</dt>
                <dd>
                  {formatNumber(
                    itemType === "word"
                      ? plan.summary.excludedWordsMissingKanji
                      : plan.summary.candidatePool.kanji,
                  )}
                </dd>
              </div>
            </dl>

            <div className="admin-plan-bands" aria-label="Распределение по диапазонам">
              {plan.summary.bands.map((band) => (
                <span key={band.band}>
                  <strong>{formatBand(band.band)}</strong>{" "}
                  {formatNumber(itemType === "kanji" ? band.kanjiItems : band.wordItems)}
                </span>
              ))}
            </div>

            {plan.candidates.length === 0 ? (
              <p className="muted">{formatEmptyCandidatePage(plan)}</p>
            ) : (
              <>
                <div className="admin-plan-batch-action">
                  <div>
                    <label className="checkbox-row admin-plan-select-page">
                      <input
                        aria-label="Выбрать всю страницу"
                        checked={allPageCandidatesSelected}
                        disabled={
                          disabled ||
                          candidatePlan.status === "loading" ||
                          loadingCandidateKey !== null ||
                          enqueueStatus === "submitting"
                        }
                        onChange={(event) => togglePageSelection(event.currentTarget.checked)}
                        ref={selectPageRef}
                        type="checkbox"
                      />
                      <strong>Выбрать всю страницу</strong>
                    </label>
                    <span>
                      Выбрано {formatNumber(selectedCandidates.length)} из{" "}
                      {formatNumber(plan.candidates.length)}
                      {" · "}Всего найдено: {formatNumber(plan.page.total)}
                    </span>
                  </div>
                  <button
                    className="primary-action"
                    data-testid="admin-plan-enqueue-page"
                    disabled={
                      disabled ||
                      selectedCandidates.length === 0 ||
                      candidatePlan.status === "loading" ||
                      loadingCandidateKey !== null ||
                      enqueueStatus === "submitting"
                    }
                    onClick={openEnqueueConfirmation}
                    type="button"
                  >
                    Добавить выбранное в очередь
                  </button>
                </div>

                <ol className="admin-plan-list">
                  {plan.candidates.map((candidate) => (
                    <li
                      data-selected={
                        selectedCandidateKey === `${candidate.itemType}:${candidate.targetId}`
                      }
                      key={`${candidate.itemType}:${candidate.targetId}`}
                    >
                      <label className="admin-plan-select-candidate">
                        <input
                          aria-label={`Выбрать ${candidate.japanese}`}
                          checked={selectedCandidateKeySet.has(candidatePlanItemKey(candidate))}
                          disabled={
                            disabled ||
                            candidatePlan.status === "loading" ||
                            loadingCandidateKey !== null ||
                            enqueueStatus === "submitting"
                          }
                          onChange={(event) =>
                            toggleCandidateSelection(candidate, event.currentTarget.checked)
                          }
                          type="checkbox"
                        />
                      </label>
                      <span className="admin-plan-rank">#{candidate.selectionRank}</span>
                      <span className="admin-plan-japanese">{candidate.japanese}</span>
                      <span>{candidate.reading ?? "без чтения"}</span>
                      <span>{formatBand(candidate.suggestedBand)}</span>
                      <span>score {candidate.score}</span>
                      <small>{formatCoverage(candidate.coverage)}</small>
                      <small>
                        {candidate.sourceName}
                        {candidate.prerequisiteKanji.length === 0
                          ? ""
                          : ` · Кандзи: ${candidate.prerequisiteKanji.join("、")}`}
                      </small>
                      <button
                        aria-label={`Проверить ${candidate.japanese}`}
                        className="secondary-action admin-plan-review"
                        disabled={
                          disabled ||
                          candidatePlan.status === "loading" ||
                          loadingCandidateKey !== null ||
                          enqueueStatus === "submitting"
                        }
                        onClick={() => void handleReviewCandidate(candidate)}
                        type="button"
                      >
                        {loadingCandidateKey === `${candidate.itemType}:${candidate.targetId}`
                          ? "Загрузка..."
                          : "Проверить"}
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            )}

            <div className="admin-plan-pagination">
              <span>
                {formatPageRange(plan)} из {formatNumber(plan.page.total)}
              </span>
              <div className="action-row">
                <button
                  className="secondary-action"
                  disabled={
                    plan.page.offset === 0 ||
                    candidatePlan.status === "loading" ||
                    enqueueStatus === "submitting"
                  }
                  onClick={() =>
                    void loadCandidatePage(
                      token,
                      itemType,
                      Math.max(0, plan.page.offset - plan.page.limit),
                      plan.planVersion,
                      candidatePlanFiltersFromPage(plan),
                    )
                  }
                  type="button"
                >
                  Назад
                </button>
                <button
                  className="secondary-action"
                  disabled={
                    !plan.page.hasMore ||
                    candidatePlan.status === "loading" ||
                    enqueueStatus === "submitting"
                  }
                  onClick={() =>
                    void loadCandidatePage(
                      token,
                      itemType,
                      plan.page.offset + plan.page.limit,
                      plan.planVersion,
                      candidatePlanFiltersFromPage(plan),
                    )
                  }
                  type="button"
                >
                  Далее
                </button>
              </div>
            </div>
          </>
        )}

        {confirmingEnqueue && plan !== null ? (
          <CandidatePageEnqueueDialog
            busy={enqueueStatus === "submitting"}
            count={selectedCandidates.length}
            error={enqueueError}
            onCancel={() => {
              setEnqueueError(null);
              setEnqueuePageKey(null);
            }}
            onConfirm={() => void handleEnqueueSelectedCandidates(plan, selectedCandidates)}
          />
        ) : null}
      </div>
    </section>
  );
}

function CandidatePageEnqueueDialog({
  busy,
  count,
  error,
  onCancel,
  onConfirm,
}: {
  readonly busy: boolean;
  readonly count: number;
  readonly error: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

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

      const buttons = [
        ...dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      ];
      const firstButton = buttons[0];
      const lastButton = buttons.at(-1);

      if (firstButton === undefined || lastButton === undefined) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        firstButton.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="dialog-backdrop">
      <section
        aria-describedby="candidate-page-enqueue-description"
        aria-labelledby="candidate-page-enqueue-title"
        aria-modal="true"
        className="confirmation-dialog admin-plan-enqueue-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="candidate-page-enqueue-title">Добавить выбранное в очередь?</h2>
        <p id="candidate-page-enqueue-description">
          Выбрано кандидатов: {formatNumber(count)}. Будут созданы только материалы со статусом
          «Нужна проверка». Существующая редакторская работа не изменится, карточки и переводы
          автоматически не создаются.
        </p>
        {error === null ? null : (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
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
          <button className="primary-action" disabled={busy} onClick={onConfirm} type="button">
            {busy ? "Добавляю..." : "Добавить в очередь"}
          </button>
        </div>
      </section>
    </div>
  );
}

function candidatePlanPageKey(plan: AdminCurriculumCandidatePlanResponse): string {
  return JSON.stringify([
    plan.planVersion,
    plan.page.itemType,
    plan.page.search,
    plan.page.band,
    plan.page.coverage,
    plan.page.offset,
  ]);
}

function candidatePlanSelectionKey(
  plan: AdminCurriculumCandidatePlanResponse,
  candidates: readonly AdminCurriculumCandidatePlanItemDto[],
): string {
  return JSON.stringify([candidatePlanPageKey(plan), candidates.map(candidatePlanItemKey)]);
}

function candidatePlanItemKey(candidate: AdminCurriculumCandidatePlanItemDto): string {
  return `${candidate.itemType}:${candidate.targetId}`;
}

function sameCandidatePlanFilters(
  page: AdminCurriculumCandidatePlanResponse["page"],
  filters: CandidatePlanViewFilters,
): boolean {
  return (
    page.search === filters.search &&
    page.band === filters.band &&
    page.coverage === filters.coverage
  );
}

function candidatePlanFiltersFromPage(
  plan: AdminCurriculumCandidatePlanResponse,
): CandidatePlanViewFilters {
  return {
    search: plan.page.search,
    band: plan.page.band,
    coverage: plan.page.coverage,
  };
}

function formatEmptyCandidatePage(plan: AdminCurriculumCandidatePlanResponse): string {
  if (plan.page.search !== null) {
    return `По запросу «${plan.page.search}» кандидаты не найдены.`;
  }

  if (plan.page.band !== null || plan.page.coverage !== null) {
    return "По выбранным фильтрам кандидаты не найдены.";
  }

  return "На этой странице кандидатов нет.";
}

function formatEnqueueResult(enqueuedCount: number, alreadyQueuedCount: number): string {
  return `Добавлено в очередь: ${formatNumber(enqueuedCount)}. Уже находились в очереди: ${formatNumber(alreadyQueuedCount)}.`;
}

function formatItemType(itemType: "kanji" | "word"): string {
  return itemType === "kanji" ? "Кандзи" : "Слова";
}

function formatBand(band: CourseBand): string {
  return band === "foundation" ? "Foundation" : band.toUpperCase();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatCoverage(
  coverage: AdminCurriculumCandidatePlanResponse["candidates"][number]["coverage"],
): string {
  return [
    coverage.russianMeaning ? "RU" : "нет RU",
    coverage.englishMeaning ? "EN" : "нет EN",
    coverage.reading ? "чтение" : "нет чтения",
    coverage.strokeData === null ? null : coverage.strokeData ? "KanjiVG" : "нет KanjiVG",
  ]
    .filter((value): value is string => value !== null)
    .join(" · ");
}

function formatCoverageFilter(coverage: AdminCandidatePlanCoverageFilter): string {
  switch (coverage) {
    case "bilingual":
      return "Есть RU + EN";
    case "missing-russian":
      return "Нет русского значения";
    case "missing-english":
      return "Нет английского значения";
    case "missing-reading":
      return "Нет чтения";
    case "missing-stroke-data":
      return "Нет порядка черт";
  }
}

function formatPageRange(plan: AdminCurriculumCandidatePlanResponse): string {
  if (plan.page.total === 0) {
    return "0";
  }

  return `${formatNumber(plan.page.offset + 1)}–${formatNumber(
    plan.page.offset + plan.candidates.length,
  )}`;
}
