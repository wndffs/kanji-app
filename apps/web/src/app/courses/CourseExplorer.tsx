"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type CourseOutlineDto } from "@kanji-srs/shared";
import { ApiError, getCourseOutline } from "../../lib/api-client";
import { clearStoredSession } from "../../lib/auth-storage";
import { ownsSession, useStoredSession } from "../../lib/use-stored-session";
import { CourseLevelMaterials } from "./CourseLevelMaterials";
import { adjacentCourseLevels, courseBrowserHref, parseCourseBrowserRoute, type CourseBrowserRoute } from "../../lib/course-browser-route";
import { SectionDisclosure } from "../../components/SectionDisclosure";

export function CourseExplorer({ courseId }: { readonly courseId: string }) {
  const session = useStoredSession();
  if (session === undefined) return <p aria-busy="true">Загружаю курс.</p>;
  if (session === null) return <section className="notice-panel"><p>Для просмотра курса нужен вход.</p><Link href="/login">Войти</Link></section>;
  return <OwnedCourseExplorer key={`${session.user.id}:${session.token}:${courseId}`} courseId={courseId} token={session.token} />;
}

function OwnedCourseExplorer({ courseId, token }: { readonly courseId: string; readonly token: string }) {
  const [outline, setOutline] = useState<CourseOutlineDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [route, setRoute] = useState<CourseBrowserRoute | null>(null);
  useEffect(() => {
    const sync = () => setRoute(parseCourseBrowserRoute(new URLSearchParams(window.location.search)));
    sync(); window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const navigate = (next: CourseBrowserRoute) => {
    window.history.pushState(null, "", courseBrowserHref(courseId, next));
    setRoute(next);
  };
  const currentLevel = route?.level ?? outline?.levels[0]?.levelNumber ?? 0;
  const adjacent = adjacentCourseLevels(outline?.levels.map((level) => level.levelNumber) ?? [], currentLevel);
  useEffect(() => {
    let active = true;
    setError(null);
    void getCourseOutline(token, courseId).then((response) => {
      if (active && ownsSession(token)) setOutline(response);
    }).catch((reason: unknown) => {
      if (!active || !ownsSession(token)) return;
      if (reason instanceof ApiError && reason.status === 401) clearStoredSession();
      else setError(reason instanceof ApiError && reason.status === 404 ? "Опубликованный курс не найден." : reason instanceof Error ? reason.message : "Не удалось загрузить курс.");
    });
    return () => { active = false; };
  }, [courseId, token, retry]);

  return <section className="page-stack course-explorer">
    <div className="page-heading"><h1>{outline?.title ?? "Программа курса"}</h1><Link href="/courses">Все курсы</Link></div>
    {error === null ? null : <div className="notice-panel"><p role="alert">{error}</p><button className="secondary-action" onClick={() => setRetry((value) => value + 1)}>Повторить загрузку</button></div>}
    {outline === null ? (error === null ? <p aria-busy="true">Загружаю программу курса.</p> : null) : <>
      {outline.description ? <p className="muted">{outline.description}</p> : null}
      {outline.levels.length === 0 ? <p>В курсе пока нет уровней.</p> : <>
        {route === null ? null : <>
        <label className="course-level-select">Уровень курса<select value={route.level ?? outline.levels[0]!.levelNumber} onChange={(event) => navigate({ ...route, level: Number(event.target.value), page: 1 })}>
          {outline.levels.map((level) => <option value={level.levelNumber} key={level.levelNumber}>{level.levelNumber}. {level.title}</option>)}
        </select></label>
        <nav className="course-page-navigation" aria-label="Переход между уровнями">
          <button className="icon-button" aria-label="Предыдущий уровень" title="Предыдущий уровень" disabled={adjacent.previous === null} onClick={() => navigate({ ...route, level: adjacent.previous, page: 1 })}><ChevronLeft size={18} /></button>
          <span>Уровень {currentLevel}</span>
          <button className="icon-button" aria-label="Следующий уровень" title="Следующий уровень" disabled={adjacent.next === null} onClick={() => navigate({ ...route, level: adjacent.next, page: 1 })}><ChevronRight size={18} /></button>
        </nav>
        {outline.levels.some((level) => level.levelNumber === (route.level ?? outline.levels[0]!.levelNumber)) ? <CourseLevelMaterials token={token} courseId={courseId} levelNumber={route.level ?? outline.levels[0]!.levelNumber} route={route} onNavigate={navigate} /> : <p role="alert">Такого уровня в курсе нет.</p>}
        </>}
        <SectionDisclosure title="Все уровни"><ol className="course-outline" aria-label="Уровни курса">
        {outline.levels.map((level) => <li key={level.levelNumber}><strong>Уровень {level.levelNumber}: {level.title}</strong><span>{level.publishedItemCount} материалов</span></li>)}
        </ol></SectionDisclosure>
      </>}
    </>}
  </section>;
}
