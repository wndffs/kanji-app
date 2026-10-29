"use client";

import { Volume2 } from "lucide-react";

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
  KANA_PRACTICE_SESSION_LENGTHS,
  type KanaPracticeAnswerResponse,
  type KanaPracticeExerciseDto,
  type KanaPracticeExerciseKind,
  type KanaPracticeScript,
  type KanaPracticeSessionDto,
} from "@kanji-srs/shared";

import { ApiError, getKanaPracticeSession, submitKanaPracticeAnswer } from "../../lib/api-client";
import { buildKanaPracticeAnswer, toKanaLessonItem } from "../../lib/kana-adaptive-practice";
import { useAnswerSound } from "../../lib/use-answer-sound";
import { useJapaneseSpeech } from "../../lib/use-japanese-speech";
import { KanaTracingExercise } from "./KanaTracingExercise";
import { SectionDisclosure } from "../../components/SectionDisclosure";
import { ownsSession } from "../../lib/use-stored-session";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";
import { buildKanaSpeechText } from "../../lib/kana-speech";

type PracticeState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly session: KanaPracticeSessionDto };

export function AdaptiveKanaPractice({
  onUnauthorized,
  script,
  token,
}: {
  readonly onUnauthorized: () => void;
  readonly script: KanaPracticeScript;
  readonly token: string;
}) {
  const [state, setState] = useState<PracticeState>({ status: "loading" });
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<KanaPracticeAnswerResponse | null>(null);
  const [pendingSession, setPendingSession] = useState<KanaPracticeSessionDto | null>(null);
  const [fallbackKind, setFallbackKind] = useState<KanaPracticeExerciseKind | null>(null);
  const handleTracingUnavailable = useCallback(() => setFallbackKind("reverse-choice"), []);
  const [submitting, setSubmitting] = useState(false);
  const [nextSize, setNextSize] = useState(12);
  const nextSizeRef = useRef(12);
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const requestRevision = useRef(0);
  const submitPending = useRef(false);
  const speech = useJapaneseSpeech();
  const { play: playAnswerSound } = useAnswerSound();

  const loadSession = useCallback(async (): Promise<void> => {
    if (!ownsSession(token)) return;
    const revision = ++requestRevision.current;
    submitPending.current = false;
    setSubmitting(false);
    setState({ status: "loading" });
    setAnswer("");
    setFeedback(null);
    setPendingSession(null);
    setFallbackKind(null);

    try {
      const session = await getKanaPracticeSession(token, script, nextSizeRef.current);
      if (revision !== requestRevision.current || !ownsSession(token)) return;
      setState({ status: "ready", session });
    } catch (error: unknown) {
      if (revision !== requestRevision.current || !ownsSession(token)) return;
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
        return;
      }

      setState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Не удалось загрузить адаптивную практику.",
      });
    }
  }, [onUnauthorized, script, token]);

  useEffect(() => {
    void loadSession();
    return () => {
      requestRevision.current += 1;
    };
  }, [loadSession]);

  const exercise = state.status === "ready" ? state.session.exercise : null;
  const effectiveKind = fallbackKind ?? exercise?.exerciseKind ?? null;

  useEffect(() => {
    if (
      exercise?.exerciseKind === "listening-choice" &&
      speech.ready &&
      (!speech.available || speech.status === "error")
    )
      setFallbackKind("reverse-choice");
  }, [exercise?.id, exercise?.exerciseKind, speech.ready, speech.available, speech.status]);

  useEffect(() => {
    if (feedback !== null) {
      continueRef.current?.focus();
    } else if (effectiveKind === "typing") {
      inputRef.current?.focus();
    } else {
      firstChoiceRef.current?.focus();
    }
  }, [effectiveKind, exercise?.id, feedback]);

  useEffect(() => {
    if (
      exercise !== null &&
      effectiveKind === "listening-choice" &&
      speech.available &&
      speech.autoplay &&
      feedback === null
    ) {
      speech.speak(buildKanaSpeechText(toKanaLessonItem(exercise)));
    }

    return speech.cancel;
  }, [
    effectiveKind,
    exercise,
    feedback,
    speech.autoplay,
    speech.available,
    speech.cancel,
    speech.speak,
  ]);

  const tracingItem = useMemo(
    () => (exercise === null ? null : toKanaLessonItem(exercise)),
    [exercise],
  );

  async function submit(value: string): Promise<void> {
    if (
      state.status !== "ready" ||
      exercise === null ||
      feedback !== null ||
      submitPending.current ||
      !ownsSession(token)
    ) {
      return;
    }

    submitPending.current = true;
    setSubmitting(true);
    const revision = requestRevision.current;

    try {
      const result = await submitKanaPracticeAnswer(
        token,
        buildKanaPracticeAnswer(
          state.session.id,
          exercise,
          value,
          effectiveKind ?? exercise.exerciseKind,
        ),
      );
      if (revision !== requestRevision.current || !ownsSession(token)) return;
      setAnswer(value);
      setFeedback(result);
      setPendingSession(result.session);
      playAnswerSound(result.correct);
    } catch (error: unknown) {
      if (revision !== requestRevision.current || !ownsSession(token)) return;
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
        return;
      }

      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Не удалось проверить ответ.",
      });
    } finally {
      if (revision === requestRevision.current && ownsSession(token)) {
        submitPending.current = false;
        setSubmitting(false);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (answer.trim() !== "") {
      void submit(answer);
    }
  }

  function continueSession(): void {
    if (pendingSession === null || !ownsSession(token)) {
      return;
    }

    setState({ status: "ready", session: pendingSession });
    setPendingSession(null);
    setFeedback(null);
    setFallbackKind(null);
    setAnswer("");
  }

  if (state.status === "loading") {
    return (
      <section aria-busy="true" className="panel kana-practice kana-adaptive-practice">
        <div className="skeleton kana-adaptive-loading" />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="panel kana-practice kana-adaptive-practice">
        <div className="error-banner" role="alert">
          {state.message}
        </div>
        <button className="secondary-action" onClick={() => void loadSession()} type="button">
          Повторить
        </button>
      </section>
    );
  }

  if (exercise === null) {
    return (
      <>
        <section className="panel kana-practice kana-adaptive-practice">
          <span className="eyebrow">Сессия завершена</span>
          <strong className="kana-adaptive-complete">
            {state.session.completedCount} из {state.session.totalCount}
          </strong>
          <label htmlFor="kana-next-session-size">Следующая сессия</label>
          <select
            id="kana-next-session-size"
            value={nextSize}
            onChange={(event) => {
              const size = Number(event.currentTarget.value);
              nextSizeRef.current = size;
              setNextSize(size);
            }}
          >
            {KANA_PRACTICE_SESSION_LENGTHS.map((size) => (
              <option key={size} value={size}>
                {size} заданий
              </option>
            ))}
          </select>
          <button className="primary-action" onClick={() => void loadSession()} type="button">
            Начать новую
          </button>
        </section>
        <PracticeSummary session={state.session} />
      </>
    );
  }

  return (
    <>
      <section
        className="panel kana-practice kana-adaptive-practice"
        data-testid="kana-adaptive-practice"
      >
        <div className="kana-adaptive-progress">
          <span>{formatExerciseKind(effectiveKind!)}</span>
          <strong>
            {state.session.completedCount + 1}/{state.session.totalCount}
          </strong>
        </div>

        {effectiveKind === "tracing" && tracingItem !== null ? (
          <>
            <KanaTracingExercise
              disabled={feedback !== null || submitting}
              item={tracingItem}
              onComplete={() => submit(exercise.character)}
              onUnavailable={handleTracingUnavailable}
            />
            {feedback === null ? null : (
              <PracticeFeedback
                continueRef={continueRef}
                feedback={feedback}
                onContinue={continueSession}
              />
            )}
          </>
        ) : (
          <>
            <PracticePrompt
              available={speech.available}
              exercise={exercise}
              kind={effectiveKind!}
              onSpeak={() => speech.speak(buildKanaSpeechText(toKanaLessonItem(exercise)))}
            />
            {feedback === null ? (
              effectiveKind === "typing" ? (
                <form onSubmit={handleSubmit}>
                  <label htmlFor="kana-practice-answer">Ромадзи</label>
                  <div className="kana-answer-row">
                    <input
                      autoComplete="off"
                      disabled={submitting}
                      id="kana-practice-answer"
                      maxLength={24}
                      onChange={(event) => setAnswer(event.currentTarget.value)}
                      ref={inputRef}
                      value={answer}
                    />
                    <button
                      className="primary-action"
                      disabled={submitting || answer.trim() === ""}
                      type="submit"
                    >
                      Проверить
                    </button>
                  </div>
                </form>
              ) : (
                <PracticeChoices
                  firstChoiceRef={firstChoiceRef}
                  disabled={submitting}
                  exercise={exercise}
                  kind={effectiveKind!}
                  onSelect={(value) => void submit(value)}
                />
              )
            ) : (
              <PracticeFeedback
                continueRef={continueRef}
                feedback={feedback}
                onContinue={continueSession}
              />
            )}
          </>
        )}
      </section>
      <SectionDisclosure title="Прогресс практики">
        <PracticeSummary
          exercise={exercise}
          effectiveKind={effectiveKind ?? undefined}
          session={state.session}
        />
      </SectionDisclosure>
    </>
  );
}

