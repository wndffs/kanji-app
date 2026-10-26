"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  CircleHelp,
  LayoutDashboard,
  Moon,
  RotateCw,
  Sun,
  Target,
  X,
} from "lucide-react";
import { ViewTabs } from "../../components/ViewTabs";
import {
  REFERENCE_FORECAST,
  REFERENCE_MATERIALS,
  referenceMeaning,
  type ReferenceMode,
  type ReferenceView,
} from "./reference-data";
import {
  REFERENCE_QUESTIONS,
  referenceExpected,
  referenceFeedback,
  type ReferenceFeedback,
} from "./reference-model";

const SCREENS = [
  { id: "dashboard", label: "Панель" },
  { id: "lesson", label: "Урок" },
  { id: "review", label: "Повторение" },
] as const;

export function ReferenceClient() {
  const [view, setView] = useState<ReferenceView>("dashboard");
  const [theme, setTheme] = useState("light");
  const [mode, setMode] = useState<ReferenceMode>("ru");
  function open(id: string) {
    setView(id as ReferenceView);
  }
  return (
    <div className="ref-root" data-theme={theme} data-reference-view={view}>
      <div className="ref-labbar">
        <div className="ref-lab-identity">
          <strong>Эталон 01</strong>
          <span>Демонстрационные данные</span>
        </div>
        <ViewTabs
          tabs={SCREENS}
          active={view}
          onChange={open}
          label="Эталонные экраны"
          idPrefix="reference"
          panelId="reference-screen"
        />
        <div className="ref-lab-tools">
          <select
            aria-label="Перевод эталона"
            value={mode}
            onChange={(event) => setMode(event.currentTarget.value as ReferenceMode)}
          >
            <option value="ru">RU</option>
            <option value="en">EN</option>
            <option value="ru-en">RU + EN</option>
          </select>
          <button
            className="ref-icon"
            type="button"
            aria-label={theme === "light" ? "Тёмный эталон" : "Светлый эталон"}
            title={theme === "light" ? "Тёмная тема" : "Светлая тема"}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </div>
      <div className={`ref-app ${view === "dashboard" ? "" : "ref-app-focus"}`}>
        {view === "dashboard" ? <ReferenceRail view={view} onOpen={open} /> : null}
        <div className="ref-workspace">
          <header className="ref-app-header">
            {view === "dashboard" ? (
              <span className="ref-breadcrumb">
                Учёба <ChevronRight size={14} /> Сегодня
              </span>
            ) : (
              <button type="button" className="ref-text-button" onClick={() => open("dashboard")}>
                <ArrowLeft size={16} /> На панель
              </button>
            )}
            <span className="ref-header-profile">
              <span>У</span>Учебный профиль
            </span>
          </header>
          <main
            id="reference-screen"
            role="tabpanel"
            aria-labelledby={`reference-${view}`}
            className="ref-main"
          >
            {view === "dashboard" ? (
              <ReferenceDashboard mode={mode} onOpen={open} />
            ) : view === "lesson" ? (
              <ReferenceLesson mode={mode} onClose={() => open("dashboard")} />
            ) : (
              <ReferenceReview key={mode} mode={mode} onClose={() => open("dashboard")} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function ReferenceRail({ view, onOpen }: { view: ReferenceView; onOpen: (id: string) => void }) {
  const destinations = [
    { id: "dashboard", label: "Сегодня", icon: LayoutDashboard },
    { id: "lesson", label: "Новые материалы", icon: BookOpen },
    { id: "review", label: "Повторения", icon: RotateCw },
  ];
  return (
    <aside className="ref-rail">
      <a className="ref-brand" href="/dashboard">
        <Image src="/icons/app-192.png" width={30} height={30} alt="" />
        Кандзи SRS
      </a>
      <nav aria-label="Навигация эталона">
        {destinations.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => onOpen(id)}
            aria-current={view === id ? "page" : undefined}
          >
            <Icon size={19} />
            <span>{label}</span>
            {id === "review" ? <small>24</small> : null}
          </button>
        ))}
      </nav>
      <div className="ref-rail-level">
        <span>Основы японского</span>
        <strong>
          Уровень 7 <span>из 60</span>
        </strong>
        <div className="ref-thin-track">
          <span style={{ width: "70%" }} />
        </div>
        <small>14 из 20 к цели уровня</small>
      </div>
      <a className="ref-rail-exit" href="/dashboard">
        <ArrowLeft size={16} />В приложение
      </a>
    </aside>
  );
}

function ReferenceDashboard({
  mode,
  onOpen,
}: {
  mode: ReferenceMode;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="ref-daily">
      <header className="ref-page-heading">
        <div>
          <p className="ref-kicker">Понедельник, 26 октября</p>
          <h1>Сегодня</h1>
        </div>
        <span className="ref-day-total">
          <CheckCheck size={17} />
          <span>Изучено сегодня</span> <strong>8</strong>
        </span>
      </header>
      <div className="ref-study-actions">
        <button
          type="button"
          className="ref-study-action ref-action-reviews"
          onClick={() => onOpen("review")}
        >
          <span className="ref-action-heading">
            <RotateCw size={20} />
            Повторения
          </span>
          <span className="ref-action-count">
            24 <small>карточки</small>
          </span>
          <span className="ref-action-bottom">
            Начать повторение
            <ArrowRight size={20} />
          </span>
        </button>
        <button
          type="button"
          className="ref-study-action ref-action-lessons"
          onClick={() => onOpen("lesson")}
        >
          <span className="ref-action-heading">
            <BookOpen size={20} />
            Новые материалы
          </span>
          <span className="ref-action-count">
            5 <small>в следующем уроке</small>
          </span>
          <span className="ref-action-bottom">
            Начать урок
            <ArrowRight size={20} />
          </span>
        </button>
      </div>
      <div className="ref-daily-columns">
        <section className="ref-level-section">
          <div className="ref-section-title">
            <h2>Текущий уровень</h2>
            <span className="ref-level-number">07</span>
          </div>
          <div className="ref-level-heading">
            <h3>Природа и время</h3>
            <span>
              14 <span>/ 20</span>
            </span>
          </div>
          <div
            className="ref-level-track"
            role="progressbar"
            aria-label="Прогресс уровня"
            aria-valuenow={70}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: "70%" }} />
          </div>
          <p className="ref-level-caption">Ещё 6 кандзи до цели уровня</p>
          <div className="ref-subject-totals">
            <span>
              <i data-subject="component" />
              Компоненты <strong>8/8</strong>
            </span>
            <span>
              <i data-subject="kanji" />
              Кандзи <strong>14/20</strong>
            </span>
            <span>
              <i data-subject="word" />
              Слова <strong>21/35</strong>
            </span>
          </div>
          <ul className="ref-level-glyphs" aria-label="Материалы уровня">
            {REFERENCE_MATERIALS.slice(0, 8).map((item, index) => (
              <li key={item.glyph}>
                <span lang="ja">{item.glyph}</span>
                <small>{referenceMeaning(item, mode)}</small>
                <span className="ref-glyph-state">
                  {index < 6 ? (
                    <Check size={13} aria-label="Цель достигнута" />
                  ) : (
                    <Clock3 size={13} aria-label="В изучении" />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="ref-schedule">
          <div className="ref-section-title">
            <h2>Ближайшие повторения</h2>
            <Clock3 size={17} />
          </div>
          <p className="ref-schedule-subtitle">После текущей очереди</p>
          <div className="ref-forecast-chart" aria-label="Прогноз повторений">
            {REFERENCE_FORECAST.map((bucket) => (
              <div key={bucket.label}>
                <strong>{bucket.count}</strong>
                <div className="ref-bar-slot">
                  <span style={{ height: `${(bucket.count / 18) * 100}%` }} />
                </div>
                <span>{bucket.label}</span>
              </div>
            ))}
          </div>
          <div className="ref-next-review">
            <span>Сегодня, 18:00</span>
            <strong>8 карточек</strong>
          </div>
          <details className="ref-statistics">
            <summary>Статистика</summary>
            <dl>
              <div>
                <dt>Закреплено</dt>
                <dd>42</dd>
              </div>
              <div>
                <dt>Точность</dt>
                <dd>92%</dd>
              </div>
            </dl>
          </details>
        </section>
      </div>
    </section>
  );
}

function ReferenceLesson({ mode, onClose }: { mode: ReferenceMode; onClose: () => void }) {
  const [phase, setPhase] = useState("meaning");
  const item = REFERENCE_MATERIALS[0];
  return (
    <section className="ref-study ref-lesson">
      <header className="ref-study-header">
        <div>
          <p className="ref-kicker">Новый материал</p>
          <h1>Урок</h1>
        </div>
        <span className="ref-position">
          1 <span>/ 5</span>
        </span>
        <button
          className="ref-icon"
          type="button"
          onClick={onClose}
          aria-label="Выйти из эталона урока"
          title="Выйти из урока"
        >
          <X size={19} />
        </button>
      </header>
      <div className="ref-session-progress" aria-label="Изучен 0 из 5 материалов">
        <span style={{ width: "0%" }} />
      </div>
      <ViewTabs
        tabs={[
          { id: "meaning", label: "Значение" },
          { id: "reading", label: "Чтение" },
        ]}
        active={phase}
        onChange={setPhase}
        label="Этапы эталона урока"
        idPrefix="reference-lesson"
        panelId="reference-lesson-content"
      />
      <div
        className="ref-lesson-body"
        id="reference-lesson-content"
        role="tabpanel"
        aria-labelledby={`reference-lesson-${phase}`}
      >
        <div className="ref-material-identity">
          <span className="ref-subject-label">
            Кандзи <span>Уровень 7</span>
          </span>
          <span className="ref-lesson-glyph" lang="ja">
            日
          </span>
          <h2>{referenceMeaning(item, mode)}</h2>
          {phase === "reading" ? (
            <p className="ref-primary-reading" lang="ja">
              にち
            </p>
          ) : null}
        </div>
        <div className="ref-lesson-content">
          <span className="ref-content-number">{phase === "meaning" ? "01" : "02"}</span>
          <h2>{phase === "meaning" ? "Значение" : "Основное чтение"}</h2>
          <p className="ref-definition">
            {phase === "meaning" ? referenceMeaning(item, mode) : <span lang="ja">にち</span>}
          </p>
          <div className="ref-memory-note">
            <span>
              <CircleHelp size={16} />
              Запомнить
            </span>
            <p>
              {referenceMeaning(
                phase === "meaning"
                  ? {
                      ru: "Прямоугольник 日 с перемычкой можно представить как окно: за ним светлый день.",
                      en: "Picture 日 as a window with a bar across it. A bright day is visible outside.",
                    }
                  : {
                      ru: "Прочитайте に и ち слитно: にち. Это чтение встречается в слове 毎日, «каждый день».",
                      en: "Read に and ち together: にち. This reading occurs in 毎日, every day.",
                    },
                mode,
              )}
            </p>
          </div>
          {phase === "meaning" ? (
            <div className="ref-lesson-detail">
              <h3>Другие значения</h3>
              <span>{mode === "en" ? "sun" : mode === "ru" ? "солнце" : "солнце / sun"}</span>
            </div>
          ) : (
            <div className="ref-lesson-word">
              <span lang="ja">毎日</span>
              <span lang="ja">まいにち</span>
              <span>
                {mode === "en"
                  ? "every day"
                  : mode === "ru"
                    ? "каждый день"
                    : "каждый день / every day"}
              </span>
            </div>
          )}
        </div>
      </div>
      <footer className="ref-study-footer">
        <span>
          Кандзи <strong lang="ja">日</strong>
        </span>
        <div>
          {phase === "reading" ? (
            <button type="button" className="ref-text-button" onClick={() => setPhase("meaning")}>
              <ArrowLeft size={16} />
              Назад
            </button>
          ) : null}
          <button
            type="button"
            className="ref-button"
            onClick={() => (phase === "meaning" ? setPhase("reading") : onClose())}
          >
            {phase === "meaning" ? "Далее: чтение" : "Завершить предпросмотр"}
            <ArrowRight size={17} />
          </button>
        </div>
      </footer>
    </section>
  );
}

function ReferenceReview({ mode, onClose }: { mode: ReferenceMode; onClose: () => void }) {
  const [answer, setAnswer] = useState("");
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [feedback, setFeedback] = useState<ReferenceFeedback | null>(null);
  const answerInput = useRef<HTMLInputElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const composing = useRef(false);
  const advancing = useRef(false);
  const question = REFERENCE_QUESTIONS[index];
  useEffect(() => {
    advancing.current = false;
    if (feedback === null) answerInput.current?.focus();
    else continueButton.current?.focus();
  }, [index, feedback]);

  function advance() {
    if (feedback === null || advancing.current) return;
    advancing.current = true;
    if (feedback.kind === "correct") setCorrect((value) => value + 1);
    if (feedback.kind === "revealed") setRevealed((value) => value + 1);
    setIndex((value) => value + 1);
    setAnswer("");
    setFeedback(null);
  }

  if (question === undefined)
    return (
      <section className="ref-study ref-preview-complete">
        <CheckCheck size={36} aria-hidden="true" />
        <h1>Предпросмотр завершён</h1>
        <dl>
          <div>
            <dt>Вопросов</dt>
            <dd>{index}</dd>
          </div>
          <div>
            <dt>Принято</dt>
            <dd>{correct}</dd>
          </div>
          <div>
            <dt>Ответ открыт</dt>
            <dd>{revealed}</dd>
          </div>
        </dl>
        <button className="ref-button" type="button" onClick={onClose}>
          На панель
          <ArrowRight size={17} />
        </button>
      </section>
    );
  const isReading = question.answerKind === "reading";
  const answeredCount = index + (feedback === null ? 0 : 1);
  return (
    <section className="ref-study ref-review">
      <header className="ref-study-header">
        <div>
          <p className="ref-kicker">Очередь на сегодня</p>
          <h1>Повторение</h1>
        </div>
        <span className="ref-position">
          {index + 1} <span>/ {REFERENCE_QUESTIONS.length}</span>
        </span>
        <button
          className="ref-icon"
          type="button"
          onClick={onClose}
          aria-label="Выйти из эталона повторения"
          title="Выйти из повторения"
        >
          <X size={19} />
        </button>
      </header>
      <div
        className="ref-session-progress"
        aria-label={`Отвечено ${answeredCount} из ${REFERENCE_QUESTIONS.length} вопросов`}
      >
        <span style={{ width: `${(answeredCount / REFERENCE_QUESTIONS.length) * 100}%` }} />
      </div>
      <article className="ref-review-question">
        <div className="ref-review-question-meta">
          <span className="ref-subject-label">Кандзи</span>
          <span className="ref-question-kind">{isReading ? "Чтение" : "Значение"}</span>
        </div>
        <h2 lang="ja" className="ref-review-glyph">
          {question.item.glyph}
        </h2>
        <p>{isReading ? "Чтение кандзи" : "Значение кандзи"}</p>
      </article>
      <form
        className="ref-answer-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!composing.current && feedback === null && answer.trim() !== "")
            setFeedback(referenceFeedback(answer, question, mode));
        }}
      >
        <label htmlFor="reference-answer">
          {isReading
            ? "Чтение каной"
            : mode === "en"
              ? "Meaning"
              : mode === "ru-en"
                ? "Значение / meaning"
                : "Значение"}
        </label>
        <div className="ref-answer-row">
          <input
            id="reference-answer"
            ref={answerInput}
            readOnly={feedback !== null}
            autoComplete="off"
            spellCheck={!isReading}
            placeholder={isReading ? "かな" : mode === "en" ? "Your answer" : "Ваш ответ"}
            value={answer}
            onChange={(event) => setAnswer(event.currentTarget.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (composing.current ||
                  event.nativeEvent.isComposing ||
                  event.nativeEvent.keyCode === 229)
              )
                event.preventDefault();
            }}
          />
          {feedback === null ? (
            <button className="ref-button" type="submit" disabled={answer.trim() === ""}>
              Проверить
              <ArrowRight size={18} />
            </button>
          ) : (
            <button className="ref-button" type="button" ref={continueButton} onClick={advance}>
              Продолжить
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </form>
      {feedback === null ? null : (
        <div className="ref-answer-result" data-result={feedback.kind} role="status">
          {feedback.kind === "correct" ? (
            <Check size={19} aria-hidden="true" />
          ) : feedback.kind === "wrong" ? (
            <X size={19} aria-hidden="true" />
          ) : (
            <CircleHelp size={19} aria-hidden="true" />
          )}
          <div>
            <strong>
              {feedback.kind === "correct"
                ? "Верно"
                : feedback.kind === "wrong"
                  ? "Пока неверно"
                  : "Ответ открыт"}
            </strong>
            <span lang={isReading ? "ja" : undefined}>{feedback.expected}</span>
          </div>
        </div>
      )}
      <div className="ref-review-bottom">
        <span>
          <Target size={16} />
          Принято <strong>{correct + (feedback?.kind === "correct" ? 1 : 0)}</strong>
        </span>
        <button
          type="button"
          className="ref-text-button"
          disabled={feedback !== null}
          onClick={() =>
            setFeedback({ kind: "revealed", expected: referenceExpected(question, mode) })
          }
        >
          <CircleHelp size={16} />
          Показать ответ
        </button>
      </div>
    </section>
  );
}
