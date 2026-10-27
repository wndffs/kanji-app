import { useState } from "react";
import { Check, Lock, X } from "lucide-react";
import { type KanaLessonUnitDto, type KanaVariant } from "@kanji-srs/shared";
import { findKanaLessonUnits, findKanaPrerequisite, KANA_GROUP_LABELS, KANA_UNIT_STATUS_LABELS, filterKanaUnitStatus, type KanaUnitStatus } from "../../lib/kana-unit-groups";

export function KanaLessonFinder({
  units,
  activeUnitId,
  submitting,
  onStart,
}: {
  readonly units: readonly KanaLessonUnitDto[];
  readonly activeUnitId: string | null;
  readonly submitting: boolean;
  readonly onStart: (unit: KanaLessonUnitDto) => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<KanaVariant | "all">("all");
  const [status, setStatus] = useState<KanaUnitStatus>("all");
  const visible = filterKanaUnitStatus(findKanaLessonUnits(units, query, group), status);
  return (
    <div className="kana-lesson-finder">
      <div className="kana-finder-controls">
        <label>
          Поиск урока
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <label>
          Группа звуков
          <select
            aria-label="Группа звуков"
            value={group}
            onChange={(event) => setGroup(event.currentTarget.value as KanaVariant | "all")}
          >
            {(Object.keys(KANA_GROUP_LABELS) as (KanaVariant | "all")[]).map((key) => (
              <option key={key} value={key}>
                {KANA_GROUP_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Состояние урока
          <select value={status} onChange={(event) => setStatus(event.currentTarget.value as KanaUnitStatus)}>
            {(Object.keys(KANA_UNIT_STATUS_LABELS) as KanaUnitStatus[]).map((key) => <option key={key} value={key}>{KANA_UNIT_STATUS_LABELS[key]}</option>)}
          </select>
        </label>
        <button
          className="icon-button"
          type="button"
          aria-label="Сбросить поиск урока"
          title="Сбросить поиск урока"
          disabled={query === "" && group === "all" && status === "all"}
          onClick={() => {
            setQuery("");
            setGroup("all");
            setStatus("all");
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="muted">
        Уроков: {visible.length} / {units.length}
      </p>
      {visible.length === 0 ? <p className="muted">Уроки не найдены.</p> : null}
      <div className="kana-unit-list" data-testid="kana-unit-list">
        {visible.map((unit) => {
          const ordinal = units.findIndex((candidate) => candidate.id === unit.id);
          const prerequisite = findKanaPrerequisite(units, unit.id);
          return (
            <button
              aria-current={unit.id === activeUnitId ? "step" : undefined}
              className={unit.complete ? "is-complete" : ""}
              data-unit-state={
                unit.id === activeUnitId
                  ? "current"
                  : !unit.unlocked
                    ? "locked"
                    : unit.complete
                      ? "mastered"
                      : "available"
              }
              disabled={!unit.unlocked || submitting}
              key={unit.id}
              onClick={() => onStart(unit)}
              type="button"
            >
              <span className="kana-unit-ordinal">{ordinal + 1}</span>
              <span className="kana-unit-copy">
                <strong>{unit.title}</strong>
                <small>
                  {unit.id === activeUnitId
                    ? "Сейчас · "
                    : unit.unlocked && !unit.complete
                      ? "Доступно · "
                      : null}
                  {!unit.unlocked ? (
                    <Lock size={14} aria-label="Закрыто" />
                  ) : unit.complete ? (
                    <Check size={14} aria-label="Освоено" />
                  ) : null}
                  {unit.masteredCount}/{unit.totalCount}
                </small>
                {prerequisite === null ? null : (
                  <small className="kana-unit-prerequisite">
                    После урока «{prerequisite.title}»
                  </small>
                )}
              </span>
              <span className="kana-unit-characters" lang="ja">
                {unit.items.map((item) => (
                  <span className={item.mastered ? "is-mastered" : ""} key={item.character}>
                    {item.character}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
