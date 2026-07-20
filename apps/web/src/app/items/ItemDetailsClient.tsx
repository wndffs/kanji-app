"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  getContentLocalesForDisplayMode,
  type CardAnswerType,
  type ConfusablePairSummaryDto,
  type ContentLocale,
  type ItemDetails,
  type LearningCardDto,
  type LocalizedTextDto,
  type TranslationBundleDto,
  type TranslationDisplayMode,
  type UserOverrideDto,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import {
  addPrivateAcceptedAnswer,
  ApiError,
  deletePrivateAcceptedAnswer,
  deletePrivateMnemonic,
  getItemDetails,
  getItemReviewHistory,
  getConfusablePairs,
  getKanjiDetails,
  savePrivateMnemonic,
} from "../../lib/api-client";
import {
  clearStoredSession,
  readStoredSession,
  readTranslationDisplayMode,
} from "../../lib/auth-storage";
import { formatSrsStageName } from "../../lib/dashboard-format";
import { safeExternalUrl } from "../../lib/safe-url";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";

type ItemLookup =
  | { readonly type: "item"; readonly value: string }
  | { readonly type: "kanji"; readonly value: string };

type ItemState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly item: ItemDetails;
      readonly token: string | null;
      readonly displayMode: TranslationDisplayMode;
      readonly timezone: string;
    };

type AcceptedAnswerFormState = {
  readonly cardId: string;
  readonly answerKind: CardAnswerType;
  readonly locale: ContentLocale;
  readonly text: string;
  readonly note: string;
  readonly editingOverride: UserOverrideDto | null;
};

type MnemonicFormState = {
  readonly locale: ContentLocale;
  readonly mnemonicType: "meaning" | "reading" | "story";
  readonly body: string;
};

const EMPTY_ACCEPTED_FORM: AcceptedAnswerFormState = {
  cardId: "",
  answerKind: "meaning",
  locale: "ru-RU",
  text: "",
  note: "",
  editingOverride: null,
};

const EMPTY_MNEMONIC_FORM: MnemonicFormState = {
  locale: "ru-RU",
  mnemonicType: "story",
  body: "",
};

