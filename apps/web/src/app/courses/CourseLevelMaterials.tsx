"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { useEffect, useState } from "react";
import { type CourseMaterialPageDto } from "@kanji-srs/shared";
import { ApiError, getCourseMaterials } from "../../lib/api-client";
import { clearStoredSession } from "../../lib/auth-storage";
import { ownsSession } from "../../lib/use-stored-session";
import { JapaneseText } from "../../components/JapaneseText";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";
import { useLessonPronunciationPreferences } from "../../lib/use-lesson-pronunciation-preferences";
import { romanizeKana } from "@kanji-srs/japanese";
import { courseItemHref, type CourseBrowserRoute } from "../../lib/course-browser-route";
import { CourseLevelProgress } from "./CourseLevelProgress";
import { CourseCardProgress } from "./CourseCardProgress";
import { CourseMaterialSearch } from "./CourseMaterialSearch";
import {
  readCourseMaterialView,
  storeCourseMaterialView,
  type CourseMaterialView,
} from "../../lib/course-material-preferences";

export function CourseLevelMaterials({
  token,
  userId,
  courseId,
  levelNumber,
  route,
  onNavigate,
}: {
  readonly token: string;
  readonly userId: string;
  readonly courseId: string;
  readonly levelNumber: number;
  readonly route: CourseBrowserRoute;
  readonly onNavigate: (route: CourseBrowserRoute) => void;
}) {
  const displayMode = useTranslationDisplayMode();
  const pronunciation = useLessonPronunciationPreferences();
  const { page, itemType, studyState, reviewState, q, sort } = route;
  const hasFilters =
    itemType !== "all" || studyState !== "all" || reviewState !== "all" || q !== "";
  const resetFilters = () =>
    onNavigate({
      ...route,
      page: 1,
      itemType: "all",
      studyState: "all",
      reviewState: "all",
      q: "",
    });
  const requestKey = JSON.stringify([
    levelNumber,
    page,
    itemType,
    studyState,
    reviewState,
    q,
    sort,
  ]);
  const [loaded, setLoaded] = useState<{
    readonly key: string;
    readonly data: CourseMaterialPageDto;
  } | null>(null);
  const data = loaded?.key === requestKey ? loaded.data : null;
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(true);
  const [view, setView] = useState<CourseMaterialView>("grid");
  useEffect(() => {
    setView(readCourseMaterialView(userId));
  }, [userId]);
  const changeView = (next: CourseMaterialView) => {
    if (!ownsSession(token)) return;
    setView(next);
    storeCourseMaterialView(userId, next);
  };
  useEffect(() => {
    const request = new AbortController();
    setPending(true);
    setError(null);
    void getCourseMaterials(
      token,
      courseId,
      levelNumber,
      page,
      itemType === "all" ? undefined : itemType,
      studyState === "all" ? undefined : studyState,
      {
        reviewState: reviewState === "all" ? undefined : reviewState,
        q,
        sort,
        signal: request.signal,
      },
    )
      .then((response) => {
        if (!request.signal.aborted && ownsSession(token))
          setLoaded({ key: requestKey, data: response });
      })
      .catch((reason: unknown) => {
        if (request.signal.aborted || !ownsSession(token)) return;
        if (reason instanceof ApiError && reason.status === 401) clearStoredSession();
        else
          setError(
            reason instanceof Error ? reason.message : "Не удалось загрузить материалы уровня.",
          );
      })
      .finally(() => {
        if (!request.signal.aborted && ownsSession(token)) setPending(false);
      });
    return () => {
      request.abort();
    };
  }, [
    token,
    courseId,
    levelNumber,
    page,
    retry,
    itemType,
    studyState,
    reviewState,
    q,
    sort,
    requestKey,
  ]);
  return (
    <section className="course-level-materials" aria-label="Материалы уровня" aria-busy={pending}>
      <h2>Материалы уровня {levelNumber}</h2>
      {data?.summary ? (
        <CourseLevelProgress summary={data.summary} route={route} onNavigate={onNavigate} />
      ) : null}
      <details className="course-material-options" open={hasFilters || sort !== "course"}>
        <summary>Поиск и фильтры</summary>
        <div className="course-material-controls">
          <CourseMaterialSearch
            key={q}
            value={q}
            onSearch={(value) => onNavigate({ ...route, q: value, page: 1 })}
          />
          <div className="course-material-filters">
            <label className="course-level-select">
              Тип материала
              <select
                aria-label="Тип материала"
                value={itemType}
                onChange={(event) =>
                  onNavigate({
                    ...route,
                    itemType: event.target.value as CourseBrowserRoute["itemType"],
                    page: 1,
                  })
                }
              >
                <option value="all">Все материалы</option>
                <option value="component">Компоненты</option>
                <option value="kanji">Кандзи</option>
                <option value="word">Слова</option>
                <option value="sentence">Предложения</option>
              </select>
            </label>
            <label className="course-level-select">
              Изучение
              <select
                aria-label="Изучение"
                value={studyState}
                onChange={(event) =>
                  onNavigate({
                    ...route,
                    studyState: event.target.value as CourseBrowserRoute["studyState"],
                    page: 1,
                  })
                }
              >
                <option value="all">Любое состояние</option>
                <option value="not-started">Новые</option>
                <option value="learning">В работе</option>
                <option value="burned">Выучены</option>
              </select>
            </label>
          </div>
          <label className="course-level-select">
            Срок повторения
            <select
              aria-label="Срок повторения"
              value={reviewState}
              onChange={(event) =>
                onNavigate({
                  ...route,
                  reviewState: event.target.value as CourseBrowserRoute["reviewState"],
                  page: 1,
                })
              }
            >
              <option value="all">Любой срок</option>
              <option value="due">Срок наступил</option>
              <option value="scheduled">Запланированы</option>
            </select>
          </label>
          <label className="course-level-select">
            Порядок
            <select
              aria-label="Порядок материалов"
              value={sort}
              onChange={(event) =>
                onNavigate({
                  ...route,
                  sort: event.target.value as CourseBrowserRoute["sort"],
                  page: 1,
                })
              }
            >
              <option value="course">По программе</option>
              <option value="review-time">По сроку повторения</option>
            </select>
          </label>
        </div>
      </details>
      {hasFilters ? (
        <button className="secondary-action course-reset-filters" onClick={resetFilters}>
          Сбросить фильтры
        </button>
      ) : null}
      {pending && data !== null ? (
        <p className="muted" role="status">
          Обновляю материалы.
        </p>
      ) : null}
      {error === null ? null : (
        <div>
          <p role="alert">{error}</p>
          <button
            className="secondary-action"
            disabled={pending}
            onClick={() => setRetry((value) => value + 1)}
          >
            Повторить загрузку материалов
          </button>
        </div>
      )}
      {data === null ? (
        error === null ? (
          <p aria-busy="true">Загружаю материалы.</p>
        ) : null
      ) : (
        <>
          <div className="course-material-result-toolbar">
            <p className="muted">Найдено: {data.total}</p>
            <div className="course-material-view" role="group" aria-label="Вид материалов">
              <button
                className="icon-button"
                aria-label="Сетка материалов"
                title="Сетка"
                aria-pressed={view === "grid"}
                onClick={() => changeView("grid")}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Список материалов"
                title="Список"
                aria-pressed={view === "list"}
                onClick={() => changeView("list")}
              >
                <List size={18} />
              </button>
            </div>
          </div>
          {data.items.length === 0 ? (
            <div className="course-empty-view">
              <p>
                {page > Math.max(1, Math.ceil(data.total / data.pageSize))
                  ? "Такой страницы больше нет."
                  : hasFilters
                    ? "По выбранным условиям ничего не найдено."
                    : "В этом уровне пока нет материалов."}
              </p>
              {page > 1 ? (
                <button
                  className="secondary-action"
                  onClick={() => onNavigate({ ...route, page: 1 })}
                >
                  К первой странице
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="course-material-grid" data-view={view}>
              {data.items.map((item) => (
                <li key={item.id} data-item-type={item.itemType}>
                  <Link href={courseItemHref(item.id, courseId, { ...route, level: levelNumber })}>
                    <JapaneseText
                      className="course-material-japanese"
                      furigana={pronunciation.mode === "furigana" ? item.reading : null}
                    >
                      {item.japanese}
                    </JapaneseText>
                    {item.reading ? (
                      <span className="course-material-reading">
                        {item.readingSource ? (
                          <small>
                            {item.readingSource === "card"
                              ? "Учебное чтение"
                              : "Чтение из метаданных"}
                          </small>
                        ) : null}
                        {pronunciation.mode === "kana" ? (
                          <JapaneseText>{item.reading}</JapaneseText>
                        ) : null}
                        {pronunciation.showRomaji && romanizeKana(item.reading) ? (
                          <small className="course-material-romaji">
                            {romanizeKana(item.reading)}
                          </small>
                        ) : null}
                      </span>
                    ) : item.itemType !== "component" && item.readingSource === "missing" ? (
                      <small>Учебное чтение не выбрано</small>
                    ) : null}
                    <span className="course-material-meanings">
                      {displayMode !== "en" && item.meaningRu ? (
                        <span lang="ru">{item.meaningRu}</span>
                      ) : null}
                      {displayMode !== "ru" && item.meaningEn ? (
                        <span lang="en">{item.meaningEn}</span>
                      ) : null}
                      {displayMode !== "en" && !item.meaningRu ? (
                        <small>Нет значения RU</small>
                      ) : null}
                      {displayMode !== "ru" && !item.meaningEn ? (
                        <small>Нет значения EN</small>
                      ) : null}
                      {(displayMode !== "en" && item.meaningSources?.ru === "target") ||
                      (displayMode !== "ru" && item.meaningSources?.en === "target") ? (
                        <small>Значение из метаданных</small>
                      ) : null}
                    </span>
                    <span className="muted course-material-kind">
                      {item.itemType === "component"
                        ? "Компонент"
                        : item.itemType === "kanji"
                          ? "Кандзи"
                          : item.itemType === "word"
                            ? "Слово"
                            : "Предложение"}
                    </span>
                    <span className="course-material-state" data-study-state={item.studyState}>
                      {item.studyState === "burned"
                        ? "Выучен"
                        : item.studyState === "learning"
                          ? `В работе: ${item.startedCardCount}/${item.cardCount}`
                          : "Новый"}
                    </span>
                    {item.dueCardCount > 0 ? (
                      <span className="course-material-review">
                        Срок наступил: {item.dueCardCount}
                      </span>
                    ) : item.nextReviewAt ? (
                      <time dateTime={item.nextReviewAt} className="muted course-material-review">
                        {new Date(item.nextReviewAt).toLocaleString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    ) : null}
                  </Link>
                  <CourseCardProgress cards={item.progressCards ?? []} japanese={item.japanese} />
                  {item.studyState === "not-started" && item.prerequisites?.firstUnmet ? (
                    <div className="course-prerequisite">
                      <span>Опор осталось: {item.prerequisites.unmet}</span>
                      {item.prerequisites.firstUnmet.itemId === null ? (
                        <span>{item.prerequisites.firstUnmet.title}</span>
                      ) : (
                        <Link
                          href={courseItemHref(item.prerequisites.firstUnmet.itemId, courseId, {
                            ...route,
                            level: levelNumber,
                          })}
                        >
                          Сначала: {item.prerequisites.firstUnmet.title}
                        </Link>
                      )}
                      <small>
                        Требуемая ступень SRS: {item.prerequisites.firstUnmet.requiredStage}
                      </small>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <nav className="course-page-navigation" aria-label="Страницы материалов">
            <button
              className="icon-button"
              aria-label="Предыдущая страница материалов"
              title="Предыдущая страница"
              disabled={page <= 1}
              onClick={() => onNavigate({ ...route, page: page - 1 })}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {page > Math.max(1, Math.ceil(data.total / data.pageSize))
                ? `Страница ${page} вне диапазона`
                : `Страница ${page} из ${Math.max(1, Math.ceil(data.total / data.pageSize))}`}
            </span>
            <button
              className="icon-button"
              aria-label="Следующая страница материалов"
              title="Следующая страница"
              disabled={page * data.pageSize >= data.total}
              onClick={() => onNavigate({ ...route, page: page + 1 })}
            >
              <ChevronRight size={18} />
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
