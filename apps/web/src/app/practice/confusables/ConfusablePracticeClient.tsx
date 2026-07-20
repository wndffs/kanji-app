"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  type ActiveConfusablePracticeSessionResponse,
  type ConfusableComparisonDto,
  type ConfusablePairSummaryDto,
  type ConfusablePracticeSessionDto,
  type PracticeAnswerResponse,
  type PracticeProgressDto,
  type ReviewQueueCardDto,
  type TranslationBundleDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../../components/JapaneseText";
import {
  abandonConfusablePracticeSession,
  ApiError,
  finishConfusablePracticeSession,
  getActiveConfusablePracticeSession,
  getConfusablePairs,
  startConfusablePracticeSession,
  submitConfusablePracticeAnswer,
} from "../../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../../lib/auth-storage";
import { useTranslationDisplayMode } from "../../../lib/use-translation-display-mode";

type ViewState =
  | { readonly status: "loading" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly pairs: readonly ConfusablePairSummaryDto[];
      readonly selected: ActiveConfusablePracticeSessionResponse | null;
    };

export function ConfusablePracticeClient({
  initialItemId,
  initialPairId,
}: {
  readonly initialItemId?: string;
  readonly initialPairId?: string;
}) {
  const displayMode = useTranslationDisplayMode();
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [session, setSession] = useState<ConfusablePracticeSessionDto | null>(null);
  const [isPracticing, setIsPracticing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<PracticeAnswerResponse | null>(null);
  const [comparison, setComparison] = useState<ConfusableComparisonDto | null>(null);
  const [answeredCard, setAnsweredCard] = useState<ReviewQueueCardDto | null>(null);
  const [finishedSummary, setFinishedSummary] = useState<PracticeProgressDto | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    const stored = readStoredSession();

    if (stored === null) {
      setState({ status: "unauthenticated" });
      return;
    }

    setState({ status: "loading" });
    setError(null);

    try {
      if (initialPairId !== undefined) {
        const selected = await getActiveConfusablePracticeSession(stored.token, initialPairId);
        setState({ status: "ready", token: stored.token, pairs: [], selected });
        setSession(selected.session);
        setIsPracticing(selected.session !== null);
        return;
      }

      const result = await getConfusablePairs(stored.token, initialItemId);
      setState({ status: "ready", token: stored.token, pairs: result.pairs, selected: null });
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
        return;
      }

      setState({
        status: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Не удалось загрузить похожие кандзи.",
      });
    }
  }, [initialItemId, initialPairId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = state.status === "ready" ? state.selected : null;
  const currentCard =
    selected !== null && session !== null ? (selected.cards[session.currentIndex] ?? null) : null;
  const visibleCard = feedback === null ? currentCard : answeredCard;

  useEffect(() => {
    if (isPracticing && feedback === null && !isBusy) {
      answerRef.current?.focus();
    }
  }, [feedback, isBusy, isPracticing, session?.currentIndex]);

  useEffect(() => {
    if (feedback !== null) {
      continueRef.current?.focus();
    }
  }, [feedback]);

  async function handleStart(): Promise<void> {
    if (state.status !== "ready" || selected === null || isBusy) {
      return;
    }

    setIsBusy(true);
    setError(null);
    setFinishedSummary(null);

    try {
      const result = await startConfusablePracticeSession(state.token, selected.pair.id);
      setState({ ...state, selected: result });
      setSession(result.session);
      setIsPracticing(true);
      resetAttempt();
    } catch (requestError: unknown) {
      setError(toMessage(requestError, "Не удалось начать сравнение."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (
      state.status !== "ready" ||
      session === null ||
      currentCard === null ||
      answer.trim() === "" ||
      feedback !== null ||
      isBusy
    ) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const result = await submitConfusablePracticeAnswer(state.token, session.id, {
        cardId: currentCard.id,
        answer: answer.trim(),
        answerType: currentCard.answerType,
      });
      setAnsweredCard(currentCard);
      setFeedback(result.answer);
      setComparison(result.comparison);
      setSession(result.session);
    } catch (requestError: unknown) {
      setError(toMessage(requestError, "Не удалось проверить ответ."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleContinue(): Promise<void> {
    if (state.status !== "ready" || session === null || feedback === null || isBusy) {
      return;
    }

    if (feedback.retry) {
      resetAttempt();
      return;
    }

    if (session.currentIndex < session.totalItems) {
      resetAttempt();
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const result = await finishConfusablePracticeSession(state.token, session.id);
      setFinishedSummary(result.summary);
      setSession(null);
      setIsPracticing(false);
      resetAttempt();
    } catch (requestError: unknown) {
      setError(toMessage(requestError, "Не удалось завершить сравнение."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAbandon(): Promise<void> {
    if (state.status !== "ready" || session === null || isBusy) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const result = await abandonConfusablePracticeSession(state.token, session.id);
      setFinishedSummary(result.summary);
      setSession(null);
      setIsPracticing(false);
      resetAttempt();
    } catch (requestError: unknown) {
      setError(toMessage(requestError, "Не удалось выйти из практики."));
    } finally {
      setIsBusy(false);
    }
  }

  function resetAttempt(): void {
    setAnswer("");
    setFeedback(null);
    setComparison(null);
    setAnsweredCard(null);
  }

  if (state.status === "loading") {
    return <PageNotice title="Похожие кандзи" message="Загружаю пары для сравнения." loading />;
  }

  if (state.status === "unauthenticated") {
    return (
      <PageNotice title="Похожие кандзи" message="Нужен вход в аккаунт.">
        <Link className="primary-action" href="/login">
          Войти
        </Link>
      </PageNotice>
    );
  }

  if (state.status === "error") {
    return (
      <PageNotice title="Похожие кандзи" message={state.message}>
        <button className="secondary-action" onClick={() => void load()} type="button">
          Повторить
        </button>
      </PageNotice>
    );
  }

  if (selected === null) {
    return (
      <section className="page-stack">
        <header className="page-heading practice-heading">
          <div>
            <span className="eyebrow">Отдельная практика</span>
            <h1>Похожие кандзи</h1>
            <p>Пары отсортированы по вашим недавним ошибкам. SRS не изменяется.</p>
          </div>
          <Link className="secondary-action" href="/practice">
            Вся практика
          </Link>
        </header>
        {state.pairs.length === 0 ? (
          <div className="notice-panel">
            <p>
              {initialItemId === undefined
                ? "Опубликованных пар пока нет."
                : "Для этого кандзи пока нет опубликованной пары."}
            </p>
          </div>
        ) : (
          <div className="confusable-pair-list">
            {state.pairs.map((pair) => (
              <PairCard key={pair.id} pair={pair} />
            ))}
          </div>
        )}
      </section>
    );
  }

  if (!isPracticing || session === null) {
    return (
      <section className="page-stack">
        <header className="page-heading practice-heading">
          <div>
            <span className="eyebrow">Сравнение без изменения SRS</span>
            <h1>Похожие кандзи</h1>
          </div>
          <Link className="secondary-action" href="/practice/confusables">
            Другие пары
          </Link>
        </header>
        <PairPreview pair={selected.pair} />
        {finishedSummary === null ? null : <PracticeSummary summary={finishedSummary} />}
        {error === null ? null : <p className="form-error">{error}</p>}
        <button
          className="primary-action"
          disabled={isBusy}
          onClick={() => void handleStart()}
          type="button"
        >
          {isBusy ? "Открываю..." : "Начать сравнение"}
        </button>
      </section>
    );
  }

  if (visibleCard === null) {
    return null;
  }

  return (
    <section className="review-session confusable-session" aria-label="Практика похожих кандзи">
      <header className="review-session-header">
        <div>
          <span className="eyebrow">
            {Math.min(session.currentIndex + 1, session.totalItems)} из {session.totalItems}
          </span>
          <h1>Сравнение кандзи</h1>
        </div>
        <div className="review-progress">
          <span>Верно: {session.progress.accepted}</span>
          <span>Ошибок: {session.progress.missed}</span>
          <button
            className="text-action"
            disabled={isBusy}
            onClick={() => void handleAbandon()}
            type="button"
          >
            Выйти
          </button>
        </div>
      </header>

      <PairPreview pair={selected.pair} compact />

      <article className="review-card">
        <div className="review-card-meta">
          <span>Кандзи</span>
          <span>{formatAnswerType(visibleCard.answerType)}</span>
          <span>Без изменения SRS</span>
        </div>
        <div className="review-prompt">
          <JapaneseText as="p" className="review-japanese" variant="display">
            {visibleCard.prompt.japanese}
          </JapaneseText>
        </div>
      </article>

      {feedback === null ? (
        <form className="review-answer-bar" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="confusable-answer">
            <span>
              {visibleCard.answerType === "reading" ? "Введите чтение" : "Введите значение"}
            </span>
            <input
              autoComplete="off"
              disabled={isBusy}
              id="confusable-answer"
              onChange={(event) => setAnswer(event.currentTarget.value)}
              ref={answerRef}
              value={answer}
            />
          </label>
          <button
            className="primary-action"
            disabled={isBusy || answer.trim() === ""}
            type="submit"
          >
            {isBusy ? "Проверяю..." : "Ответить"}
          </button>
        </form>
      ) : (
        <>
          <section
            className={
              feedback.accepted ? "feedback-panel feedback-panel-success" : "feedback-panel"
            }
          >
            <div className="feedback-header">
              <div>
                <span className="eyebrow">{formatResult(feedback)}</span>
                <h2>{feedback.feedback.message}</h2>
              </div>
              <button
                className="primary-action"
                disabled={isBusy}
                onClick={() => void handleContinue()}
                ref={continueRef}
                type="button"
              >
                {feedback.retry
                  ? "Ответить снова"
                  : session.currentIndex >= session.totalItems
                    ? "Завершить"
                    : "Дальше"}
              </button>
            </div>
            <div className="feedback-grid">
              <div>
                <h3>Ваш ответ</h3>
                <p>{answer}</p>
              </div>
              <div>
                <h3>Правильные ответы</h3>
                <p>{feedback.feedback.expected.map((item) => item.text).join(" · ")}</p>
              </div>
              <div>
                <h3>SRS</h3>
                <p>Без изменений</p>
              </div>
            </div>
          </section>
          {comparison === null ? null : (
            <Comparison comparison={comparison} displayMode={displayMode} />
          )}
        </>
      )}
      {error === null ? null : <p className="form-error">{error}</p>}
    </section>
  );
}

function PairCard({ pair }: { readonly pair: ConfusablePairSummaryDto }) {
  return (
    <article className="panel confusable-pair-card">
      <PairGlyphs pair={pair} />
      <div>
        <p>{pair.kinds.map(formatKind).join(" · ")}</p>
        <small>
          Недавних ошибок: {pair.recentWrongCount} · сила связи: {pair.strength}
        </small>
      </div>
      <Link
        className="primary-action"
        href={`/practice/confusables?pairId=${encodeURIComponent(pair.id)}`}
      >
        Сравнить
      </Link>
    </article>
  );
}

function PairPreview({
  pair,
  compact = false,
}: {
  readonly pair: ConfusablePairSummaryDto;
  readonly compact?: boolean;
}) {
  return (
    <section
      className={compact ? "confusable-pair-preview is-compact" : "confusable-pair-preview panel"}
      aria-label="Пара кандзи"
    >
      <PairGlyphs pair={pair} />
      <p>{pair.kinds.map(formatKind).join(" · ")}</p>
    </section>
  );
}

function PairGlyphs({ pair }: { readonly pair: ConfusablePairSummaryDto }) {
  return (
    <div className="confusable-glyphs">
      <JapaneseText as="strong" variant="display">
        {pair.kanji[0].character}
      </JapaneseText>
      <span aria-hidden="true">/</span>
      <JapaneseText as="strong" variant="display">
        {pair.kanji[1].character}
      </JapaneseText>
    </div>
  );
}

function Comparison({
  comparison,
  displayMode,
}: {
  readonly comparison: ConfusableComparisonDto;
  readonly displayMode: TranslationDisplayMode;
}) {
  return (
    <section className="confusable-comparison" aria-label="Различия кандзи">
      <header>
        <span className="eyebrow">После ответа</span>
        <h2>Чем отличаются</h2>
        <p>{formatBundle(comparison.explanation, displayMode)}</p>
      </header>
      <div className="confusable-comparison-grid">
        {comparison.kanji.map((kanji) => (
          <article className="panel" key={kanji.itemId}>
            <h3>
              <JapaneseText as="span" variant="display">
                {kanji.character}
              </JapaneseText>
            </h3>
            <ComparisonRow label="Значения" value={formatBundle(kanji.meanings, displayMode)} />
            <ComparisonRow
              label="Чтения"
              value={kanji.readings.join("、") || "нет данных"}
              japanese
            />
            <RelatedList displayMode={displayMode} items={kanji.components} title="Компоненты" />
            <RelatedList displayMode={displayMode} items={kanji.vocabulary} title="Примеры слов" />
            <Link className="inline-link" href={`/items/${kanji.itemId}`}>
              Открыть материал
            </Link>
          </article>
        ))}
      </div>
      <small className="muted">Источник связи: {comparison.source.sourceNote}</small>
    </section>
  );
}

function ComparisonRow({
  label,
  value,
  japanese = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly japanese?: boolean;
}) {
  return (
    <div className="confusable-comparison-row">
      <span>{label}</span>
      {japanese ? <JapaneseText>{value}</JapaneseText> : <p>{value}</p>}
    </div>
  );
}

function RelatedList({
  displayMode,
  items,
  title,
}: {
  readonly displayMode: TranslationDisplayMode;
  readonly items: ConfusableComparisonDto["kanji"][number]["components"];
  readonly title: string;
}) {
  return (
    <div className="confusable-comparison-row">
      <span>{title}</span>
      {items.length === 0 ? (
        <p>нет данных</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <JapaneseText>{item.japanese}</JapaneseText>
              <small>
                {item.reading === null ? "" : `${item.reading} · `}
                {formatBundle(item.translations, displayMode)}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PracticeSummary({ summary }: { readonly summary: PracticeProgressDto }) {
  return (
    <section className="panel practice-summary">
      <h2>Практика завершена</h2>
      <p>
        Ответов: {summary.answered} · верно: {summary.accepted} · ошибок: {summary.missed}
      </p>
    </section>
  );
}

function PageNotice({
  children,
  loading = false,
  message,
  title,
}: {
  readonly children?: React.ReactNode;
  readonly loading?: boolean;
  readonly message: string;
  readonly title: string;
}) {
  return (
    <section className="page-stack" aria-busy={loading}>
      <div className="page-heading">
        <h1>{title}</h1>
        <p>{message}</p>
      </div>
      {children}
    </section>
  );
}

function formatBundle(bundle: TranslationBundleDto, mode: TranslationDisplayMode): string {
  const values = [
    ...(mode === "ru" || mode === "ru-en" ? [bundle.primaryRu] : []),
    ...(mode === "en" || mode === "ru-en" ? [bundle.primaryEn] : []),
  ].filter((value): value is string => value !== null && value !== "");

  return values.length === 0 ? "нет данных" : values.join(" / ");
}

function formatAnswerType(value: ReviewQueueCardDto["answerType"]): string {
  return value === "reading" ? "Чтение" : "Значение";
}

function formatKind(value: ConfusablePairSummaryDto["kinds"][number]): string {
  return value === "visual" ? "Похожи внешне" : "Близки по смыслу";
}

function formatResult(feedback: PracticeAnswerResponse): string {
  if (feedback.retry) return "Другое чтение";
  if (feedback.result === "correct") return "Верно";
  if (feedback.result === "typo") return "Опечатка";
  if (feedback.result === "blocked") return "Ответ отклонён";
  return "Ошибка";
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
