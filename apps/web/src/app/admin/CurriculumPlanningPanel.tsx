"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type AdminCurriculumCandidatePlanResponse,
  type AdminCurriculumScaleReadinessDto,
  type CourseBand,
} from "@kanji-srs/shared";

import { ApiError, getAdminCandidatePlan, getAdminScaleReadiness } from "../../lib/api-client";

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

export function CurriculumPlanningPanel({ token }: { readonly token: string }) {
  const initializedToken = useRef<string | null>(null);
  const [readiness, setReadiness] =
    useState<ResourceState<AdminCurriculumScaleReadinessDto>>(EMPTY_RESOURCE);
  const [candidatePlan, setCandidatePlan] =
    useState<ResourceState<AdminCurriculumCandidatePlanResponse>>(EMPTY_RESOURCE);
  const [itemType, setItemType] = useState<"kanji" | "word">("kanji");

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
    ) => {
      setItemType(nextItemType);
      setCandidatePlan((previous) => ({
        status: "loading",
        data: previous.data?.page.itemType === nextItemType ? previous.data : null,
        error: null,
      }));

      try {
        const data = await getAdminCandidatePlan(accessToken, {
          itemType: nextItemType,
          offset,
          limit: CANDIDATE_PAGE_LIMIT,
          ...(planVersion === undefined ? {} : { planVersion }),
        });

        if (initializedToken.current !== accessToken) {
          return;
        }

        setCandidatePlan({ status: "ready", data, error: null });
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
    if (initializedToken.current === token) {
      return;
    }

    initializedToken.current = token;
    void loadReadiness(token);
    void loadCandidatePage(token, "kanji", 0);
  }, [loadCandidatePage, loadReadiness, token]);

  const plan = candidatePlan.data;

  return (
    <section className="panel admin-curriculum-planning" aria-label="Масштаб учебного корпуса">
      <header className="admin-planning-header">
        <div>
          <span className="eyebrow">2 300 + 8 000</span>
          <h2>План учебного корпуса</h2>
        </div>
        <button
          className="secondary-action"
          disabled={readiness.status === "loading" || candidatePlan.status === "loading"}
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
              disabled={candidatePlan.status === "loading"}
              onClick={() => void loadCandidatePage(token, "kanji", 0, plan?.planVersion)}
              type="button"
            >
              Кандзи
            </button>
            <button
              aria-pressed={itemType === "word"}
              disabled={candidatePlan.status === "loading"}
              onClick={() => void loadCandidatePage(token, "word", 0, plan?.planVersion)}
              type="button"
            >
              Слова
            </button>
          </div>
        </div>

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
              <p className="muted">На этой странице кандидатов нет.</p>
            ) : (
              <ol className="admin-plan-list">
                {plan.candidates.map((candidate) => (
                  <li key={`${candidate.itemType}:${candidate.targetId}`}>
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
                  </li>
                ))}
              </ol>
            )}

            <div className="admin-plan-pagination">
              <span>
                {formatPageRange(plan)} из {formatNumber(plan.page.total)}
              </span>
              <div className="action-row">
                <button
                  className="secondary-action"
                  disabled={plan.page.offset === 0 || candidatePlan.status === "loading"}
                  onClick={() =>
                    void loadCandidatePage(
                      token,
                      itemType,
                      Math.max(0, plan.page.offset - plan.page.limit),
                      plan.planVersion,
                    )
                  }
                  type="button"
                >
                  Назад
                </button>
                <button
                  className="secondary-action"
                  disabled={!plan.page.hasMore || candidatePlan.status === "loading"}
                  onClick={() =>
                    void loadCandidatePage(
                      token,
                      itemType,
                      plan.page.offset + plan.page.limit,
                      plan.planVersion,
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
      </div>
    </section>
  );
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

function formatPageRange(plan: AdminCurriculumCandidatePlanResponse): string {
  if (plan.page.total === 0) {
    return "0";
  }

  return `${formatNumber(plan.page.offset + 1)}–${formatNumber(
    plan.page.offset + plan.candidates.length,
  )}`;
}
