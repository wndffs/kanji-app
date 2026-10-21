"use client";

import { useRef, useState } from "react";
import {
  CONTENT_QUALITY_ISSUE_CODES,
  type ContentQualityIssueCode,
  type ContentQualityPageDto,
} from "@kanji-srs/shared";
import { getAdminContentQualityPage } from "../../lib/api-client";

export function ContentQualityPanel({
  token,
  onInspect,
}: {
  readonly token: string;
  readonly onInspect: (id: string) => Promise<void>;
}) {
  const [code, setCode] = useState<ContentQualityIssueCode | "">("");
  const [page, setPage] = useState<ContentQualityPageDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);

  async function load(cursor?: string) {
    const request = ++revision.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminContentQualityPage(token, {
        cursor,
        code: code === "" ? undefined : code,
      });
      if (request === revision.current) setPage(result);
    } catch (cause) {
      if (request === revision.current)
        setError(cause instanceof Error ? cause.message : "Не удалось проверить контент.");
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="content-quality-title">
      <h2 id="content-quality-title">Качество учебных материалов</h2>
      <div className="form-grid">
        <label>
          Проверка
          <select
            value={code}
            disabled={loading}
            onChange={(event) => {
              setCode(event.target.value as ContentQualityIssueCode | "");
              setPage(null);
            }}
          >
            <option value="">Все проверки</option>
            {CONTENT_QUALITY_ISSUE_CODES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button secondary"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Проверка..." : "Проверить с начала"}
        </button>
      </div>
      {error !== null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {page !== null && (
        <>
          <p role="status">
            Материалов на странице: {page.scannedItems}. Ошибок: {page.blockerCount}.
            Предупреждений: {page.warningCount}.
          </p>
          {page.issues.length === 0 ? (
            <p className="muted">На этой странице подходящих замечаний нет.</p>
          ) : (
            <ul className="plain-list">
              {page.issues.map((issue, index) => (
                <li key={`${issue.learningItemId}:${issue.code}:${index}`}>
                  <strong>{issue.code}</strong>: {issue.message}{" "}
                  <span className="muted">{issue.remediation}</span>{" "}
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => void onInspect(issue.learningItemId)}
                  >
                    Открыть материал
                  </button>
                </li>
              ))}
            </ul>
          )}
          {page.nextCursor !== null && (
            <button
              type="button"
              className="button secondary"
              disabled={loading}
              onClick={() => void load(page.nextCursor!)}
            >
              Следующая страница
            </button>
          )}
        </>
      )}
    </section>
  );
}
