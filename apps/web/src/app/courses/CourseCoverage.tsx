"use client";
import { useEffect, useRef, useState } from "react";
import { type CourseCoverageDto, type CourseCoverageCounts } from "@kanji-srs/shared";
import { getCourseCoverage, ApiError } from "../../lib/api-client";
import { clearStoredSession } from "../../lib/auth-storage";
import { ownsSession } from "../../lib/use-stored-session";
import { SectionDisclosure } from "../../components/SectionDisclosure";

export function CourseCoverage({
  token,
  courseId,
}: {
  readonly token: string;
  readonly courseId: string;
}) {
  const [report, setReport] = useState<CourseCoverageDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [group, setGroup] = useState<"levels" | "bands" | "jlpt">("levels");
  useEffect(() => () => request.current?.abort(), []);
  async function load() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    const controller = new AbortController();
    request.current = controller;
    try {
      const value = await getCourseCoverage(token, courseId, controller.signal);
      if (!controller.signal.aborted && ownsSession(token)) setReport(value);
    } catch (reason) {
      if (controller.signal.aborted || !ownsSession(token)) return;
      if (reason instanceof ApiError && reason.status === 401) clearStoredSession();
      else setError(reason instanceof Error ? reason.message : "Не удалось проверить наполнение.");
    } finally {
      busy.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  }
  const rows =
    report === null
      ? []
      : group === "levels"
        ? report.levels.map((row) => ({ label: `Уровень ${row.level}`, counts: row.counts }))
        : report[group].map((row) => ({
            label:
              row.band === "unassigned"
                ? "Без JLPT"
                : row.band === "foundation"
                  ? "Основы"
                  : row.band.toUpperCase(),
            counts: row.counts,
          }));
  return (
    <SectionDisclosure
      title="Наполнение курса"
      onOpen={() => {
        if (report === null && error === null) void load();
      }}
    >
      {error ? <p role="alert">{error}</p> : null}
      {report === null ? (
        pending ? (
          <p aria-busy="true">Проверяю опубликованные материалы.</p>
        ) : (
          <button className="secondary-action" onClick={() => void load()}>
            Повторить проверку наполнения
          </button>
        )
      ) : (
        <>
          <p className="muted">
            Опубликованные материалы и неаудиальные карточки. Не объём словаря. JLPT — метки
            источника, не полнота экзамена.
          </p>
          <dl className="course-scope-counts" aria-label="Учебные аспекты и метаданные">
            {report.teachingAspects ? (
              <>
                <div>
                  <dt>Кандзи и слова с карточками значения и чтения</dt>
                  <dd>
                    {report.teachingAspects.withBothCardTypes} /{" "}
                    {report.teachingAspects.assessedItems}
                  </dd>
                </div>
                <div>
                  <dt>Без карточки значения</dt>
                  <dd>{report.teachingAspects.missingMeaningCards}</dd>
                </div>
                <div>
                  <dt>Без карточки чтения</dt>
                  <dd>{report.teachingAspects.missingReadingCards}</dd>
                </div>
              </>
            ) : null}
            {report.jlptMetadata ? (
              <>
                <div>
                  <dt>Кандзи без современной метки JLPT</dt>
                  <dd>{report.jlptMetadata.kanji.unknown}</dd>
                </div>
                <div>
                  <dt>Слова без современной метки JLPT</dt>
                  <dd>{report.jlptMetadata.words.unknown}</dd>
                </div>
                <div>
                  <dt>Покрытие экзамена N4–N3</dt>
                  <dd>Не подтверждено</dd>
                </div>
              </>
            ) : null}
          </dl>
          <a href="https://www.jlpt.jp/e/about/levelsummary.html" target="_blank" rel="noreferrer">
            Требования JLPT
          </a>
          <label className="course-level-select">
            Группировка наполнения{" "}
            <select
              value={group}
              onChange={(event) => setGroup(event.currentTarget.value as typeof group)}
            >
              <option value="levels">По уровням</option>
              <option value="bands">По этапам курса</option>
              <option value="jlpt">По JLPT</option>
            </select>
          </label>
          <div className="course-coverage-scroll" tabIndex={0}>
            <table className="course-coverage-table">
              <caption>Наполнение и пробелы учебных ответов</caption>
              <thead>
                <tr>
                  {[
                    "Раздел",
                    "Материалы",
                    "Компоненты",
                    "Кандзи",
                    "Слова",
                    "Карточки",
                    "Нет RU",
                    "Нет EN",
                    "Нет чтения",
                  ].map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CoverageRow label="Всего" counts={report.total} />
                {rows.map((row) => (
                  <CoverageRow key={row.label} {...row} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SectionDisclosure>
  );
}
function CoverageRow({
  label,
  counts,
}: {
  readonly label: string;
  readonly counts: CourseCoverageCounts;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {[
        counts.items,
        counts.byKind.component,
        counts.byKind.kanji,
        counts.byKind.word,
        counts.cards,
        counts.missingRu,
        counts.missingEn,
        counts.missingReading,
      ].map((value, index) => (
        <td key={index}>{value}</td>
      ))}
    </tr>
  );
}
