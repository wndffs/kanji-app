"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type CourseOutlineDto } from "@kanji-srs/shared";
import { ApiError, getCourseOutline } from "../../lib/api-client";
import { clearStoredSession } from "../../lib/auth-storage";
import { ownsSession, useStoredSession } from "../../lib/use-stored-session";

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
      {outline.levels.length === 0 ? <p>В курсе пока нет уровней.</p> : <ol className="course-outline" aria-label="Уровни курса">
        {outline.levels.map((level) => <li key={level.levelNumber}><strong>Уровень {level.levelNumber}: {level.title}</strong><span>{level.publishedItemCount} материалов</span></li>)}
      </ol>}
    </>}
  </section>;
}
