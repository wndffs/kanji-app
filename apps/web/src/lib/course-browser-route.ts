import { ITEM_KINDS, type ItemKind, type CourseMaterialStudyState } from "@kanji-srs/shared";

export type CourseBrowserRoute = { readonly level: number | null; readonly page: number; readonly itemType: ItemKind | "all"; readonly studyState: CourseMaterialStudyState | "all" };
export function parseCourseBrowserRoute(params: URLSearchParams): CourseBrowserRoute {
  const integer = (value: string | null, max: number) => value !== null && /^[1-9]\d*$/u.test(value) && Number(value) <= max ? Number(value) : null;
  const kind = params.get("itemType");
  const state = params.get("studyState");
  return { level: integer(params.get("level"), 60), page: integer(params.get("page"), 10_000) ?? 1,
    itemType: ITEM_KINDS.includes(kind as ItemKind) ? kind as ItemKind : "all",
    studyState: ["not-started", "learning", "burned"].includes(state ?? "") ? state as CourseMaterialStudyState : "all" };
}
export function courseBrowserHref(courseId: string, route: CourseBrowserRoute) {
  const params = new URLSearchParams();
  if (route.level !== null) params.set("level", String(route.level));
  if (route.page > 1) params.set("page", String(route.page));
  if (route.itemType !== "all") params.set("itemType", route.itemType);
  if (route.studyState !== "all") params.set("studyState", route.studyState);
  return `/courses/${encodeURIComponent(courseId)}${params.size ? `?${params}` : ""}`;
}

export function adjacentCourseLevels(levels: readonly number[], current: number) {
  const sorted = [...new Set(levels)].sort((left, right) => left - right);
  return { previous: sorted.filter((level) => level < current).at(-1) ?? null,
    next: sorted.find((level) => level > current) ?? null };
}
