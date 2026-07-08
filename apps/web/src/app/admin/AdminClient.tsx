"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  type AdminContentStatus,
  type AdminCurriculumCompletenessReportDto,
  type AdminCurationCardDto,
  type AdminCurationItemDto,
  type AdminImportRunSummaryDto,
  type AdminReviewQueueFilters,
  type AdminReviewQueueItemDto,
  SUPPORTED_COURSE_BANDS,
  type CourseBand,
} from "@kanji-srs/shared";

import {
  ApiError,
  getAdminCompletenessReport,
  getAdminCurationItem,
  getAdminImportRuns,
  getAdminReviewQueueWithFilters,
  promoteAdminImportedCandidate,
  updateAdminCardAnswers,
  updateAdminItem,
} from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";

type AdminState =
  | { readonly status: "checking" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "forbidden" }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly queue: readonly AdminReviewQueueItemDto[];
      readonly importRuns: readonly AdminImportRunSummaryDto[];
      readonly report: AdminCurriculumCompletenessReportDto;
      readonly item: AdminCurationItemDto | null;
    };

type AdminFilters = {
  readonly band: "" | CourseBand;
  readonly jlptLevel: "" | "N5" | "N4" | "N3" | "N2";
  readonly status: AdminContentStatus;
  readonly missingAcceptedAnswers: boolean;
  readonly missingMnemonics: boolean;
};

type ItemDraft = {
  readonly status: AdminContentStatus;
  readonly band: "" | CourseBand;
  readonly meaningRu: string;
  readonly meaningEn: string;
  readonly hintRu: string;
  readonly hintEn: string;
  readonly mnemonicRu: string;
  readonly mnemonicEn: string;
};

type CardDraft = {
  readonly acceptedRu: string;
  readonly acceptedEn: string;
  readonly blocked: string;
  readonly blockedReason: string;
};

type PromoteDraft = {
  readonly targetType: "component" | "kanji" | "word" | "sentence";
  readonly targetId: string;
  readonly title: string;
  readonly band: CourseBand;
  readonly level: string;
};

