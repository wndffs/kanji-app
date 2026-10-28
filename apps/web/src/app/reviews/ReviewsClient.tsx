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
  SUPPORTED_REVIEW_ORDER_MODES,
  getContentLocalesForDisplayMode,
  type CardAnswerType,
  type ContentLocale,
  type LocalizedTextDto,
  type ListeningPlaybackEvidenceDto,
  type ReviewAnswerResponse,
  type ReviewCorrectionResponse,
  type ReviewSessionProgressDto,
  type ReviewOrderMode,
  type ReviewQueueItem,
  type ReviewSessionSummaryDto,
  type ReviewSrsTransition,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import { useStudyFocus } from "../../components/StudyFocus";
import { SectionDisclosure } from "../../components/SectionDisclosure";
import { ReviewQueueBrowser } from "../../components/ReviewQueueBrowser";
import {
  Volume2,
  Languages,
  Type,
  CircleCheck,
  CircleX,
  RotateCcw,
  SpellCheck,
  RefreshCw,
} from "lucide-react";
import { ListeningAttribution, ListeningPrompt } from "../../components/ListeningPrompt";
import {
  ApiError,
  addPrivateAcceptedAnswer,
  finishReviewSession,
  getActiveReviewSession,
  getReviewQueue,
  startReviewSession,
  submitReviewAnswer,
  submitReviewCorrection,
  updateUserSettings,
  type ReviewSessionDto,
} from "../../lib/api-client";
import { clearStoredSession, readStoredSession, updateStoredUser } from "../../lib/auth-storage";
import { formatReviewOrderMode, formatSrsStageName } from "../../lib/dashboard-format";
import { useAnswerSound } from "../../lib/use-answer-sound";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";
import { ownsSession, useStoredSession } from "../../lib/use-stored-session";
import { formatReviewDueAt, pendingReviewCorrections, reviewFeedbackTone, reviewPromptKind, reviewTimezone, summarizeReviewQueue } from "../../lib/review-workspace";

type QueueState =
  | { readonly status: "checking" }
  | { readonly status: "loading" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly queue: readonly ReviewQueueItem[];
      readonly orderMode: ReviewOrderMode;
      readonly vacationStartedAt: string | null;
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
  const account = useStoredSession();
  if (account === undefined) return <section className="page-stack" aria-busy="true"><h1>Повторения</h1></section>;
  return <ReviewsScreen key={account === null ? "guest" : `${account.user.id}:${account.token}`} timezone={reviewTimezone(account?.user.settings.timezone ?? "UTC")} />;
}

