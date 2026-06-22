"use client";

import Link from "next/link";
import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type CardAnswerType,
  type ContentLocale,
  type LocalizedTextDto,
  type ReviewAnswerResponse,
  type ReviewQueueItem,
} from "@kanji-srs/shared";

import {
  ApiError,
  addPrivateAcceptedAnswer,
  finishReviewSession,
  getReviewQueue,
  startReviewSession,
  submitReviewAnswer,
  type ReviewSessionDto,
} from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";

type QueueState =
  | { readonly status: "checking" }
  | { readonly status: "loading" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly queue: readonly ReviewQueueItem[];
    };

type ReviewProgress = {
  readonly answered: number;
  readonly accepted: number;
  readonly missed: number;
};

const INITIAL_PROGRESS: ReviewProgress = {
  answered: 0,
  accepted: 0,
  missed: 0,
};

export function ReviewsClient() {
  const [queueState, setQueueState] = useState<QueueState>({ status: "checking" });
  const [session, setSession] = useState<ReviewSessionDto | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<ReviewAnswerResponse | null>(null);
  const [progress, setProgress] = useState<ReviewProgress>(INITIAL_PROGRESS);
  const [finishedSummary, setFinishedSummary] = useState<ReviewProgress | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  const loadQueue = useCallback(async () => {
    const storedSession = readStoredSession();

    if (storedSession === null) {
      setQueueState({ status: "unauthenticated" });
      return;
    }

    setQueueState({ status: "loading" });
    setSession(null);
    setCurrentIndex(0);
    setAnswer("");
    setFeedback(null);
    setProgress(INITIAL_PROGRESS);
    setFinishedSummary(null);
    setFormError(null);
    setSessionError(null);

    try {
      const queue = await getReviewQueue(storedSession.token);
      setQueueState({
        status: "ready",
        token: storedSession.token,
        queue: queue.items,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setQueueState({ status: "unauthenticated" });
        return;
      }

      setQueueState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Не удалось загрузить очередь повторений.",
      });
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const activeQueue = queueState.status === "ready" ? queueState.queue : [];
  const currentItem = session === null ? null : (activeQueue[currentIndex] ?? null);
  const totalCount = activeQueue.length;
  const progressLabel = useMemo(() => {
    if (currentItem === null) {
      return "";
    }

    return `${currentIndex + 1} из ${totalCount}`;
  }, [currentIndex, currentItem, totalCount]);

  useEffect(() => {
    if (session !== null && feedback === null && currentItem !== null && !isSubmitting) {
      answerInputRef.current?.focus();
    }
  }, [currentItem, feedback, isSubmitting, session]);

  useEffect(() => {
    if (feedback !== null) {
      continueButtonRef.current?.focus();
    }
  }, [feedback]);

  async function handleStartSession(): Promise<void> {
    if (queueState.status !== "ready" || queueState.queue.length === 0) {
      return;
    }

    setIsStarting(true);
    setSessionError(null);
    setFinishedSummary(null);

    try {
      const response = await startReviewSession(queueState.token);
      setSession(response.session);
      setCurrentIndex(0);
      setAnswer("");
      setFeedback(null);
      setProgress(INITIAL_PROGRESS);
    } catch (error: unknown) {
      setSessionError(error instanceof Error ? error.message : "Не удалось начать повторение.");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (
      queueState.status !== "ready" ||
      session === null ||
      currentItem === null ||
      feedback !== null ||
      isSubmitting
    ) {
      return;
    }

    const trimmedAnswer = answer.trim();

    if (trimmedAnswer === "") {
      setFormError("Введите ответ.");
      answerInputRef.current?.focus();
      return;
    }

    setFormError(null);
    setSessionError(null);
    setIsSubmitting(true);

    try {
      const response = await submitReviewAnswer(queueState.token, session.id, {
        cardId: currentItem.card.id,
        answer: trimmedAnswer,
        answerType: currentItem.card.answerType,
        answeredAt: new Date().toISOString(),
      });

      setFeedback(response);
      setProgress((previous) => ({
        answered: previous.answered + 1,
        accepted: previous.accepted + (response.accepted ? 1 : 0),
        missed: previous.missed + (response.accepted ? 0 : 1),
      }));
    } catch (error: unknown) {
      setSessionError(error instanceof Error ? error.message : "Не удалось отправить ответ.");
      answerInputRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleContinue(): Promise<void> {
    if (queueState.status !== "ready" || session === null || feedback === null || isContinuing) {
      return;
    }

    const nextIndex = currentIndex + 1;
    setSessionError(null);

    if (nextIndex < queueState.queue.length) {
      setCurrentIndex(nextIndex);
      setAnswer("");
      setFeedback(null);
      setFormError(null);
      return;
    }

    setIsContinuing(true);

    try {
      await finishReviewSession(queueState.token, session.id);
      setFinishedSummary(progress);
      setSession(null);
      setCurrentIndex(0);
      setAnswer("");
      setFeedback(null);
      setFormError(null);
    } catch (error: unknown) {
      setSessionError(error instanceof Error ? error.message : "Не удалось завершить сессию.");
    } finally {
      setIsContinuing(false);
    }
  }

  if (queueState.status === "checking" || queueState.status === "loading") {
    return (
      <section className="page-stack" aria-busy="true">
        <div className="page-heading">
          <h1>Повторения</h1>
          <p>Загружаю очередь карточек.</p>
        </div>
        <div className="review-loading-grid" aria-hidden="true">
          <div className="panel skeleton" />
          <div className="panel skeleton" />
        </div>
      </section>
    );
  }

  if (queueState.status === "unauthenticated") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Повторения</h1>
          <p>Нужен вход в аккаунт.</p>
        </div>
        <div className="notice-panel">
          <p>Войдите в demo-аккаунт, чтобы открыть очередь SRS и отправлять ответы.</p>
          <Link className="primary-action" href="/login">
            Войти
          </Link>
        </div>
      </section>
    );
  }

  if (queueState.status === "error") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Повторения</h1>
          <p>Очередь сейчас недоступна.</p>
        </div>
        <div className="notice-panel error-panel">
          <p>{queueState.message}</p>
          <button className="secondary-action" onClick={() => void loadQueue()} type="button">
            Повторить загрузку
          </button>
        </div>
      </section>
    );
  }

  if (finishedSummary !== null) {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Повторения</h1>
          <p>Сессия завершена.</p>
        </div>
        <div className="review-summary panel">
          <dl className="stats-list">
            <div>
              <dt>Ответов</dt>
              <dd>{finishedSummary.answered}</dd>
            </div>
            <div>
              <dt>Принято</dt>
              <dd>{finishedSummary.accepted}</dd>
            </div>
            <div>
              <dt>Ошибок</dt>
              <dd>{finishedSummary.missed}</dd>
            </div>
          </dl>
          <div className="action-row">
            <button className="primary-action" onClick={() => void loadQueue()} type="button">
              Обновить очередь
            </button>
            <Link className="secondary-action" href="/dashboard">
              На панель
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (queueState.queue.length === 0) {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Повторения</h1>
          <p>Нет карточек к повторению.</p>
        </div>
        <div className="notice-panel">
          <p>Следующая сессия появится, когда SRS расписание откроет новые карточки.</p>
          <button className="secondary-action" onClick={() => void loadQueue()} type="button">
            Проверить снова
          </button>
        </div>
      </section>
    );
  }

  if (session === null) {
    return (
      <section className="page-stack">
        <div className="page-heading review-heading">
          <div>
            <h1>Повторения</h1>
            <p>
              Готово карточек: {queueState.queue.length}. Ответы проверяются API с учётом ваших
              приватных вариантов.
            </p>
          </div>
          <button
            className="primary-action"
            disabled={isStarting}
            onClick={() => void handleStartSession()}
            type="button"
          >
            {isStarting ? "Начинаю..." : "Начать повторение"}
          </button>
        </div>
        {sessionError === null ? null : <p className="form-error">{sessionError}</p>}
        <ReviewQueuePreview queue={queueState.queue} />
      </section>
    );
  }

  if (currentItem === null) {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Повторения</h1>
          <p>Сессия потеряла текущую карточку.</p>
        </div>
        <button className="secondary-action" onClick={() => void loadQueue()} type="button">
          Перезагрузить очередь
        </button>
      </section>
    );
  }

  return (
    <section className="review-session" aria-label="Сессия повторения">
      <header className="review-session-header">
        <div>
          <span className="eyebrow">{progressLabel}</span>
          <h1>Повторение</h1>
        </div>
        <div className="review-progress">
          <span>Принято: {progress.accepted}</span>
          <span>Ошибок: {progress.missed}</span>
        </div>
      </header>

      <article className="review-card">
        <div className="review-card-meta">
          <span>{formatItemType(currentItem.item.itemType)}</span>
          <span>{formatAnswerType(currentItem.card.answerType)}</span>
          <span>{currentItem.srs.stageName}</span>
        </div>
        <div className="review-prompt">
          <p className="review-japanese">{currentItem.card.prompt.japanese}</p>
          {currentItem.card.answerType === "meaning" ? null : (
            <p className="muted">Введите чтение. Правильный вариант появится после ответа.</p>
          )}
          {currentItem.card.answerType === "reading" ? null : (
            <p className="muted">Введите значение. Правильный вариант появится после ответа.</p>
          )}
        </div>
      </article>

      {feedback === null ? null : (
        <FeedbackPanel
          answer={answer}
          feedback={feedback}
          item={currentItem}
          onContinue={() => void handleContinue()}
          continueButtonRef={continueButtonRef}
          isContinuing={isContinuing}
          token={queueState.token}
        />
      )}

      {sessionError === null ? null : <p className="form-error">{sessionError}</p>}

      <form className="review-answer-bar" onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="review-answer">
          <span>{formatInputLabel(currentItem.card.answerType)}</span>
          <input
            autoComplete="off"
            disabled={feedback !== null || isSubmitting}
            id="review-answer"
            onChange={(event) => setAnswer(event.currentTarget.value)}
            placeholder={formatInputPlaceholder(currentItem.card.answerType)}
            ref={answerInputRef}
            spellCheck={currentItem.card.answerType === "meaning"}
            value={answer}
          />
        </label>
        <button
          className="primary-action"
          disabled={feedback !== null || isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Проверяю..." : "Ответить"}
        </button>
        {formError === null ? null : <p className="form-error">{formError}</p>}
      </form>
    </section>
  );
}

function ReviewQueuePreview({ queue }: { readonly queue: readonly ReviewQueueItem[] }) {
  return (
    <div className="review-queue-grid">
      {queue.slice(0, 6).map((item) => (
        <article className="review-queue-card" key={item.card.id}>
          <div>
            <span className="eyebrow">{formatItemType(item.item.itemType)}</span>
            <strong>{item.item.japanese}</strong>
          </div>
          <span>{formatAnswerType(item.card.answerType)}</span>
        </article>
      ))}
    </div>
  );
}

function FeedbackPanel({
  answer,
  feedback,
  item,
  onContinue,
  continueButtonRef,
  isContinuing,
  token,
}: {
  readonly answer: string;
  readonly feedback: ReviewAnswerResponse;
  readonly item: ReviewQueueItem;
  readonly onContinue: () => void;
  readonly continueButtonRef: RefObject<HTMLButtonElement | null>;
  readonly isContinuing: boolean;
  readonly token: string;
}) {
  const [privateAnswer, setPrivateAnswer] = useState(answer.trim());
  const [privateLocale, setPrivateLocale] = useState<ContentLocale>("ru-RU");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isAccepted = feedback.accepted;

  async function handleSavePrivateAnswer(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const text = privateAnswer.trim();

    if (text === "") {
      setSaveError("Введите вариант ответа.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      await addPrivateAcceptedAnswer(token, item.card.id, {
        answerKind: item.card.answerType,
        text,
        locale: privateLocale,
        note: "Добавлено из сессии повторения.",
      });
      setSaveMessage("Приватный вариант сохранён.");
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить вариант.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      aria-label="Результат ответа"
      className={isAccepted ? "feedback-panel feedback-panel-success" : "feedback-panel"}
    >
      <div className="feedback-header">
        <div>
          <span className="eyebrow">{formatResult(feedback.result)}</span>
          <h2>{feedback.feedback.message}</h2>
        </div>
        <button
          className="primary-action"
          disabled={isContinuing}
          onClick={onContinue}
          ref={continueButtonRef}
          type="button"
        >
          {isContinuing ? "Завершаю..." : "Дальше"}
        </button>
      </div>

      <div className="feedback-grid">
        <div>
          <h3>Ваш ответ</h3>
          <p>{answer}</p>
        </div>
        <div>
          <h3>Правильные ответы</h3>
          <ExpectedAnswers answers={feedback.feedback.expected} answerType={item.card.answerType} />
        </div>
        <div>
          <h3>Следующий SRS</h3>
          <p>
            {feedback.nextSrs.stageName}
            {feedback.nextSrs.availableAt === null
              ? ""
              : ` · ${new Date(feedback.nextSrs.availableAt).toLocaleString("ru-RU")}`}
          </p>
        </div>
      </div>

      <form
        className="private-answer-form"
        onSubmit={(event) => void handleSavePrivateAnswer(event)}
      >
        <label>
          <span>Приватный правильный вариант</span>
          <input
            autoComplete="off"
            onChange={(event) => setPrivateAnswer(event.currentTarget.value)}
            value={privateAnswer}
          />
        </label>
        <label>
          <span>Язык</span>
          <select
            onChange={(event) => setPrivateLocale(event.currentTarget.value as ContentLocale)}
            value={privateLocale}
          >
            <option value="ru-RU">Русский</option>
            <option value="en-US">English</option>
          </select>
        </label>
        <button className="secondary-action" disabled={isSaving} type="submit">
          {isSaving ? "Сохраняю..." : "Сохранить вариант"}
        </button>
        {saveMessage === null ? null : <p className="success-text">{saveMessage}</p>}
        {saveError === null ? null : <p className="form-error">{saveError}</p>}
      </form>
    </section>
  );
}

function ExpectedAnswers({
  answers,
  answerType,
}: {
  readonly answers: readonly LocalizedTextDto[];
  readonly answerType: CardAnswerType;
}) {
  if (answers.length === 0) {
    return <p className="muted">API не вернул список ответов.</p>;
  }

  return (
    <ul aria-label="Правильные ответы" className="expected-answer-list">
      {answers.map((answer, index) => (
        <li key={`${answer.locale}-${answer.text}-${index}`}>
          <span>{answer.text}</span>
          {answerType === "reading" ? null : <small>{formatLocale(answer.locale)}</small>}
        </li>
      ))}
    </ul>
  );
}

function formatItemType(itemType: ReviewQueueItem["item"]["itemType"]): string {
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

function formatAnswerType(answerType: CardAnswerType): string {
  return answerType === "reading" ? "Чтение" : "Значение";
}

function formatInputLabel(answerType: CardAnswerType): string {
  return answerType === "reading" ? "Ответ чтением" : "Ответ значением";
}

function formatInputPlaceholder(answerType: CardAnswerType): string {
  return answerType === "reading" ? "например: にほん" : "например: Япония";
}

function formatResult(result: ReviewAnswerResponse["result"]): string {
  switch (result) {
    case "correct":
      return "Верно";
    case "typo":
      return "Опечатка";
    case "blocked":
      return "Отклонено";
    case "reveal":
      return "Показан ответ";
    case "manual-ignore":
      return "Игнорировано";
    case "wrong":
      return "Ошибка";
  }
}

function formatLocale(locale: LocalizedTextDto["locale"]): string {
  return locale === "ru-RU" ? "RU" : "EN";
}
