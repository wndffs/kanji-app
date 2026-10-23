"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type PublishedCourseDto } from "@kanji-srs/shared";

import { ApiError, enrollInCourse, getAvailableCourses } from "../../lib/api-client";
import { AUTH_CHANGED_EVENT, clearStoredSession, readStoredSession } from "../../lib/auth-storage";
import { EnrolledCourses } from "./EnrolledCourses";

export function CoursesClient() {
  const [enrollmentRevision, setEnrollmentRevision] = useState(0);
  const [courses, setCourses] = useState<readonly PublishedCourseDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const revision = useRef(0);

  function expired(token: string, request: number): boolean {
    return revision.current !== request || readStoredSession()?.token !== token;
  }

  function handleError(reason: unknown, token: string) {
    if (reason instanceof ApiError && reason.status === 401) {
      if (readStoredSession()?.token === token) clearStoredSession();
      setNeedsLogin(true);
    } else setError(reason instanceof Error ? reason.message : "Не удалось загрузить курсы.");
  }

  async function load(next?: string) {
    const session = readStoredSession();
    if (!session) {
      setNeedsLogin(true);
      setLoading(false);
      return;
    }
    const request = ++revision.current;
    setNeedsLogin(false);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const page = await getAvailableCourses(session.token, next);
      if (expired(session.token, request)) return;
      setCourses((previous) =>
        next === undefined
          ? page.courses
          : [
              ...new Map(
                [...previous, ...page.courses].map((course) => [course.id, course]),
              ).values(),
            ],
      );
      setCursor(page.nextCursor);
    } catch (reason) {
      if (!expired(session.token, request)) handleError(reason, session.token);
    } finally {
      if (!expired(session.token, request)) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const sync = () => {
      revision.current++;
      setCourses([]);
      setCursor(null);
      setSavingId(null);
      setMessage(null);
      void load();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === null || ["kanji-srs.accessToken", "kanji-srs.user"].includes(event.key))
        sync();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("storage", storage);
    return () => {
      revision.current++;
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", storage);
    };
  }, []);

  async function join(course: PublishedCourseDto) {
    const session = readStoredSession();
    if (!session || savingId !== null || loading) return;
    const request = ++revision.current;
    setSavingId(course.id);
    setError(null);
    setMessage(null);
    try {
      await enrollInCourse(session.token, course.id);
      if (expired(session.token, request)) return;
      setCourses((previous) => previous.filter((candidate) => candidate.id !== course.id));
      setMessage(`Курс «${course.title}» добавлен. Текущий курс не изменён.`);
      setEnrollmentRevision((value) => value + 1);
    } catch (reason) {
      if (!expired(session.token, request)) handleError(reason, session.token);
    } finally {
      if (!expired(session.token, request)) setSavingId(null);
    }
  }

  return (
    <section className="page-stack courses-page">
      <div className="page-heading">
        <h1>Курсы</h1>
        <Link className="secondary-action" href="/dashboard">
          На панель
        </Link>
      </div>
      <EnrolledCourses refresh={enrollmentRevision} />
      {needsLogin ? (
        <div className="notice-panel">
          <p>Нужен вход в аккаунт.</p>
          <Link href="/login">Войти</Link>
        </div>
      ) : (
        <>
          {error === null ? null : <p role="alert">{error}</p>}
          <h2>Доступные курсы</h2>
          <p role="status">
            {message ??
              (loading
                ? "Загружаю курсы."
                : error === null && courses.length === 0 && cursor === null
                  ? "Новых опубликованных курсов нет."
                  : "")}
          </p>
          <ul
            className="course-catalog-list"
            aria-label="Доступные курсы"
            aria-busy={loading || savingId !== null}
          >
            {courses.map((course) => (
              <li key={course.id}>
                <div>
                  <h2>
                    <Link href={`/courses/${encodeURIComponent(course.id)}`}>{course.title}</Link>
                  </h2>
                  {course.description ? <p>{course.description}</p> : null}
                </div>
                <button
                  className="primary-action"
                  disabled={loading || savingId !== null}
                  onClick={() => void join(course)}
                >
                  {savingId === course.id ? "Добавляю..." : "Добавить курс"}
                </button>
              </li>
            ))}
          </ul>
          {cursor === null ? null : (
            <button
              className="secondary-action"
              disabled={loading || savingId !== null}
              onClick={() => void load(cursor)}
            >
              Ещё курсы
            </button>
          )}
          {error === null ? null : (
            <button
              className="secondary-action"
              disabled={loading || savingId !== null}
              onClick={() => void load()}
            >
              Обновить
            </button>
          )}
        </>
      )}
    </section>
  );
}
