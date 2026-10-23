"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type CourseListResponse } from "@kanji-srs/shared";
import { ApiError, getCourses } from "../../lib/api-client";
import { clearStoredSession } from "../../lib/auth-storage";
import { ownsSession, useStoredSession } from "../../lib/use-stored-session";

export function EnrolledCourses({ refresh }: { readonly refresh: number }) {
  const session = useStoredSession();
  return session == null ? null : <CourseLibrary key={`${session.user.id}:${session.token}`} token={session.token} refresh={refresh} />;
}

function CourseLibrary({ token, refresh }: { readonly token: string; readonly refresh: number }) {
  const [library, setLibrary] = useState<CourseListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void getCourses(token).then((response) => {
      if (active && ownsSession(token)) setLibrary(response);
    }).catch((reason: unknown) => {
      if (!active || !ownsSession(token)) return;
      if (reason instanceof ApiError && reason.status === 401) clearStoredSession();
      else setError(reason instanceof Error ? reason.message : "Не удалось загрузить мои курсы.");
    });
    return () => { active = false; };
  }, [token, refresh, retry]);
  return <section className="course-library" aria-label="Мои курсы">
    <h2>Мои курсы</h2>
    {error === null ? null : <div><p role="alert">{error}</p><button className="secondary-action" onClick={() => setRetry((value) => value + 1)}>Повторить загрузку</button></div>}
    {library === null ? error === null ? <p aria-busy="true">Загружаю мои курсы.</p> : null : library.courses.length === 0 ? <p className="muted">Нет добавленных курсов.</p> : <ul className="course-catalog-list">
      {library.courses.map((course) => <li key={course.id}>
        <div><h3>{course.title}</h3><span className="muted">{course.isCurrent ? "Текущий курс" : course.enrollmentStatus === "active" ? "Добавлен" : course.enrollmentStatus === "completed" ? "Завершён" : "На паузе"}</span></div>
        {course.isCurrent ? <Link className="primary-action" href="/lessons">К урокам</Link> : null}
      </li>)}
    </ul>}
  </section>;
}
