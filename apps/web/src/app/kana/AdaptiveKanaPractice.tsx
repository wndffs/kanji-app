"use client";

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
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const requestRevision = useRef(0);
  const speech = useJapaneseSpeech();
  const { play: playAnswerSound } = useAnswerSound();

  const loadSession = useCallback(async (): Promise<void> => {
    const revision = ++requestRevision.current;
    setState({ status: "loading" });
    setAnswer("");
    setFeedback(null);
    setPendingSession(null);
    setFallbackKind(null);

    try {
      const session = await getKanaPracticeSession(token, script);
      if (revision !== requestRevision.current) return;
      setState({ status: "ready", session });
    } catch (error: unknown) {
      if (revision !== requestRevision.current) return;
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
    if (feedback !== null) {
      continueRef.current?.focus();
    } else if (effectiveKind === "typing") {
      inputRef.current?.focus();
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
      speech.speak(exercise.character);
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
    if (state.status !== "ready" || exercise === null || feedback !== null || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await submitKanaPracticeAnswer(
        token,
        buildKanaPracticeAnswer(state.session.id, exercise, value),
      );
      setAnswer(value);
      setFeedback(result);
      setPendingSession(result.session);
      playAnswerSound(result.correct);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
        return;
      }

      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Не удалось проверить ответ.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (answer.trim() !== "") {
      void submit(answer);
    }
  }

  function continueSession(): void {
    if (pendingSession === null) {
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
              onUnavailable={() => setFallbackKind("reverse-choice")}
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
              onSpeak={() => speech.speak(exercise.character)}
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
      <PracticeSummary exercise={exercise} session={state.session} />
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
        <button
          aria-label="Воспроизвести произношение"
          className="kana-audio-button"
          onClick={() => void onSpeak()}
          type="button"
        >
          <span aria-hidden="true">▶</span>
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
  disabled,
  exercise,
  kind,
  onSelect,
}: {
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
      {exercise.choices.map((choice) => (
        <button
          disabled={disabled}
          key={`${choice.script}:${choice.character}`}
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
        {feedback.confusionExplanation === null ? null : <p>{feedback.confusionExplanation}</p>}
      </div>
      <button className="secondary-action" onClick={onContinue} ref={continueRef} type="button">
        Следующий
      </button>
    </div>
  );
}

function PracticeSummary({
  exercise,
  session,
}: {
  readonly exercise?: KanaPracticeExerciseDto;
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
            <dd>{formatExerciseKind(exercise.exerciseKind)}</dd>
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
