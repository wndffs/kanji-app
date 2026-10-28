import { type CourseOutlineDto } from "@kanji-srs/shared";

export const COURSE_OUTLINE_MAX_AGE_MS = 30_000;
let generation = 0;
let snapshot: { key: string; outline: CourseOutlineDto; confirmedAt: number } | null = null;

export function courseOutlineGeneration(): number {
  return generation;
}

export function invalidateCourseOutline(): void {
  generation += 1;
  snapshot = null;
}

export function readCourseOutline(token: string, courseId: string, now = Date.now()): CourseOutlineDto | null {
  if (snapshot?.key !== JSON.stringify([token, courseId])) return null;
  const age = now - snapshot.confirmedAt;
  if (age < 0 || age > COURSE_OUTLINE_MAX_AGE_MS) {
    snapshot = null;
    return null;
  }
  return snapshot.outline;
}

export function storeCourseOutline(token: string, courseId: string, outline: CourseOutlineDto, expectedGeneration: number, now = Date.now()): void {
  if (generation !== expectedGeneration) return;
  snapshot = { key: JSON.stringify([token, courseId]), outline, confirmedAt: now };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", invalidateCourseOutline);
}