function ReviewsScreen({ timezone }: { readonly timezone: string }) {
  const displayMode = useTranslationDisplayMode();
  const { play: playAnswerSound } = useAnswerSound();
  const [queueState, setQueueState] = useState<QueueState>({ status: "checking" });
  const [session, setSession] = useState<ReviewSessionDto | null>(null);
  useStudyFocus(session !== null, "Повторение");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<ReviewAnswerResponse | ReviewCorrectionResponse | null>(
    null,
  );
  const [corrections, setCorrections] = useState<readonly ReviewQueueItem[]>([]);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctedCardIds, setCorrectedCardIds] = useState<readonly string[]>([]);
  const [resumable, setResumable] = useState(false);
  const [scheduledOffset, setScheduledOffset] = useState(0);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [progress, setProgress] = useState<ReviewProgress>(INITIAL_PROGRESS);
  const [finishedSummary, setFinishedSummary] = useState<ReviewSessionSummaryDto | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingOrderMode, setIsSavingOrderMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [unconfirmedAnswer, setUnconfirmedAnswer] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const reconcilePending = useRef(false);
  const reconcileRequest = useRef<AbortController | null>(null);
  const [awaitingFinish, setAwaitingFinish] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const readBusy = useRef(false);
  const [listeningEvidence, setListeningEvidence] = useState<ListeningPlaybackEvidenceDto>({
    completed: false,
    playCount: 0,
  });
  const answerInputRef = useRef<HTMLInputElement>(null);
  const composingAnswer = useRef(false);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const requestRevision = useRef(0);
  const readRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const startPending = useRef(false);
  const orderPending = useRef(false);
  const submitPending = useRef(false);
  const continuePending = useRef(false);
  const ownsWorkspace = (token: string) => mounted.current && ownsSession(token);

  const loadQueue = useCallback(async (preserve = false) => {
    if (preserve && readBusy.current) return;
    readBusy.current = true;
    const revision = ++requestRevision.current;
    readRequest.current?.abort();
    const controller = new AbortController();
    readRequest.current = controller;
    const storedSession = readStoredSession();

    if (storedSession === null) {
      readBusy.current = false;
      setQueueState({ status: "unauthenticated" });
      return;
    }
    const isCurrent = () => !controller.signal.aborted && revision === requestRevision.current && ownsSession(storedSession.token);
    setIsRefreshing(true);
    setReadError(null);

    if (!preserve) {
    setQueueState({ status: "loading" });
    setSession(null);
    setCurrentIndex(0);
    setAnswer("");
    setFeedback(null);
    setProgress(INITIAL_PROGRESS);
    setFinishedSummary(null);
    setCorrections([]);
    setIsCorrecting(false);
    setCorrectedCardIds([]);
    setResumable(false);
    setScheduledOffset(0);
    setFormError(null);
    setSessionError(null);
    setUnconfirmedAnswer(false);
    setRecoveryMessage(null);
    setAwaitingFinish(false);
    }

    try {
      const [queue, savedActive] = await Promise.all([
        getReviewQueue(storedSession.token, { signal: controller.signal }),
        getActiveReviewSession(storedSession.token, { signal: controller.signal }).catch((error: unknown) => {
          // Older API deployments have no resumable-session endpoint.
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        }),
      ]);
      if (!isCurrent()) return;
      const active = queue.vacationStartedAt == null ? savedActive : null;
      if (active?.session !== undefined && active.session !== null && active.progress !== null) {
        if (active.currentIndex >= active.items.length && active.corrections.length === 0) {
          const finished = await finishReviewSession(storedSession.token, active.session.id);
          if (!isCurrent()) return;
          setFinishedSummary(finished.summary);
        } else {
          const correcting = active.currentIndex >= active.items.length;
          setSession(active.session);
          setResumable(true);
          setCorrections(active.corrections);
          setCorrectedCardIds(active.progress.correctedCardIds);
          setIsCorrecting(correcting);
          setCurrentIndex(correcting ? 0 : active.currentIndex);
          setProgress(toReviewProgress(active.progress));
          setScheduledTotal(active.progress.scheduledTotal);
          setScheduledOffset(active.progress.scheduledAnswered - active.currentIndex);
        }
      } else {
        setScheduledTotal(queue.items.length);
      }
      setQueueState({
        status: "ready",
        token: storedSession.token,
        queue: active?.session != null ? active.items : queue.items,
        orderMode: queue.orderMode ?? storedSession.user.settings.reviewOrderMode ?? "shuffled",
        vacationStartedAt: queue.vacationStartedAt ?? null,
      });
    } catch (error: unknown) {
      if (!isCurrent()) return;
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setQueueState({ status: "unauthenticated" });
        return;
      }

      if (preserve) {
        setReadError(error instanceof Error ? error.message : "Не удалось обновить очередь.");
        return;
      }

      setQueueState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Не удалось загрузить очередь повторений.",
      });
    } finally {
      if (isCurrent()) { readBusy.current = false; setIsRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadQueue();
    return () => {
      requestRevision.current += 1;
      mounted.current = false;
      readRequest.current?.abort();
      reconcileRequest.current?.abort();
    };
  }, [loadQueue]);

  const activeQueue = isCorrecting
    ? corrections
    : queueState.status === "ready"
      ? queueState.queue
      : [];
  const currentItem = session === null ? null : (activeQueue[currentIndex] ?? null);
  const totalCount = activeQueue.length;
  const progressLabel = useMemo(() => {
    if (currentItem === null) {
      return "";
    }

    return isCorrecting
      ? `${currentIndex + 1} из ${totalCount}`
      : `${scheduledOffset + currentIndex + 1} из ${scheduledTotal}`;
  }, [currentIndex, currentItem, totalCount, isCorrecting, scheduledOffset, scheduledTotal]);

  useEffect(() => {
    if (
      session !== null &&
      feedback === null &&
      currentItem !== null &&
      !isSubmitting &&
      !isReconciling &&
      (currentItem.card.promptType !== "listening" || listeningEvidence.completed)
    ) {
      answerInputRef.current?.focus();
    }
  }, [currentItem, feedback, isSubmitting, isReconciling, listeningEvidence.completed, session]);

  useEffect(() => {
    composingAnswer.current = false;
    setListeningEvidence({ completed: false, playCount: 0 });
  }, [currentItem?.card.id, isCorrecting, currentIndex]);

  useEffect(() => {
    if (feedback !== null && !isContinuing) {
      continueButtonRef.current?.focus();
    }
  }, [feedback, isContinuing]);

  useEffect(() => { continuePending.current = false; }, [feedback, currentIndex, isCorrecting]);

  async function handleStartSession(): Promise<void> {
    if (queueState.status !== "ready" || queueState.queue.length === 0 || startPending.current || orderPending.current || readBusy.current || queueState.vacationStartedAt !== null) {
      return;
    }

    startPending.current = true;
    setIsStarting(true);
    setSessionError(null);
    setFinishedSummary(null);

    try {
      const response = await startReviewSession(queueState.token);
      if (!ownsWorkspace(queueState.token)) return;
      const items = response.items ?? queueState.queue;
      const index = response.currentIndex ?? 0;
      const correcting = index >= items.length && (response.corrections?.length ?? 0) > 0;
      setQueueState({ ...queueState, queue: items });
      setSession(response.session);
      setResumable(response.progress !== undefined);
      setScheduledTotal(response.progress?.scheduledTotal ?? items.length);
      setScheduledOffset((response.progress?.scheduledAnswered ?? 0) - index);
      setCorrections(response.corrections ?? []);
      setCorrectedCardIds(response.progress?.correctedCardIds ?? []);
      setIsCorrecting(correcting);
      setCurrentIndex(correcting ? 0 : index);
      setAnswer("");
      setFeedback(null);
      setProgress(
        response.progress === undefined ? INITIAL_PROGRESS : toReviewProgress(response.progress),
      );
    } catch (error: unknown) {
      if (!ownsWorkspace(queueState.token)) return;
      setSessionError(error instanceof Error ? error.message : "Не удалось начать повторение.");
    } finally {
      startPending.current = false;
      setIsStarting(false);
    }
  }

  async function handleOrderModeChange(nextMode: ReviewOrderMode): Promise<void> {
    if (queueState.status !== "ready" || orderPending.current || startPending.current || readBusy.current || nextMode === queueState.orderMode) {
      return;
    }

    orderPending.current = true;
    setIsSavingOrderMode(true);
    setSessionError(null);

    try {
      const updatedUser = await updateUserSettings(queueState.token, {
        reviewOrderMode: nextMode,
      });
      if (!ownsWorkspace(queueState.token)) return;
      updateStoredUser(updatedUser);
      setQueueState((current) =>
        current.status === "ready" ? { ...current, orderMode: nextMode } : current,
      );

      const queue = await getReviewQueue(queueState.token, { signal: readRequest.current?.signal });
      if (!ownsWorkspace(queueState.token)) return;
      setQueueState({
        status: "ready",
        token: queueState.token,
        queue: queue.items,
        orderMode: queue.orderMode ?? nextMode,
        vacationStartedAt: queue.vacationStartedAt ?? null,
      });
    } catch (error: unknown) {
      if (!ownsWorkspace(queueState.token)) return;
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setQueueState({ status: "unauthenticated" });
        return;
      }

      setSessionError(
        error instanceof Error ? error.message : "Не удалось изменить порядок повторений.",
      );
    } finally {
      orderPending.current = false;
      setIsSavingOrderMode(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (composingAnswer.current) return;

    if (
      queueState.status !== "ready" ||
      session === null ||
      currentItem === null ||
      feedback !== null ||
      submitPending.current || reconcilePending.current
    ) {
      return;
    }

    const trimmedAnswer = answer.trim();

    if (currentItem.card.promptType === "listening" && !listeningEvidence.completed) {
      setFormError("Сначала прослушайте запись полностью.");
      return;
    }

    if (trimmedAnswer === "") {
      setFormError("Введите ответ.");
      answerInputRef.current?.focus();
      return;
    }

    setFormError(null);
    setSessionError(null);
    setUnconfirmedAnswer(false);
    setRecoveryMessage(null);
    submitPending.current = true;
    setIsSubmitting(true);

    try {
      const request = {
        cardId: currentItem.card.id,
        answer: trimmedAnswer,
        answerType: currentItem.card.answerType,
        answeredAt: new Date().toISOString(),
        listeningEvidence:
          currentItem.card.promptType === "listening" ? listeningEvidence : undefined,
      };
      const response = isCorrecting
        ? await submitReviewCorrection(queueState.token, session.id, request)
        : await submitReviewAnswer(queueState.token, session.id, request);
      if (!ownsWorkspace(queueState.token)) return;

      if ("progress" in response) setCorrectedCardIds(response.progress.correctedCardIds);
      if (!response.retry) {
        playAnswerSound(response.accepted);
      }
      setFeedback(response);
      if (!response.retry && !isCorrecting) {
        setProgress((previous) => ({
          answered: previous.answered + 1,
          accepted: previous.accepted + (response.accepted ? 1 : 0),
          missed: previous.missed + (response.accepted ? 0 : 1),
        }));
      }
    } catch (error: unknown) {
      if (!ownsWorkspace(queueState.token)) return;
      setSessionError(error instanceof Error ? error.message : "Не удалось отправить ответ.");
      setUnconfirmedAnswer(true);
      answerInputRef.current?.focus();
    } finally {
      submitPending.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleReconcileAnswer(): Promise<void> {
    if (queueState.status !== "ready" || session === null || submitPending.current || reconcilePending.current) return;
    reconcilePending.current = true;
    const controller = new AbortController();
    reconcileRequest.current?.abort(); reconcileRequest.current = controller;
    setIsReconciling(true); setRecoveryMessage(null);
    try {
      const active = await getActiveReviewSession(queueState.token, { signal: controller.signal });
      if (controller.signal.aborted || !ownsWorkspace(queueState.token)) return;
      if (active.session?.id !== session.id || active.progress === null) throw new Error("Сохранённая сессия изменилась. Ответ не отправлен повторно.");
      const correcting = active.currentIndex >= active.items.length && active.corrections.length > 0;
      const target = correcting ? active.corrections[0] : active.items[active.currentIndex];
      const sameCard = target?.card.id === currentItem?.card.id && correcting === isCorrecting;
      setQueueState({ ...queueState, queue: active.items });
      setSession(active.session); setResumable(true);
      setCorrections(active.corrections); setCorrectedCardIds(active.progress.correctedCardIds);
      setIsCorrecting(correcting); setCurrentIndex(correcting ? 0 : active.currentIndex);
      setProgress(toReviewProgress(active.progress));
      setScheduledTotal(active.progress.scheduledTotal); setScheduledOffset(active.progress.scheduledAnswered - active.currentIndex);
      setAwaitingFinish(target === undefined && active.corrections.length === 0);
      setFeedback(null); setSessionError(null); setFormError(null); setUnconfirmedAnswer(false);
      if (!sameCard) setAnswer("");
      setRecoveryMessage(sameCard ? "Текущая карточка ожидает ответа." : "Сохранённая позиция восстановлена.");
    } catch (error: unknown) {
      if (controller.signal.aborted || !ownsWorkspace(queueState.token)) return;
      if (error instanceof ApiError && error.status === 401) { clearStoredSession(); return; }
      setSessionError(error instanceof Error ? error.message : "Не удалось сверить прогресс.");
    } finally {
      if (reconcileRequest.current === controller) { reconcilePending.current = false; setIsReconciling(false); }
    }
  }

  async function handleContinue(): Promise<void> {
    if (queueState.status !== "ready" || session === null || feedback === null || continuePending.current) {
      return;
    }
    continuePending.current = true;

    const nextIndex = currentIndex + 1;
    setSessionError(null);

    if (feedback.retry || ("corrected" in feedback && !feedback.corrected)) {
      setAnswer("");
      setFeedback(null);
      setFormError(null);
      return;
    }

    if (nextIndex < activeQueue.length) {
      setCurrentIndex(nextIndex);
      setAnswer("");
      setFeedback(null);
      setFormError(null);
      return;
    }

    setIsContinuing(true);

    try {
      if (resumable && !isCorrecting) {
        const active = await getActiveReviewSession(queueState.token, { signal: readRequest.current?.signal });
        if (!ownsWorkspace(queueState.token)) return;
        if (active.session?.id !== session.id) {
          throw new Error(
            "Сессия изменилась. Перезагрузите страницу, чтобы восстановить прогресс.",
          );
        }
        if (active.corrections.length > 0) {
          setCorrections(active.corrections);
          setCorrectedCardIds(active.progress?.correctedCardIds ?? []);
          setIsCorrecting(true);
          setCurrentIndex(0);
          setAnswer("");
          setFeedback(null);
          setFormError(null);
          return;
        }
      }
      const response = await finishReviewSession(queueState.token, session.id);
      if (!ownsWorkspace(queueState.token)) return;
      setFinishedSummary(response.summary);
      setSession(null);
      setCurrentIndex(0);
      setAnswer("");
      setFeedback(null);
      setFormError(null);
    } catch (error: unknown) {
      if (!ownsWorkspace(queueState.token)) return;
      setSessionError(error instanceof Error ? error.message : "Не удалось завершить сессию.");
    } finally {
      continuePending.current = false;
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
          <p>Войдите, чтобы открыть свои повторения.</p>
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
          <p role="alert">{queueState.message}</p>
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
              <dd>{finishedSummary.totalAnswers}</dd>
            </div>
            <div>
              <dt>Точность</dt>
              <dd>
                {finishedSummary.accuracyPercent === null
                  ? "—"
                  : `${finishedSummary.accuracyPercent}%`}
              </dd>
            </div>
            <div>
              <dt>Верно</dt>
              <dd>{finishedSummary.correctAnswers}</dd>
            </div>
            <div>
              <dt>Ошибок</dt>
              <dd>{finishedSummary.incorrectAnswers}</dd>
            </div>
            {finishedSummary.ignoredAnswers === 0 ? null : (
              <div>
                <dt>Пропущено</dt>
                <dd>{finishedSummary.ignoredAnswers}</dd>
              </div>
            )}
            <div>
              <dt>Повышено</dt>
              <dd>{finishedSummary.advanced}</dd>
            </div>
            <div>
              <dt>Без изменения</dt>
              <dd>{finishedSummary.unchanged}</dd>
            </div>
            <div>
              <dt>Понижено</dt>
              <dd>{finishedSummary.demoted}</dd>
            </div>
            <div>
              <dt>Закреплено</dt>
              <dd>{finishedSummary.burned}</dd>
            </div>
            <div>
              <dt>Время</dt>
              <dd>{formatDuration(finishedSummary.durationSeconds)}</dd>
            </div>
          </dl>
          <div className="action-row">
            <button className="primary-action" onClick={() => void loadQueue()} type="button">
              Обновить очередь
            </button>
            <Link className="secondary-action" href="/dashboard">
              На панель
            </Link>
            <Link className="secondary-action" href="/settings">
              Настроить нагрузку
            </Link>
            {vacationActive ? null : <Link className="inline-link" href="/lessons">К урокам</Link>}
          </div>
        </div>
      </section>
    );
  }

  if (queueState.queue.length === 0 && !isCorrecting) {
    const vacationActive = queueState.vacationStartedAt !== null;

    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Повторения</h1>
          <p>{vacationActive ? "Режим отпуска включён." : "Нет карточек к повторению."}</p>
        </div>
        <div className="notice-panel">
          <p>
            {vacationActive
              ? "Плановые повторения приостановлены. После выключения отпуска будущие даты будут сдвинуты на время паузы."
              : "Следующая сессия появится, когда расписание повторений откроет новые карточки."}
          </p>
          <div className="action-row">
            <button className="secondary-action" onClick={() => void loadQueue()} type="button">
              Проверить снова
            </button>
            <Link className="secondary-action" href="/settings">
              {vacationActive ? "Настроить режим отпуска" : "Настроить нагрузку"}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (session === null) {
    return (
      <section className="page-stack review-lobby">
        <div className="page-heading review-heading">
          <div>
            <h1>Повторения</h1>
            <p>По расписанию: {queueState.queue.length} карточек</p>
          </div>
          <div className="review-heading-actions">
            <button className="icon-button" type="button" aria-label="Обновить очередь" title="Обновить очередь" disabled={isRefreshing || isStarting || isSavingOrderMode} onClick={() => void loadQueue(true)}><RefreshCw size={18} aria-hidden="true" /></button>
          </div>
        </div>
        {sessionError === null ? null : <p className="form-error">{sessionError}</p>}
        {readError === null ? null : <p className="form-error" role="alert">{readError}</p>}
        {isRefreshing ? <p className="muted" role="status">Обновляю очередь…</p> : null}
        <ReviewQueueOverview queue={queueState.queue} />
        <SectionDisclosure title="Параметры повторения">
          <label className="review-order-picker">
            <span>Порядок карточек</span>
            <select
              disabled={isSavingOrderMode || isStarting || isRefreshing}
              onChange={(event) =>
                void handleOrderModeChange(event.currentTarget.value as ReviewOrderMode)
              }
              value={queueState.orderMode}
            >
              {SUPPORTED_REVIEW_ORDER_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {formatReviewOrderMode(mode)}
                </option>
              ))}
            </select>
          </label>
        </SectionDisclosure>
        <SectionDisclosure title="Состав очереди">
          <ReviewQueueBrowser queue={queueState.queue} disabled={isStarting || isSavingOrderMode || isRefreshing} timezone={timezone} />
        </SectionDisclosure>
        <div className="review-lobby-actions"><span>К сессии: {queueState.queue.length} карточек</span><button className="primary-action" type="button" disabled={isStarting || isSavingOrderMode || isRefreshing} onClick={() => void handleStartSession()}>{isStarting ? "Начинаю..." : "Начать повторение"}</button></div>
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
    <section
      className="review-session"
      aria-label="Сессия повторения"
      data-item-type={currentItem.item.itemType}
    >
      <header className="review-session-header">
        <div>
          <span className="eyebrow">{progressLabel}</span>
          <h1>{isCorrecting ? "Исправление ошибок" : "Повторение"}</h1>
          {isCorrecting ? <p className="muted">Без изменения SRS</p> : null}
        </div>
        <div className="review-progress">
          <span>Принято: {progress.accepted}</span>
          <span>Ошибок: {progress.missed}</span>
          {isCorrecting ? <span>Исправлений осталось: {pendingReviewCorrections(corrections, correctedCardIds)}</span> : <span>Плановых осталось: {Math.max(0, scheduledTotal - progress.answered)}</span>}
        </div>
      </header>

      <progress
        className="study-progress"
        aria-label={isCorrecting ? "Исправленные карточки" : "Отвеченные карточки"}
        max={Math.max(1, isCorrecting ? totalCount : scheduledTotal)}
        value={isCorrecting ? currentIndex : progress.answered}
      />
      <article className="review-card" data-answer-type={currentItem.card.answerType}>
        <div className="review-card-meta">
          <span>{formatItemType(currentItem.item.itemType)}</span>
        </div>
        <h2 className="review-question">{reviewPromptKind(currentItem) === "listening" ? <><Volume2 size={20} aria-hidden="true" />Аудирование</> : currentItem.card.answerType === "reading" ? <><Languages size={20} aria-hidden="true" />Чтение</> : <><Type size={20} aria-hidden="true" />Значение</>}</h2>
        <div className="review-prompt">
          {currentItem.card.promptType === "listening" ? (
            <ListeningPrompt
              audio={currentItem.card.audio}
              onEvidenceChange={setListeningEvidence}
            />
          ) : (
            <JapaneseText
              as="p"
              className="review-japanese"
              variant={currentItem.item.itemType === "sentence" ? "sentence" : "display"}
            >
              {currentItem.card.prompt.japanese}
            </JapaneseText>
          )}
        </div>
      </article>

      {feedback === null ? null : (
        <FeedbackPanel
          key={`${session.id}:${currentItem.card.id}:${isCorrecting ? "correction" : "scheduled"}`}
          answer={answer}
          feedback={feedback}
          correction={isCorrecting}
          item={currentItem}
          onContinue={() => void handleContinue()}
          continueButtonRef={continueButtonRef}
          displayMode={displayMode}
          isContinuing={isContinuing}
          token={queueState.token}
          timezone={timezone}
        />
      )}

      {sessionError === null ? null : (
        <p className="form-error" role="alert">
          {sessionError}
        </p>
      )}
      {recoveryMessage === null ? null : <p className="muted" role="status">{recoveryMessage}</p>}
      {unconfirmedAnswer && resumable ? <button className="secondary-action review-reconcile" type="button" disabled={isReconciling || isSubmitting} onClick={() => void handleReconcileAnswer()}>{isReconciling ? "Сверяю…" : "Сверить прогресс"}</button> : null}

      {feedback !== null ? null : (
        <form className="review-answer-bar" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="review-answer">
            <span>{formatInputLabel(currentItem.card.answerType)}</span>
            <input
              aria-describedby={formError === null ? undefined : "review-answer-error"}
              aria-invalid={formError !== null}
              autoComplete="off"
              autoCapitalize="none"
              disabled={
                isSubmitting || isReconciling ||
                (currentItem.card.promptType === "listening" && !listeningEvidence.completed)
              }
              id="review-answer"
              onChange={(event) => setAnswer(event.currentTarget.value)}
              onCompositionStart={() => { composingAnswer.current = true; }}
              onCompositionEnd={() => { composingAnswer.current = false; }}
              onKeyDown={(event) => { if (event.key === "Enter" && (composingAnswer.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }}
              placeholder={formatInputPlaceholder(currentItem.card.answerType)}
              ref={answerInputRef}
              spellCheck={currentItem.card.answerType === "meaning"}
              value={answer}
            />
          </label>
          <button
            className="primary-action"
            disabled={
              isSubmitting || isReconciling ||
              (currentItem.card.promptType === "listening" && !listeningEvidence.completed)
            }
            type="submit"
          >
            {isSubmitting ? "Проверяю..." : unconfirmedAnswer ? "Повторить отправку" : "Ответить"}
          </button>
          {formError === null ? null : (
            <p className="form-error" id="review-answer-error" role="alert">
              {formError}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function ReviewQueueOverview({ queue }: { readonly queue: readonly ReviewQueueItem[] }) {
  const counts = summarizeReviewQueue(queue);
  return (
    <dl className="review-queue-overview" aria-label="Вопросы в очереди">
      <div><dt>Карточек</dt><dd>{counts.cards}</dd></div>
      <div><dt>Материалов</dt><dd>{counts.materials}</dd></div>
      {(
        [
          { kind: "meaning", label: "Значение", icon: Type },
          { kind: "reading", label: "Чтение", icon: Languages },
          { kind: "listening", label: "Аудирование", icon: Volume2 },
        ] as const
      )
        .filter(({ kind }) => counts[kind] > 0)
        .map(({ kind, label, icon: Icon }) => (
          <div key={kind}>
            <dt>
              <Icon size={18} aria-hidden="true" />
              {label}
            </dt>
            <dd>{counts[kind]}</dd>
          </div>
        ))}
    </dl>
  );
}

function FeedbackPanel({
  answer,
  feedback,
  correction,
  item,
  onContinue,
  continueButtonRef,
  displayMode,
  isContinuing,
  token,
  timezone,
}: {
  readonly answer: string;
  readonly feedback: ReviewAnswerResponse | ReviewCorrectionResponse;
  readonly correction: boolean;
  readonly item: ReviewQueueItem;
  readonly onContinue: () => void;
  readonly continueButtonRef: RefObject<HTMLButtonElement | null>;
  readonly displayMode: TranslationDisplayMode;
  readonly isContinuing: boolean;
  readonly token: string;
  readonly timezone: string;
}) {
  const [privateAnswer, setPrivateAnswer] = useState(answer.trim());
  const [privateLocale, setPrivateLocale] = useState<ContentLocale>("ru-RU");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savePending = useRef(false);
  useEffect(() => {
    if (!isSaving && saveMessage !== null) continueButtonRef.current?.focus();
  }, [isSaving, saveMessage, continueButtonRef]);
  const isAccepted = feedback.accepted;
  const ResultIcon = feedback.retry
    ? RotateCcw
    : feedback.result === "typo"
      ? SpellCheck
      : isAccepted
        ? CircleCheck
        : CircleX;

  async function handleSavePrivateAnswer(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (savePending.current || !ownsSession(token)) return;

    const text = privateAnswer.trim();

    if (text === "") {
      setSaveError("Введите вариант ответа.");
      return;
    }

    savePending.current = true;
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
      if (!ownsSession(token)) return;
      setSaveMessage("Приватный вариант сохранён.");
    } catch (error: unknown) {
      if (!ownsSession(token)) return;
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить вариант.");
    } finally {
      savePending.current = false;
      setIsSaving(false);
    }
  }

  return (
    <section
      aria-label="Результат ответа"
      className={`feedback-panel feedback-panel-${reviewFeedbackTone(feedback)}`}
    >
      <div className="feedback-header">
        <div role="status" aria-atomic="true">
          <h2>
            <ResultIcon size={22} aria-hidden="true" />
            {feedback.retry ? "Другое чтение" : formatResult(feedback.result)}
          </h2>
          <p>{feedback.feedback.message}</p>
          {!feedback.retry && "nextSrs" in feedback ? (
            <span className="feedback-stage">{formatSrsStageName(feedback.nextSrs.stageName)}</span>
          ) : null}
        </div>
      </div>

      <div className="feedback-grid">
        <div>
          <h3>Ваш ответ</h3>
          <p>{answer}</p>
        </div>
        <div>
          <h3>Правильные ответы</h3>
          <ExpectedAnswers
            answers={feedback.feedback.expected}
            answerType={item.card.answerType}
            displayMode={displayMode}
          />
        </div>
      </div>
      <SectionDisclosure title="Расписание повторений">
        {"srsTransition" in feedback ? (
          <div>
            <h3>Изменение SRS</h3>
            <p>
              {formatSrsTransition(feedback.srsTransition)} ·{" "}
              {formatSrsStageName(feedback.previousSrs.stageName)} →{" "}
              {formatSrsStageName(feedback.nextSrs.stageName)}
              {feedback.nextSrs.availableAt === null
                ? ""
                : ` · ${formatReviewDueAt(feedback.nextSrs.availableAt, timezone)}`}
            </p>
          </div>
        ) : (
          <div>
            <h3>SRS</h3>
            <p>Без изменений</p>
          </div>
        )}
      </SectionDisclosure>

      {item.card.promptType === "listening" && item.card.audio != null ? (
        <section className="listening-feedback-details">
          <div>
            <h3>Прослушанный материал</h3>
            <JapaneseText
              as="p"
              variant={item.item.itemType === "sentence" ? "sentence" : "display"}
            >
              {item.item.japanese}
            </JapaneseText>
            <p lang="ja">{item.item.reading ?? "Чтение не указано"}</p>
            {item.item.translations === undefined ? null : (
              <p>{formatReviewTranslations(item.item.translations, displayMode)}</p>
            )}
          </div>
          <ListeningAttribution audio={item.card.audio} />
        </section>
      ) : null}

      <SectionDisclosure title="Добавить свой ответ">
        <form
          className="private-answer-form"
          onSubmit={(event) => void handleSavePrivateAnswer(event)}
        >
          <label>
            <span>Приватный правильный вариант</span>
            <input
              autoComplete="off"
              disabled={isSaving}
              onChange={(event) => setPrivateAnswer(event.currentTarget.value)}
              value={privateAnswer}
            />
          </label>
          {item.card.answerType === "reading" ? (
            <p className="muted">Чтения сохраняются как японские варианты без метки RU/EN.</p>
          ) : (
            <label>
              <span>Язык</span>
              <select
                disabled={isSaving}
                onChange={(event) => setPrivateLocale(event.currentTarget.value as ContentLocale)}
                value={privateLocale}
              >
                <option value="ru-RU">Русский</option>
                <option value="en-US">English</option>
              </select>
            </label>
          )}
          <button className="secondary-action" disabled={isSaving} type="submit">
            {isSaving ? "Сохраняю..." : "Сохранить вариант"}
          </button>
          {saveMessage === null ? null : <p className="success-text">{saveMessage}</p>}
          {saveError === null ? null : (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
        </form>
      </SectionDisclosure>
      <div className="feedback-actions">
        <button
          className="primary-action"
          disabled={isContinuing || isSaving}
          onClick={onContinue}
          ref={continueButtonRef}
          type="button"
        >
          {isContinuing
            ? "Завершаю..."
            : feedback.retry || (correction && "corrected" in feedback && !feedback.corrected)
              ? "Ответить снова"
              : "Дальше"}
        </button>
      </div>
    </section>
  );
}

function toReviewProgress(progress: ReviewSessionProgressDto): ReviewProgress {
  return {
    answered: progress.original.totalAnswers,
    accepted: progress.original.correctAnswers,
    missed: progress.original.incorrectAnswers,
  };
}

function ExpectedAnswers({
  answers,
  answerType,
  displayMode,
}: {
  readonly answers: readonly LocalizedTextDto[];
  readonly answerType: CardAnswerType;
  readonly displayMode: TranslationDisplayMode;
}) {
  const visibleAnswers =
    answerType === "reading"
      ? answers
      : answers.filter((answer) =>
          getContentLocalesForDisplayMode(displayMode).includes(answer.locale),
        );

  if (visibleAnswers.length === 0) {
    return <p className="muted">Список ответов недоступен для выбранного режима.</p>;
  }

  return (
    <ul aria-label="Правильные ответы" className="expected-answer-list">
      {visibleAnswers.map((answer, index) => (
        <li key={`${answer.locale}-${answer.text}-${index}`}>
          {answerType === "reading" ? (
            <JapaneseText>{answer.text}</JapaneseText>
          ) : (
            <span>{answer.text}</span>
          )}
          <small>{answerType === "reading" ? "чтение" : formatLocale(answer.locale)}</small>
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

function formatSrsTransition(transition: ReviewSrsTransition): string {
  switch (transition) {
    case "advanced":
      return "Повышение";
    case "demoted":
      return "Понижение";
    case "burned":
      return "Закреплено";
    default:
      return "Без изменения";
  }
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes === 0 ? `${seconds} сек` : `${minutes} мин ${seconds} сек`;
}

function formatLocale(locale: LocalizedTextDto["locale"]): string {
  return locale === "ru-RU" ? "RU" : "EN";
}

function formatReviewTranslations(
  translations: NonNullable<ReviewQueueItem["item"]["translations"]>,
  displayMode: TranslationDisplayMode,
): string {
  const values = [
    ...(displayMode === "ru" || displayMode === "ru-en" ? [translations.primaryRu] : []),
    ...(displayMode === "en" || displayMode === "ru-en" ? [translations.primaryEn] : []),
  ].filter((value): value is string => value !== null);

  return values.length === 0 ? "Значение не указано" : values.join(" · ");
}
