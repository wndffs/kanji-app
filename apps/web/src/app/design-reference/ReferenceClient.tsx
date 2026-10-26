"use client";

import Image from "next/image";
import { useState } from "react";
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
              <ReferenceReview mode={mode} onClose={() => open("dashboard")} />
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
          Изучено сегодня <strong>8</strong>
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
              {phase === "meaning"
                ? "Прямоугольник 日 с перемычкой можно представить как окно: за ним светлый день."
                : "Прочитайте に и ち слитно: にち. Это чтение встречается в слове 毎日, «каждый день»."}
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
  return (
    <section className="ref-study ref-review">
      <header className="ref-study-header">
        <div>
          <p className="ref-kicker">Очередь на сегодня</p>
          <h1>Повторение</h1>
        </div>
        <span className="ref-position">
          1 <span>/ 24</span>
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
      <div className="ref-session-progress" aria-label="Отвечено 0 из 24 вопросов">
        <span style={{ width: "0%" }} />
      </div>
      <article className="ref-review-question">
        <div className="ref-review-question-meta">
          <span className="ref-subject-label">Кандзи</span>
          <span className="ref-question-kind">Значение</span>
        </div>
        <h2 lang="ja" className="ref-review-glyph">
          水
        </h2>
        <p>Значение кандзи</p>
      </article>
      <form className="ref-answer-form" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="reference-answer">
          {mode === "en" ? "Meaning" : mode === "ru-en" ? "Значение / meaning" : "Значение"}
        </label>
        <div className="ref-answer-row">
          <input
            id="reference-answer"
            autoComplete="off"
            placeholder={mode === "en" ? "Your answer" : "Ваш ответ"}
            value={answer}
            onChange={(event) => setAnswer(event.currentTarget.value)}
          />
          <button className="ref-button" type="submit">
            Проверить
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
      <div className="ref-review-bottom">
        <span>
          <Target size={16} />
          Принято <strong>0</strong>
        </span>
        <button type="button" className="ref-text-button">
          <CircleHelp size={16} />
          Показать ответ
        </button>
      </div>
    </section>
  );
}