export function AdminClient() {
  const [state, setState] = useState<AdminState>({ status: "checking" });
  const [filters, setFilters] = useState<AdminFilters>(DEFAULT_FILTERS);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(EMPTY_ITEM_DRAFT);
  const [cardDrafts, setCardDrafts] = useState<Record<string, CardDraft>>({});
  const [promoteDraft, setPromoteDraft] = useState<PromoteDraft>(EMPTY_PROMOTE_DRAFT);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const syncDrafts = useCallback((item: AdminCurationItemDto | null) => {
    if (item === null) {
      setItemDraft(EMPTY_ITEM_DRAFT);
      setCardDrafts({});
      return;
    }

    setItemDraft(buildItemDraft(item));
    setCardDrafts(buildCardDrafts(item.cards));
  }, []);

  const loadAdmin = useCallback(async () => {
    const session = readStoredSession();

    if (session === null) {
      setState({ status: "unauthenticated" });
      return;
    }

    if (session.user.role !== "ADMIN") {
      setState({ status: "forbidden" });
      return;
    }

    setState({ status: "loading" });
    setFormError(null);
    setStatusMessage(null);

    try {
      const [queue, importRuns, report] = await Promise.all([
        getAdminReviewQueueWithFilters(session.token, toApiFilters(filters)),
        getAdminImportRuns(session.token),
        getAdminCompletenessReport(session.token),
      ]);
      const firstItem =
        queue.items.length === 0
          ? null
          : await getAdminCurationItem(session.token, queue.items[0].id);

      syncDrafts(firstItem);
      setState({
        status: "ready",
        token: session.token,
        queue: queue.items,
        importRuns: importRuns.importRuns,
        report,
        item: firstItem,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
        return;
      }

      if (error instanceof ApiError && error.status === 403) {
        setState({ status: "forbidden" });
        return;
      }

      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить админку.",
      });
    }
  }, [filters, syncDrafts]);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  const activeItem = state.status === "ready" ? state.item : null;
  const sourceNames = useMemo(() => {
    if (activeItem === null) {
      return "";
    }

    return activeItem.attributions.map((source) => source.sourceName).join(", ");
  }, [activeItem]);

  async function handleSelectItem(itemId: string): Promise<void> {
    if (state.status !== "ready" || savingKey !== null) {
      return;
    }

    setSavingKey(`load:${itemId}`);
    setFormError(null);
    setStatusMessage(null);

    try {
      const item = await getAdminCurationItem(state.token, itemId);
      syncDrafts(item);
      setState({ ...state, item });
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось открыть материал.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveItem(
    event: FormEvent<HTMLFormElement> | null,
    nextStatus?: AdminContentStatus,
  ): Promise<void> {
    event?.preventDefault();

    if (state.status !== "ready" || state.item === null || savingKey !== null) {
      return;
    }

    setSavingKey("item");
    setFormError(null);
    setStatusMessage(null);

    try {
      const item = await updateAdminItem(state.token, state.item.id, {
        status: nextStatus ?? itemDraft.status,
        band: itemDraft.band === "" ? null : itemDraft.band,
        meanings: {
          ru: itemDraft.meaningRu,
          en: itemDraft.meaningEn,
        },
        hints: [
          { locale: "ru-RU", type: "meaning", body: itemDraft.hintRu },
          { locale: "en-US", type: "meaning", body: itemDraft.hintEn },
        ],
        mnemonics: [
          { locale: "ru-RU", type: "story", body: itemDraft.mnemonicRu },
          { locale: "en-US", type: "story", body: itemDraft.mnemonicEn },
        ],
      });

      syncDrafts(item);
      setState({ ...state, item });
      setStatusMessage("Материал сохранён.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить материал.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handlePromoteCandidate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (state.status !== "ready" || savingKey !== null) {
      return;
    }

    const targetId = promoteDraft.targetId.trim();
    const title = promoteDraft.title.trim();
    const levelText = promoteDraft.level.trim();
    const level = levelText === "" ? null : Number(levelText);

    if (targetId === "" || title === "") {
      setFormError("Укажите target ID и название кандидата.");
      return;
    }

    if (level !== null && (!Number.isInteger(level) || level <= 0)) {
      setFormError("Level must be a positive integer.");
      return;
    }

    setSavingKey("promote");
    setFormError(null);
    setStatusMessage(null);

    try {
      const item = await promoteAdminImportedCandidate(state.token, {
        targetType: promoteDraft.targetType,
        targetId,
        title,
        band: promoteDraft.band,
        level,
      });
      const [queue, report] = await Promise.all([
        getAdminReviewQueueWithFilters(state.token, toApiFilters(filters)),
        getAdminCompletenessReport(state.token),
      ]);

      syncDrafts(item);
      setState({ ...state, queue: queue.items, report, item });
      setPromoteDraft(EMPTY_PROMOTE_DRAFT);
      setStatusMessage("Кандидат добавлен в кураторскую очередь.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось продвинуть кандидата.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveCard(card: AdminCurationCardDto): Promise<void> {
    if (state.status !== "ready" || state.item === null || savingKey !== null) {
      return;
    }

    const draft = cardDrafts[card.id] ?? EMPTY_CARD_DRAFT;

    setSavingKey(card.id);
    setFormError(null);
    setStatusMessage(null);

    try {
      const item = await updateAdminCardAnswers(state.token, card.id, {
        acceptedAnswers: [
          ...splitLines(draft.acceptedRu).map((text, index) => ({
            locale: "ru-RU" as const,
            text,
            answerKind: card.answerType,
            isPrimary: index === 0,
          })),
          ...splitLines(draft.acceptedEn).map((text, index) => ({
            locale: "en-US" as const,
            text,
            answerKind: card.answerType,
            isPrimary: index === 0,
          })),
        ],
        blockedAnswers: splitLines(draft.blocked).map((text) => ({
          text,
          reason: draft.blockedReason.trim() === "" ? null : draft.blockedReason.trim(),
        })),
      });

      syncDrafts(item);
      setState({ ...state, item });
      setStatusMessage("Ответы карточки сохранены.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить ответы.");
    } finally {
      setSavingKey(null);
    }
  }

  if (state.status === "checking" || state.status === "loading") {
    return (
      <section className="page-stack" aria-busy="true">
        <div className="page-heading">
          <h1>Админка</h1>
          <p>Загружаю очередь проверки.</p>
        </div>
        <div className="admin-layout">
          <div className="panel skeleton" />
          <div className="panel skeleton" />
        </div>
      </section>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Админка</h1>
          <p>Нужен вход в аккаунт администратора.</p>
        </div>
        <div className="notice-panel">
          <Link className="primary-action" href="/login">
            Войти
          </Link>
        </div>
      </section>
    );
  }

  if (state.status === "forbidden") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Админка</h1>
          <p>Недостаточно прав для редактирования контента.</p>
        </div>
        <div className="notice-panel error-panel">
          <p>Обычный пользователь не может открыть административные экраны.</p>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Админка</h1>
          <p>API недоступен.</p>
        </div>
        <div className="notice-panel error-panel">
          <p>{state.message}</p>
          <button className="secondary-action" onClick={() => void loadAdmin()} type="button">
            Повторить
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <div className="page-heading admin-heading">
        <div>
          <h1>Админка</h1>
          <p>Кураторская правка закрытого учебного контента.</p>
        </div>
        {activeItem === null ? null : (
          <div className="action-row">
            <button
              className="secondary-action"
              disabled={savingKey !== null}
              onClick={() => void handleSaveItem(null, "needs-review")}
              type="button"
            >
              Снять с публикации
            </button>
            <button
              className="primary-action"
              disabled={savingKey !== null}
              onClick={() => void handleSaveItem(null, "published")}
              type="button"
            >
              Опубликовать
            </button>
          </div>
        )}
      </div>

      {statusMessage === null ? null : <p className="success-text">{statusMessage}</p>}
      {formError === null ? null : <p className="form-error">{formError}</p>}

      <section className="panel admin-form" aria-label="Фильтры учебной программы">
        <h2>Фильтры курса</h2>
        <div className="admin-two-column">
          <label>
            Band
            <select
              onChange={(event) => {
                const band = event.currentTarget.value as AdminFilters["band"];
                setFilters((previous) => ({ ...previous, band }));
              }}
              value={filters.band}
            >
              <option value="">Все</option>
              <option value="foundation">Foundation</option>
              <option value="n5">N5</option>
              <option value="n4">N4</option>
              <option value="n3">N3</option>
              <option value="n2">N2</option>
            </select>
          </label>
          <label>
            JLPT
            <select
              onChange={(event) => {
                const jlptLevel = event.currentTarget.value as AdminFilters["jlptLevel"];
                setFilters((previous) => ({ ...previous, jlptLevel }));
              }}
              value={filters.jlptLevel}
            >
              <option value="">Все</option>
              <option value="N5">N5</option>
              <option value="N4">N4</option>
              <option value="N3">N3</option>
              <option value="N2">N2</option>
            </select>
          </label>
        </div>
        <div className="admin-two-column">
          <label>
            Статус
            <select
              onChange={(event) => {
                const status = event.currentTarget.value as AdminContentStatus;
                setFilters((previous) => ({ ...previous, status }));
              }}
              value={filters.status}
            >
              <option value="draft">Черновик</option>
              <option value="needs-review">Нужна проверка</option>
              <option value="published">Опубликовано</option>
              <option value="archived">Архив</option>
            </select>
          </label>
          <div className="admin-filter-flags">
            <label className="checkbox-row">
              <input
                checked={filters.missingAcceptedAnswers}
                onChange={(event) => {
                  const missingAcceptedAnswers = event.currentTarget.checked;
                  setFilters((previous) => ({ ...previous, missingAcceptedAnswers }));
                }}
                type="checkbox"
              />
              Нет правильных ответов
            </label>
            <label className="checkbox-row">
              <input
                checked={filters.missingMnemonics}
                onChange={(event) => {
                  const missingMnemonics = event.currentTarget.checked;
                  setFilters((previous) => ({ ...previous, missingMnemonics }));
                }}
                type="checkbox"
              />
              Нет мнемоник
            </label>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Completeness by band</h2>
        <div className="admin-completeness-grid">
          {state.report.bands.map((band) => (
            <article key={band.band}>
              <strong>{formatBand(band.band)}</strong>
              <dl>
                <div>
                  <dt>Всего</dt>
                  <dd>{band.totalItems}</dd>
                </div>
                <div>
                  <dt>Опубликовано</dt>
                  <dd>{band.publishedItems}</dd>
                </div>
                <div>
                  <dt>Нет ответов</dt>
                  <dd>{band.missingAcceptedAnswers}</dd>
                </div>
                <div>
                  <dt>Нет мнемоник</dt>
                  <dd>{band.missingMnemonics}</dd>
                </div>
                <div>
                  <dt>Нет RU/EN</dt>
                  <dd>{band.missingLocaleCoverage}</dd>
                </div>
                <div>
                  <dt>Связи</dt>
                  <dd>{band.invalidDependencies}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <div className="admin-layout">
        <aside className="panel admin-queue">
          <h2>Нужны правки</h2>
          {state.queue.length === 0 ? (
            <p className="muted">Материалов в очереди проверки нет.</p>
          ) : (
            <ul>
              {state.queue.map((item) => (
                <li key={item.id}>
                  <button
                    aria-current={activeItem?.id === item.id ? "true" : undefined}
                    disabled={savingKey !== null}
                    onClick={() => void handleSelectItem(item.id)}
                    type="button"
                  >
                    <strong>{item.japanese}</strong>
                    <span>{item.title}</span>
                    <small>{formatStatus(item.status)}</small>
                    <small>
                      {formatBand(item.band)} {item.jlptLevel ?? "no JLPT"}
                    </small>
                    <small>{item.qualityIssues.length} quality issue(s)</small>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="admin-import-runs">
            <h2>Import runs</h2>
            {state.importRuns.length === 0 ? (
              <p className="muted">Запусков импорта пока нет.</p>
            ) : (
              <ul className="source-list" data-testid="admin-import-runs">
                {state.importRuns.map((run) => (
                  <li key={run.id}>
                    <strong>{run.dataSourceName}</strong>
                    <span>
                      {formatImportStatus(run.status)} · {run.recordCount} записей
                    </span>
                    <small>{formatImportRunSourceMeta(run)}</small>
                    <p>{run.sourceFileName}</p>
                    <small>{formatImportRunTiming(run)}</small>
                    <small>{run.checksumSha256}</small>
                    <small>{formatImportRunStats(run)}</small>
                    <small>
                      {run.errorText === null ? "Ошибок нет" : `Ошибка: ${run.errorText}`}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form
            className="admin-promote-form"
            onSubmit={(event) => void handlePromoteCandidate(event)}
          >
            <h2>Promote candidate</h2>
            <label>
              Target type
              <select
                onChange={(event) => {
                  const targetType = event.currentTarget.value as PromoteDraft["targetType"];
                  setPromoteDraft((previous) => ({ ...previous, targetType }));
                }}
                value={promoteDraft.targetType}
              >
                <option value="component">Component</option>
                <option value="kanji">Kanji</option>
                <option value="word">Word</option>
                <option value="sentence">Sentence</option>
              </select>
            </label>
            <label>
              Target ID
              <input
                onChange={(event) => {
                  const targetId = event.currentTarget.value;
                  setPromoteDraft((previous) => ({ ...previous, targetId }));
                }}
                value={promoteDraft.targetId}
              />
            </label>
            <label>
              Curated title
              <input
                onChange={(event) => {
                  const title = event.currentTarget.value;
                  setPromoteDraft((previous) => ({ ...previous, title }));
                }}
                value={promoteDraft.title}
              />
            </label>
            <div className="admin-two-column">
              <label>
                Band
                <select
                  onChange={(event) => {
                    const band = event.currentTarget.value as CourseBand;
                    setPromoteDraft((previous) => ({ ...previous, band }));
                  }}
                  value={promoteDraft.band}
                >
                  {SUPPORTED_COURSE_BANDS.map((band) => (
                    <option key={band} value={band}>
                      {formatBand(band)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Level
                <input
                  inputMode="numeric"
                  onChange={(event) => {
                    const level = event.currentTarget.value;
                    setPromoteDraft((previous) => ({ ...previous, level }));
                  }}
                  value={promoteDraft.level}
                />
              </label>
            </div>
            <button className="secondary-action" disabled={savingKey !== null} type="submit">
              Promote
            </button>
          </form>
        </aside>

        {activeItem === null ? (
          <div className="panel">
            <h2>Материал</h2>
            <p className="muted">Выберите item из очереди, когда он появится.</p>
          </div>
        ) : (
          <div className="admin-editor">
            <section className="panel admin-item-header">
              <div>
                <span className="eyebrow">{formatItemType(activeItem.itemType)}</span>
                <h2>{activeItem.japanese}</h2>
                <p>
                  {activeItem.title} · {formatStatus(activeItem.status)}
                </p>
              </div>
              <dl className="stats-list">
                <div>
                  <dt>Чтение</dt>
                  <dd>{activeItem.reading ?? "нет"}</dd>
                </div>
                <div>
                  <dt>Уровень</dt>
                  <dd>{activeItem.level ?? "нет"}</dd>
                </div>
                <div>
                  <dt>Band</dt>
                  <dd>{formatBand(activeItem.band)}</dd>
                </div>
                <div>
                  <dt>JLPT</dt>
                  <dd>{activeItem.jlptLevel ?? "нет"}</dd>
                </div>
                <div>
                  <dt>Обновлено</dt>
                  <dd>{formatDate(activeItem.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            <form className="panel admin-form" onSubmit={(event) => void handleSaveItem(event)}>
              <h2>Значения и подсказки</h2>
              <div className="admin-two-column">
                <label>
                  Статус
                  <select
                    onChange={(event) => {
                      const status = event.currentTarget.value as AdminContentStatus;
                      setItemDraft((previous) => ({ ...previous, status }));
                    }}
                    value={itemDraft.status}
                  >
                    <option value="draft">Черновик</option>
                    <option value="needs-review">Нужна проверка</option>
                    <option value="published">Опубликовано</option>
                    <option value="archived">Архив</option>
                  </select>
                </label>
                <label>
                  Band
                  <select
                    onChange={(event) => {
                      const band = event.currentTarget.value as ItemDraft["band"];
                      setItemDraft((previous) => ({ ...previous, band }));
                    }}
                    value={itemDraft.band}
                  >
                    <option value="">Unset</option>
                    {SUPPORTED_COURSE_BANDS.map((band) => (
                      <option key={band} value={band}>
                        {formatBand(band)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-two-column">
                <label>
                  Значение RU
                  <input
                    data-testid="admin-meaning-ru"
                    onChange={(event) => {
                      const meaningRu = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, meaningRu }));
                    }}
                    value={itemDraft.meaningRu}
                  />
                </label>
                <label>
                  Meaning EN
                  <input
                    data-testid="admin-meaning-en"
                    onChange={(event) => {
                      const meaningEn = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, meaningEn }));
                    }}
                    value={itemDraft.meaningEn}
                  />
                </label>
              </div>
              <div className="admin-two-column">
                <label>
                  Подсказка RU
                  <textarea
                    onChange={(event) => {
                      const hintRu = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, hintRu }));
                    }}
                    value={itemDraft.hintRu}
                  />
                </label>
                <label>
                  Hint EN
                  <textarea
                    onChange={(event) => {
                      const hintEn = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, hintEn }));
                    }}
                    value={itemDraft.hintEn}
                  />
                </label>
              </div>
              <div className="admin-two-column">
                <label>
                  Мнемоника RU
                  <textarea
                    onChange={(event) => {
                      const mnemonicRu = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, mnemonicRu }));
                    }}
                    value={itemDraft.mnemonicRu}
                  />
                </label>
                <label>
                  Mnemonic EN
                  <textarea
                    onChange={(event) => {
                      const mnemonicEn = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, mnemonicEn }));
                    }}
                    value={itemDraft.mnemonicEn}
                  />
                </label>
              </div>
              <button className="primary-action" disabled={savingKey !== null} type="submit">
                Сохранить материал
              </button>
            </form>

            <section className="panel admin-card-list">
              <h2>Ответы карточек</h2>
              {activeItem.cards.map((card) => (
                <article key={card.id}>
                  <div>
                    <h3>
                      {formatPromptType(card.promptType)} · {formatAnswerType(card.answerType)}
                    </h3>
                    <small>Обновлено: {formatDate(card.updatedAt)}</small>
                  </div>
                  <div className="admin-two-column">
                    <label>
                      Accepted RU
                      <textarea
                        data-testid="admin-accepted-ru"
                        onChange={(event) => updateCardDraft(card.id, "acceptedRu", event)}
                        value={cardDrafts[card.id]?.acceptedRu ?? ""}
                      />
                    </label>
                    <label>
                      Accepted EN
                      <textarea
                        data-testid="admin-accepted-en"
                        onChange={(event) => updateCardDraft(card.id, "acceptedEn", event)}
                        value={cardDrafts[card.id]?.acceptedEn ?? ""}
                      />
                    </label>
                  </div>
                  <label>
                    Заблокированные ответы
                    <textarea
                      onChange={(event) => updateCardDraft(card.id, "blocked", event)}
                      value={cardDrafts[card.id]?.blocked ?? ""}
                    />
                  </label>
                  <label>
                    Причина блокировки
                    <input
                      onChange={(event) => updateCardDraft(card.id, "blockedReason", event)}
                      value={cardDrafts[card.id]?.blockedReason ?? ""}
                    />
                  </label>
                  <button
                    className="secondary-action"
                    data-testid="admin-save-card"
                    disabled={savingKey !== null}
                    onClick={() => void handleSaveCard(card)}
                    type="button"
                  >
                    Сохранить ответы
                  </button>
                </article>
              ))}
            </section>

            <div className="admin-side-grid">
              <section className="panel">
                <h2>Quality gates</h2>
                {activeItem.qualityIssues.length === 0 ? (
                  <p className="success-text">Ready to publish.</p>
                ) : (
                  <ul className="quality-list">
                    {activeItem.qualityIssues.map((issue, index) => (
                      <li key={`${issue.code}-${issue.cardId ?? issue.dependencyItemId ?? index}`}>
                        <strong>{formatQualityIssueCode(issue.code)}</strong>
                        <span>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel">
                <h2>Dependencies</h2>
                {activeItem.dependencies.length === 0 ? (
                  <p className="muted">No prerequisites are linked.</p>
                ) : (
                  <ul className="dependency-list">
                    {activeItem.dependencies.map((dependency) => (
                      <li key={dependency.id}>
                        <strong>{dependency.prerequisiteTitle}</strong>
                        <span>
                          {formatDependencyType(dependency.dependencyType)} ·{" "}
                          {formatStatus(dependency.prerequisiteStatus)}
                        </span>
                        <small>
                          {dependency.requiredStage === null
                            ? "No required SRS stage"
                            : `Required SRS stage ${dependency.requiredStage}`}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel">
                <h2>Источники</h2>
                {activeItem.attributions.length === 0 ? (
                  <p className="muted">Источник не указан.</p>
                ) : (
                  <ul className="source-list">
                    {activeItem.attributions.map((source) => (
                      <li key={`${source.sourceName}-${source.licenseName}`}>
                        <strong>{source.sourceName}</strong>
                        <span>{source.licenseName}</span>
                        <p>{source.attributionText}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {sourceNames === "" ? null : <p className="muted">Сводка: {sourceNames}</p>}
              </section>

              <section className="panel">
                <h2>Import runs</h2>
                {activeItem.importRuns.length === 0 ? (
                  <p className="muted">Импорт не связан с материалом.</p>
                ) : (
                  <ul className="source-list">
                    {activeItem.importRuns.map((run) => (
                      <li key={run.id}>
                        <strong>{run.dataSourceName}</strong>
                        <span>
                          {formatImportStatus(run.status)} · {run.recordCount} записей
                        </span>
                        <p>{run.sourceFileName}</p>
                        <small>{formatImportRunSourceMeta(run)}</small>
                        <small>{formatImportRunTiming(run)}</small>
                        <small>{run.checksumSha256}</small>
                        <small>{formatImportRunStats(run)}</small>
                        <small>
                          {run.errorText === null ? "Ошибок нет" : `Ошибка: ${run.errorText}`}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  function updateCardDraft(
    cardId: string,
    field: keyof CardDraft,
    event: { readonly currentTarget: HTMLInputElement | HTMLTextAreaElement },
  ): void {
    const value = event.currentTarget.value;

    setCardDrafts((previous) => ({
      ...previous,
      [cardId]: {
        ...(previous[cardId] ?? EMPTY_CARD_DRAFT),
        [field]: value,
      },
    }));
  }
}

const DEFAULT_FILTERS: AdminFilters = {
  band: "",
  jlptLevel: "",
  status: "needs-review",
  missingAcceptedAnswers: false,
  missingMnemonics: false,
};

const EMPTY_ITEM_DRAFT: ItemDraft = {
  status: "needs-review",
  band: "",
  meaningRu: "",
  meaningEn: "",
  hintRu: "",
  hintEn: "",
  mnemonicRu: "",
  mnemonicEn: "",
};

const EMPTY_CARD_DRAFT: CardDraft = {
  acceptedRu: "",
  acceptedEn: "",
  blocked: "",
  blockedReason: "",
};

const EMPTY_PROMOTE_DRAFT: PromoteDraft = {
  targetType: "word",
  targetId: "",
  title: "",
  band: "n5",
  level: "",
};

function buildItemDraft(item: AdminCurationItemDto): ItemDraft {
  return {
    status: item.status,
    band: item.band ?? "",
    meaningRu: item.meanings.ru,
    meaningEn: item.meanings.en,
    hintRu: findText(item.hints, "ru-RU"),
    hintEn: findText(item.hints, "en-US"),
    mnemonicRu: findText(item.mnemonics, "ru-RU"),
    mnemonicEn: findText(item.mnemonics, "en-US"),
  };
}

function buildCardDrafts(cards: readonly AdminCurationCardDto[]): Record<string, CardDraft> {
  return Object.fromEntries(
    cards.map((card) => [
      card.id,
      {
        acceptedRu: card.acceptedAnswers
          .filter((answer) => answer.locale === "ru-RU")
          .map((answer) => answer.text)
          .join("\n"),
        acceptedEn: card.acceptedAnswers
          .filter((answer) => answer.locale === "en-US")
          .map((answer) => answer.text)
          .join("\n"),
        blocked: card.blockedAnswers.map((answer) => answer.text).join("\n"),
        blockedReason: card.blockedAnswers[0]?.reason ?? "",
      },
    ]),
  );
}

function findText(
  texts: readonly { readonly locale: string; readonly body: string }[],
  locale: "ru-RU" | "en-US",
): string {
  return texts.find((text) => text.locale === locale)?.body ?? "";
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

function toApiFilters(filters: AdminFilters): AdminReviewQueueFilters {
  return {
    ...(filters.band === "" ? {} : { band: filters.band }),
    ...(filters.jlptLevel === "" ? {} : { jlptLevel: filters.jlptLevel }),
    status: filters.status,
    ...(filters.missingAcceptedAnswers
      ? { missingAcceptedAnswers: filters.missingAcceptedAnswers }
      : {}),
    ...(filters.missingMnemonics ? { missingMnemonics: filters.missingMnemonics } : {}),
  };
}

function formatBand(value: CourseBand | null): string {
  switch (value) {
    case "foundation":
      return "Foundation";
    case "n5":
      return "N5";
    case "n4":
      return "N4";
    case "n3":
      return "N3";
    case "n2":
      return "N2";
    default:
      return "Unset";
  }
}

function formatQualityIssueCode(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDependencyType(value: string): string {
  switch (value) {
    case "prerequisite":
      return "Prerequisite";
    case "related":
      return "Related";
    case "unlock":
      return "Unlock";
    default:
      return value;
  }
}

function formatItemType(value: string): string {
  switch (value) {
    case "component":
      return "Компонент";
    case "kanji":
      return "Кандзи";
    case "word":
      return "Слово";
    case "sentence":
      return "Предложение";
    default:
      return value;
  }
}

function formatStatus(value: AdminContentStatus): string {
  switch (value) {
    case "draft":
      return "черновик";
    case "needs-review":
      return "нужна проверка";
    case "published":
      return "опубликовано";
    case "archived":
      return "архив";
  }
}

function formatImportStatus(value: string): string {
  switch (value) {
    case "pending":
      return "ожидает";
    case "success":
      return "успешно";
    case "failed":
      return "ошибка";
    default:
      return value;
  }
}

function formatImportRunStats(run: AdminImportRunSummaryDto): string {
  const entries = Object.entries(run.stats);

  if (entries.length === 0) {
    return "stats: none";
  }

  return entries.map(([key, value]) => `${key}: ${value ?? "null"}`).join(" · ");
}

function formatImportRunSourceMeta(run: AdminImportRunSummaryDto): string {
  return run.sourceVersion === null ? run.licenseName : `${run.licenseName} · ${run.sourceVersion}`;
}

function formatImportRunTiming(run: AdminImportRunSummaryDto): string {
  return run.finishedAt === null
    ? `started: ${formatDate(run.startedAt)}`
    : `${formatDate(run.startedAt)} -> ${formatDate(run.finishedAt)}`;
}

function formatPromptType(value: string): string {
  switch (value) {
    case "meaning":
      return "значение";
    case "reading":
      return "чтение";
    case "recall":
      return "вспоминание";
    case "cloze":
      return "пропуск";
    case "recognition":
      return "узнавание";
    default:
      return value;
  }
}

function formatAnswerType(value: string): string {
  return value === "reading" ? "чтение" : "значение";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
