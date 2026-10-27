import { type LessonOrderMode, type LessonQueueItem } from "@kanji-srs/shared";

export function lessonBatchCapacity(batchLimit: number, remainingToday: number): number {
  if (!Number.isFinite(batchLimit) || !Number.isFinite(remainingToday)) return 0;
  return Math.max(0, Math.floor(Math.min(batchLimit, remainingToday)));
}

export function lessonSelectionCardCount(items: readonly LessonQueueItem[]): number {
  return new Set(items.flatMap((lesson) => lesson.cards.map((card) => card.id))).size;
}

export function boundedLessonSelection(
  eligible: readonly LessonQueueItem[],
  requestedIds: readonly string[],
  limit: number,
): readonly string[] {
  const allowed = new Set(eligible.map(({ item }) => item.id));
  return [...new Set(requestedIds)].filter((id) => allowed.has(id)).slice(0, Math.max(0, limit));
}

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
