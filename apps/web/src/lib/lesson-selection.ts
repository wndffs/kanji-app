import { type LessonQueueItem } from "@kanji-srs/shared";

export type LessonOrderMode = "course" | "interleaved";

export function orderLessonSelection(
  lessons: readonly LessonQueueItem[],
  mode: LessonOrderMode,
): readonly LessonQueueItem[] {
  if (mode === "course" || lessons.length < 2) {
    return [...lessons];
  }

  const groups = new Map<LessonQueueItem["item"]["itemType"], LessonQueueItem[]>();

  for (const lesson of lessons) {
    const group = groups.get(lesson.item.itemType) ?? [];
    group.push(lesson);
    groups.set(lesson.item.itemType, group);
  }

  const result: LessonQueueItem[] = [];
  let groupIndex = 0;

  while (result.length < lessons.length) {
    for (const group of groups.values()) {
      const lesson = group[groupIndex];

      if (lesson !== undefined) {
        result.push(lesson);
      }
    }

    groupIndex += 1;
  }

  return result;
}
