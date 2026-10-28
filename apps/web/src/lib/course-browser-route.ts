import {
  ITEM_KINDS,
  type ItemKind,
  type CourseMaterialStudyState,
  type CourseReviewFilter,
  type CourseMaterialSort,
} from "@kanji-srs/shared";

export type CourseBrowserRoute = {
  readonly level: number | null;
  readonly page: number;
  readonly itemType: ItemKind | "all";
  readonly studyState: CourseMaterialStudyState | "all";
  readonly reviewState: CourseReviewFilter | "all";
  readonly q: string;
  readonly sort: CourseMaterialSort;
};
export function parseCourseBrowserRoute(params: URLSearchParams): CourseBrowserRoute {
  const integer = (value: string | null, max: number) =>
    value !== null && /^[1-9]\d*$/u.test(value) && Number(value) <= max ? Number(value) : null;
  const kind = params.get("itemType");
  const state = params.get("studyState");
  return {
    level: integer(params.get("level"), 60),
    page: integer(params.get("page"), 10_000) ?? 1,
    itemType: ITEM_KINDS.includes(kind as ItemKind) ? (kind as ItemKind) : "all",
    studyState: ["not-started", "learning", "burned"].includes(state ?? "")
      ? (state as CourseMaterialStudyState)
      : "all",
    reviewState:
      params.get("reviewState") === "due"
        ? "due"
        : params.get("reviewState") === "scheduled"
          ? "scheduled"
          : "all",
    q: normalizeCourseSearch(params.get("q") ?? ""),
    sort: params.get("sort") === "review-time" ? "review-time" : "course",
  };
}
export function courseBrowserHref(courseId: string, route: CourseBrowserRoute) {
  const params = new URLSearchParams();
  if (route.level !== null) params.set("level", String(route.level));
  if (route.page > 1) params.set("page", String(route.page));
  if (route.itemType !== "all") params.set("itemType", route.itemType);
  if (route.studyState !== "all") params.set("studyState", route.studyState);
  if (route.reviewState !== "all") params.set("reviewState", route.reviewState);
  if (route.q) params.set("q", normalizeCourseSearch(route.q));
  if (route.sort !== "course") params.set("sort", route.sort);
  return `/courses/${encodeURIComponent(courseId)}${params.size ? `?${params}` : ""}`;
}

export function adjacentCourseLevels(levels: readonly number[], current: number) {
  const sorted = [...new Set(levels)].sort((left, right) => left - right);
  return {
    previous: sorted.filter((level) => level < current).at(-1) ?? null,
    next: sorted.find((level) => level > current) ?? null,
  };
}

export function courseItemHref(itemId: string, courseId: string, route: CourseBrowserRoute) {
  const courseUrl = new URL(courseBrowserHref(courseId, route), "https://course.invalid");
  const params = courseUrl.searchParams;
  params.set("courseId", courseId);
  return `/items/${encodeURIComponent(itemId)}?${params}`;
}

export function courseReturnHref(params: Record<string, string | string[] | undefined>) {
  const courseId = params.courseId;
  if (
    typeof courseId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(courseId)
  )
    return null;
  const query = new URLSearchParams();
  for (const key of ["level", "page", "itemType", "studyState", "reviewState", "q", "sort"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  return courseBrowserHref(courseId, parseCourseBrowserRoute(query));
}
export function normalizeCourseSearch(value: string) {
  if (value.length > 80 || [...value].some((character) => character.charCodeAt(0) < 32)) return "";
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized.length <= 80 ? normalized : "";
}

export function relatedCourseItemHref(itemId: string, params: URLSearchParams) {
  const context = courseReturnHref(Object.fromEntries(params));
  if (context === null) return `/items/${encodeURIComponent(itemId)}`;
  const url = new URL(context, "https://course.invalid");
  const courseId = params.get("courseId")!;
  return courseItemHref(itemId, courseId, parseCourseBrowserRoute(url.searchParams));
}
