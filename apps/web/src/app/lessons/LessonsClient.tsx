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
  abandonLessonSession,
  ApiError,
  completeLessonItem,
  finishLessonSession,
  getActiveLessonSession,
  getLessonQueue,
  startLessonSession,
  updateLessonSessionProgress,
} from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";
import { type LessonOrderMode, orderLessonSelection } from "../../lib/lesson-selection";
import { buildLessonQuizQueue } from "../../lib/lesson-quiz";
import {
  getLessonPronunciationText,
  getLessonStudyPhases,
  type LessonStudyPhase,
} from "../../lib/lesson-study";
import { useJapaneseSpeech } from "../../lib/use-japanese-speech";
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
  const {
    available: speechAvailable,
    cancel: cancelJapaneseSpeech,
    speak: speakJapanese,
  } = useJapaneseSpeech();
  const [queueState, setQueueState] = useState<QueueState>({ status: "checking" });
  const [session, setSession] = useState<LessonSessionDto | null>(null);
  const [sessionQueue, setSessionQueue] = useState<readonly LessonQueueItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<readonly string[]>([]);
  const [orderMode, setOrderMode] = useState<LessonOrderMode>("course");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<LessonStep>("study");
  const [studyPhaseIndex, setStudyPhaseIndex] = useState(0);
  const [quizCardIndex, setQuizCardIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizFeedback, setQuizFeedback] = useState<
    CompleteLessonItemResponse["answers"][number] | null
  >(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [abandonError, setAbandonError] = useState<string | null>(null);
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
    setStudyPhaseIndex(0);
    setQuizCardIndex(0);
    setQuizAnswer("");
    setQuizAnswers({});
    setQuizFeedback(null);
    setIsSavingProgress(false);
    setIsExitDialogOpen(false);
    setIsAbandoning(false);
    setAbandonError(null);
    setSessionError(null);
    setCompletionSummary(null);

    try {
      const requestedDeckId = readRequestedDeckId();
      const active = await getActiveLessonSession(storedSession.token);
      const activeMatchesSource =
        active.session !== null && active.session.deckId === requestedDeckId;

      if (activeMatchesSource && active.session !== null && active.source !== null) {
        const resumedItems =
          active.session.phase === "quiz"
            ? buildLessonQuizQueue(active.items, active.session.id)
            : active.items;
        const resumedIndex = Math.max(
          0,
          resumedItems.findIndex((lesson) => lesson.item.id === active.session?.currentItemId),
        );
        const resumedLesson = resumedItems[resumedIndex] ?? resumedItems[0];
        const resumedPhases =
          resumedLesson === undefined ? [] : getLessonStudyPhases(resumedLesson);
        const resumedPhaseIndex =
          active.session.phase === "quiz"
            ? 0
            : Math.max(0, resumedPhases.indexOf(active.session.phase));

        setQueueState({
          status: "ready",
          token: storedSession.token,
          suggestedItems: active.items,
          availableItems: active.items,
          batchLimit: active.items.length,
          remainingToday: active.items.length,
          source: active.source,
        });
        setSession(active.session);
        setSessionQueue(active.items);
        setSelectedItemIds(active.items.map((lesson) => lesson.item.id));
        setCurrentIndex(resumedIndex);
        setStep(active.session.phase === "quiz" ? "quiz" : "study");
        setStudyPhaseIndex(resumedPhaseIndex);
        setCompletionSummary({
          learnedItems: active.completedItemCount,
          createdCards: active.createdSrsStateCount,
        });
        return;
      }

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

  const quizQueue = useMemo(
    () => (session === null ? [] : buildLessonQuizQueue(sessionQueue, session.id)),
    [session, sessionQueue],
  );
  const activeQueue = step === "quiz" ? quizQueue : sessionQueue;
  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const selectedLessons = useMemo(
    () =>
      queueState.status === "ready"
        ? queueState.availableItems.filter((lesson) => selectedItemIdSet.has(lesson.item.id))
        : [],
    [queueState, selectedItemIdSet],
  );
  const currentLesson = session === null ? null : (activeQueue[currentIndex] ?? null);
  const currentStudyPhases = useMemo(
    () => (currentLesson === null ? [] : getLessonStudyPhases(currentLesson)),
    [currentLesson],
  );
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
      const response = await startLessonSession(queueState.token, {
        ...(queueState.source.kind === "deck" ? { deckId: queueState.source.deckId } : {}),
        itemIds: orderedLessons.map((lesson) => lesson.item.id),
      });
      setSession(response.session);
      setSessionQueue(orderedLessons);
      setCurrentIndex(0);
      setStep("study");
      setStudyPhaseIndex(0);
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

  async function persistStudyProgress(
    currentItemId: string,
    phase: "meaning" | "reading" | "context" | "quiz",
  ): Promise<boolean> {
    if (queueState.status !== "ready" || session === null || isSavingProgress) {
      return false;
    }

    setIsSavingProgress(true);
    setSessionError(null);

    try {
      const response = await updateLessonSessionProgress(queueState.token, session.id, {
        currentItemId,
        phase,
      });
      setSession(response.session);
      return true;
    } catch (error: unknown) {
      setSessionError(
        error instanceof Error ? error.message : "Не удалось сохранить позицию урока.",
      );
      return false;
    } finally {
      setIsSavingProgress(false);
    }
  }

  async function handleStudyPhaseChange(index: number): Promise<void> {
    const phase = currentStudyPhases[index];

    if (currentLesson === null || phase === undefined || index === studyPhaseIndex) {
      return;
    }

    if (await persistStudyProgress(currentLesson.item.id, phase)) {
      setStudyPhaseIndex(index);
    }
  }

  async function handleContinueStudy(): Promise<void> {
    const nextPhase = currentStudyPhases[studyPhaseIndex + 1];

    if (currentLesson === null) {
      return;
    }

    if (nextPhase !== undefined) {
      if (await persistStudyProgress(currentLesson.item.id, nextPhase)) {
        setStudyPhaseIndex(studyPhaseIndex + 1);
      }
      return;
    }

    if (currentIndex + 1 < activeQueue.length) {
      const nextLesson = activeQueue[currentIndex + 1];

      if (nextLesson !== undefined && (await persistStudyProgress(nextLesson.item.id, "meaning"))) {
        setStudyPhaseIndex(0);
        setCurrentIndex(currentIndex + 1);
      }
      return;
    }

    const firstLesson = quizQueue[0];
    if (firstLesson !== undefined && (await persistStudyProgress(firstLesson.item.id, "quiz"))) {
      setStudyPhaseIndex(0);
      setCurrentIndex(0);
      setStep("quiz");
      setQuizCardIndex(0);
      setQuizAnswer("");
      setQuizAnswers({});
      setQuizFeedback(null);
      setSessionError(null);
    }
  }

  useEffect(() => {
    if (step === "quiz" && !isCompleting) {
      quizInputRef.current?.focus();
    }
  }, [currentIndex, isCompleting, quizCardIndex, step]);

  useEffect(() => {
    cancelJapaneseSpeech();
  }, [cancelJapaneseSpeech, currentIndex, step, studyPhaseIndex]);

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
        const nextLesson = activeQueue[nextIndex];

        if (nextLesson !== undefined) {
          try {
            const progress = await updateLessonSessionProgress(queueState.token, session.id, {
              currentItemId: nextLesson.item.id,
              phase: "quiz",
            });
            setSession(progress.session);
          } catch {
            setSessionError(
              "Материал сохранён, но позицию урока не удалось обновить. При перезагрузке откроется первый незавершённый материал.",
            );
          }
        }

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
      setStudyPhaseIndex(0);
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

  async function handleAbandonSession(): Promise<void> {
    if (queueState.status !== "ready" || session === null || isAbandoning) {
      return;
    }

    setIsAbandoning(true);
    setAbandonError(null);

    try {
      await abandonLessonSession(queueState.token, session.id);
      setIsExitDialogOpen(false);
      setSession(null);
      setSessionQueue([]);
      setCompletionSummary(null);
      await loadQueue();
    } catch (error: unknown) {
      setAbandonError(error instanceof Error ? error.message : "Не удалось завершить урок.");
    } finally {
      setIsAbandoning(false);
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
        <div className="lesson-session-tools">
          <div className="review-progress">
            <span>Изучено: {learnedItems}</span>
            <span>{formatDisplayMode(activeDisplayMode)}</span>
          </div>
          <button
            className="secondary-action"
            disabled={isSavingProgress || isCompleting}
            onClick={() => {
              setAbandonError(null);
              setIsExitDialogOpen(true);
            }}
            type="button"
          >
            Выйти из урока
          </button>
        </div>
      </header>

      {step === "study" ? (
        <LessonStudyView
          lesson={currentLesson}
          displayMode={activeDisplayMode}
          phase={currentStudyPhases[studyPhaseIndex] ?? "meaning"}
          phaseIndex={studyPhaseIndex}
          phases={currentStudyPhases}
          navigationPending={isSavingProgress}
          speechAvailable={speechAvailable}
          isLast={currentIndex === activeQueue.length - 1}
          onContinue={() => void handleContinueStudy()}
          onPhaseChange={(index) => void handleStudyPhaseChange(index)}
          onSpeak={speakJapanese}
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

      {isExitDialogOpen ? (
        <LessonExitDialog
          busy={isAbandoning}
          error={abandonError}
          onCancel={() => setIsExitDialogOpen(false)}
          onConfirm={() => void handleAbandonSession()}
        />
      ) : null}
    </section>
  );
}

function LessonExitDialog({
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  readonly busy: boolean;
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
        aria-describedby="lesson-exit-description"
        aria-labelledby="lesson-exit-title"
        aria-modal="true"
        className="confirmation-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id="lesson-exit-title">Завершить текущий урок?</h2>
        <p id="lesson-exit-description">
          Карточки, уже добавленные в SRS, сохранятся. Незавершённые материалы вернутся в доступную
          очередь, а введённые ответы не сохранятся.
        </p>
        {error === null ? null : (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="primary-action"
            disabled={busy}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            Продолжить урок
          </button>
          <button className="danger-action" disabled={busy} onClick={onConfirm} type="button">
            {busy ? "Завершаю..." : "Завершить урок"}
          </button>
        </div>
      </section>
    </div>
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
  phase,
  phaseIndex,
  phases,
  navigationPending,
  speechAvailable,
  isLast,
  onContinue,
  onPhaseChange,
  onSpeak,
}: {
  readonly lesson: LessonQueueItem;
  readonly displayMode: TranslationDisplayMode;
  readonly phase: LessonStudyPhase;
  readonly phaseIndex: number;
  readonly phases: readonly LessonStudyPhase[];
  readonly navigationPending: boolean;
  readonly speechAvailable: boolean;
  readonly isLast: boolean;
  readonly onContinue: () => void;
  readonly onPhaseChange: (index: number) => void;
  readonly onSpeak: (text: string) => boolean;
}) {
  const meaningCards = lesson.cards.filter((card) => card.answerType === "meaning");
  const readingCards = lesson.cards.filter((card) => card.answerType === "reading");
  const mnemonicGroups = lesson.mnemonics.filter((group) =>
    phase === "context" ? group.purpose === "story" : group.purpose === phase,
  );
  const hintGroups = lesson.hints.filter((group) =>
    phase === "context" ? group.purpose === "usage" : group.purpose === phase,
  );
  const nextPhase = phases[phaseIndex + 1];
  const showsMemory = mnemonicGroups.length > 0 || hintGroups.length > 0;
  const pronunciationText = getLessonPronunciationText(lesson);

  return (
    <>
      <div className="lesson-phase-tabs" role="tablist" aria-label="Этапы изучения">
        {phases.map((candidate, index) => (
          <button
            aria-controls="lesson-study-phase"
            aria-selected={phase === candidate}
            disabled={navigationPending}
            id={`lesson-phase-${candidate}`}
            key={candidate}
            onClick={() => onPhaseChange(index)}
            role="tab"
            type="button"
          >
            <span>{index + 1}</span>
            {formatStudyPhase(candidate)}
          </button>
        ))}
      </div>

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
            <dd>
              {phase === "meaning" && phases.includes("reading")
                ? "следующий этап"
                : (lesson.item.reading ?? "нет")}
            </dd>
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

      <div
        aria-labelledby={`lesson-phase-${phase}`}
        className="lesson-study-grid"
        id="lesson-study-phase"
        role="tabpanel"
      >
        {phase === "meaning" ? (
          <>
            <section className="panel">
              <h2>Объяснение</h2>
              <p>
                Изучаем {formatItemTypeLower(lesson.item.itemType)} как отдельный учебный материал.
                После изучения всей группы обязательная проверка создаст расписание повторений для{" "}
                {lesson.cards.length} {formatCardsCount(lesson.cards.length)} только при верных
                ответах.
              </p>
            </section>

            <section className="panel">
              <h2>Значения</h2>
              <TextList texts={collectCardAnswers(meaningCards, displayMode)} />
            </section>

            <section className="panel lesson-wide-panel">
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
          </>
        ) : null}

        {phase === "reading" ? (
          <section className="panel lesson-wide-panel">
            <div className="lesson-section-heading">
              <h2>Чтения</h2>
              {pronunciationText === null ? null : (
                <JapaneseSpeechButton
                  available={speechAvailable}
                  label="Озвучить чтение"
                  onClick={() => void onSpeak(pronunciationText)}
                />
              )}
            </div>
            <TextList
              textKind="reading"
              texts={[
                ...(lesson.item.reading === null
                  ? []
                  : [{ locale: "ru-RU" as const, text: lesson.item.reading }]),
                ...collectCardAnswers(readingCards, displayMode),
              ]}
            />
          </section>
        ) : null}

        {showsMemory ? (
          <section className="panel lesson-wide-panel">
            <h2>Мнемоника и подсказка</h2>
            <div className="lesson-memory-grid">
              {mnemonicGroups.length === 0 ? null : (
                <div className="lesson-memory-column">
                  <h3>Мнемоники</h3>
                  <MemoryGroupList
                    displayMode={displayMode}
                    groups={mnemonicGroups}
                    kind="mnemonic"
                  />
                </div>
              )}
              {hintGroups.length === 0 ? null : (
                <div className="lesson-memory-column">
                  <h3>Подсказки</h3>
                  <MemoryGroupList displayMode={displayMode} groups={hintGroups} kind="hint" />
                </div>
              )}
            </div>
          </section>
        ) : null}

        {phase === "context" && lesson.exampleSentences.length > 0 ? (
          <section className="panel lesson-wide-panel">
            <h2>Примеры употребления</h2>
            <ul className="lesson-example-list">
              {lesson.exampleSentences.map((sentence) => (
                <li key={sentence.id}>
                  <div className="lesson-example-heading">
                    <JapaneseText variant="sentence">{sentence.japaneseText}</JapaneseText>
                    <JapaneseSpeechButton
                      available={speechAvailable}
                      label={`Озвучить пример ${sentence.japaneseText}`}
                      onClick={() => void onSpeak(sentence.japaneseText)}
                    />
                  </div>
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
        ) : null}
      </div>

      <div className="lesson-action-bar">
        {phaseIndex === 0 ? null : (
          <button
            className="secondary-action"
            disabled={navigationPending}
            onClick={() => onPhaseChange(phaseIndex - 1)}
            type="button"
          >
            Предыдущий этап
          </button>
        )}
        <button
          className="primary-action"
          disabled={navigationPending}
          onClick={onContinue}
          type="button"
        >
          {nextPhase === undefined
            ? isLast
              ? "Перейти к проверке"
              : "Следующий материал"
            : `Далее: ${formatStudyPhase(nextPhase)}`}
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

function JapaneseSpeechButton({
  available,
  label,
  onClick,
}: {
  readonly available: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="lesson-audio-button"
      disabled={!available}
      onClick={onClick}
      title={available ? label : "Озвучивание недоступно в этом браузере"}
      type="button"
    >
      <span aria-hidden="true">▶</span>
    </button>
  );
}

function MemoryGroupList({
  displayMode,
  groups,
  kind,
}: {
  readonly displayMode: TranslationDisplayMode;
  readonly groups: LessonQueueItem["mnemonics"] | LessonQueueItem["hints"];
  readonly kind: "mnemonic" | "hint";
}) {
  const visibleGroups = groups
    .map((group) => ({
      purpose: group.purpose,
      texts: getLearningTexts(group.texts, displayMode),
    }))
    .filter((group) => group.texts.length > 0);

  if (visibleGroups.length === 0) {
    return <p className="muted">Нет данных для выбранного режима перевода.</p>;
  }

  return (
    <div className="lesson-memory-groups">
      {visibleGroups.map((group) => (
        <section className="lesson-memory-group" key={group.purpose}>
          <h4>{formatMemoryPurpose(group.purpose, kind)}</h4>
          <TextList texts={group.texts} />
        </section>
      ))}
    </div>
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
  texts: LessonQueueItem["mnemonics"][number]["texts"],
  displayMode: TranslationDisplayMode,
): readonly LocalizedTextDto[] {
  const locales = getContentLocalesForDisplayMode(displayMode);
  return [...texts.ru, ...texts.en].filter((text) => locales.includes(text.locale));
}

function formatMemoryPurpose(
  purpose:
    | LessonQueueItem["mnemonics"][number]["purpose"]
    | LessonQueueItem["hints"][number]["purpose"],
  kind: "mnemonic" | "hint",
): string {
  switch (purpose) {
    case "reading":
      return "Чтение";
    case "story":
      return "История";
    case "usage":
      return "Употребление";
    case "meaning":
      return kind === "mnemonic" ? "Значение" : "Пояснение значения";
  }
}

function formatStudyPhase(phase: LessonStudyPhase): string {
  switch (phase) {
    case "meaning":
      return "Значение";
    case "reading":
      return "Чтение";
    case "context":
      return "Контекст";
  }
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
