"use client";

import Link from "next/link";
import { Volume2 } from "lucide-react";
import { ViewTabs } from "../../components/ViewTabs";
import { SectionDisclosure } from "../../components/SectionDisclosure";
import { KanaContentSummary } from "../../components/KanaContentSummary";
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
  type KanaAssessmentAnswerResponse,
  type KanaAssessmentItemDto,
  type KanaAssessmentProgressDto,
  type KanaLessonItemDto,
  type KanaLessonPathDto,
  type KanaLessonUnitDto,
  type KanaPracticeScript,
  type KanaScript,
} from "@kanji-srs/shared";

import {
  ApiError,
  getKanaAssessment,
  getKanaLessons,
  submitKanaAssessmentAnswer,
  submitKanaLessonAnswer,
} from "../../lib/api-client";
import { clearStoredSession } from "../../lib/auth-storage";
import { ownsSession, useStoredSession } from "../../lib/use-stored-session";
import {
  buildKanaExerciseChoices,
  selectKanaExerciseKind,
  type KanaExerciseKind,
} from "../../lib/kana-exercises";
import { buildKanaSpeechText } from "../../lib/kana-speech";
import { isKanaTracingCandidate } from "../../lib/kana-tracing";
import { useAnswerSound } from "../../lib/use-answer-sound";
import { useJapaneseSpeech } from "../../lib/use-japanese-speech";
import { resolveKanaLessonDestination, type KanaRouteMode } from "../../lib/kana-route";
import { AdaptiveKanaPractice } from "./AdaptiveKanaPractice";
import { KanaTracingExercise } from "./KanaTracingExercise";
import { KanaLessonFinder } from "./KanaLessonFinder";
import { groupKanaCharacters, selectKanaResumeUnit } from "../../lib/kana-unit-groups";

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

type KanaClientProps = {
  readonly initialUnitId?: string | null;
  readonly initialCharacter?: string | null;
  readonly initialMode?: KanaRouteMode;
  readonly initialScript?: KanaScript;
  readonly initialPracticeScript?: KanaPracticeScript;
};

export function KanaClient(props: KanaClientProps) {
  const session = useStoredSession();
  if (session === undefined)
    return (
      <section className="page-stack" aria-busy="true">
        <h1>Кана</h1>
      </section>
    );
  if (session === null)
    return (
      <section className="page-stack">
        <h1>Кана</h1>
        <p>Для уроков каны нужен вход.</p>
        <Link href="/login">Войти</Link>
      </section>
    );
  return (
    <OwnedKanaClient
      key={`${session.user.id}:${session.token}:${props.initialMode}:${props.initialScript}:${props.initialUnitId}:${props.initialCharacter}`}
      {...props}
      token={session.token}
    />
  );
}

