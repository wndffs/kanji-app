import { useState } from "react";
import { Check, Lock, X } from "lucide-react";
import { type KanaLessonUnitDto, type KanaVariant } from "@kanji-srs/shared";
import { findKanaLessonUnits, KANA_GROUP_LABELS } from "../../lib/kana-unit-groups";

export function KanaLessonFinder({ units, activeUnitId, submitting, onStart }: {
  readonly units: readonly KanaLessonUnitDto[];
  readonly activeUnitId: string | null;
  readonly submitting: boolean;
  readonly onStart: (unit: KanaLessonUnitDto) => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<KanaVariant | "all">("all");
  const visible = findKanaLessonUnits(units, query, group);
  return <div className="kana-lesson-finder">
    <div className="kana-finder-controls">
      <label>Поиск урока<input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
      <label>Группа звуков<select value={group} onChange={(event) => setGroup(event.currentTarget.value as KanaVariant | "all")}>
        {(Object.keys(KANA_GROUP_LABELS) as (KanaVariant | "all")[]).map((key) => <option key={key} value={key}>{KANA_GROUP_LABELS[key]}</option>)}
      </select></label>
      <button className="icon-button" type="button" aria-label="Сбросить поиск урока" title="Сбросить поиск урока" disabled={query === "" && group === "all"}
        onClick={() => { setQuery(""); setGroup("all"); }}><X size={18} aria-hidden="true" /></button>
    </div>
    <p className="muted">Уроков: {visible.length} / {units.length}</p>
    {visible.length === 0 ? <p className="muted">Уроки не найдены.</p> : null}
    <div className="kana-unit-list" data-testid="kana-unit-list">
      {visible.map((unit) => <button aria-current={unit.id === activeUnitId ? "step" : undefined} className={unit.complete ? "is-complete" : ""}
        disabled={!unit.unlocked || submitting} key={unit.id} onClick={() => onStart(unit)} type="button">
        <span className="kana-unit-copy"><strong>{unit.title}</strong><small>
          {!unit.unlocked ? <Lock size={14} aria-label="Закрыто" /> : unit.complete ? <Check size={14} aria-label="Освоено" /> : null}
          {unit.masteredCount}/{unit.totalCount}
        </small></span>
        <span className="kana-unit-characters" lang="ja">{unit.items.map((item) => <span className={item.mastered ? "is-mastered" : ""} key={item.character}>{item.character}</span>)}</span>
      </button>)}
    </div>
  </div>;
}
