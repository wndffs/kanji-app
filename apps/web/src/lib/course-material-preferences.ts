export type CourseMaterialView = "grid" | "list";
const key = (userId: string) => `kanji-srs.course-material-view:${encodeURIComponent(userId)}`;
export function readCourseMaterialView(userId: string): CourseMaterialView {
  try {
    return window.localStorage.getItem(key(userId)) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}
export function storeCourseMaterialView(userId: string, view: CourseMaterialView): void {
  try {
    window.localStorage.setItem(key(userId), view);
  } catch {
    /* The current view remains usable without persistent storage. */
  }
}