function OwnedKanaClient({
  initialMode = "lessons",
  initialScript = "hiragana",
  initialPracticeScript = "hiragana",
  initialUnitId = null,
  initialCharacter = null,
  token,
}: KanaClientProps & { readonly token: string }) {
  const [script, setScript] = useState<KanaScript>(initialScript);
  const [practiceScript, setPracticeScript] = useState<KanaPracticeScript>(initialPracticeScript);
  const [dataRevision, setDataRevision] = useState(0);
  const [mode, setMode] = useState<KanaRouteMode>(initialMode);
  const [state, setState] = useState<KanaState>({ status: "checking" });
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>("teach");
  const [exerciseKind, setExerciseKind] = useState<KanaExerciseKind>("typing");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<KanaAssessmentAnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const practiceRef = useRef<HTMLElement>(null);
  const choiceRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const requestRevision = useRef(0);
  const desiredDestination = useRef({ unitId: initialUnitId, character: initialCharacter });
  const kanaSpeech = useJapaneseSpeech();
  const { play: playAnswerSound } = useAnswerSound();
  const handleTracingUnavailable = useCallback(() => setExerciseKind("typing"), []);
  const handleUnauthorized = useCallback(() => {
    if (!ownsSession(token)) return;
    clearStoredSession();
    setState({ status: "unauthenticated" });
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const revision = ++requestRevision.current;
    setState({ status: "loading" });
    setAnswer("");
    setFeedback(null);

    void Promise.all([getKanaAssessment(token, script), getKanaLessons(token, script)])
      .then(([progress, path]) => {
        if (cancelled || revision !== requestRevision.current || !ownsSession(token)) {
          return;
        }

        const destination =
          mode === "lessons"
            ? resolveKanaLessonDestination(
                path,
                desiredDestination.current.unitId,
                desiredDestination.current.character,
              )
            : null;
        const unit = destination?.unit ?? selectCurrentUnit(path.units);
        const character =
          destination?.character ?? selectNextLessonCharacter(unit?.items ?? [], null);
        const item = unit?.items.find((candidate) => candidate.character === character);
        setActiveUnitId(unit?.id ?? null);
        setSelectedCharacter(character);
        setLessonPhase(selectLessonPhase(unit?.items ?? [], character));
        setExerciseKind(item === undefined ? "typing" : selectKanaExerciseKind(item));
        setState({ status: "ready", token, progress, path });
      })
      .catch((error: unknown) => {
        if (cancelled || revision !== requestRevision.current || !ownsSession(token)) {
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
      requestRevision.current++;
    };
  }, [dataRevision, script, token, initialUnitId, initialCharacter]);

  useEffect(() => {
    if (state.status === "ready" && mode === "lessons")
      desiredDestination.current = { unitId: activeUnitId, character: selectedCharacter };
  }, [state.status, mode, activeUnitId, selectedCharacter]);

  useEffect(() => {
    if (lessonPhase === "quiz" && feedback === null) {
      if (exerciseKind === "typing") {
        inputRef.current?.focus();
      } else {
        choiceRef.current?.focus();
      }
    } else if (feedback !== null) {
      continueRef.current?.focus();
    }
  }, [exerciseKind, feedback, lessonPhase, selectedCharacter]);

  useEffect(() => kanaSpeech.cancel, [kanaSpeech.cancel, selectedCharacter, script, mode, lessonPhase]);

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
    if (state.status !== "ready") {
      return null;
    }

    return (
      state.path.units
        .flatMap((unit) => unit.items)
        .find((item) => item.character === selectedCharacter) ?? null
    );
  }, [selectedCharacter, state]);

  const exerciseItems = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }

    return mode === "lessons"
      ? (activeUnit?.items ?? [])
      : state.path.units.flatMap((unit) => unit.items);
  }, [activeUnit, mode, state]);

  const exerciseChoices = useMemo(() => {
    if (currentLessonItem === null) {
      return [];
    }

    return buildKanaExerciseChoices(
      exerciseItems,
      currentLessonItem,
      exerciseKind === "matching" ? 3 : 4,
    );
  }, [currentLessonItem, exerciseItems, exerciseKind]);

  useEffect(() => {
    if (
      !kanaSpeech.available ||
      !kanaSpeech.autoplay ||
      currentLessonItem === null ||
      feedback !== null ||
      !((mode === "lessons" && lessonPhase === "teach") || exerciseKind === "listening-choice")
    ) {
      return;
    }

    kanaSpeech.speak(buildKanaSpeechText(currentLessonItem));
    return kanaSpeech.cancel;
  }, [
    currentLessonItem,
    exerciseKind,
    feedback,
    kanaSpeech.available,
    kanaSpeech.autoplay,
    kanaSpeech.cancel,
    kanaSpeech.speak,
    lessonPhase,
    mode,
  ]);

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

    const result = await submitAnswer(currentItem.character, answer);

    if (result !== null) {
      setFeedback(result);
    }
  }

  async function handleChoiceAnswer(
    selectedRomaji: string,
    selectedCharacter?: string,
  ): Promise<void> {
    if (currentItem === null || feedback !== null || submitting) {
      return;
    }

    kanaSpeech.cancel();
    setAnswer(selectedRomaji);
    const result = await submitAnswer(currentItem.character, selectedRomaji, selectedCharacter);

    if (result !== null) {
      setFeedback(result);
    }
  }

  async function handleTraceComplete(): Promise<void> {
    if (currentItem === null || currentLessonItem === null || feedback !== null || submitting) {
      return;
    }

    const result = await submitAnswer(
      currentItem.character,
      currentLessonItem.romaji,
      currentItem.character,
    );

    if (result !== null) {
      setFeedback(result);
    }
  }

  async function submitAnswer(
    character: string,
    submittedAnswer: string,
    selectedAnswerCharacter?: string,
  ): Promise<KanaAssessmentAnswerResponse | null> {
    if (state.status !== "ready" || submitting || !ownsSession(token)) {
      return null;
    }

    setSubmitting(true);
    const revision = requestRevision.current;

    try {
      const submit = mode === "lessons" ? submitKanaLessonAnswer : submitKanaAssessmentAnswer;
      const result = await submit(state.token, {
        character,
        answer: submittedAnswer,
        exerciseKind,
        ...(selectedAnswerCharacter === undefined
          ? {}
          : { selectedCharacter: selectedAnswerCharacter }),
      });
      if (revision !== requestRevision.current || !ownsSession(token)) return null;

      setState((currentState) => {
        if (currentState.status !== "ready") {
          return currentState;
        }

        return {
          ...currentState,
          progress: updateProgress(currentState.progress, result),
          path: updateLessonPath(currentState.path, result.item),
        };
      });

      playAnswerSound(result.correct);
      return result;
    } catch (error: unknown) {
      if (revision !== requestRevision.current || !ownsSession(token)) return null;
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
        return null;
      }

      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Не удалось проверить ответ.",
      });
      return null;
    } finally {
      if (revision === requestRevision.current && ownsSession(token)) setSubmitting(false);
    }
  }

  function prepareExercise(character: string | null, items: readonly KanaLessonItemDto[]): void {
    const item = items.find((candidate) => candidate.character === character);

    setSelectedCharacter(character);
    setExerciseKind(
      item === undefined
        ? "typing"
        : selectKanaExerciseKind(item, {
            listeningAvailable: kanaSpeech.available,
            tracingAvailable: isKanaTracingCandidate(item),
          }),
    );
    setAnswer("");
    setFeedback(null);
  }

  function handleNext(): void {
    if (state.status !== "ready" || currentItem === null) {
      return;
    }

    if (mode === "assessment") {
      const character = selectNextCharacter(state.progress.items, currentItem.character);
      prepareExercise(
        character,
        state.path.units.flatMap((unit) => unit.items),
      );
      setLessonPhase("quiz");
    } else {
      const unit = state.path.units.find((candidate) => candidate.id === activeUnitId) ?? null;

      if (unit?.complete === true) {
        const nextUnit = selectCurrentUnit(state.path.units);
        const nextCharacter = selectNextLessonCharacter(nextUnit?.items ?? [], null);
        setActiveUnitId(nextUnit?.id ?? null);
        prepareExercise(nextCharacter, nextUnit?.items ?? []);
        setLessonPhase(selectLessonPhase(nextUnit?.items ?? [], nextCharacter));
      } else {
        const nextCharacter = selectNextLessonCharacter(unit?.items ?? [], currentItem.character);
        prepareExercise(nextCharacter, unit?.items ?? []);
        setLessonPhase(selectLessonPhase(unit?.items ?? [], nextCharacter));
      }
    }
  }

  function handleModeChange(nextMode: KanaRouteMode): void {
    if (state.status !== "ready" || nextMode === mode || submitting) {
      return;
    }

    setMode(nextMode);

    if (nextMode === "practice") {
      setPracticeScript(script);
      setAnswer("");
      setFeedback(null);
      return;
    }

    if (mode === "practice") {
      if (practiceScript !== "mixed" && practiceScript !== script) {
        setScript(practiceScript);
      } else {
        setDataRevision((revision) => revision + 1);
      }
    }

    if (nextMode === "assessment") {
      const character = selectNextCharacter(state.progress.items, null);
      prepareExercise(
        character,
        state.path.units.flatMap((unit) => unit.items),
      );
      setLessonPhase("quiz");
      return;
    }

    const unit = selectCurrentUnit(state.path.units);
    const character = selectNextLessonCharacter(unit?.items ?? [], null);
    setActiveUnitId(unit?.id ?? null);
    prepareExercise(character, unit?.items ?? []);
    setLessonPhase(selectLessonPhase(unit?.items ?? [], character));
  }

  function handleStartUnit(unit: KanaLessonUnitDto): void {
    if (!unit.unlocked || feedback !== null || submitting) {
      return;
    }

    setMode("lessons");
    setActiveUnitId(unit.id);
    const character = selectNextLessonCharacter(unit.items, null);
    prepareExercise(character, unit.items);
    setLessonPhase(selectLessonPhase(unit.items, character));
    requestAnimationFrame(() => practiceRef.current?.scrollIntoView({ block: "start" }));
  }

  function handleSelectAssessmentCharacter(character: string): void {
    if (feedback !== null) {
      return;
    }

    prepareExercise(
      character,
      state.status === "ready" ? state.path.units.flatMap((unit) => unit.items) : [],
    );
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
        <button
          className="secondary-action"
          onClick={() => setDataRevision((value) => value + 1)}
          type="button"
        >
          Повторить
        </button>
      </section>
    );
  }

  const progressPercent =
    state.path.totalCount === 0
      ? 0
      : Math.round((state.path.masteredCount / state.path.totalCount) * 100);

  return (
    <section className="page-stack kana-page" data-script={script} data-mode={mode}>
      <div className="page-heading kana-heading">
        <div>
          <span className="kana-script-mark" lang="ja" aria-hidden="true">
            {script === "hiragana" ? "あ" : "ア"}
          </span>
          <h1>Кана</h1>
        </div>
        <div
          aria-label="Выбор азбуки"
          className={`kana-script-control ${mode === "practice" ? "has-mixed" : ""}`}
          role="group"
        >
          <button
            aria-pressed={
              mode === "practice" ? practiceScript === "hiragana" : script === "hiragana"
            }
            disabled={submitting}
            onClick={() => {
              setPracticeScript("hiragana");
              if (mode !== "practice") {
                setScript("hiragana");
              }
            }}
            type="button"
          >
            Хирагана
          </button>
          <button
            aria-pressed={
              mode === "practice" ? practiceScript === "katakana" : script === "katakana"
            }
            disabled={submitting}
            onClick={() => {
              setPracticeScript("katakana");
              if (mode !== "practice") {
                setScript("katakana");
              }
            }}
            type="button"
          >
            Катакана
          </button>
          {mode === "practice" ? (
            <button
              aria-pressed={practiceScript === "mixed"}
              disabled={submitting}
              onClick={() => setPracticeScript("mixed")}
              type="button"
            >
              Смешанная
            </button>
          ) : null}
        </div>
      </div>

      <ViewTabs
        active={mode}
        onChange={(value) => handleModeChange(value as KanaRouteMode)}
        label="Режим кана"
        idPrefix="kana-mode"
        panelId="kana-workspace"
        tabs={[
          { id: "lessons", label: "Уроки" },
          { id: "assessment", label: "Проверка" },
          { id: "practice", label: "Практика" },
        ]}
      />

      {mode === "practice" ? null : (
        <div className="kana-progress-summary">
          <div>
            <span>Освоено учебных элементов</span>
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
      )}

      {mode === "practice" ? null : <KanaContentSummary items={state.progress.items} />}

      <div
        className="kana-workspace"
        id="kana-workspace"
        role="tabpanel"
        aria-labelledby={`kana-mode-${mode}`}
      >
        {mode === "practice" ? (
          <AdaptiveKanaPractice
            key={`${state.token}:${practiceScript}`}
            onUnauthorized={handleUnauthorized}
            script={practiceScript}
            token={state.token}
          />
        ) : (
          <>
            <section className="panel kana-practice" data-testid="kana-practice" ref={practiceRef}>
              {mode === "lessons" && activeUnit !== null ? (
                <header className="kana-current-lesson">
                  <h2 className="kana-current-unit">{activeUnit.title}</h2>
                  <span>
                    Освоено {activeUnit.masteredCount} / {activeUnit.totalCount}
                  </span>
                </header>
              ) : null}
              {currentItem === null ? (
                <p className="muted">В этой азбуке пока нет знаков.</p>
              ) : mode === "lessons" && lessonPhase === "teach" && currentLessonItem !== null ? (
                <KanaTeachingStep
                  item={currentLessonItem}
                  speechAvailable={kanaSpeech.available}
                  onSpeak={() => kanaSpeech.speak(buildKanaSpeechText(currentLessonItem))}
                  onContinue={() => setLessonPhase("quiz")}
                />
              ) : currentLessonItem === null ? (
                <p className="muted">Не удалось подготовить упражнение для этого знака.</p>
              ) : (
                <KanaQuiz
                  answer={answer}
                  choiceRef={choiceRef}
                  choices={exerciseChoices}
                  continueRef={continueRef}
                  exerciseKind={exerciseKind}
                  feedback={feedback}
                  inputRef={inputRef}
                  item={currentLessonItem}
                  masteryThreshold={state.progress.masteryThreshold}
                  onAnswerChange={setAnswer}
                  onChoice={(romaji, character) => void handleChoiceAnswer(romaji, character)}
                  onMatchAnswer={submitAnswer}
                  onNext={handleNext}
                  onSpeak={() => kanaSpeech.speak(buildKanaSpeechText(currentLessonItem))}
                  onSubmit={(event) => void handleSubmit(event)}
                  onTraceComplete={handleTraceComplete}
                  onTracingUnavailable={handleTracingUnavailable}
                  submitting={submitting}
                />
              )}
            </section>

            {mode === "lessons" ? (
              <SectionDisclosure title="Все уроки" key={`units:${script}`}>
                <KanaLessonFinder
                  units={state.path.units}
                  activeUnitId={activeUnitId}
                  submitting={submitting || feedback !== null}
                  onStart={handleStartUnit}
                />
              </SectionDisclosure>
            ) : (
              <SectionDisclosure title="Карта знаков" key={`map:${script}`}>
                <section className="kana-character-map" aria-label="Карта кана">
                  {groupKanaCharacters(state.progress.items).map((group) => (
                    <section className="kana-character-group" key={group.variant}>
                      <h3>
                        {group.label}
                        <span>
                          {group.items.filter((item) => item.mastered).length} /{" "}
                          {group.items.length}
                        </span>
                      </h3>
                      <div className="kana-map">
                        {group.items.map((item) => (
                          <button
                            aria-current={item.character === selectedCharacter ? "true" : undefined}
                            aria-label={formatKanaStatus(item, state.progress.masteryThreshold)}
                            className={
                              item.mastered
                                ? "is-mastered"
                                : item.attemptCount > 0
                                  ? "is-started"
                                  : ""
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
                      </div>
                    </section>
                  ))}
                </section>
              </SectionDisclosure>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function KanaQuiz({
  answer,
  choiceRef,
  choices,
  continueRef,
  exerciseKind,
  feedback,
  inputRef,
  item,
  masteryThreshold,
  onAnswerChange,
  onChoice,
  onMatchAnswer,
  onNext,
  onSpeak,
  onSubmit,
  onTraceComplete,
  onTracingUnavailable,
  submitting,
}: {
  readonly answer: string;
  readonly choiceRef: RefObject<HTMLButtonElement | null>;
  readonly choices: readonly KanaLessonItemDto[];
  readonly continueRef: RefObject<HTMLButtonElement | null>;
  readonly exerciseKind: KanaExerciseKind;
  readonly feedback: KanaAssessmentAnswerResponse | null;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly item: KanaLessonItemDto;
  readonly masteryThreshold: number;
  readonly onAnswerChange: (answer: string) => void;
  readonly onChoice: (romaji: string, character?: string) => void;
  readonly onMatchAnswer: (
    character: string,
    answer: string,
  ) => Promise<KanaAssessmentAnswerResponse | null>;
  readonly onNext: () => void;
  readonly onSpeak: () => boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onTraceComplete: () => Promise<void>;
  readonly onTracingUnavailable: () => void;
  readonly submitting: boolean;
}) {
  if (exerciseKind === "matching") {
    return (
      <KanaMatchingExercise
        choiceRef={choiceRef}
        items={choices}
        onAnswer={onMatchAnswer}
        onNext={onNext}
        submitting={submitting}
      />
    );
  }

  if (exerciseKind === "tracing") {
    return (
      <>
        <KanaTracingExercise
          disabled={feedback !== null || submitting}
          item={item}
          onComplete={onTraceComplete}
          onUnavailable={onTracingUnavailable}
        />
        {feedback === null ? null : (
          <KanaFeedback
            continueRef={continueRef}
            feedback={feedback}
            item={item}
            onNext={onNext}
            reverse={true}
          />
        )}
      </>
    );
  }

  const reverse = exerciseKind === "reverse-choice";
  const listening = exerciseKind === "listening-choice";
  const characterChoices = reverse || listening;

  return (
    <>
      <span className="eyebrow">{formatExerciseKind(exerciseKind)}</span>
      {listening ? (
        <div className="kana-listening-prompt">
          <button
            aria-label="Воспроизвести произношение"
            className="kana-audio-button"
            onClick={() => void onSpeak()}
            ref={choiceRef}
            title="Воспроизвести произношение"
            type="button"
          >
            <Volume2 aria-hidden="true" size={20} />
            <span>Воспроизвести</span>
          </button>
        </div>
      ) : reverse ? (
        <div className="kana-romaji-prompt">{item.romaji}</div>
      ) : (
        <div className="kana-prompt" lang="ja">
          {item.character}
        </div>
      )}

      {exerciseKind === "typing" ? (
        <form onSubmit={onSubmit}>
          <label htmlFor="kana-answer">Ромадзи</label>
          <div className="kana-answer-row">
            <input
              autoComplete="off"
              disabled={feedback !== null || submitting}
              id="kana-answer"
              inputMode="text"
              maxLength={24}
              onChange={(event) => onAnswerChange(event.currentTarget.value)}
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
      ) : (
        <div className={`kana-choice-grid ${characterChoices ? "is-kana" : ""}`}>
          {choices.map((choice, index) => (
            <button
              aria-pressed={answer === choice.romaji}
              className={answer === choice.romaji ? "is-selected" : ""}
              disabled={feedback !== null || submitting}
              key={choice.character}
              lang={characterChoices ? "ja" : undefined}
              onClick={() =>
                onChoice(choice.romaji, characterChoices ? choice.character : undefined)
              }
              ref={index === 0 && !listening ? choiceRef : undefined}
              type="button"
            >
              {characterChoices ? choice.character : choice.romaji}
            </button>
          ))}
        </div>
      )}

      {feedback === null ? (
        <div className="kana-streak">
          Прогресс: {item.currentStreak}/{masteryThreshold}
        </div>
      ) : (
        <KanaFeedback
          continueRef={continueRef}
          feedback={feedback}
          item={item}
          onNext={onNext}
          reverse={characterChoices}
        />
      )}
    </>
  );
}

function KanaMatchingExercise({
  choiceRef,
  items,
  onAnswer,
  onNext,
  submitting,
}: {
  readonly choiceRef: RefObject<HTMLButtonElement | null>;
  readonly items: readonly KanaLessonItemDto[];
  readonly onAnswer: (
    character: string,
    answer: string,
  ) => Promise<KanaAssessmentAnswerResponse | null>;
  readonly onNext: () => void;
  readonly submitting: boolean;
}) {
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [matchedCharacters, setMatchedCharacters] = useState<readonly string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const completeRef = useRef<HTMLButtonElement>(null);
  const readings = items.length < 2 ? [...items] : [...items.slice(1), items[0]!];
  const complete = items.length > 0 && matchedCharacters.length === items.length;
  const firstUnmatchedIndex = items.findIndex(
    (item) => !matchedCharacters.includes(item.character),
  );

  useEffect(() => {
    if (complete) {
      completeRef.current?.focus();
    } else if (matchedCharacters.length > 0) {
      choiceRef.current?.focus();
    }
  }, [choiceRef, complete, matchedCharacters]);

  async function handleReading(romaji: string): Promise<void> {
    if (selectedCharacter === null || submitting || complete) {
      return;
    }

    const result = await onAnswer(selectedCharacter, romaji);

    if (result === null) {
      return;
    }

    if (!result.correct) {
      setMessage("Пара не совпадает");
      return;
    }

    const nextMatched = [...matchedCharacters, selectedCharacter];
    setMatchedCharacters(nextMatched);
    setSelectedCharacter(null);
    setMessage(nextMatched.length === items.length ? "Все пары собраны" : "Пара верна");
  }

  return (
    <div className="kana-matching">
      <span className="eyebrow">Сопоставление</span>
      <div className="kana-match-board">
        <div aria-label="Знаки" className="kana-match-column">
          {items.map((choice, index) => {
            const matched = matchedCharacters.includes(choice.character);

            return (
              <button
                aria-pressed={selectedCharacter === choice.character}
                className={matched ? "is-matched" : ""}
                disabled={matched || submitting || complete}
                key={choice.character}
                lang="ja"
                onClick={() => {
                  setSelectedCharacter(choice.character);
                  setMessage(null);
                }}
                ref={index === firstUnmatchedIndex ? choiceRef : undefined}
                type="button"
              >
                {choice.character}
              </button>
            );
          })}
        </div>
        <div aria-label="Чтения" className="kana-match-column">
          {readings.map((choice) => {
            const matched = matchedCharacters.includes(choice.character);

            return (
              <button
                className={matched ? "is-matched" : ""}
                disabled={selectedCharacter === null || matched || submitting || complete}
                key={choice.romaji}
                onClick={() => void handleReading(choice.romaji)}
                type="button"
              >
                {choice.romaji}
              </button>
            );
          })}
        </div>
      </div>
      <div aria-live="polite" className="kana-match-status">
        {message ?? "Выберите знак"}
      </div>
      {complete ? (
        <button className="secondary-action" onClick={onNext} ref={completeRef} type="button">
          Следующий
        </button>
      ) : null}
    </div>
  );
}

function KanaFeedback({
  continueRef,
  feedback,
  item,
  onNext,
  reverse,
}: {
  readonly continueRef: RefObject<HTMLButtonElement | null>;
  readonly feedback: KanaAssessmentAnswerResponse;
  readonly item: KanaLessonItemDto;
  readonly onNext: () => void;
  readonly reverse: boolean;
}) {
  return (
    <div className={`kana-feedback ${feedback.correct ? "is-correct" : "is-wrong"}`} role="status">
      <div>
        <strong>{feedback.correct ? "Верно" : "Неверно"}</strong>
        <span>
          {reverse ? `${item.character} · ${feedback.expectedRomaji}` : feedback.expectedRomaji}
        </span>
      </div>
      <button className="secondary-action" onClick={onNext} ref={continueRef} type="button">
        Следующий
      </button>
    </div>
  );
}

function KanaTeachingStep({
  item,
  onContinue,
  onSpeak,
  speechAvailable,
}: {
  readonly item: KanaLessonItemDto;
  readonly onContinue: () => void;
  readonly onSpeak: () => boolean;
  readonly speechAvailable: boolean;
}) {
  return (
    <div className="kana-teaching-step">
      <span className="eyebrow">{formatVariant(item)}</span>
      <div className="kana-prompt" lang="ja">
        {item.character}
      </div>
      <div className="kana-teaching-reading">
        <strong className="kana-reading">{item.romaji}</strong>
        <button className="icon-button" type="button" onClick={() => void onSpeak()} disabled={!speechAvailable} aria-label="Прослушать чтение" title={speechAvailable ? "Прослушать чтение" : "Озвучивание недоступно в этом браузере"}>
          <Volume2 size={20} aria-hidden="true" />
        </button>
      </div>
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
  return selectKanaResumeUnit(units);
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

function formatExerciseKind(kind: Exclude<KanaExerciseKind, "matching">): string {
  switch (kind) {
    case "recognition-choice":
      return "Выберите чтение";
    case "reverse-choice":
      return "Выберите знак";
    case "listening-choice":
      return "Аудирование";
    default:
      return "Введите чтение";
  }
}

function formatVariant(item: KanaLessonItemDto): string {
  switch (item.variant) {
    case "dakuten":
      return "Дакутэн";
    case "handakuten":
      return "Хандакутэн";
    case "yoon":
      return "Ёон";
    case "sokuon":
      return "Малая っ";
    case "long-vowel":
      return "Долгая гласная";
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