function PracticePrompt({
  available,
  exercise,
  kind,
  onSpeak,
}: {
  readonly available: boolean;
  readonly exercise: KanaPracticeExerciseDto;
  readonly kind: KanaPracticeExerciseKind;
  readonly onSpeak: () => boolean;
}) {
  if (kind === "listening-choice" && available) {
    return (
      <div className="kana-listening-prompt">
        <small className="muted">Синтез речи браузера · TTS</small>
        <button
          aria-label="Воспроизвести произношение"
          className="kana-audio-button"
          onClick={() => void onSpeak()}
          type="button"
        >
          <Volume2 aria-hidden="true" size={20} />
          <span>Воспроизвести</span>
        </button>
      </div>
    );
  }

  if (kind === "reverse-choice" || kind === "matching" || kind === "listening-choice") {
    return <div className="kana-romaji-prompt">{exercise.romaji}</div>;
  }

  return (
    <div className="kana-prompt" lang="ja">
      {exercise.character}
    </div>
  );
}

function PracticeChoices({
  firstChoiceRef,
  disabled,
  exercise,
  kind,
  onSelect,
}: {
  readonly firstChoiceRef: RefObject<HTMLButtonElement | null>;
  readonly disabled: boolean;
  readonly exercise: KanaPracticeExerciseDto;
  readonly kind: KanaPracticeExerciseKind;
  readonly onSelect: (value: string) => void;
}) {
  const characterChoices =
    kind === "reverse-choice" ||
    kind === "matching" ||
    kind === "listening-choice" ||
    kind === "tracing";

  return (
    <div className={`kana-choice-grid ${characterChoices ? "is-kana" : ""}`}>
      {exercise.choices.map((choice, index) => (
        <button
          disabled={disabled}
          key={`${choice.script}:${choice.character}`}
          ref={index === 0 ? firstChoiceRef : undefined}
          lang={characterChoices ? "ja" : undefined}
          onClick={() => onSelect(characterChoices ? choice.character : choice.romaji)}
          type="button"
        >
          {characterChoices ? choice.character : choice.romaji}
        </button>
      ))}
    </div>
  );
}

