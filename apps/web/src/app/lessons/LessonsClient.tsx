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
  getContentLocalesForDisplayMode,
  type CardAnswerType,
  type CompleteLessonItemResponse,
  type ContentLocale,
  type LearningCardDto,
  type LessonQueueItem,
  type LessonQueueSourceDto,
  type LessonSessionDto,
  type LocalizedTextDto,
  type TranslationBundleDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import {
  ApiError,
  completeLessonItem,
  finishLessonSession,
  getLessonQueue,
  startLessonSession,
} from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";
import { type LessonOrderMode, orderLessonSelection } from "../../lib/lesson-selection";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";

type QueueState =
  | { readonly status: "checking" }
  | { readonly status: "loading" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly suggestedItems: readonly LessonQueueItem[];
      readonly availableItems: readonly LessonQueueItem[];
      readonly batchLimit: number;
      readonly remainingToday: number;
      readonly source: LessonQueueSourceDto;
    };

type LessonStep = "study" | "quiz";

type CompletionSummary = {
  readonly learnedItems: number;
  readonly createdCards: number;
};

export function LessonsClient() {
  const activeDisplayMode = useTranslationDisplayMode();
  const [queueState, setQueueState] = useState<QueueState>({ status: "checking" });
  const [session, setSession] = useState<LessonSessionDto | null>(null);
  const [sessionQueue, setSessionQueue] = useState<readonly LessonQueueItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<readonly string[]>([]);
  const [orderMode, setOrderMode] = useState<LessonOrderMode>("course");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<LessonStep>("study");
  const [quizCardIndex, setQuizCardIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizFeedback, setQuizFeedback] = useState<
    CompleteLessonItemResponse["answers"][number] | null
  >(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
  const quizInputRef = useRef<HTMLInputElement>(null);

  const loadQueue = useCallback(async () => {
    const storedSession = readStoredSession();

    if (storedSession === null) {
      setQueueState({ status: "unauthenticated" });
      return;
    }

    setQueueState({ status: "loading" });
    setSession(null);
    setSessionQueue([]);
    setSelectedItemIds([]);
    setOrderMode("course");
    setCurrentIndex(0);
    setStep("study");
    setQuizCardIndex(0);
    setQuizAnswer("");
    setQuizAnswers({});
    setQuizFeedback(null);
    setSessionError(null);
    setCompletionSummary(null);

    try {
      const requestedDeckId = readRequestedDeckId();
      const queue = await getLessonQueue(storedSession.token, requestedDeckId);
      const availableItems = queue.availableItems ?? queue.items;
      setQueueState({
        status: "ready",
        token: storedSession.token,
        suggestedItems: queue.items,
        availableItems,
        batchLimit: queue.batchLimit,
        remainingToday: queue.remainingToday,
        source: queue.source ?? { kind: "course" },
      });
      setSelectedItemIds(queue.items.map((lesson) => lesson.item.id));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setQueueState({ status: "unauthenticated" });
        return;
      }

      setQueueState({
        status: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить очередь уроков.",
      });
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const activeQueue = sessionQueue;
  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const selectedLessons = useMemo(
    () =>
      queueState.status === "ready"
        ? queueState.availableItems.filter((lesson) => selectedItemIdSet.has(lesson.item.id))
        : [],
    [queueState, selectedItemIdSet],
  );
  const currentLesson = session === null ? null : (activeQueue[currentIndex] ?? null);
  const learnedItems = completionSummary?.learnedItems ?? 0;
  const progressLabel = useMemo(() => {
    if (currentLesson === null) {
      return "";
    }

    return `${currentIndex + 1} из ${activeQueue.length}`;
  }, [activeQueue.length, currentIndex, currentLesson]);

  async function handleStartSession(): Promise<void> {
    if (queueState.status !== "ready" || selectedLessons.length === 0 || isStarting) {
      return;
    }

    const orderedLessons = orderLessonSelection(selectedLessons, orderMode);
    setIsStarting(true);
    setSessionError(null);
    setCompletionSummary(null);

    try {
      const response = await startLessonSession(
        queueState.token,
        queueState.source.kind === "deck" ? queueState.source.deckId : null,
      );
      setSession(response.session);
      setSessionQueue(orderedLessons);
      setCurrentIndex(0);
      setStep("study");
      setQuizCardIndex(0);
      setQuizAnswer("");
      setQuizAnswers({});
      setQuizFeedback(null);
    } catch (error: unknown) {
      setSessionError(error instanceof Error ? error.message : "Не удалось начать урок.");
    } finally {
      setIsStarting(false);
    }
  }

  function handleToggleLesson(itemId: string): void {
    if (queueState.status !== "ready") {
      return;
    }

    setSelectedItemIds((current) => {
      if (current.includes(itemId)) {
        return current.filter((candidate) => candidate !== itemId);
      }

      return current.length >= queueState.batchLimit ? current : [...current, itemId];
    });
  }

  function handleUseSuggestedBatch(): void {
    if (queueState.status === "ready") {
      setSelectedItemIds(queueState.suggestedItems.map((lesson) => lesson.item.id));
    }
  }

  function handleContinueStudy(): void {
    if (currentIndex + 1 < activeQueue.length) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    setCurrentIndex(0);
    setStep("quiz");
    setQuizCardIndex(0);
    setQuizAnswer("");
    setQuizAnswers({});
    setQuizFeedback(null);
    setSessionError(null);
  }

  useEffect(() => {
    if (step === "quiz") {
      quizInputRef.current?.focus();
    }
  }, [currentIndex, quizCardIndex, step]);

  async function handleQuizSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const quizCard = currentLesson?.cards[quizCardIndex];
    if (
      queueState.status !== "ready" ||
      session === null ||
      currentLesson === null ||
      quizCard === undefined ||
      quizAnswer.trim() === "" ||
      isCompleting
    ) {
      return;
    }

    const nextAnswers = { ...quizAnswers, [quizCard.id]: quizAnswer.trim() };
    const nextUnansweredIndex = currentLesson.cards.findIndex(
      (card) => (nextAnswers[card.id] ?? "").trim() === "",
    );

    setQuizAnswers(nextAnswers);
    setQuizFeedback(null);

    if (nextUnansweredIndex !== -1) {
      setQuizCardIndex(nextUnansweredIndex);
      setQuizAnswer("");
      return;
    }

    setIsCompleting(true);
    setSessionError(null);

    try {
      const result = await completeLessonItem(queueState.token, session.id, {
        itemId: currentLesson.item.id,
        answers: currentLesson.cards.map((card) => ({
          cardId: card.id,
          answerType: card.answerType,
          answer: nextAnswers[card.id] ?? "",
        })),
      });

      if (!result.passed) {
        const firstFailed = result.answers.find((answer) => !answer.accepted);
        const failedIndex = currentLesson.cards.findIndex(
          (card) => card.id === firstFailed?.cardId,
        );

        setQuizCardIndex(Math.max(0, failedIndex));
        setQuizAnswer("");
        setQuizFeedback(firstFailed ?? null);
        return;
      }

      const nextIndex = currentIndex + 1;
      const nextSummary: CompletionSummary = {
        learnedItems: learnedItems + 1,
        createdCards: (completionSummary?.createdCards ?? 0) + result.createdSrsStateCount,
      };

      if (nextIndex < activeQueue.length) {
        setCurrentIndex(nextIndex);
        setQuizCardIndex(0);
        setQuizAnswer("");
        setQuizAnswers({});
        setQuizFeedback(null);
        setCompletionSummary(nextSummary);
        return;
      }

      await finishLessonSession(queueState.token, session.id);
      setSession(null);
      setSessionQueue([]);
      setCurrentIndex(0);
      setStep("study");
      setQuizCardIndex(0);
      setQuizAnswer("");
      setQuizAnswers({});
      setQuizFeedback(null);
      setCompletionSummary(nextSummary);
    } catch (error: unknown) {
      setSessionError(error instanceof Error ? error.message : "Не удалось завершить карточку.");
    } finally {
      setIsCompleting(false);
    }
  }

  if (queueState.status === "checking" || queueState.status === "loading") {
    return (
      <section className="page-stack" aria-busy="true">
        <div className="page-heading">
          <h1>Уроки</h1>
          <p>Загружаю очередь новых материалов.</p>
        </div>
        <div className="lesson-preview-grid" aria-hidden="true">
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
          <h1>Уроки</h1>
          <p>Нужен вход в аккаунт.</p>
        </div>
        <div className="notice-panel">
          <p>Войдите в demo-аккаунт, чтобы открыть очередь уроков и создать карточки повторения.</p>
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
          <h1>Уроки</h1>
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

  if (completionSummary !== null && session === null) {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Уроки</h1>
          <p>Сессия завершена. Новые карточки добавлены в систему повторений.</p>
        </div>
        <div className="lesson-summary panel">
          <dl className="stats-list">
            <div>
              <dt>Изучено</dt>
              <dd>{completionSummary.learnedItems}</dd>
            </div>
            <div>
              <dt>Карточек повторения</dt>
              <dd>{completionSummary.createdCards}</dd>
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

  if (queueState.availableItems.length === 0) {
    const isDeckQueue = queueState.source.kind === "deck";

    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>{isDeckQueue ? "Уроки колоды" : "Уроки"}</h1>
          <p>Очередь пуста.</p>
        </div>
        <div className="notice-panel">
          <p>
            {isDeckQueue
              ? "В колоде нет доступных новых материалов: проверьте предпосылки или дневной лимит."
              : "Новые уроки появятся, когда курс откроет следующий материал или обновится лимит дня."}
          </p>
          <button className="secondary-action" onClick={() => void loadQueue()} type="button">
            Проверить снова
          </button>
        </div>
      </section>
    );
  }

  if (session === null) {
    const isDeckQueue = queueState.source.kind === "deck";

    return (
      <section className="page-stack">
        <div className="page-heading lesson-heading">
          <div>
            <h1>{isDeckQueue ? "Уроки колоды" : "Уроки"}</h1>
            <p>
              {isDeckQueue ? `${queueState.source.title}. ` : ""}
              Выбрано: {selectedLessons.length} из максимум {queueState.batchLimit}. Доступно:{" "}
              {queueState.availableItems.length}. Осталось на сегодня: {queueState.remainingToday}.
              Режим перевода: {formatDisplayMode(activeDisplayMode)}.
            </p>
          </div>
          <button
            className="primary-action"
            disabled={isStarting || selectedLessons.length === 0}
            onClick={() => void handleStartSession()}
            type="button"
          >
            {isStarting ? "Начинаю..." : "Начать урок"}
          </button>
        </div>
        {sessionError === null ? null : (
          <p className="form-error" role="alert">
            {sessionError}
          </p>
        )}
        <LessonPicker
          availableItems={queueState.availableItems}
          batchLimit={queueState.batchLimit}
          displayMode={activeDisplayMode}
          orderMode={orderMode}
          selectedItemIds={selectedItemIdSet}
          onClear={() => setSelectedItemIds([])}
          onOrderModeChange={setOrderMode}
          onToggle={handleToggleLesson}
          onUseSuggested={handleUseSuggestedBatch}
        />
      </section>
    );
  }

  if (currentLesson === null) {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Уроки</h1>
          <p>Сессия потеряла текущий материал.</p>
        </div>
        <button className="secondary-action" onClick={() => void loadQueue()} type="button">
          Перезагрузить очередь
        </button>
      </section>
    );
  }

  return (
    <section className="lesson-session" aria-label="Сессия урока">
      <header className="lesson-session-header">
        <div>
          <span className="eyebrow">{progressLabel}</span>
          <h1>{step === "study" ? "Изучение" : "Обязательная проверка"}</h1>
        </div>
        <div className="review-progress">
          <span>Изучено: {learnedItems}</span>
          <span>{formatDisplayMode(activeDisplayMode)}</span>
        </div>
      </header>

      {step === "study" ? (
        <LessonStudyView
          lesson={currentLesson}
          displayMode={activeDisplayMode}
          isLast={currentIndex === activeQueue.length - 1}
          onContinue={handleContinueStudy}
        />
      ) : (
        <LessonQuizView
          lesson={currentLesson}
          cardIndex={quizCardIndex}
          answer={quizAnswer}
          feedback={quizFeedback}
          isCompleting={isCompleting}
          onAnswerChange={setQuizAnswer}
          inputRef={quizInputRef}
          onSubmit={(event) => void handleQuizSubmit(event)}
        />
      )}

      {sessionError === null ? null : (
        <p className="form-error" role="alert">
          {sessionError}
        </p>
      )}
    </section>
  );
}

function LessonPicker({
  availableItems,
  batchLimit,
  displayMode,
  orderMode,
  selectedItemIds,
  onClear,
  onOrderModeChange,
  onToggle,
  onUseSuggested,
}: {
  readonly availableItems: readonly LessonQueueItem[];
  readonly batchLimit: number;
  readonly displayMode: TranslationDisplayMode;
  readonly orderMode: LessonOrderMode;
  readonly selectedItemIds: ReadonlySet<string>;
  readonly onClear: () => void;
  readonly onOrderModeChange: (mode: LessonOrderMode) => void;
  readonly onToggle: (itemId: string) => void;
  readonly onUseSuggested: () => void;
}) {
  const selectedCount = selectedItemIds.size;

  return (
    <section className="lesson-picker" aria-labelledby="lesson-picker-heading">
      <header className="lesson-picker-header">
        <div>
          <span className="eyebrow">
            {selectedCount} / {batchLimit}
          </span>
          <h2 id="lesson-picker-heading">Группа урока</h2>
        </div>
        <div className="lesson-picker-actions">
          <button className="text-action" onClick={onUseSuggested} type="button">
            Рекомендованные
          </button>
          <button
            className="text-action"
            disabled={selectedCount === 0}
            onClick={onClear}
            type="button"
          >
            Очистить
          </button>
        </div>
      </header>

      <div className="lesson-order-control" role="group" aria-label="Порядок материалов">
        <button
          aria-pressed={orderMode === "course"}
          onClick={() => onOrderModeChange("course")}
          type="button"
        >
          Порядок источника
        </button>
        <button
          aria-pressed={orderMode === "interleaved"}
          onClick={() => onOrderModeChange("interleaved")}
          type="button"
        >
          Чередовать типы
        </button>
      </div>

      <div className="lesson-preview-grid">
        {availableItems.map((lesson) => {
          const isSelected = selectedItemIds.has(lesson.item.id);
          const isDisabled = !isSelected && selectedCount >= batchLimit;

          return (
            <label
              className={`lesson-preview-card${isSelected ? " lesson-preview-card-selected" : ""}`}
              key={lesson.item.id}
            >
              <input
                aria-label={`Выбрать ${lesson.item.japanese}: ${formatTranslationBundle(lesson.item.translations, displayMode)}`}
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => onToggle(lesson.item.id)}
                type="checkbox"
              />
              <span className="lesson-preview-content">
                <span className="eyebrow">{formatItemType(lesson.item.itemType)}</span>
                <JapaneseText as="strong">{lesson.item.japanese}</JapaneseText>
                <span>{formatTranslationBundle(lesson.item.translations, displayMode)}</span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function LessonStudyView({
  lesson,
  displayMode,
  isLast,
  onContinue,
}: {
  readonly lesson: LessonQueueItem;
  readonly displayMode: TranslationDisplayMode;
  readonly isLast: boolean;
  readonly onContinue: () => void;
}) {
  const meaningCards = lesson.cards.filter((card) => card.answerType === "meaning");
  const readingCards = lesson.cards.filter((card) => card.answerType === "reading");
  const mnemonicTexts = getLearningTexts(lesson.mnemonics, displayMode);
  const hintTexts = getLearningTexts(lesson.hints, displayMode);

  return (
    <>
      <article className="lesson-hero panel">
        <div className="lesson-hero-main">
          <span className="eyebrow">{formatItemType(lesson.item.itemType)}</span>
          <JapaneseText
            as="p"
            className="review-japanese"
            variant={lesson.item.itemType === "sentence" ? "sentence" : "display"}
          >
            {lesson.item.japanese}
          </JapaneseText>
          <p>{formatTranslationBundle(lesson.item.translations, displayMode)}</p>
        </div>
        <dl className="lesson-facts">
          <div>
            <dt>Чтение</dt>
            <dd>{lesson.item.reading ?? "нет"}</dd>
          </div>
          <div>
            <dt>Уровень</dt>
            <dd>{lesson.item.level ?? "без уровня"}</dd>
          </div>
          <div>
            <dt>JLPT</dt>
            <dd>{lesson.item.jlptLevel ?? "нет"}</dd>
          </div>
        </dl>
      </article>

      <div className="lesson-study-grid">
        <section className="panel">
          <h2>Объяснение</h2>
          <p>
            Изучаем {formatItemTypeLower(lesson.item.itemType)} как отдельный учебный материал.
            После изучения всей группы обязательная проверка создаст расписание повторений для{" "}
            {lesson.cards.length} {formatCardsCount(lesson.cards.length)} только при верных ответах.
          </p>
        </section>

        <section className="panel">
          <h2>Значения</h2>
          <TextList texts={collectCardAnswers(meaningCards, displayMode)} />
        </section>

        <section className="panel">
          <h2>Чтения</h2>
          {lesson.item.reading === null && readingCards.length === 0 ? (
            <p className="muted">Для этого материала чтение не требуется.</p>
          ) : (
            <TextList
              textKind="reading"
              texts={[
                ...(lesson.item.reading === null
                  ? []
                  : [{ locale: "ru-RU" as const, text: lesson.item.reading }]),
                ...collectCardAnswers(readingCards, displayMode),
              ]}
            />
          )}
        </section>

        <section className="panel">
          <h2>Связи</h2>
          {lesson.unlockedBy.length === 0 ? (
            <p className="muted">Материал доступен без предварительных компонентов.</p>
          ) : (
            <ul className="lesson-relation-list">
              {lesson.unlockedBy.map((item) => (
                <li key={item.id}>
                  <JapaneseText>{item.japanese}</JapaneseText>
                  <small>{formatTranslationBundle(item.translations, displayMode)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel lesson-wide-panel">
          <h2>Мнемоника и подсказка</h2>
          <div className="lesson-memory-grid">
            <div>
              <h3>Мнемоника</h3>
              <TextList texts={mnemonicTexts} />
            </div>
            <div>
              <h3>Подсказка</h3>
              <TextList texts={hintTexts} />
            </div>
          </div>
        </section>

        {lesson.exampleSentences.length === 0 ? null : (
          <section className="panel lesson-wide-panel">
            <h2>Примеры употребления</h2>
            <ul className="lesson-example-list">
              {lesson.exampleSentences.map((sentence) => (
                <li key={sentence.id}>
                  <JapaneseText variant="sentence">{sentence.japaneseText}</JapaneseText>
                  {sentence.readingText === null ? null : <span>{sentence.readingText}</span>}
                  <p>{formatLessonSentenceTranslation(sentence, displayMode)}</p>
                  {sentence.attribution === null ? null : (
                    <small>
                      {sentence.attribution.sourceName} · {sentence.attribution.licenseName}
                    </small>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="lesson-action-bar">
        <button className="primary-action" onClick={onContinue} type="button">
          {isLast ? "Перейти к проверке" : "Следующий материал"}
        </button>
      </div>
    </>
  );
}

function LessonQuizView({
  lesson,
  cardIndex,
  answer,
  feedback,
  isCompleting,
  onAnswerChange,
  inputRef,
  onSubmit,
}: {
  readonly lesson: LessonQueueItem;
  readonly cardIndex: number;
  readonly answer: string;
  readonly feedback: CompleteLessonItemResponse["answers"][number] | null;
  readonly isCompleting: boolean;
  readonly onAnswerChange: (value: string) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const quizCard = lesson.cards[cardIndex];
  const answerType = quizCard?.answerType ?? "meaning";

  return (
    <article className="lesson-quiz panel">
      <div className="lesson-quiz-prompt">
        <span className="eyebrow">{formatAnswerType(answerType)}</span>
        <strong className="lesson-quiz-count">
          Карточка {Math.min(cardIndex + 1, lesson.cards.length)} из {lesson.cards.length}
        </strong>
        <JapaneseText
          as="p"
          className="review-japanese"
          variant={lesson.item.itemType === "sentence" ? "sentence" : "display"}
        >
          {lesson.item.japanese}
        </JapaneseText>
        <p className="muted">
          Введите {answerType === "reading" ? "чтение" : "значение"}. Материал попадёт в SRS только
          после верных ответов на все карточки.
        </p>
      </div>

      <form className="lesson-quiz-form" onSubmit={onSubmit}>
        <label htmlFor="lesson-quiz-answer">
          <span>{answerType === "reading" ? "Ваше чтение" : "Ваше значение"}</span>
          <input
            autoComplete="off"
            disabled={isCompleting}
            id="lesson-quiz-answer"
            onChange={(event) => onAnswerChange(event.currentTarget.value)}
            placeholder={answerType === "reading" ? "например: いち" : "например: один"}
            ref={inputRef}
            value={answer}
          />
        </label>
        <button
          className="primary-action"
          disabled={isCompleting || answer.trim() === ""}
          type="submit"
        >
          {isCompleting ? "Проверяю..." : "Проверить"}
        </button>
      </form>

      {feedback === null ? null : (
        <section className="lesson-quiz-result" aria-label="Результат проверки" role="alert">
          <h2>{feedback.result === "blocked" ? "Этот ответ не подходит" : "Попробуйте ещё раз"}</h2>
          <p>
            Карточка ещё не добавлена в SRS. Введите другой ответ, чтобы продолжить обязательную
            проверку.
          </p>
          <strong>Допустимые ответы</strong>
          <TextList
            textKind={answerType === "reading" ? "reading" : "localized"}
            texts={feedback.expected}
          />
        </section>
      )}
    </article>
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
    return <p className="muted">Нет данных для выбранного режима перевода.</p>;
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
            {textKind === "reading"
              ? "чтение"
              : `${formatLocale(text.locale)}${text.sourceKind === "user" ? " · личное" : ""}`}
          </small>
        </li>
      ))}
    </ul>
  );
}

function collectCardAnswers(
  cards: readonly LearningCardDto[],
  displayMode: TranslationDisplayMode,
): readonly LocalizedTextDto[] {
  const locales = getContentLocalesForDisplayMode(displayMode);
  const seen = new Set<string>();
  const answers: LocalizedTextDto[] = [];

  for (const card of cards) {
    for (const answer of card.acceptedAnswers) {
      if (card.answerType === "meaning" && !locales.includes(answer.locale)) {
        continue;
      }

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

function getLearningTexts(
  texts: LessonQueueItem["mnemonics"],
  displayMode: TranslationDisplayMode,
): readonly LocalizedTextDto[] {
  const locales = getContentLocalesForDisplayMode(displayMode);
  return [...texts.ru, ...texts.en].filter((text) => locales.includes(text.locale));
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

function formatLessonSentenceTranslation(
  sentence: LessonQueueItem["exampleSentences"][number],
  displayMode: TranslationDisplayMode,
): string {
  const parts: string[] = [];

  if ((displayMode === "ru" || displayMode === "ru-en") && sentence.translationRu !== null) {
    parts.push(sentence.translationRu);
  }

  if ((displayMode === "en" || displayMode === "ru-en") && sentence.translationEn !== null) {
    parts.push(sentence.translationEn);
  }

  return parts.join(" / ");
}

function formatItemType(itemType: LessonQueueItem["item"]["itemType"]): string {
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

function formatItemTypeLower(itemType: LessonQueueItem["item"]["itemType"]): string {
  switch (itemType) {
    case "component":
      return "компонент";
    case "kanji":
      return "кандзи";
    case "word":
      return "слово";
    case "sentence":
      return "предложение";
  }
}

function formatAnswerType(answerType: CardAnswerType): string {
  return answerType === "reading" ? "Чтение" : "Значение";
}

function formatLocale(locale: ContentLocale): string {
  return locale === "ru-RU" ? "RU" : "EN";
}

function formatDisplayMode(mode: TranslationDisplayMode): string {
  switch (mode) {
    case "ru":
      return "русский";
    case "en":
      return "English";
    case "ru-en":
      return "русский + English";
  }
}

function formatCardsCount(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return "карточек";
  }

  if (last === 1) {
    return "карточки";
  }

  if (last >= 2 && last <= 4) {
    return "карточки";
  }

  return "карточек";
}

function readRequestedDeckId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const deckId = new URLSearchParams(window.location.search).get("deckId")?.trim() ?? "";
  return deckId === "" ? null : deckId;
}
