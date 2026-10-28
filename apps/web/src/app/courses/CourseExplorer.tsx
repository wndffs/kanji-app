"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type CourseOutlineDto } from "@kanji-srs/shared";
import { ApiError, getCourseOutline } from "../../lib/api-client";
import { clearStoredSession } from "../../lib/auth-storage";
import { ownsSession, useStoredSession } from "../../lib/use-stored-session";
import { CourseLevelMaterials } from "./CourseLevelMaterials";
import {
  adjacentCourseLevels,
  courseBrowserHref,
  parseCourseBrowserRoute,
  type CourseBrowserRoute,
} from "../../lib/course-browser-route";
import { SectionDisclosure } from "../../components/SectionDisclosure";
import { CourseNextStep } from "./CourseNextStep";
import { CourseCoverage } from "./CourseCoverage";

export function CourseExplorer({ courseId }: { readonly courseId: string }) {
  const session = useStoredSession();
  if (session === undefined) return <p aria-busy="true">Загружаю курс.</p>;
  if (session === null)
    return (
      <section className="notice-panel">
        <p>Для просмотра курса нужен вход.</p>
        <Link href="/login">Войти</Link>
      </section>
    );
  return (
    <OwnedCourseExplorer
      key={`${session.user.id}:${session.token}:${courseId}`}
      courseId={courseId}
      token={session.token}
      userId={session.user.id}
    />
  );
}

function OwnedCourseExplorer({
  courseId,
  token,
  userId,
}: {
  readonly courseId: string;
  readonly token: string;
  readonly userId: string;
}) {
  const [outline, setOutline] = useState<CourseOutlineDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [route, setRoute] = useState<CourseBrowserRoute | null>(null);
  useEffect(() => {
    const sync = () =>
      setRoute(parseCourseBrowserRoute(new URLSearchParams(window.location.search)));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const navigate = (next: CourseBrowserRoute) => {
    window.history.pushState(null, "", courseBrowserHref(courseId, next));
    setRoute(next);
  };
  const currentLevel = route?.level ?? outline?.levels[0]?.levelNumber ?? 0;
  const adjacent = adjacentCourseLevels(
    outline?.levels.map((level) => level.levelNumber) ?? [],
    currentLevel,
  );
  useEffect(() => {
    const request = new AbortController();
    setError(null);
    void getCourseOutline(token, courseId, request.signal, retry > 0)
      .then((response) => {
        if (!request.signal.aborted && ownsSession(token)) setOutline(response);
      })
      .catch((reason: unknown) => {
        if (request.signal.aborted || !ownsSession(token)) return;
        if (reason instanceof ApiError && reason.status === 401) clearStoredSession();
        else
          setError(
            reason instanceof ApiError && reason.status === 404
              ? "Опубликованный курс не найден."
              : reason instanceof Error
                ? reason.message
                : "Не удалось загрузить курс.",
          );
      });
    return () => {
      request.abort();
    };
  }, [courseId, token, retry]);

  return (
    <section className="page-stack course-explorer">
      <div className="page-heading">
        <div>
          <h1>Материалы курса</h1>
          {outline ? <p className="course-identity">{outline.title}</p> : null}
        </div>
        <Link href="/courses">Все курсы</Link>
      </div>
      {error === null ? null : (
        <div className="notice-panel">
          <p role="alert">{error}</p>
          <button className="secondary-action" onClick={() => setRetry((value) => value + 1)}>
            Повторить загрузку
          </button>
        </div>
      )}
      {outline === null ? (
        error === null ? (
          <p aria-busy="true">Загружаю программу курса.</p>
        ) : null
      ) : (
        <>
          {outline.levels.length === 0 ? (
            <p>В курсе пока нет уровней.</p>
          ) : (
            <>
              {route === null ? null : (
                <>
                  <div className="course-level-toolbar">
                    <label className="course-level-select">
                      Уровень курса
                      <select
                        aria-label="Уровень курса"
                        value={route.level ?? outline.levels[0]!.levelNumber}
                        onChange={(event) =>
                          navigate({ ...route, level: Number(event.target.value), page: 1 })
                        }
                      >
                        {outline.levels.map((level) => (
                          <option value={level.levelNumber} key={level.levelNumber}>
                            {level.levelNumber}. {level.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <nav className="course-page-navigation" aria-label="Переход между уровнями">
                      <button
                        className="icon-button"
                        aria-label="Предыдущий уровень"
                        title="Предыдущий уровень"
                        disabled={adjacent.previous === null}
                        onClick={() => navigate({ ...route, level: adjacent.previous, page: 1 })}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span>Уровень {currentLevel}</span>
                      <button
                        className="icon-button"
                        aria-label="Следующий уровень"
                        title="Следующий уровень"
                        disabled={adjacent.next === null}
                        onClick={() => navigate({ ...route, level: adjacent.next, page: 1 })}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </nav>
                  </div>
                  {outline.levels.some(
                    (level) =>
                      level.levelNumber === (route.level ?? outline.levels[0]!.levelNumber),
                  ) ? (
                    <CourseLevelMaterials
                      userId={userId}
                      token={token}
                      courseId={courseId}
                      levelNumber={route.level ?? outline.levels[0]!.levelNumber}
                      route={route}
                      onNavigate={navigate}
                    />
                  ) : (
                    <div className="notice-panel">
                      <p role="alert">Такого уровня в курсе нет.</p>
                      <button
                        className="secondary-action"
                        onClick={() =>
                          navigate({ ...route, level: outline.levels[0]!.levelNumber, page: 1 })
                        }
                      >
                        К первому уровню
                      </button>
                    </div>
                  )}
                </>
              )}
              <CourseNextStep token={token} courseId={courseId} returnHref={courseBrowserHref(courseId, route ?? parseCourseBrowserRoute(new URLSearchParams()))} />
              <CourseCoverage token={token} courseId={courseId} />
              <SectionDisclosure title="Все уровни">
                <ol className="course-outline" aria-label="Уровни курса">
                  {outline.levels.map((level) => (
                    <li key={level.levelNumber}>
                      <Link
                        prefetch={false}
                        href={courseBrowserHref(courseId, {
                          ...(route ?? parseCourseBrowserRoute(new URLSearchParams())),
                          level: level.levelNumber,
                          page: 1,
                        })}
                        aria-current={level.levelNumber === currentLevel ? "location" : undefined}
                        onClick={(event) => {
                          if (
                            event.button !== 0 ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          )
                            return;
                          event.preventDefault();
                          navigate({
                            ...(route ?? parseCourseBrowserRoute(new URLSearchParams())),
                            level: level.levelNumber,
                            page: 1,
                          });
                        }}
                      >
                        <strong>
                          Уровень {level.levelNumber}: {level.title}
                        </strong>
                        <span>{level.publishedItemCount} материалов</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </SectionDisclosure>
              {outline.description ? (
                <SectionDisclosure title="О курсе">
                  <p className="muted">{outline.description}</p>
                </SectionDisclosure>
              ) : null}
            </>
          )}
        </>
      )}
    </section>
  );
}
