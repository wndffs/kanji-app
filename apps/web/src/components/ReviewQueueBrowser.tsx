"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import { type ReviewQueueItem } from "@kanji-srs/shared";
import { JapaneseText } from "./JapaneseText";
import { DEFAULT_REVIEW_BROWSER, REVIEW_PREVIEW_PAGE_SIZE, filterReviewPreview, mergeReviewBrowser, parseReviewBrowser, reviewBrowserHref, reviewPromptKind, type ReviewBrowserRoute } from "../lib/review-workspace";

const KINDS = { component: "Компонент", kanji: "Кандзи", word: "Слово", sentence: "Предложение" } as const;
const PROMPTS = { meaning: "Значение", reading: "Чтение", listening: "Аудирование" } as const;

export function ReviewQueueBrowser({ queue, disabled }: { readonly queue: readonly ReviewQueueItem[]; readonly disabled: boolean }) {
  const router = useRouter(); const params = useSearchParams();
  const confirmed = useMemo(() => parseReviewBrowser(params), [params]);
  const [pending, startTransition] = useTransition(); const [optimistic, setOptimistic] = useState(confirmed); const latest = useRef(confirmed);
  const route = pending ? optimistic : confirmed;
  useEffect(() => { if (!pending) latest.current = confirmed; }, [confirmed, pending]);
  const navigate = useCallback((patch: Partial<ReviewBrowserRoute>, replace = false) => {
    const next = mergeReviewBrowser(latest.current, patch); latest.current = next; setOptimistic(next);
    startTransition(() => { if (replace) router.replace(reviewBrowserHref(next), { scroll: false }); else router.push(reviewBrowserHref(next), { scroll: false }); });
  }, [router]);
  const matching = filterReviewPreview(queue, route);
  const pageCount = Math.max(1, Math.ceil(matching.length / REVIEW_PREVIEW_PAGE_SIZE)); const page = Math.min(route.page, pageCount);
  useEffect(() => { if (route.page !== page) navigate({ page }, true); }, [route.page, page, navigate]);
  const levels = [...new Set(queue.flatMap(({ item }) => item.level === null ? [] : [item.level]))].sort((a, b) => a - b);
  return <section className="review-queue-browser" aria-label="Просмотр очереди" aria-busy={pending}>
    <fieldset disabled={disabled} className="review-preview-controls">
      <div className="review-preview-filters">
        <label><span>Тип материала</span><select value={route.kind} onChange={(event) => navigate({ kind: event.currentTarget.value as ReviewBrowserRoute["kind"] })}><option value="all">Все типы</option>{Object.entries(KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><span>Вопрос</span><select value={route.prompt} onChange={(event) => navigate({ prompt: event.currentTarget.value as ReviewBrowserRoute["prompt"] })}><option value="all">Все вопросы</option>{Object.entries(PROMPTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><span>Уровень</span><select value={route.level ?? "all"} onChange={(event) => navigate({ level: event.currentTarget.value === "all" ? null : Number(event.currentTarget.value) })}><option value="all">Все уровни</option>{levels.map((level) => <option key={level} value={level}>Уровень {level}</option>)}</select></label>
      </div>
      <div className="review-preview-counts"><span>Просмотр: {matching.length} / {queue.length} карточек</span>{route.kind !== "all" || route.prompt !== "all" || route.level !== null ? <button className="link-button" type="button" onClick={() => navigate(DEFAULT_REVIEW_BROWSER)}>Сбросить фильтры очереди</button> : null}</div>
      {matching.length === 0 ? <p className="muted">По выбранным фильтрам карточки не найдены.</p> : null}
      <div className="review-queue-grid">{matching.slice((page - 1) * REVIEW_PREVIEW_PAGE_SIZE, page * REVIEW_PREVIEW_PAGE_SIZE).map((row) => <article className="review-queue-card" key={row.card.id} data-item-type={row.item.itemType}>
        <div><span className="eyebrow">{KINDS[row.item.itemType]}</span>{reviewPromptKind(row) === "listening" ? <strong className="audio-queue-label"><Volume2 size={20} aria-hidden="true" />Аудио</strong> : <JapaneseText as="strong">{row.item.japanese}</JapaneseText>}</div>
        <span>{PROMPTS[reviewPromptKind(row)]}</span>
      </article>)}</div>
      {pageCount <= 1 ? null : <nav className="review-preview-pages" aria-label="Страницы очереди"><button className="icon-button" type="button" title="Предыдущая страница" aria-label="Предыдущая страница очереди" disabled={page === 1} onClick={() => navigate({ page: page - 1 })}><ChevronLeft size={18} aria-hidden="true" /></button><span>{page} / {pageCount}</span><button className="icon-button" type="button" title="Следующая страница" aria-label="Следующая страница очереди" disabled={page === pageCount} onClick={() => navigate({ page: page + 1 })}><ChevronRight size={18} aria-hidden="true" /></button></nav>}
    </fieldset>
  </section>;
}
