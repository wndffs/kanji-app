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
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";

type QueueState =
  | { readonly status: "checking" }
  | { readonly status: "loading" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly queue: readonly LessonQueueItem[];
      readonly batchLimit: number;
      readonly remainingToday: number;
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
    setCurrentIndex(0);
    setStep("study");
    setQuizCardIndex(0);
    setQuizAnswer("");
    setQuizAnswers({});
    setQuizFeedback(null);
    setSessionError(null);
    setCompletionSummary(null);

    try {
      const queue = await getLessonQueue(storedSession.token);
      setQueueState({
        status: "ready",
        token: storedSession.token,
        queue: queue.items,
        batchLimit: queue.batchLimit,
        remainingToday: queue.remainingToday,
      });
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

  const activeQueue = queueState.status === "ready" ? queueState.queue : [];
  const currentLesson = session === null ? null : (activeQueue[currentIndex] ?? null);
  const learnedItems = completionSummary?.learnedItems ?? 0;
  const progressLabel = useMemo(() => {
    if (currentLesson === null) {
      return "";
    }

    return `${currentIndex + 1} из ${activeQueue.length}`;
  }, [activeQueue.length, currentIndex, currentLesson]);

  async function handleStartSession(): Promise<void> {
    if (queueState.status !== "ready" || queueState.queue.length === 0 || isStarting) {
      return;
    }

    setIsStarting(true);
    setSessionError(null);
    setCompletionSummary(null);

    try {
      const response = await startLessonSession(queueState.token);
      setSession(response.session);
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

      if (nextIndex < queueState.queue.length) {
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

  if (queueState.queue.length === 0) {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Уроки</h1>
          <p>Очередь пуста.</p>
        </div>
        <div className="notice-panel">
          <p>
            Новые уроки появятся, когда курс откроет следующий материал или обновится лимит дня.
          </p>
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
        <div className="page-heading lesson-heading">
          <div>
            <h1>Уроки</h1>
            <p>
              В этой группе: {queueState.queue.length} из максимум {queueState.batchLimit}. Осталось
              на сегодня: {queueState.remainingToday}. Режим перевода:{" "}
              {formatDisplayMode(activeDisplayMode)}.
            </p>
          </div>
          <button
            className="primary-action"
            disabled={isStarting}
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
        <LessonQueuePreview queue={queueState.queue} displayMode={activeDisplayMode} />
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

function LessonQueuePreview({
  queue,
  displayMode,
}: {
  readonly queue: readonly LessonQueueItem[];
  readonly displayMode: TranslationDisplayMode;
}) {
  return (
    <div className="lesson-preview-grid">
      {queue.map((lesson) => (
        <article className="lesson-preview-card" key={lesson.item.id}>
          <div>
            <span className="eyebrow">{formatItemType(lesson.item.itemType)}</span>
            <JapaneseText as="strong">{lesson.item.japanese}</JapaneseText>
          </div>
          <p>{formatTranslationBundle(lesson.item.translations, displayMode)}</p>
        </article>
      ))}
    </div>
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
          <p className="muted">
            Для этого материала в очереди уроков пока нет отдельной мнемоники или подсказки.
            Используйте значения, чтения и связи выше; расширенный контент появится в карточке
            материала.
          </p>
        </section>
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
          <small>{textKind === "reading" ? "чтение" : formatLocale(text.locale)}</small>
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
