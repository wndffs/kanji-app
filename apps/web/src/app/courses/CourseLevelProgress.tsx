"use client";

import { type CourseLevelSummaryDto } from "@kanji-srs/shared";
import { type CourseBrowserRoute } from "../../lib/course-browser-route";

export function CourseLevelProgress({ summary, route, onNavigate }: {
  readonly summary: CourseLevelSummaryDto;
  readonly route: CourseBrowserRoute;
  readonly onNavigate: (route: CourseBrowserRoute) => void;
}) {
  return <nav className="course-level-progress" aria-label="Прогресс уровня">
    <span>Всего: {summary.total}</span>
    {([
      ["Новые", summary.newCount, "not-started"],
      ["В работе", summary.learningCount, "learning"],
      ["Выучены", summary.burnedCount, "burned"],
    ] as const).map(([label, count, state]) => <button key={state} className="text-action"
      onClick={() => onNavigate({ ...route, q: "", page: 1, itemType: "all", studyState: state, reviewState: "all" })}>
      {label}: {count}
    </button>)}
    <button className="text-action" onClick={() => onNavigate({ ...route, q: "", page: 1, itemType: "all", studyState: "all", reviewState: "due" })}>
      Срок наступил: {summary.dueItemCount}
    </button>
  </nav>;
}
