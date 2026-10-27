"use client";

import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { normalizeLessonSearch } from "../lib/lesson-browser";

export function LessonPickerSearch({ value, onSearch, disabled }: { readonly value: string; readonly onSearch: (value: string) => void; readonly disabled: boolean }) {
  const [draft, setDraft] = useState(value);
  const composing = useRef(false);
  return <form className="lesson-picker-search" role="search" aria-label="Поиск новых материалов" onSubmit={(event) => { event.preventDefault(); if (!composing.current && !disabled) onSearch(normalizeLessonSearch(draft)); }}>
    <label htmlFor="lesson-picker-query">Поиск новых материалов</label>
    <div><input id="lesson-picker-query" type="search" maxLength={80} disabled={disabled} value={draft} onChange={(event) => setDraft(event.currentTarget.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={(event) => { if (event.key === "Enter" && (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }} />
      <button className="icon-button" type="submit" disabled={disabled} aria-label="Найти новые материалы" title="Найти"><Search size={18} aria-hidden="true" /></button>
      {draft || value ? <button className="icon-button" type="button" disabled={disabled} aria-label="Очистить поиск материалов" title="Очистить поиск" onClick={() => { setDraft(""); onSearch(""); }}><X size={18} aria-hidden="true" /></button> : null}
    </div>
  </form>;
}
