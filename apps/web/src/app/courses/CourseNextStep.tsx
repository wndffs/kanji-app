"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { type LessonQueueResponse } from "@kanji-srs/shared";
import { getCourses, getLessonQueue, ApiError } from "../../lib/api-client";
import { clearStoredSession } from "../../lib/auth-storage";
import { ownsSession } from "../../lib/use-stored-session";
import { JapaneseText } from "../../components/JapaneseText";

export function CourseNextStep({ token, courseId }: { readonly token: string; readonly courseId: string }) {
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<LessonQueueResponse | "not-current" | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function load() {
    if (busy.current) return;
    busy.current = true;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setPending(true); setError(null);
    try {
      const courses = await getCourses(token, controller.signal);
      if (controller.signal.aborted || !ownsSession(token)) return;
      if (courses.currentCourseId !== courseId) { setResult("not-current"); return; }
      const queue = await getLessonQueue(token, null, { signal: controller.signal });
      if (!controller.signal.aborted && ownsSession(token)) setResult(queue);
    } catch (reason) {
      if (controller.signal.aborted || !ownsSession(token)) return;
      if (reason instanceof ApiError && reason.status === 401) clearStoredSession();
      else setError(reason instanceof Error ? reason.message : "Не удалось проверить уроки.");
    } finally { busy.current = false; if (!controller.signal.aborted) setPending(false); }
  }
  const next = result !== null && result !== "not-current" ? result.items[0] : undefined;
  return <section className="course-next-step" aria-label="Следующий шаг курса">
    <div><h2>Следующий шаг</h2>
      {result === "not-current" ? <p>Этот курс не выбран текущим. <Link href="/courses">Мои курсы</Link></p>
        : next ? <p>Доступен материал: <JapaneseText>{next.item.japanese}</JapaneseText></p>
          : result !== null ? <p>Сейчас новые уроки недоступны. <Link href="/dashboard">К плану обучения</Link></p>
            : null}
      {next && next.unlockedBy.length > 0 ? <p className="muted">Опора: {next.unlockedBy.map((item) => item.japanese).join(" · ")}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
    {next ? <Link className="primary-action" href="/lessons">К урокам <ArrowRight size={16}/></Link> : null}
    <button className={result === null ? "secondary-action" : "icon-button"} type="button" disabled={pending}
      title="Проверить следующий шаг" aria-label="Проверить следующий шаг" onClick={() => void load()}>
      <RefreshCw size={16}/>{result === null ? pending ? "Проверяю…" : "Проверить уроки" : null}
    </button>
  </section>;
}