export function ItemDetailsClient({ lookup }: { readonly lookup: ItemLookup }) {
  const liveDisplayMode = useTranslationDisplayMode();
  const [state, setState] = useState<ItemState>({ status: "loading" });
  const [acceptedForm, setAcceptedForm] = useState<AcceptedAnswerFormState>(EMPTY_ACCEPTED_FORM);
  const [mnemonicForm, setMnemonicForm] = useState<MnemonicFormState>(EMPTY_MNEMONIC_FORM);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingAcceptedAnswer, setIsSavingAcceptedAnswer] = useState(false);
  const [isSavingMnemonic, setIsSavingMnemonic] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [confusablePairs, setConfusablePairs] = useState<readonly ConfusablePairSummaryDto[]>([]);

  const loadItem = useCallback(async () => {
    const storedSession = readStoredSession();
    const token = storedSession?.token ?? null;
    const displayMode =
      storedSession?.user.settings.translationDisplayMode ?? readTranslationDisplayMode();
    const timezone =
      storedSession?.user.settings.timezone ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      "UTC";

    setState({ status: "loading" });
    setStatusMessage(null);
    setFormError(null);
    setConfusablePairs([]);

    try {
      const item =
        lookup.type === "kanji"
          ? await getKanjiDetails(lookup.value, token)
          : await getItemDetails(lookup.value, token);

      setState({
        status: "ready",
        item,
        token,
        displayMode,
        timezone,
      });
      if (token !== null && item.itemType === "kanji") {
        try {
          setConfusablePairs((await getConfusablePairs(token, item.id)).pairs);
        } catch {
          setConfusablePairs([]);
        }
      }
      setAcceptedForm((previous) => resolveAcceptedFormDefaults(previous, item));
      setMnemonicForm((previous) => resolveMnemonicFormDefaults(previous, item, displayMode));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
      }

      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить материал.",
      });
    }
  }, [lookup.type, lookup.value]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  const editableCards = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }

    return state.item.cards.filter((card) => card.answerType === acceptedForm.answerKind);
  }, [acceptedForm.answerKind, state]);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    if (
      acceptedForm.cardId !== "" &&
      state.item.cards.some((card) => card.id === acceptedForm.cardId)
    ) {
      return;
    }

    setAcceptedForm((previous) => resolveAcceptedFormDefaults(previous, state.item));
  }, [acceptedForm.cardId, state]);

  async function handleSaveAcceptedAnswer(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (state.status !== "ready" || state.token === null || isSavingAcceptedAnswer) {
      return;
    }

    const text = acceptedForm.text.trim();
    const card = state.item.cards.find((candidate) => candidate.id === acceptedForm.cardId);

    if (card === undefined) {
      setFormError("Выберите карточку для приватного ответа.");
      return;
    }

    if (text === "") {
      setFormError("Введите приватный вариант ответа.");
      return;
    }

    setIsSavingAcceptedAnswer(true);
    setFormError(null);
    setStatusMessage(null);

    try {
      if (acceptedForm.editingOverride !== null) {
        await deletePrivateAcceptedAnswer(
          state.token,
          acceptedForm.editingOverride.learningCardId,
          acceptedForm.editingOverride.id,
        );
      }

      await addPrivateAcceptedAnswer(state.token, card.id, {
        answerKind: card.answerType,
        text,
        locale: acceptedForm.locale,
        note: acceptedForm.note.trim() === "" ? null : acceptedForm.note.trim(),
      });
      setAcceptedForm(resolveAcceptedFormDefaults(EMPTY_ACCEPTED_FORM, state.item));
      await loadItem();
      setStatusMessage("Приватный ответ сохранён.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить ответ.");
    } finally {
      setIsSavingAcceptedAnswer(false);
    }
  }

  async function handleDeleteAcceptedAnswer(override: UserOverrideDto): Promise<void> {
    if (state.status !== "ready" || state.token === null) {
      return;
    }

    setFormError(null);
    setStatusMessage(null);

    try {
      await deletePrivateAcceptedAnswer(state.token, override.learningCardId, override.id);
      await loadItem();
      setStatusMessage("Приватный ответ удалён.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось удалить ответ.");
    }
  }

  function handleEditAcceptedAnswer(override: UserOverrideDto): void {
    const card = state.status === "ready" ? findCardForOverride(state.item.cards, override) : null;

    setAcceptedForm({
      cardId: override.learningCardId,
      answerKind: card?.answerType ?? "meaning",
      locale: override.locale,
      text: override.text,
      note: override.note ?? "",
      editingOverride: override,
    });
    setStatusMessage(null);
    setFormError(null);
  }

  async function handleSaveMnemonic(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (state.status !== "ready" || state.token === null || isSavingMnemonic) {
      return;
    }

    const body = mnemonicForm.body.trim();

    if (body === "") {
      setFormError("Введите приватную заметку.");
      return;
    }

    setIsSavingMnemonic(true);
    setFormError(null);
    setStatusMessage(null);

    try {
      await savePrivateMnemonic(state.token, state.item.id, {
        locale: mnemonicForm.locale,
        mnemonicType: mnemonicForm.mnemonicType,
        body,
      });
      await loadItem();
      setStatusMessage("Приватная заметка сохранена.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить заметку.");
    } finally {
      setIsSavingMnemonic(false);
    }
  }

  async function handleDeleteMnemonic(): Promise<void> {
    if (state.status !== "ready" || state.token === null) {
      return;
    }

    setFormError(null);
    setStatusMessage(null);

    try {
      await deletePrivateMnemonic(state.token, state.item.id, {
        locale: mnemonicForm.locale,
        mnemonicType: mnemonicForm.mnemonicType,
      });
      setMnemonicForm({ ...mnemonicForm, body: "" });
      await loadItem();
      setStatusMessage("Приватная заметка удалена.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось удалить заметку.");
    }
  }

  async function handleLoadHistory(): Promise<void> {
    if (
      state.status !== "ready" ||
      state.token === null ||
      state.item.reviewHistory.nextCursor === null ||
      isLoadingHistory
    ) {
      return;
    }

    setIsLoadingHistory(true);
    setFormError(null);

    try {
      const page = await getItemReviewHistory(
        state.item.id,
        state.item.reviewHistory.nextCursor,
        state.token,
      );

      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              item: {
                ...current.item,
                reviewHistory: {
                  items: [...current.item.reviewHistory.items, ...page.items],
                  nextCursor: page.nextCursor,
                },
              },
            },
      );
    } catch (error: unknown) {
      setFormError(
        error instanceof Error ? error.message : "Не удалось загрузить историю повторений.",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  if (state.status === "loading") {
    return (
      <section className="page-stack" aria-busy="true">
        <div className="page-heading">
          <h1>Материал</h1>
          <p>Загружаю карточку.</p>
        </div>
        <div className="item-layout" aria-hidden="true">
          <div className="panel skeleton" />
          <div className="panel skeleton" />
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Материал</h1>
          <p>Не удалось открыть страницу.</p>
        </div>
        <div className="notice-panel error-panel">
          <p role="alert">{state.message}</p>
          <button className="secondary-action" onClick={() => void loadItem()} type="button">
            Повторить загрузку
          </button>
        </div>
      </section>
    );
  }

  const { item, token, timezone } = state;
  const displayMode = liveDisplayMode;
  const readingCards = item.cards.filter((card) => card.answerType === "reading");
  const privateOverrides = item.userOverrides.filter(
    (override) => override.kind === "accepted-answer",
  );
  const userMnemonicTexts = getLocalizedTexts(item.mnemonics, displayMode).filter(
    (text) => text.sourceKind === "user",
  );

  return (
    <section className="item-page">
      <header className="item-hero panel">
        <div className="item-hero-main">
          <span className="eyebrow">{formatItemType(item.itemType)}</span>
          <JapaneseText
            as="h1"
            className="review-japanese"
            variant={item.itemType === "sentence" ? "sentence" : "display"}
          >
            {item.japanese}
          </JapaneseText>
          <p>{formatTranslationBundle(item.translations, displayMode)}</p>
        </div>
        <dl className="lesson-facts">
          <div>
            <dt>Чтение</dt>
            <dd>{item.reading ?? "нет"}</dd>
          </div>
          <div>
            <dt>Уровень</dt>
            <dd>{item.level ?? "без уровня"}</dd>
          </div>
          <div>
            <dt>JLPT</dt>
            <dd>{item.jlptLevel ?? "нет"}</dd>
          </div>
          <div>
            <dt>Повторения</dt>
            <dd>{formatSrsStageName(item.srs?.stageName)}</dd>
          </div>
          <div>
            <dt>Следующее повторение</dt>
            <dd>{formatReviewSchedule(item.nextReviewAt, timezone)}</dd>
          </div>
        </dl>
      </header>

      {statusMessage === null ? null : <p className="success-text">{statusMessage}</p>}
      {formError === null ? null : (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      {item.srs?.leech?.isCandidate ? <LeechNotice item={item} /> : null}
      {item.itemType === "kanji" && token !== null ? (
        <section className="panel item-confusable-panel">
          <div>
            <span className="eyebrow">Отдельная практика</span>
            <h2>Похожие кандзи</h2>
          </div>
          <div className="item-confusable-links">
            {confusablePairs.slice(0, 3).map((pair) => (
              <Link
                className="secondary-action"
                href={`/practice/confusables?pairId=${encodeURIComponent(pair.id)}`}
                key={pair.id}
              >
                {pair.kanji[0].character} / {pair.kanji[1].character}
              </Link>
            ))}
            <Link
              className={confusablePairs.length === 0 ? "secondary-action" : "inline-link"}
              href={`/practice/confusables?itemId=${encodeURIComponent(item.id)}`}
            >
              {confusablePairs.length === 0 ? "Найти пары" : "Все пары"}
            </Link>
          </div>
        </section>
      ) : null}

      <div className="item-layout">
        <main className="item-main">
          <section className="panel">
            <h2>Значения</h2>
            <TextList texts={getLocalizedTexts(item.translations, displayMode)} />
          </section>

          {item.componentDetails === null ? null : (
            <section className="panel" data-testid="component-details">
              <h2>Компонент</h2>
              <dl className="lesson-facts">
                <div>
                  <dt>Учебное имя</dt>
                  <dd>{formatTranslationBundle(item.componentDetails.name, displayMode)}</dd>
                </div>
                <div>
                  <dt>Описание формы</dt>
                  <dd>
                    {formatTranslationBundle(item.componentDetails.shapeDescription, displayMode)}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <ItemReadingDetails displayMode={displayMode} item={item} readingCards={readingCards} />

          <section className="panel">
            <h2>Глобальные ответы</h2>
            <CardAnswerList cards={item.cards} displayMode={displayMode} />
          </section>

          <SrsHistory
            history={item.reviewHistory}
            isLoading={isLoadingHistory}
            nextReviewAt={item.nextReviewAt}
            onLoadMore={handleLoadHistory}
            stageName={item.srs?.stageName ?? null}
            timezone={timezone}
          />

          <RelationGroups
            displayMode={displayMode}
            groups={item.relationGroups}
            legacyRelations={item.relations}
          />

          <section className="panel">
            <h2>Примеры</h2>
            {item.exampleSentences.length === 0 ? (
              <p className="muted">Примеры для этого материала пока не добавлены.</p>
            ) : (
              <ul className="example-list">
                {item.exampleSentences.map((sentence) => (
                  <li key={sentence.id}>
                    <JapaneseText variant="sentence">{sentence.japaneseText}</JapaneseText>
                    {sentence.readingText === null ? null : <small>{sentence.readingText}</small>}
                    <p>{formatSentenceTranslation(sentence, displayMode)}</p>
                    {sentence.attribution === null ? null : (
                      <SourceAttribution source={sentence.attribution} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>Мнемоники и подсказки</h2>
            <ContentBlock
              title="Мнемоники"
              texts={getLocalizedTexts(item.mnemonics, displayMode)}
            />
            <ContentBlock title="Подсказки" texts={getLocalizedTexts(item.hints, displayMode)} />
          </section>

          <section className="panel">
            <h2>Источники</h2>
            {item.attributions.length === 0 ? (
              <p className="muted">Источник для этого материала пока не указан.</p>
            ) : (
              <ul className="source-list">
                {item.attributions.map((source, index) => {
                  const sourceUrl = safeExternalUrl(source.sourceUrl);

                  return (
                    <li key={`${source.sourceName}-${index}`}>
                      <strong>{source.sourceName}</strong>
                      <span>{source.licenseName}</span>
                      <p>{source.attributionText}</p>
                      {sourceUrl === null ? null : (
                        <a className="inline-link" href={sourceUrl} rel="noreferrer">
                          Открыть источник
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </main>

        <aside className="item-side">
          {item.itemType === "kanji" ? (
            <section className="panel stroke-placeholder">
              <h2>Порядок черт</h2>
              {item.strokeGraphic === null ? (
                <StrokePlaceholder character={item.japanese} />
              ) : (
                <KanjiStrokeGraphic character={item.japanese} graphic={item.strokeGraphic} />
              )}
            </section>
          ) : null}

          <section className="panel">
            <h2>Приватные ответы</h2>
            {token === null ? (
              <p className="muted">Войдите, чтобы добавить личные варианты ответа.</p>
            ) : (
              <>
                <form
                  className="private-item-form"
                  data-testid="private-answer-form"
                  onSubmit={(event) => void handleSaveAcceptedAnswer(event)}
                >
                  <label>
                    <span>Тип</span>
                    <select
                      onChange={(event) => {
                        const answerKind = event.currentTarget.value as CardAnswerType;

                        setAcceptedForm((previous) =>
                          resolveAcceptedFormDefaults(
                            {
                              ...previous,
                              answerKind,
                              cardId: "",
                              editingOverride: null,
                            },
                            item,
                          ),
                        );
                      }}
                      value={acceptedForm.answerKind}
                    >
                      <option value="meaning">Значение</option>
                      <option value="reading">Чтение</option>
                    </select>
                  </label>
                  <label>
                    <span>Карточка</span>
                    <select
                      onChange={(event) => {
                        const cardId = event.currentTarget.value;

                        setAcceptedForm((previous) => ({
                          ...previous,
                          cardId,
                        }));
                      }}
                      value={acceptedForm.cardId}
                    >
                      {editableCards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {formatPromptType(card.promptType)} · {formatAnswerType(card.answerType)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {acceptedForm.answerKind === "reading" ? (
                    <p className="muted">
                      Чтения сохраняются как японские варианты без метки RU/EN.
                    </p>
                  ) : (
                    <label>
                      <span>Язык</span>
                      <select
                        onChange={(event) => {
                          const locale = event.currentTarget.value as ContentLocale;

                          setAcceptedForm((previous) => ({
                            ...previous,
                            locale,
                          }));
                        }}
                        value={acceptedForm.locale}
                      >
                        <option value="ru-RU">Русский</option>
                        <option value="en-US">English</option>
                      </select>
                    </label>
                  )}
                  <label>
                    <span>Ответ</span>
                    <input
                      data-testid="private-answer-text"
                      onChange={(event) => {
                        const text = event.currentTarget.value;

                        setAcceptedForm((previous) => ({
                          ...previous,
                          text,
                        }));
                      }}
                      value={acceptedForm.text}
                    />
                  </label>
                  <label>
                    <span>Заметка</span>
                    <input
                      aria-label="Заметка к приватному ответу"
                      data-testid="private-answer-note"
                      onChange={(event) => {
                        const note = event.currentTarget.value;

                        setAcceptedForm((previous) => ({
                          ...previous,
                          note,
                        }));
                      }}
                      value={acceptedForm.note}
                    />
                  </label>
                  <button
                    className="secondary-action"
                    data-testid="private-answer-submit"
                    disabled={isSavingAcceptedAnswer}
                    type="submit"
                  >
                    {acceptedForm.editingOverride === null ? "Добавить ответ" : "Сохранить ответ"}
                  </button>
                </form>
                <PrivateOverridesList
                  cards={item.cards}
                  overrides={privateOverrides}
                  onDelete={handleDeleteAcceptedAnswer}
                  onEdit={handleEditAcceptedAnswer}
                />
              </>
            )}
          </section>

          <section className="panel">
            <h2>Приватная заметка</h2>
            {token === null ? (
              <p className="muted">Войдите, чтобы сохранить личную мнемонику или заметку.</p>
            ) : (
              <>
                <form
                  className="private-item-form"
                  data-testid="private-mnemonic-form"
                  onSubmit={(event) => void handleSaveMnemonic(event)}
                >
                  <label>
                    <span>Язык</span>
                    <select
                      onChange={(event) => {
                        const locale = event.currentTarget.value as ContentLocale;

                        setMnemonicForm((previous) => ({
                          ...previous,
                          locale,
                        }));
                      }}
                      value={mnemonicForm.locale}
                    >
                      <option value="ru-RU">Русский</option>
                      <option value="en-US">English</option>
                    </select>
                  </label>
                  <label>
                    <span>Тип</span>
                    <select
                      onChange={(event) => {
                        const mnemonicType = event.currentTarget
                          .value as MnemonicFormState["mnemonicType"];

                        setMnemonicForm((previous) => ({
                          ...previous,
                          mnemonicType,
                        }));
                      }}
                      value={mnemonicForm.mnemonicType}
                    >
                      <option value="story">Заметка</option>
                      <option value="meaning">Мнемоника значения</option>
                      <option value="reading">Мнемоника чтения</option>
                    </select>
                  </label>
                  <label>
                    <span>Текст</span>
                    <textarea
                      aria-label="Текст приватной заметки"
                      data-testid="private-mnemonic-body"
                      onChange={(event) => {
                        const body = event.currentTarget.value;

                        setMnemonicForm((previous) => ({
                          ...previous,
                          body,
                        }));
                      }}
                      value={mnemonicForm.body}
                    />
                  </label>
                  <div className="action-row">
                    <button
                      className="secondary-action"
                      data-testid="private-mnemonic-submit"
                      disabled={isSavingMnemonic}
                      type="submit"
                    >
                      Сохранить заметку
                    </button>
                    <button
                      className="secondary-action"
                      onClick={() => void handleDeleteMnemonic()}
                      type="button"
                    >
                      Удалить заметку
                    </button>
                  </div>
                </form>
                {userMnemonicTexts.length === 0 ? (
                  <p className="muted">Личных заметок пока нет.</p>
                ) : (
                  <TextList texts={userMnemonicTexts} />
                )}
              </>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function LeechNotice({ item }: { readonly item: ItemDetails }) {
  const leech = item.srs?.leech;

  if (leech === undefined || leech === null || !leech.isCandidate) {
    return null;
  }

  return (
    <section className="notice-panel leech-notice" data-testid="item-leech-notice">
      <div>
        <strong>Карточка требует внимания</strong>
        <p>Балл {leech.score}. Пересмотрите мнемонику и личную заметку перед следующей сессией.</p>
      </div>
      <p>{formatLeechReasons(leech.reasons)}</p>
    </section>
  );
}

function resolveAcceptedFormDefaults(
  form: AcceptedAnswerFormState,
  item: ItemDetails,
): AcceptedAnswerFormState {
  const card =
    item.cards.find((candidate) => candidate.id === form.cardId) ??
    item.cards.find((candidate) => candidate.answerType === form.answerKind) ??
    item.cards[0];

  if (card === undefined) {
    return form;
  }

  return {
    ...form,
    cardId: card.id,
    answerKind: card.answerType,
  };
}

function resolveMnemonicFormDefaults(
  form: MnemonicFormState,
  item: ItemDetails,
  displayMode: TranslationDisplayMode,
): MnemonicFormState {
  const existing = getLocalizedTexts(item.mnemonics, displayMode).find(
    (text) => text.sourceKind === "user" && text.locale === form.locale,
  );

  return existing === undefined ? form : { ...form, body: existing.text };
}

function PrivateOverridesList({
  cards,
  overrides,
  onDelete,
  onEdit,
}: {
  readonly cards: readonly LearningCardDto[];
  readonly overrides: readonly UserOverrideDto[];
  readonly onDelete: (override: UserOverrideDto) => void;
  readonly onEdit: (override: UserOverrideDto) => void;
}) {
  if (overrides.length === 0) {
    return <p className="muted">Личных вариантов пока нет.</p>;
  }

  return (
    <ul className="private-override-list">
      {overrides.map((override) => {
        const card = findCardForOverride(cards, override);

        return (
          <li key={override.id}>
            <div>
              <strong>{override.text}</strong>
              <span>
                {card?.answerType === "reading" ? "чтение" : formatLocale(override.locale)} ·{" "}
                {formatAnswerType(card?.answerType ?? "meaning")}
              </span>
              {override.note === null ? null : <small>{override.note}</small>}
            </div>
            <div className="action-row">
              <button className="secondary-action" onClick={() => onEdit(override)} type="button">
                Изменить
              </button>
              <button className="secondary-action" onClick={() => onDelete(override)} type="button">
                Удалить
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CardAnswerList({
  cards,
  displayMode,
}: {
  readonly cards: readonly LearningCardDto[];
  readonly displayMode: TranslationDisplayMode;
}) {
  if (cards.length === 0) {
    return <p className="muted">Карточки для материала пока не добавлены.</p>;
  }

  return (
    <div className="card-answer-grid">
      {cards.map((card) => (
        <article key={card.id}>
          <h3>
            {formatPromptType(card.promptType)} · {formatAnswerType(card.answerType)}
          </h3>
          <TextList
            textKind={card.answerType === "reading" ? "reading" : "localized"}
            texts={filterCardAnswers(card, displayMode)}
          />
          {card.blockedAnswers.length === 0 ? null : (
            <p className="blocked-hint">
              Не принимайте как правильный ответ:{" "}
              {card.blockedAnswers.map((answer) => answer.text).join(", ")}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function ItemReadingDetails({
  displayMode,
  item,
  readingCards,
}: {
  readonly displayMode: TranslationDisplayMode;
  readonly item: ItemDetails;
  readonly readingCards: readonly LearningCardDto[];
}) {
  if (item.kanjiDetails !== null) {
    const readingGroups = [
      ["on", "Онъёми"],
      ["kun", "Кунъёми"],
      ["nanori", "Нанори"],
      ["other", "Другие"],
    ] as const;

    return (
      <section className="panel" data-testid="kanji-reading-details">
        <h2>Чтения</h2>
        <div className="reading-evidence-grid">
          <div className="content-block">
            <h3>Основное учебное чтение</h3>
            {item.kanjiDetails.primaryTaughtReading === null ? (
              <p className="muted">Учебное чтение пока не выбрано.</p>
            ) : (
              <TextList textKind="reading" texts={[item.kanjiDetails.primaryTaughtReading]} />
            )}
          </div>
          <div className="content-block">
            <h3>Допустимые учебные чтения</h3>
            <TextList textKind="reading" texts={item.kanjiDetails.additionalAcceptedReadings} />
          </div>
        </div>
        <div className="dictionary-evidence">
          <div className="section-heading-row">
            <h3>Словарные чтения</h3>
            <span className="source-kind-label imported">импортированные данные</span>
          </div>
          <div className="reading-evidence-grid">
            {readingGroups.map(([kind, title]) => {
              const readings = item.kanjiDetails?.readingEvidence.filter(
                (reading) => reading.readingType === kind,
              );

              return readings === undefined || readings.length === 0 ? null : (
                <div className="content-block" key={kind}>
                  <h3>{title}</h3>
                  <ul className="reading-chip-list">
                    {readings.map((reading) => (
                      <li key={`${kind}-${reading.reading}`}>
                        <JapaneseText>{reading.reading}</JapaneseText>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <ImportedSourceLinks sources={item.attributions} />
        </div>
      </section>
    );
  }

  if (item.wordDetails !== null) {
    const locales = getContentLocalesForDisplayMode(displayMode);
    const senses = item.wordDetails.senses.filter((sense) => locales.includes(sense.locale));

    return (
      <section className="panel" data-testid="word-study-details">
        <h2>Чтение и словарные сведения</h2>
        <dl className="lesson-facts">
          <div>
            <dt>Чтение</dt>
            <dd>
              <JapaneseText>{item.wordDetails.reading}</JapaneseText>
            </dd>
          </div>
          {item.wordDetails.commonnessRank === null ? null : (
            <div>
              <dt>Частотный ранг источника</dt>
              <dd>{item.wordDetails.commonnessRank}</dd>
            </div>
          )}
        </dl>
        {senses.length === 0 ? (
          <p className="muted">Словарные сведения для выбранного языка пока не добавлены.</p>
        ) : (
          <ul className="word-sense-list">
            {senses.map((sense, index) => (
              <li key={`${sense.locale}-${sense.meaning}-${sense.partOfSpeech}-${index}`}>
                <strong>{sense.meaning}</strong>
                <span>
                  {formatLocale(sense.locale)} · {formatPartOfSpeech(sense.partOfSpeech)}
                  {sense.register === null ? "" : ` · ${sense.register}`}
                </span>
                {sense.tags.length === 0 ? null : <small>{sense.tags.join(", ")}</small>}
                <span className={`source-kind-label ${sense.sourceKind}`}>
                  {formatSourceKind(sense.sourceKind)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <ImportedSourceLinks sources={item.attributions} />
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Чтения</h2>
      {item.reading === null && readingCards.length === 0 ? (
        <p className="muted">Для этого материала чтение не требуется.</p>
      ) : (
        <TextList
          textKind="reading"
          texts={[
            ...(item.reading === null ? [] : [{ locale: "ru-RU" as const, text: item.reading }]),
            ...collectAnswers(readingCards, displayMode),
          ]}
        />
      )}
    </section>
  );
}

function SrsHistory({
  history,
  isLoading,
  nextReviewAt,
  onLoadMore,
  stageName,
  timezone,
}: {
  readonly history: ItemDetails["reviewHistory"];
  readonly isLoading: boolean;
  readonly nextReviewAt: string | null;
  readonly onLoadMore: () => void;
  readonly stageName: string | null;
  readonly timezone: string;
}) {
  return (
    <section className="panel" data-testid="item-srs-history">
      <h2>История SRS</h2>
      <dl className="lesson-facts">
        <div>
          <dt>Текущий этап</dt>
          <dd>{formatSrsStageName(stageName ?? undefined)}</dd>
        </div>
        <div>
          <dt>Следующее повторение</dt>
          <dd>{formatReviewSchedule(nextReviewAt, timezone)}</dd>
        </div>
      </dl>
      {history.items.length === 0 ? (
        <p className="muted">У этого материала ещё нет истории повторений.</p>
      ) : (
        <ol className="review-history-list">
          {history.items.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>{formatReviewResult(entry.result)}</strong>
                <span>
                  {formatPromptType(entry.promptType)} ·{" "}
                  {formatStageTransition(entry.previousStageIndex, entry.nextStageIndex)}
                </span>
              </div>
              <time dateTime={entry.answeredAt}>
                {formatAbsoluteTime(entry.answeredAt, timezone)} ·{" "}
                {formatRelativeTime(entry.answeredAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {history.nextCursor === null ? null : (
        <button
          className="secondary-action"
          disabled={isLoading}
          onClick={onLoadMore}
          type="button"
        >
          {isLoading ? "Загружаю…" : "Показать более ранние"}
        </button>
      )}
    </section>
  );
}

function RelationGroups({
  displayMode,
  groups,
  legacyRelations,
}: {
  readonly displayMode: TranslationDisplayMode;
  readonly groups: ItemDetails["relationGroups"];
  readonly legacyRelations: ItemDetails["relations"];
}) {
  return (
    <section className="panel" data-testid="item-relation-groups">
      <h2>Связи</h2>
      {groups.length === 0 ? (
        <RelationsList relations={legacyRelations} displayMode={displayMode} />
      ) : (
        <div className="relation-group-list">
          {groups.map((group) => (
            <div className="content-block" key={group.kind}>
              <h3>{formatRelationGroup(group.kind)}</h3>
              <ul className="lesson-relation-list">
                {group.items.map((related) => (
                  <li key={related.id}>
                    <Link className="inline-link" href={`/items/${related.id}`}>
                      <JapaneseText>{related.japanese}</JapaneseText>
                    </Link>
                    <small>
                      {related.reading === null ? "" : `${related.reading} · `}
                      {formatTranslationBundle(related.translations, displayMode)}
                    </small>
                  </li>
                ))}
              </ul>
              {group.total > group.items.length ? (
                <p className="relation-group-summary">
                  Показаны первые {group.items.length} из {group.total}.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RelationsList({
  relations,
  displayMode,
}: {
  readonly relations: ItemDetails["relations"];
  readonly displayMode: TranslationDisplayMode;
}) {
  if (relations.length === 0) {
    return <p className="muted">Связанные материалы пока не добавлены.</p>;
  }

  return (
    <ul className="lesson-relation-list">
      {relations.map((relation) => (
        <li key={`${relation.relationType}-${relation.item.id}`}>
          <Link className="inline-link" href={`/items/${relation.item.id}`}>
            <JapaneseText>{relation.item.japanese}</JapaneseText>
          </Link>
          <small>
            {formatRelationType(relation.relationType)} ·{" "}
            {relation.item.reading === null ? "" : `${relation.item.reading} · `}
            {formatTranslationBundle(relation.item.translations, displayMode)}
          </small>
        </li>
      ))}
    </ul>
  );
}

function SourceAttribution({
  source,
}: {
  readonly source: NonNullable<ItemDetails["exampleSentences"][number]["attribution"]>;
}) {
  const sourceUrl = safeExternalUrl(source.sourceUrl);
  const label = `${source.sourceName} · ${source.licenseName}`;

  return sourceUrl === null ? (
    <small className="example-attribution">{label}</small>
  ) : (
    <a className="example-attribution inline-link" href={sourceUrl} rel="noreferrer">
      {label}
    </a>
  );
}

function ImportedSourceLinks({ sources }: { readonly sources: ItemDetails["attributions"] }) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <p className="imported-source-links">
      <span>Источники метаданных:</span>{" "}
      {sources.map((source, index) => {
        const sourceUrl = safeExternalUrl(source.sourceUrl);
        const separator = index === sources.length - 1 ? "" : ", ";

        return (
          <span key={`${source.sourceName}-${index}`}>
            {sourceUrl === null ? (
              source.sourceName
            ) : (
              <a className="inline-link" href={sourceUrl} rel="noreferrer">
                {source.sourceName}
              </a>
            )}
            {" · "}
            {source.licenseName}
            {separator}
          </span>
        );
      })}
    </p>
  );
}

function KanjiStrokeGraphic({
  character,
  graphic,
}: {
  readonly character: string;
  readonly graphic: NonNullable<ItemDetails["strokeGraphic"]>;
}) {
  return (
    <div className="stroke-graphic" data-testid="kanji-stroke-graphic">
      <svg
        aria-label={`Порядок черт для ${character}`}
        className="stroke-svg-frame"
        role="img"
        viewBox={graphic.viewBox}
      >
        {graphic.strokes.map((stroke) => (
          <path
            d={stroke.path}
            data-order={stroke.order}
            key={stroke.id}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <ol className="stroke-order-list" aria-label="Список черт">
        {graphic.strokes.map((stroke) => (
          <li key={stroke.id}>
            <span>{stroke.order}</span>
            <strong>{stroke.type ?? "черта"}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StrokePlaceholder({ character }: { readonly character: string }) {
  return (
    <>
      <div className="stroke-fallback" aria-hidden="true" lang="ja">
        {character}
      </div>
      <p className="muted">
        KanjiVG-графика пока не подключена. Здесь будет порядок черт после импорта.
      </p>
    </>
  );
}

function ContentBlock({
  title,
  texts,
}: {
  readonly title: string;
  readonly texts: readonly LocalizedTextDto[];
}) {
  return (
    <div className="content-block">
      <h3>{title}</h3>
      <TextList texts={texts} />
    </div>
  );
}

function TextList({
  textKind = "localized",
  texts,
}: {
  readonly textKind?: "localized" | "reading";
  readonly texts: readonly LocalizedTextDto[];
}) {
  if (texts.length === 0) {
    return <p className="muted">Нет данных для выбранного режима.</p>;
  }

  return (
    <ul className="lesson-text-list">
      {texts.map((text, index) => (
        <li key={`${text.locale}-${text.text}-${index}`}>
          {textKind === "reading" ? (
            <JapaneseText>{text.text}</JapaneseText>
          ) : (
            <span>{text.text}</span>
          )}
          <small>
            {textKind === "reading" ? "чтение" : formatLocale(text.locale)}
            {text.sourceKind === undefined ? "" : ` · ${formatSourceKind(text.sourceKind)}`}
          </small>
        </li>
      ))}
    </ul>
  );
}

function getLocalizedTexts(
  bundle: { readonly ru: readonly LocalizedTextDto[]; readonly en: readonly LocalizedTextDto[] },
  displayMode: TranslationDisplayMode,
): readonly LocalizedTextDto[] {
  const locales = getContentLocalesForDisplayMode(displayMode);

  return [...bundle.ru, ...bundle.en].filter((text) => locales.includes(text.locale));
}

function collectAnswers(
  cards: readonly LearningCardDto[],
  displayMode: TranslationDisplayMode,
): readonly LocalizedTextDto[] {
  const seen = new Set<string>();
  const answers: LocalizedTextDto[] = [];

  for (const card of cards) {
    for (const answer of filterCardAnswers(card, displayMode)) {
      const key = `${answer.locale}:${answer.text}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      answers.push(answer);
    }
  }

  return answers;
}

function filterCardAnswers(
  card: LearningCardDto,
  displayMode: TranslationDisplayMode,
): readonly LocalizedTextDto[] {
  if (card.answerType === "reading") {
    return card.acceptedAnswers;
  }

  const locales = getContentLocalesForDisplayMode(displayMode);
  return card.acceptedAnswers.filter((answer) => locales.includes(answer.locale));
}

function findCardForOverride(
  cards: readonly LearningCardDto[],
  override: UserOverrideDto,
): LearningCardDto | null {
  return cards.find((card) => card.id === override.learningCardId) ?? null;
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

function formatSentenceTranslation(
  sentence: ItemDetails["exampleSentences"][number],
  displayMode: TranslationDisplayMode,
): string {
  const parts: string[] = [];

  if ((displayMode === "ru" || displayMode === "ru-en") && sentence.translationRu !== null) {
    parts.push(sentence.translationRu);
  }

  if ((displayMode === "en" || displayMode === "ru-en") && sentence.translationEn !== null) {
    parts.push(sentence.translationEn);
  }

  return parts.length === 0 ? "перевод пока не добавлен" : parts.join(" / ");
}

function formatItemType(itemType: ItemDetails["itemType"]): string {
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

function formatPromptType(promptType: LearningCardDto["promptType"]): string {
  switch (promptType) {
    case "reading":
      return "чтение";
    case "recall":
      return "воспроизведение";
    case "cloze":
      return "пропуск";
    case "recognition":
      return "распознавание";
    case "meaning":
      return "значение";
  }
}

function formatAnswerType(answerType: CardAnswerType): string {
  return answerType === "reading" ? "чтение" : "значение";
}

function formatLocale(locale: ContentLocale): string {
  return locale === "ru-RU" ? "RU" : "EN";
}

function formatSourceKind(sourceKind: NonNullable<LocalizedTextDto["sourceKind"]>): string {
  switch (sourceKind) {
    case "imported":
      return "словарные данные";
    case "user":
      return "личное";
    default:
      return "учебный материал";
  }
}

function formatPartOfSpeech(partOfSpeech: string): string {
  const labels: Readonly<Record<string, string>> = {
    n: "существительное",
    noun: "существительное",
    "adj-i": "прилагательное на い",
    "adj-na": "прилагательное на な",
    v1: "глагол 一段",
    v5: "глагол 五段",
    adverb: "наречие",
  };

  return labels[partOfSpeech] ?? partOfSpeech;
}

function formatReviewSchedule(value: string | null, timezone: string): string {
  if (value === null) {
    return "не запланировано";
  }

  return `${formatAbsoluteTime(value, timezone)} · ${formatRelativeTime(value)}`;
}

function formatAbsoluteTime(value: string, timezone: string): string {
  const date = new Date(value);
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  };

  try {
    return `${new Intl.DateTimeFormat("ru-RU", options).format(date)} (${timezone})`;
  } catch {
    return `${new Intl.DateTimeFormat("ru-RU", {
      ...options,
      timeZone: "UTC",
    }).format(date)} (UTC)`;
  }
}

function formatRelativeTime(value: string): string {
  const differenceMs = new Date(value).getTime() - Date.now();
  const units = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ] as const;
  const formatter = new Intl.RelativeTimeFormat("ru-RU", { numeric: "auto" });

  for (const [unit, milliseconds] of units) {
    if (Math.abs(differenceMs) >= milliseconds || unit === "minute") {
      return formatter.format(Math.round(differenceMs / milliseconds), unit);
    }
  }

  return "сейчас";
}

function formatReviewResult(
  result: ItemDetails["reviewHistory"]["items"][number]["result"],
): string {
  switch (result) {
    case "wrong":
      return "Неверно";
    case "typo":
      return "Опечатка";
    case "reveal":
      return "Ответ показан";
    case "manual-ignore":
      return "Ошибка проигнорирована";
    case "resurrect":
      return "Возвращено в SRS";
    default:
      return "Верно";
  }
}

function formatStageTransition(previous: number | null, next: number | null): string {
  if (previous === null && next === null) {
    return "этап не изменён";
  }

  return `этап ${previous ?? "—"} → ${next ?? "—"}`;
}

function formatRelationGroup(kind: ItemDetails["relationGroups"][number]["kind"]): string {
  switch (kind) {
    case "components":
      return "Составляющие компоненты";
    case "used-in-kanji":
      return "Кандзи с этим компонентом";
    case "kanji":
      return "Составляющие кандзи";
    case "vocabulary":
      return "Слова, закрепляющие материал";
    case "sentences":
      return "Связанные предложения";
    case "prerequisites":
      return "Другие предпосылки";
    case "dependents":
      return "Открываемые материалы";
  }
}

function formatLeechReasons(
  reasons: NonNullable<NonNullable<ItemDetails["srs"]>["leech"]>["reasons"],
) {
  return reasons.map(formatLeechReason).join(" · ");
}

function formatLeechReason(
  reason: NonNullable<NonNullable<ItemDetails["srs"]>["leech"]>["reasons"][number],
) {
  switch (reason) {
    case "wrong-count":
      return "накопленные ошибки";
    case "recent-wrong":
      return "недавние ошибки";
    case "stage-instability":
      return "нестабильная стадия";
    case "correct-streak-relief":
      return "есть серия верных ответов";
    case "burned":
      return "сожжено";
  }
}

function formatRelationType(
  relationType: ItemDetails["relations"][number]["relationType"],
): string {
  switch (relationType) {
    case "component":
      return "компонент";
    case "kanji":
      return "кандзи";
    case "word":
      return "слово";
    case "dependency":
      return "зависимость";
    case "example":
      return "пример";
  }
}
