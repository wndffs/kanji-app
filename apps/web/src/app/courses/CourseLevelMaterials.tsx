"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { type CourseMaterialPageDto } from "@kanji-srs/shared";
import { ApiError, getCourseMaterials } from "../../lib/api-client";
import { clearStoredSession } from "../../lib/auth-storage";
import { ownsSession } from "../../lib/use-stored-session";
import { JapaneseText } from "../../components/JapaneseText";
import { useTranslationDisplayMode } from "../../lib/use-translation-display-mode";
import { type CourseBrowserRoute } from "../../lib/course-browser-route";

export function CourseLevelMaterials({ token, courseId, levelNumber, route, onNavigate }: { readonly token: string; readonly courseId: string; readonly levelNumber: number; readonly route: CourseBrowserRoute; readonly onNavigate: (route: CourseBrowserRoute) => void }) {
  const displayMode = useTranslationDisplayMode();
  const { page, itemType, studyState } = route;
  const requestKey = `${levelNumber}:${page}:${itemType}:${studyState}`;
  const [loaded, setLoaded] = useState<{ readonly key: string; readonly data: CourseMaterialPageDto } | null>(null);
  const data = loaded?.key === requestKey ? loaded.data : null;
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void getCourseMaterials(token, courseId, levelNumber, page, itemType === "all" ? undefined : itemType, studyState === "all" ? undefined : studyState).then((response) => {
      if (active && ownsSession(token)) setLoaded({ key: requestKey, data: response });
    }).catch((reason: unknown) => {
      if (!active || !ownsSession(token)) return;
      if (reason instanceof ApiError && reason.status === 401) clearStoredSession();
      else setError(reason instanceof Error ? reason.message : "Не удалось загрузить материалы уровня.");
    });
    return () => { active = false; };
  }, [token, courseId, levelNumber, page, retry, itemType, studyState, requestKey]);
  return <section className="course-level-materials" aria-label="Материалы уровня">
    <h2>Материалы уровня {levelNumber}</h2>
    <label className="course-level-select">Тип материала<select value={itemType} onChange={(event) => onNavigate({ ...route, itemType: event.target.value as CourseBrowserRoute["itemType"], page: 1 })}>
      <option value="all">Все материалы</option><option value="component">Компоненты</option><option value="kanji">Кандзи</option><option value="word">Слова</option><option value="sentence">Предложения</option>
    </select></label>
    <label className="course-level-select">Изучение<select value={studyState} onChange={(event) => onNavigate({ ...route, studyState: event.target.value as CourseBrowserRoute["studyState"], page: 1 })}>
      <option value="all">Любое состояние</option><option value="not-started">Новые</option><option value="learning">В работе</option><option value="burned">Выучены</option>
    </select></label>
    {error === null ? null : <div><p role="alert">{error}</p><button className="secondary-action" onClick={() => setRetry((value) => value + 1)}>Повторить загрузку материалов</button></div>}
    {data === null ? (error === null ? <p aria-busy="true">Загружаю материалы.</p> : null) : <>
      <p className="muted">Найдено: {data.total}</p>
      {data.items.length === 0 ? <p>Материалов на этой странице нет.</p> : <ul className="course-material-grid">
        {data.items.map((item) => <li key={item.id}><Link href={`/items/${encodeURIComponent(item.id)}`}>
          <JapaneseText className="course-material-japanese">{item.japanese}</JapaneseText>
          {item.reading ? <JapaneseText className="course-material-reading">{item.reading}</JapaneseText> : null}
          {displayMode !== "en" && item.meaningRu ? <span lang="ru">{item.meaningRu}</span> : null}
          {displayMode !== "ru" && item.meaningEn ? <span lang="en">{item.meaningEn}</span> : null}
          <span className="muted">{item.itemType === "component" ? "Компонент" : item.itemType === "kanji" ? "Кандзи" : item.itemType === "word" ? "Слово" : "Предложение"}</span><span>{item.studyState === "burned" ? "Выучен" : item.studyState === "learning" ? `В работе: ${item.startedCardCount}/${item.cardCount}` : "Новый"}</span>
        </Link></li>)}
      </ul>}
      <nav className="course-page-navigation" aria-label="Страницы материалов">
        <button className="icon-button" aria-label="Предыдущая страница материалов" title="Предыдущая страница" disabled={page <= 1} onClick={() => onNavigate({ ...route, page: page - 1 })}><ChevronLeft size={18} /></button>
        <span>Страница {page} из {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
        <button className="icon-button" aria-label="Следующая страница материалов" title="Следующая страница" disabled={page * data.pageSize >= data.total} onClick={() => onNavigate({ ...route, page: page + 1 })}><ChevronRight size={18} /></button>
      </nav>
    </>}
  </section>;
}
