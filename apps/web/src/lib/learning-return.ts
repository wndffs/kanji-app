import { courseBrowserHref, parseCourseBrowserRoute } from "./course-browser-route";

export function canonicalCourseReturn(value: string | null | undefined): string | null {
  if (!value || value.length > 1024 || !value.startsWith("/courses/")) return null;
  try {
    const url = new URL(value, "https://learning.invalid");
    const match =
      /^\/courses\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/iu.exec(
        url.pathname,
      );
    if (!match || url.origin !== "https://learning.invalid" || url.hash) return null;
    return courseBrowserHref(match[1]!, parseCourseBrowserRoute(url.searchParams));
  } catch {
    return null;
  }
}
export function lessonReturnHref(params: URLSearchParams): string | null {
  return params.getAll("returnTo").length === 1
    ? canonicalCourseReturn(params.get("returnTo"))
    : null;
}
export function lessonEntryHref(returnHref: string): string {
  const safe = canonicalCourseReturn(returnHref);
  return safe === null ? "/lessons" : `/lessons?${new URLSearchParams({ returnTo: safe })}`;
}
