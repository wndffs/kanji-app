import { type LessonAnswerFeedbackDto, type LessonQueueItem } from "@kanji-srs/shared";

export function buildLessonQuizQueue(
  lessons: readonly LessonQueueItem[],
  sessionId: string,
): readonly LessonQueueItem[] {
  return orderByStableHash(lessons, sessionId, (lesson) => lesson.item.id).map((lesson) => ({
    ...lesson,
    cards: ensureCardOrderChanged(
      lesson.cards,
      `${sessionId}:${lesson.item.id}`,
      (card) => card.id,
    ),
  }));
}

export function advanceLessonQuizCardQueue(
  pendingCardIds: readonly string[],
  feedback: LessonAnswerFeedbackDto,
): readonly string[] {
  if (pendingCardIds[0] !== feedback.cardId) {
    return pendingCardIds;
  }

  if (feedback.diagnostic?.kind === "alternative-reading") {
    return pendingCardIds;
  }

  return feedback.accepted
    ? pendingCardIds.slice(1)
    : [...pendingCardIds.slice(1), feedback.cardId];
}

function ensureCardOrderChanged<T>(
  values: readonly T[],
  seed: string,
  getId: (value: T) => string,
): readonly T[] {
  const ordered = orderByStableHash(values, seed, getId);

  if (
    ordered.length > 1 &&
    ordered.every((value, index) => getId(value) === getId(values[index]!))
  ) {
    return [...ordered.slice(1), ordered[0]!];
  }

  return ordered;
}

function orderByStableHash<T>(
  values: readonly T[],
  seed: string,
  getId: (value: T) => string,
): readonly T[] {
  return [...values].sort((left, right) => {
    const leftId = getId(left);
    const rightId = getId(right);
    const hashDifference = stableHash(`${seed}:${leftId}`) - stableHash(`${seed}:${rightId}`);

    return hashDifference || leftId.localeCompare(rightId);
  });
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}
