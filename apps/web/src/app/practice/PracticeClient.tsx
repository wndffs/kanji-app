"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  PRACTICE_SOURCES,
  type PracticeAnswerResponse,
  type PracticeSource,
  type ReviewQueueItem,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import { ApiError, getPracticeQueue, submitPracticeAnswer } from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";

type QueueState =
  | { readonly status: "loading" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly items: readonly ReviewQueueItem[];
    };

type PracticeProgress = {
  readonly answered: number;
  readonly accepted: number;
  readonly missed: number;
};

const INITIAL_PROGRESS: PracticeProgress = { answered: 0, accepted: 0, missed: 0 };

export function PracticeClient() {
  const [source, setSource] = useState<PracticeSource>("recent-mistakes");
  const [queueState, setQueueState] = useState<QueueState>({ status: "loading" });
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<PracticeAnswerResponse | null>(null);
  const [progress, setProgress] = useState<PracticeProgress>(INITIAL_PROGRESS);
  const [finishedSummary, setFinishedSummary] = useState<PracticeProgress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  const loadQueue = useCallback(async () => {
    const storedSession = readStoredSession();

    if (storedSession === null) {
      setQueueState({ status: "unauthenticated" });
      return;
    }

    setQueueState({ status: "loading" });
    setIsPracticing(false);
    setCurrentIndex(0);
    setAnswer("");
    setFeedback(null);
    setProgress(INITIAL_PROGRESS);
    setFinishedSummary(null);
    setError(null);

    try {
      const response = await getPracticeQueue(storedSession.token, source);
      setQueueState({ status: "ready", token: storedSession.token, items: response.items });
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearStoredSession();
        setQueueState({ status: "unauthenticated" });
        return;
      }

      setQueueState({
        status: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Не удалось загрузить материалы для практики.",
      });
    }
  }, [source]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const currentItem =
    queueState.status === "ready" && isPracticing ? (queueState.items[currentIndex] ?? null) : null;

  useEffect(() => {
    if (currentItem !== null && feedback === null && !isSubmitting) {
      answerInputRef.current?.focus();
    }
  }, [currentItem, feedback, isSubmitting]);

  useEffect(() => {
    if (feedback !== null) {
      continueButtonRef.current?.focus();
    }
  }, [feedback]);

  function handleSourceChange(nextSource: PracticeSource): void {
    if (nextSource !== source) {
      setSource(nextSource);
    }
  }

  function handleStart(): void {
    if (queueState.status !== "ready" || queueState.items.length === 0) {
      return;
    }

    setIsPracticing(true);
    setCurrentIndex(0);
    setAnswer("");
    setFeedback(null);
    setProgress(INITIAL_PROGRESS);
    setFinishedSummary(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (
      queueState.status !== "ready" ||
      currentItem === null ||
      answer.trim() === "" ||
      feedback !== null ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await submitPracticeAnswer(queueState.token, {
        cardId: currentItem.card.id,
        answer: answer.trim(),
        answerType: currentItem.card.answerType,
      });
      setFeedback(response);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Не удалось проверить ответ.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinue(): void {
    if (queueState.status !== "ready" || feedback === null) {
      return;
    }

    const nextProgress = {
      answered: progress.answered + 1,
      accepted: progress.accepted + (feedback.accepted ? 1 : 0),
      missed: progress.missed + (feedback.accepted ? 0 : 1),
    };
    const nextIndex = currentIndex + 1;

    if (nextIndex >= queueState.items.length) {
      setProgress(nextProgress);
      setFinishedSummary(nextProgress);
      setIsPracticing(false);
      setFeedback(null);
      setAnswer("");
      return;
    }

    setProgress(nextProgress);
    setCurrentIndex(nextIndex);
    setAnswer("");
    setFeedback(null);
  }

  if (queueState.status === "loading") {
    return (
      <section className="page-stack" aria-busy="true">
        <div className="page-heading">
          <h1>Практика</h1>
          <p>Загружаю карточки.</p>
        </div>
        <div className="review-card skeleton" />
      </section>
    );
  }

  if (queueState.status === "unauthenticated") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Практика</h1>
          <p>Нужен вход в аккаунт.</p>
        </div>
        <Link className="primary-action" href="/login">
          Войти
        </Link>
      </section>
    );
  }

  if (queueState.status === "error") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Практика</h1>
          <p>Материалы сейчас недоступны.</p>
        </div>
        <div className="notice-panel error-panel">
          <p>{queueState.message}</p>
          <button className="secondary-action" onClick={() => void loadQueue()} type="button">
            Повторить
          </button>
        </div>
      </section>
    );
  }

  if (!isPracticing) {
    return (
      <section className="page-stack">
        <div className="page-heading practice-heading">
          <div>
            <h1>Практика</h1>
            <p>Карточек: {queueState.items.length}. SRS и расписание не изменяются.</p>
          </div>
          <button
            className="primary-action"
            disabled={queueState.items.length === 0}
            onClick={handleStart}
            type="button"
          >
            Начать практику
          </button>
        </div>

        <PracticeSourceControl source={source} onChange={handleSourceChange} />

        {finishedSummary === null ? null : (
          <section className="practice-summary panel" aria-label="Результат практики">
            <h2>Практика завершена</h2>
            <dl className="stats-list">
              <div>
                <dt>Карточек</dt>
                <dd>{finishedSummary.answered}</dd>
              </div>
              <div>
                <dt>Верно</dt>
                <dd>{finishedSummary.accepted}</dd>
              </div>
              <div>
                <dt>Ошибок</dt>
                <dd>{finishedSummary.missed}</dd>
              </div>
            </dl>
          </section>
        )}

        {queueState.items.length === 0 ? (
          <div className="notice-panel">
            <p>{formatEmptyMessage(source)}</p>
          </div>
        ) : (
          <PracticeQueuePreview items={queueState.items} />
        )}
      </section>
    );
  }

  if (currentItem === null) {
    return null;
  }

  return (
    <section className="review-session" aria-label="Сессия практики">
      <header className="review-session-header">
        <div>
          <span className="eyebrow">
            {currentIndex + 1} из {queueState.items.length}
          </span>
          <h1>Практика</h1>
        </div>
        <div className="review-progress">
          <span>Верно: {progress.accepted}</span>
          <span>Ошибок: {progress.missed}</span>
        </div>
      </header>

      <article className="review-card">
        <div className="review-card-meta">
          <span>{formatItemType(currentItem.item.itemType)}</span>
          <span>{formatAnswerType(currentItem.card.answerType)}</span>
          <span>Без изменения SRS</span>
        </div>
        <div className="review-prompt">
          <JapaneseText
            as="p"
            className="review-japanese"
            variant={currentItem.item.itemType === "sentence" ? "sentence" : "display"}
          >
            {currentItem.card.prompt.japanese}
          </JapaneseText>
        </div>
      </article>

      {feedback === null ? (
        <form className="review-answer-bar" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="practice-answer">
            <span>{formatInputLabel(currentItem.card.answerType)}</span>
            <input
              autoComplete="off"
              disabled={isSubmitting}
              id="practice-answer"
              onChange={(event) => setAnswer(event.currentTarget.value)}
              ref={answerInputRef}
              value={answer}
            />
          </label>
          <button
            className="primary-action"
            disabled={isSubmitting || answer.trim() === ""}
            type="submit"
          >
            {isSubmitting ? "Проверяю..." : "Ответить"}
          </button>
        </form>
      ) : (
        <section
          className={feedback.accepted ? "feedback-panel feedback-panel-success" : "feedback-panel"}
          aria-label="Результат ответа"
        >
          <div className="feedback-header">
            <div>
              <span className="eyebrow">{formatResult(feedback.result)}</span>
              <h2>{feedback.feedback.message}</h2>
            </div>
            <button
              className="primary-action"
              onClick={handleContinue}
              ref={continueButtonRef}
              type="button"
            >
              Дальше
            </button>
          </div>
          <div className="feedback-grid">
            <div>
              <h3>Ваш ответ</h3>
              <p>{answer}</p>
            </div>
            <div>
              <h3>Правильные ответы</h3>
              <ul className="lesson-text-list">
                {feedback.feedback.expected.map((expected) => (
                  <li key={`${expected.locale}:${expected.text}`}>
                    <span>{expected.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>SRS</h3>
              <p>Без изменений</p>
            </div>
          </div>
        </section>
      )}

      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function PracticeSourceControl({
  source,
  onChange,
}: {
  readonly source: PracticeSource;
  readonly onChange: (source: PracticeSource) => void;
}) {
  return (
    <div className="practice-source-control" role="tablist" aria-label="Источник практики">
      {PRACTICE_SOURCES.map((candidate) => (
        <button
          aria-selected={candidate === source}
          key={candidate}
          onClick={() => onChange(candidate)}
          role="tab"
          type="button"
        >
          {formatSource(candidate)}
        </button>
      ))}
    </div>
  );
}

function PracticeQueuePreview({ items }: { readonly items: readonly ReviewQueueItem[] }) {
  return (
    <div className="review-queue-grid">
      {items.slice(0, 6).map((item) => (
        <article className="review-queue-card" key={item.card.id}>
          <div>
            <span className="eyebrow">{formatItemType(item.item.itemType)}</span>
            <JapaneseText as="strong">{item.item.japanese}</JapaneseText>
          </div>
          <span>{formatAnswerType(item.card.answerType)}</span>
        </article>
      ))}
    </div>
  );
}

function formatSource(source: PracticeSource): string {
  switch (source) {
    case "recent-lessons":
      return "Недавние уроки";
    case "burned":
      return "Сожжённые";
    default:
      return "Недавние ошибки";
  }
}

function formatEmptyMessage(source: PracticeSource): string {
  switch (source) {
    case "recent-lessons":
      return "За последние 14 дней новых карточек не найдено.";
    case "burned":
      return "Сожжённых карточек пока нет.";
    default:
      return "За последние 30 дней ошибок не найдено.";
  }
}

function formatItemType(itemType: ReviewQueueItem["item"]["itemType"]): string {
  switch (itemType) {
    case "component":
      return "Компонент";
    case "kanji":
      return "Кандзи";
    case "word":
      return "Слово";
    default:
      return "Предложение";
  }
}

function formatAnswerType(answerType: ReviewQueueItem["card"]["answerType"]): string {
  return answerType === "reading" ? "Чтение" : "Значение";
}

function formatInputLabel(answerType: ReviewQueueItem["card"]["answerType"]): string {
  return answerType === "reading" ? "Введите чтение" : "Введите значение";
}

function formatResult(result: PracticeAnswerResponse["result"]): string {
  switch (result) {
    case "correct":
      return "Верно";
    case "typo":
      return "Опечатка";
    case "blocked":
      return "Ответ отклонён";
    default:
      return "Ошибка";
  }
}