function PracticeFeedback({
  continueRef,
  feedback,
  onContinue,
}: {
  readonly continueRef: RefObject<HTMLButtonElement | null>;
  readonly feedback: KanaPracticeAnswerResponse;
  readonly onContinue: () => void;
}) {
  const mode = useTranslationDisplayMode();
  return (
    <div
      className={`kana-feedback kana-adaptive-feedback ${
        feedback.correct ? "is-correct" : "is-wrong"
      }`}
      role="status"
    >
      <div>
        <strong>{feedback.correct ? "Верно" : "Неверно"}</strong>
        <span>
          {feedback.expectedCharacter} · {feedback.expectedRomaji}
        </span>
        {feedback.confusion ? (
          <>
            {mode !== "en" ? <p>{feedback.confusion.ru}</p> : null}
            {mode !== "ru" ? <p lang="en">{feedback.confusion.en}</p> : null}
          </>
        ) : feedback.confusionExplanation ? (
          <p>{feedback.confusionExplanation}</p>
        ) : null}
      </div>
      <button className="secondary-action" onClick={onContinue} ref={continueRef} type="button">
        Следующий
      </button>
    </div>
  );
}

function PracticeSummary({
  exercise,
  effectiveKind,
  session,
}: {
  readonly exercise?: KanaPracticeExerciseDto;
  readonly effectiveKind?: KanaPracticeExerciseKind;
  readonly session: KanaPracticeSessionDto;
}) {
  const percent =
    session.totalCount === 0
      ? 100
      : Math.round((session.completedCount / session.totalCount) * 100);

  return (
    <aside className="kana-adaptive-summary">
      <div>
        <span>Прогресс сессии</span>
        <strong>
          {session.completedCount}/{session.totalCount}
        </strong>
      </div>
      <div
        aria-label={`Выполнено ${percent}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="kana-progress-track"
        role="progressbar"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      {exercise === undefined ? null : (
        <dl>
          <div>
            <dt>Фокус</dt>
            <dd>{formatFocusReason(exercise.focusReason)}</dd>
          </div>
          <div>
            <dt>Азбука</dt>
            <dd>{exercise.script === "hiragana" ? "Хирагана" : "Катакана"}</dd>
          </div>
          <div>
            <dt>Формат</dt>
            <dd>{formatExerciseKind(effectiveKind ?? exercise.exerciseKind)}</dd>
          </div>
        </dl>
      )}
    </aside>
  );
}

function formatExerciseKind(kind: KanaPracticeExerciseKind): string {
  switch (kind) {
    case "recognition-choice":
      return "Распознавание";
    case "reverse-choice":
      return "Звук → знак";
    case "matching":
      return "Сопоставление";
    case "listening-choice":
      return "Аудирование";
    case "tracing":
      return "Обводка";
    default:
      return "Ввод чтения";
  }
}

function formatFocusReason(reason: KanaPracticeExerciseDto["focusReason"]): string {
  switch (reason) {
    case "weak":
      return "Слабый знак";
    case "overdue":
      return "Давно не повторялся";
    case "new":
      return "Новый знак";
    default:
      return "Контроль освоенного";
  }
}
