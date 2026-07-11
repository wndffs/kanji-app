"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  type KanaAssessmentAnswerResponse,
  type KanaAssessmentItemDto,
  type KanaAssessmentProgressDto,
  type KanaLessonItemDto,
  type KanaLessonPathDto,
  type KanaLessonUnitDto,
  type KanaScript,
} from "@kanji-srs/shared";

import {
  ApiError,
  getKanaAssessment,
  getKanaLessons,
  submitKanaAssessmentAnswer,
  submitKanaLessonAnswer,
} from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";

type KanaMode = "lessons" | "assessment";
type LessonPhase = "teach" | "quiz";

type KanaState =
  | { readonly status: "checking" }
  | { readonly status: "loading" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly progress: KanaAssessmentProgressDto;
      readonly path: KanaLessonPathDto;
    };

export function KanaClient() {
  const [script, setScript] = useState<KanaScript>("hiragana");
  const [mode, setMode] = useState<KanaMode>("lessons");
  const [state, setState] = useState<KanaState>({ status: "checking" });
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>("teach");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<KanaAssessmentAnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const session = readStoredSession();

    if (session === null) {
      setState({ status: "unauthenticated" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    setAnswer("");
    setFeedback(null);

    void Promise.all([
      getKanaAssessment(session.token, script),
      getKanaLessons(session.token, script),
    ])
      .then(([progress, path]) => {
        if (cancelled) {
          return;
        }

        const unit = selectCurrentUnit(path.units);
        const character = selectNextLessonCharacter(unit?.items ?? [], null);
        setActiveUnitId(unit?.id ?? null);
        setSelectedCharacter(character);
        setLessonPhase(selectLessonPhase(unit?.items ?? [], character));
        setState({ status: "ready", token: session.token, progress, path });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          clearStoredSession();
          setState({ status: "unauthenticated" });
          return;
        }

        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Не удалось загрузить уроки кана.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [script]);

  useEffect(() => {
    if (lessonPhase === "quiz" && feedback === null) {
      inputRef.current?.focus();
    } else if (feedback !== null) {
      continueRef.current?.focus();
    }
  }, [feedback, lessonPhase, selectedCharacter]);

  const currentItem = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return state.progress.items.find((item) => item.character === selectedCharacter) ?? null;
  }, [selectedCharacter, state]);

  const activeUnit = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return state.path.units.find((unit) => unit.id === activeUnitId) ?? null;
  }, [activeUnitId, state]);

  const currentLessonItem = useMemo(() => {
    return activeUnit?.items.find((item) => item.character === selectedCharacter) ?? null;
  }, [activeUnit, selectedCharacter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (
      state.status !== "ready" ||
      currentItem === null ||
      feedback !== null ||
      submitting ||
      answer.trim() === ""
    ) {
      return;
    }

    setSubmitting(true);

    try {
      const submit = mode === "lessons" ? submitKanaLessonAnswer : submitKanaAssessmentAnswer;
      const result = await submit(state.token, {
        character: currentItem.character,
        answer,
      });
      const progress = updateProgress(state.progress, result);
      const path = updateLessonPath(state.path, result.item);

      setState({ ...state, progress, path });
      setFeedback(result);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
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

  function handleNext(): void {
    if (state.status !== "ready" || currentItem === null) {
      return;
    }

    if (mode === "assessment") {
      setSelectedCharacter(selectNextCharacter(state.progress.items, currentItem.character));
      setLessonPhase("quiz");
    } else {
      const unit = state.path.units.find((candidate) => candidate.id === activeUnitId) ?? null;

      if (unit?.complete === true) {
        const nextUnit = selectCurrentUnit(state.path.units);
        const nextCharacter = selectNextLessonCharacter(nextUnit?.items ?? [], null);
        setActiveUnitId(nextUnit?.id ?? null);
        setSelectedCharacter(nextCharacter);
        setLessonPhase(selectLessonPhase(nextUnit?.items ?? [], nextCharacter));
      } else {
        const nextCharacter = selectNextLessonCharacter(unit?.items ?? [], currentItem.character);
        setSelectedCharacter(nextCharacter);
        setLessonPhase(selectLessonPhase(unit?.items ?? [], nextCharacter));
      }
    }

    setAnswer("");
    setFeedback(null);
  }

  function handleModeChange(nextMode: KanaMode): void {
    if (state.status !== "ready" || nextMode === mode) {
      return;
    }

    setMode(nextMode);
    setAnswer("");
    setFeedback(null);

    if (nextMode === "assessment") {
      setSelectedCharacter(selectNextCharacter(state.progress.items, null));
      setLessonPhase("quiz");
      return;
    }

    const unit = selectCurrentUnit(state.path.units);
    const character = selectNextLessonCharacter(unit?.items ?? [], null);
    setActiveUnitId(unit?.id ?? null);
    setSelectedCharacter(character);
    setLessonPhase(selectLessonPhase(unit?.items ?? [], character));
  }

  function handleStartUnit(unit: KanaLessonUnitDto): void {
    if (!unit.unlocked || feedback !== null) {
      return;
    }

    setMode("lessons");
    setActiveUnitId(unit.id);
    const character = selectNextLessonCharacter(unit.items, null);
    setSelectedCharacter(character);
    setLessonPhase(selectLessonPhase(unit.items, character));
    setAnswer("");
  }

  function handleSelectAssessmentCharacter(character: string): void {
    if (feedback !== null) {
      return;
    }

    setSelectedCharacter(character);
    setAnswer("");
  }

  if (state.status === "checking" || state.status === "loading") {
    return (
      <section aria-busy="true" className="page-stack">
        <div className="page-heading">
          <h1>Кана</h1>
          <p>Загружаю уроки.</p>
        </div>
        <div className="panel skeleton kana-loading" />
      </section>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Кана</h1>
          <p>Прогресс уроков сохраняется в профиле.</p>
        </div>
        <div className="notice-panel">
          <Link className="primary-action" href="/login">
            Войти
          </Link>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Кана</h1>
          <p>Не удалось открыть уроки.</p>
        </div>
        <div className="error-banner" role="alert">
          {state.message}
        </div>
        <button className="secondary-action" onClick={() => window.location.reload()} type="button">
          Повторить
        </button>
      </section>
    );
  }

  const progressPercent = Math.round((state.path.masteredCount / state.path.totalCount) * 100);

  return (
    <section className="page-stack kana-page">
      <div className="page-heading kana-heading">
        <div>
          <span className="eyebrow">Characters</span>
          <h1>Кана</h1>
        </div>
        <div aria-label="Выбор азбуки" className="kana-script-control" role="group">
          <button
            aria-pressed={script === "hiragana"}
            disabled={submitting}
            onClick={() => setScript("hiragana")}
            type="button"
          >
            Хирагана
          </button>
          <button
            aria-pressed={script === "katakana"}
            disabled={submitting}
            onClick={() => setScript("katakana")}
            type="button"
          >
            Катакана
          </button>
        </div>
      </div>

      <div aria-label="Режим кана" className="kana-mode-tabs" role="tablist">
        <button
          aria-selected={mode === "lessons"}
          onClick={() => handleModeChange("lessons")}
          role="tab"
          type="button"
        >
          Уроки
        </button>
        <button
          aria-selected={mode === "assessment"}
          onClick={() => handleModeChange("assessment")}
          role="tab"
          type="button"
        >
          Проверка
        </button>
      </div>

      <div className="kana-progress-summary">
        <div>
          <span>Освоено</span>
          <strong>
            {state.path.masteredCount}/{state.path.totalCount}
          </strong>
        </div>
        <div
          aria-label={`Освоено ${progressPercent}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progressPercent}
          className="kana-progress-track"
          role="progressbar"
        >
          <span style={{ width: `${progressPercent}%` }} />
        </div>
        <small>
          {mode === "lessons" ? formatLessonCount(state.path.units.length) : "Свободный режим"}
        </small>
      </div>

      <div className="kana-workspace">
        <section className="panel kana-practice" data-testid="kana-practice">
          {currentItem === null ? (
            <p className="muted">В этой азбуке пока нет знаков.</p>
          ) : mode === "lessons" && lessonPhase === "teach" && currentLessonItem !== null ? (
            <KanaTeachingStep item={currentLessonItem} onContinue={() => setLessonPhase("quiz")} />
          ) : (
            <>
              <div className="kana-prompt" lang="ja">
                {currentItem.character}
              </div>
              <form onSubmit={(event) => void handleSubmit(event)}>
                <label htmlFor="kana-answer">Ромадзи</label>
                <div className="kana-answer-row">
                  <input
                    autoComplete="off"
                    disabled={feedback !== null || submitting}
                    id="kana-answer"
                    inputMode="text"
                    maxLength={24}
                    onChange={(event) => setAnswer(event.currentTarget.value)}
                    ref={inputRef}
                    value={answer}
                  />
                  <button
                    className="primary-action"
                    disabled={feedback !== null || submitting || answer.trim() === ""}
                    type="submit"
                  >
                    Проверить
                  </button>
                </div>
              </form>

              {feedback === null ? (
                <div className="kana-streak">
                  Прогресс: {currentItem.currentStreak}/{state.progress.masteryThreshold}
                </div>
              ) : (
                <div
                  className={`kana-feedback ${feedback.correct ? "is-correct" : "is-wrong"}`}
                  role="status"
                >
                  <div>
                    <strong>{feedback.correct ? "Верно" : "Неверно"}</strong>
                    <span>{feedback.expectedRomaji}</span>
                  </div>
                  <button
                    className="secondary-action"
                    onClick={handleNext}
                    ref={continueRef}
                    type="button"
                  >
                    Следующий
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {mode === "lessons" ? (
          <div className="kana-unit-list" data-testid="kana-unit-list">
            {state.path.units.map((unit) => (
              <button
                aria-current={unit.id === activeUnitId ? "step" : undefined}
                className={unit.complete ? "is-complete" : ""}
                disabled={!unit.unlocked || submitting}
                key={unit.id}
                onClick={() => handleStartUnit(unit)}
                type="button"
              >
                <span className="kana-unit-copy">
                  <strong>{unit.title}</strong>
                  <small>
                    {unit.masteredCount}/{unit.totalCount}
                  </small>
                </span>
                <span className="kana-unit-characters" lang="ja">
                  {unit.items.map((item) => (
                    <span className={item.mastered ? "is-mastered" : ""} key={item.character}>
                      {item.character}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <section className="kana-map" aria-label="Карта кана">
            {state.progress.items.map((item) => (
              <button
                aria-current={item.character === selectedCharacter ? "true" : undefined}
                aria-label={formatKanaStatus(item, state.progress.masteryThreshold)}
                className={
                  item.mastered ? "is-mastered" : item.attemptCount > 0 ? "is-started" : ""
                }
                disabled={feedback !== null || submitting}
                key={item.character}
                lang="ja"
                onClick={() => handleSelectAssessmentCharacter(item.character)}
                type="button"
              >
                {item.character}
              </button>
            ))}
          </section>
        )}
      </div>
    </section>
  );
}

function KanaTeachingStep({
  item,
  onContinue,
}: {
  readonly item: KanaLessonItemDto;
  readonly onContinue: () => void;
}) {
  return (
    <div className="kana-teaching-step">
      <span className="eyebrow">{formatVariant(item)}</span>
      <div className="kana-prompt" lang="ja">
        {item.character}
      </div>
      <strong className="kana-reading">{item.romaji}</strong>
      {item.variant === "basic" ? null : (
        <div className="kana-base-pair" lang="ja">
          <span>{item.baseCharacter}</span>
          <span aria-hidden="true">→</span>
          <span>{item.character}</span>
        </div>
      )}
      <button className="primary-action" onClick={onContinue} type="button">
        Проверить чтение
      </button>
    </div>
  );
}

function updateProgress(
  progress: KanaAssessmentProgressDto,
  result: KanaAssessmentAnswerResponse,
): KanaAssessmentProgressDto {
  return {
    ...progress,
    attemptedCount: result.attemptedCount,
    masteredCount: result.masteredCount,
    items: progress.items.map((item) =>
      item.character === result.item.character ? result.item : item,
    ),
  };
}

function updateLessonPath(
  path: KanaLessonPathDto,
  updatedItem: KanaAssessmentItemDto,
): KanaLessonPathDto {
  let previousComplete = true;
  const units = path.units.map((unit, order) => {
    const items = unit.items.map((item) =>
      item.character === updatedItem.character ? { ...item, ...updatedItem } : item,
    );
    const masteredCount = items.filter((item) => item.mastered).length;
    const complete = masteredCount === items.length;
    const unlocked = order === 0 || previousComplete;

    previousComplete = previousComplete && complete;

    return { ...unit, items, masteredCount, complete, unlocked };
  });

  return {
    ...path,
    masteredCount: units.reduce((count, unit) => count + unit.masteredCount, 0),
    units,
  };
}

function selectCurrentUnit(units: readonly KanaLessonUnitDto[]): KanaLessonUnitDto | null {
  return units.find((unit) => unit.unlocked && !unit.complete) ?? units.at(-1) ?? null;
}

function selectNextLessonCharacter(
  items: readonly KanaLessonItemDto[],
  currentCharacter: string | null,
): string | null {
  const ordered = [...items].sort(
    (left, right) =>
      Number(left.mastered) - Number(right.mastered) ||
      left.currentStreak - right.currentStreak ||
      left.attemptCount - right.attemptCount ||
      left.order - right.order,
  );

  return (
    ordered.find((item) => item.character !== currentCharacter && !item.mastered)?.character ??
    ordered.find((item) => item.character !== currentCharacter)?.character ??
    ordered[0]?.character ??
    null
  );
}

function selectLessonPhase(
  items: readonly KanaLessonItemDto[],
  character: string | null,
): LessonPhase {
  const item = items.find((candidate) => candidate.character === character);

  return item === undefined || item.attemptCount === 0 ? "teach" : "quiz";
}

function selectNextCharacter(
  items: readonly KanaAssessmentItemDto[],
  currentCharacter: string | null,
): string | null {
  const ordered = [...items].sort(
    (left, right) =>
      Number(left.mastered) - Number(right.mastered) ||
      left.currentStreak - right.currentStreak ||
      left.attemptCount - right.attemptCount ||
      left.order - right.order,
  );

  return (
    ordered.find((item) => item.character !== currentCharacter)?.character ??
    ordered[0]?.character ??
    null
  );
}

function formatKanaStatus(item: KanaAssessmentItemDto, masteryThreshold: number): string {
  if (item.mastered) {
    return `${item.character}: освоено`;
  }

  return `${item.character}: прогресс ${item.currentStreak} из ${masteryThreshold}`;
}

function formatVariant(item: KanaLessonItemDto): string {
  switch (item.variant) {
    case "dakuten":
      return "Дакутэн";
    case "handakuten":
      return "Хандакутэн";
    case "yoon":
      return "Ёон";
    default:
      return "Новый знак";
  }
}

function formatLessonCount(count: number): string {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} уроков`;
  }

  if (lastDigit === 1) {
    return `${count} урок`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} урока`;
  }

  return `${count} уроков`;
}
