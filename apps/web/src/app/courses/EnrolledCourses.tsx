"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type CourseListResponse, type EnrolledCourseDto } from "@kanji-srs/shared";
import { ApiError, getCourses, selectCurrentCourse } from "../../lib/api-client";
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
  const [target, setTarget] = useState<EnrolledCourseDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
    {message === null ? null : <p role="status">{message}</p>}
    {error === null ? null : <div><p role="alert">{error}</p><button className="secondary-action" onClick={() => setRetry((value) => value + 1)}>Повторить загрузку</button></div>}
    {library === null ? error === null ? <p aria-busy="true">Загружаю мои курсы.</p> : null : library.courses.length === 0 ? <p className="muted">Нет добавленных курсов.</p> : <ul className="course-catalog-list">
      {library.courses.map((course) => <li key={course.id}>
        <div><h3>{course.title}</h3><span className="muted">{course.isCurrent ? "Текущий курс" : course.enrollmentStatus === "active" ? "Добавлен" : course.enrollmentStatus === "completed" ? "Завершён" : "На паузе"}</span></div>
        {course.isCurrent ? <Link className="primary-action" href="/lessons">К урокам</Link> : course.enrollmentStatus === "active" ? <button className="secondary-action" onClick={() => setTarget(course)}>Выбрать</button> : null}
      </li>)}
    </ul>}
    {target === null ? null : <CourseSwitchDialog course={target} token={token} onCancel={() => setTarget(null)} onSelected={(response) => {
      setLibrary(response);
      setMessage(`Текущий курс: ${target.title}`);
      setTarget(null);
    }} />}
  </section>;
}

function CourseSwitchDialog({ course, token, onCancel, onSelected }: {
  readonly course: EnrolledCourseDto; readonly token: string;
  readonly onCancel: () => void; readonly onSelected: (response: CourseListResponse) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  async function confirm() {
    if (pending.current || !ownsSession(token)) return;
    pending.current = true;
    setBusy(true); setError(null); setConflict(false);
    try {
      const response = await selectCurrentCourse(token, { courseId: course.id });
      if (ownsSession(token)) onSelected(response);
    } catch (reason) {
      if (!ownsSession(token)) return;
      if (reason instanceof ApiError && reason.status === 401) clearStoredSession();
      else {
        const activeLesson = reason instanceof ApiError && reason.status === 409;
        setConflict(activeLesson);
        setError(activeLesson ? "Завершите или покиньте текущий урок перед сменой курса." : reason instanceof Error ? reason.message : "Не удалось выбрать курс.");
      }
    } finally { pending.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} className="confirmation-dialog course-switch-dialog" aria-labelledby="course-switch-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="course-switch-title">Выбрать текущий курс?</h2>
    <p>{course.title}</p>
    <p className="muted">Прогресс и расписание уже изученных карточек сохранятся.</p>
    {error === null ? null : <p role="alert" className="form-error">{error}</p>}
    {conflict ? <Link href="/lessons" className="inline-link">К текущему уроку</Link> : null}
    <div className="dialog-actions"><button autoFocus className="secondary-action" disabled={busy} onClick={onCancel}>Отмена</button><button className="primary-action" disabled={busy} onClick={() => void confirm()}>{busy ? "Выбираю..." : "Сделать текущим"}</button></div>
  </dialog>;
}
