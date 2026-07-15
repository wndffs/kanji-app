"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  type AdminCourseLevelOptionDto,
  type AdminCoursePlacementListResponse,
  type AdminCurationItemDto,
  type AdminUpdateCoursePlacementsRequest,
} from "@kanji-srs/shared";

import { getAdminCoursePlacements } from "../../lib/api-client";

type CoursePlacementEditorProps = {
  readonly token: string;
  readonly item: AdminCurationItemDto;
  readonly disabled: boolean;
  readonly onSave: (
    request: AdminUpdateCoursePlacementsRequest,
  ) => Promise<AdminCoursePlacementListResponse>;
};

type CourseOption = {
  readonly courseId: string;
  readonly courseTitle: string;
  readonly courseStatus: AdminCourseLevelOptionDto["courseStatus"];
  readonly courseType: AdminCourseLevelOptionDto["courseType"];
  readonly levels: readonly AdminCourseLevelOptionDto[];
};

export function CoursePlacementEditor({
  token,
  item,
  disabled,
  onSave,
}: CoursePlacementEditorProps) {
  const [placements, setPlacements] = useState<AdminCoursePlacementListResponse | null>(null);
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setPlacements(null);
    setDrafts({});
    setStatus("loading");
    setError(null);

    void getAdminCoursePlacements(token, item.id)
      .then((response) => {
        if (!active) {
          return;
        }

        setPlacements(response);
        setDrafts(buildDrafts(response.levels));
        setStatus("ready");
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : "Не удалось загрузить уровни курса.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [item.id, token]);

  const courses = useMemo(() => groupCourses(placements?.levels ?? []), [placements]);
  const selectedCount = Object.values(drafts).filter(Boolean).length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (placements === null || status !== "ready" || disabled || item.status !== "published") {
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      const response = await onSave({
        courseLevelIds: Object.values(drafts).filter((levelId) => levelId !== ""),
      });
      setPlacements(response);
      setDrafts(buildDrafts(response.levels));
      setStatus("ready");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "Не удалось сохранить размещение в курсе.",
      );
      setStatus("ready");
    }
  }

  return (
    <section className="panel admin-course-placement" data-testid="admin-course-placement">
      <div className="admin-prerequisite-heading">
        <div>
          <span className="eyebrow">Структура курса</span>
          <h2>Размещение по уровням</h2>
        </div>
        <strong>{selectedCount}</strong>
      </div>

      {status === "loading" ? <p className="muted">Загрузка уровней...</p> : null}
      {status !== "loading" && courses.length === 0 ? (
        <p className="muted">Доступных курсов пока нет.</p>
      ) : null}

      {courses.length === 0 ? null : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="admin-course-placement-list">
            {courses.map((course) => (
              <label key={course.courseId}>
                <span>
                  <strong>{course.courseTitle}</strong>
                  <small>
                    {formatCourseType(course.courseType)} · {formatStatus(course.courseStatus)}
                  </small>
                </span>
                <select
                  aria-label={`Уровень курса ${course.courseTitle}`}
                  disabled={disabled || status === "saving" || item.status !== "published"}
                  onChange={(event) => {
                    const courseLevelId = event.currentTarget.value;
                    setDrafts((current) => ({ ...current, [course.courseId]: courseLevelId }));
                  }}
                  value={drafts[course.courseId] ?? ""}
                >
                  <option value="">Не размещён</option>
                  {course.levels.map((level) => (
                    <option key={level.courseLevelId} value={level.courseLevelId}>
                      {level.levelNumber}. {level.levelTitle} · {formatBand(level.band)}
                      {level.sortOrder === null ? "" : ` · #${level.sortOrder}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <button
            className="primary-action"
            disabled={disabled || status === "saving" || item.status !== "published"}
            type="submit"
          >
            {status === "saving" ? "Сохраняю..." : "Сохранить размещение"}
          </button>
        </form>
      )}

      {item.status === "published" ? null : (
        <p className="muted">Размещение доступно после публикации материала.</p>
      )}
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function buildDrafts(
  levels: readonly AdminCourseLevelOptionDto[],
): Readonly<Record<string, string>> {
  const drafts: Record<string, string> = {};

  for (const level of levels) {
    drafts[level.courseId] ??= "";

    if (level.selected) {
      drafts[level.courseId] = level.courseLevelId;
    }
  }

  return drafts;
}

function groupCourses(levels: readonly AdminCourseLevelOptionDto[]): readonly CourseOption[] {
  const courses = new Map<string, CourseOption>();

  for (const level of levels) {
    const current = courses.get(level.courseId);

    if (current === undefined) {
      courses.set(level.courseId, {
        courseId: level.courseId,
        courseTitle: level.courseTitle,
        courseStatus: level.courseStatus,
        courseType: level.courseType,
        levels: [level],
      });
      continue;
    }

    courses.set(level.courseId, { ...current, levels: [...current.levels, level] });
  }

  return [...courses.values()];
}

function formatCourseType(courseType: AdminCourseLevelOptionDto["courseType"]): string {
  return courseType === "structured" ? "основной курс" : "демо-курс";
}

function formatStatus(status: AdminCourseLevelOptionDto["courseStatus"]): string {
  switch (status) {
    case "draft":
      return "черновик";
    case "needs-review":
      return "нужна проверка";
    case "published":
      return "опубликован";
    case "archived":
      return "архив";
  }
}

function formatBand(band: AdminCourseLevelOptionDto["band"]): string {
  return band === "foundation" ? "основа" : band.toUpperCase();
}
