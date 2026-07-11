"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  type KanaAssessmentAnswerResponse,
  type KanaAssessmentItemDto,
  type KanaAssessmentProgressDto,
  type KanaScript,
} from "@kanji-srs/shared";

import { ApiError, getKanaAssessment, submitKanaAssessmentAnswer } from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";

type KanaState =
  | { readonly status: "checking" }
  | { readonly status: "loading" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly progress: KanaAssessmentProgressDto;
    };

export function KanaClient() {
  const [script, setScript] = useState<KanaScript>("hiragana");
  const [state, setState] = useState<KanaState>({ status: "checking" });
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
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

    void getKanaAssessment(session.token, script)
      .then((progress) => {
        if (cancelled) {
          return;
        }

        setSelectedCharacter(selectNextCharacter(progress.items, null));
        setState({ status: "ready", token: session.token, progress });
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
          message: error instanceof Error ? error.message : "Не удалось загрузить проверку кана.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [script]);

  useEffect(() => {
    if (feedback === null) {
      inputRef.current?.focus();
    } else {
      continueRef.current?.focus();
    }
  }, [feedback, selectedCharacter]);

  const currentItem = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return state.progress.items.find((item) => item.character === selectedCharacter) ?? null;
  }, [selectedCharacter, state]);

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
      const result = await submitKanaAssessmentAnswer(state.token, {
        character: currentItem.character,
        answer,
      });
      const progress: KanaAssessmentProgressDto = {
        ...state.progress,
        attemptedCount: result.attemptedCount,
        masteredCount: result.masteredCount,
        items: state.progress.items.map((item) =>
          item.character === result.item.character ? result.item : item,
        ),
      };

      setState({ ...state, progress });
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

    setSelectedCharacter(selectNextCharacter(state.progress.items, currentItem.character));
    setAnswer("");
    setFeedback(null);
  }

  function handleSelectCharacter(character: string): void {
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
          <p>Загружаю прогресс.</p>
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
          <p>Прогресс проверки сохраняется в профиле.</p>
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
          <p>Не удалось открыть проверку.</p>
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

  const progressPercent = Math.round(
    (state.progress.masteredCount / state.progress.totalCount) * 100,
  );

  return (
    <section className="page-stack kana-page">
      <div className="page-heading kana-heading">
        <div>
          <span className="eyebrow">Foundation</span>
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

      <div className="kana-progress-summary">
        <div>
          <span>Освоено</span>
          <strong>
            {state.progress.masteredCount}/{state.progress.totalCount}
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
        <small>Проверено: {state.progress.attemptedCount}</small>
      </div>

      <div className="kana-workspace">
        <section className="panel kana-practice" data-testid="kana-practice">
          {currentItem === null ? (
            <p className="muted">В этой азбуке пока нет знаков.</p>
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
                  Серия: {currentItem.currentStreak}/{state.progress.masteryThreshold}
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

        <section className="kana-map" aria-label="Карта кана">
          {state.progress.items.map((item) => (
            <button
              aria-current={item.character === currentItem?.character ? "true" : undefined}
              aria-label={formatKanaStatus(item, state.progress.masteryThreshold)}
              className={item.mastered ? "is-mastered" : item.attemptCount > 0 ? "is-started" : ""}
              disabled={feedback !== null || submitting}
              key={item.character}
              lang="ja"
              onClick={() => handleSelectCharacter(item.character)}
              type="button"
            >
              {item.character}
            </button>
          ))}
        </section>
      </div>
    </section>
  );
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

  return `${item.character}: серия ${item.currentStreak} из ${masteryThreshold}`;
}
