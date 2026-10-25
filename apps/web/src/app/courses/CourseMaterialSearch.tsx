"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { normalizeCourseSearch } from "../../lib/course-browser-route";

export function CourseMaterialSearch({ value, onSearch }: {
  readonly value: string;
  readonly onSearch: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return <form className="course-material-search" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(normalizeCourseSearch(draft)); }}>
    <label htmlFor="course-material-query">Поиск в уровне</label>
    <div>
      <input id="course-material-query" type="search" value={draft} maxLength={80}
        onChange={(event) => setDraft(event.target.value)} />
      <button className="icon-button" aria-label="Найти в уровне" title="Найти" type="submit"><Search size={18} /></button>
      {value || draft ? <button className="icon-button" aria-label="Очистить поиск" title="Очистить поиск" type="button" onClick={() => { setDraft(""); onSearch(""); }}><X size={18} /></button> : null}
    </div>
  </form>;
}
