import { type ReviewQueueItem } from "@kanji-srs/shared";

export function reviewPromptKind(item: ReviewQueueItem): "meaning" | "reading" | "listening" {
  return item.card.promptType === "listening" ? "listening" : item.card.answerType;
}

export function summarizeReviewQueue(queue: readonly ReviewQueueItem[]) {
  const cards = [...new Map(queue.map((row) => [row.card.id, row])).values()];
  return { cards: cards.length, materials: new Set(cards.map((row) => row.item.id)).size,
    meaning: cards.filter((row) => reviewPromptKind(row) === "meaning").length,
    reading: cards.filter((row) => reviewPromptKind(row) === "reading").length,
    listening: cards.filter((row) => reviewPromptKind(row) === "listening").length };
}

export function pendingReviewCorrections(queue: readonly ReviewQueueItem[], corrected: readonly string[]): number {
  const ids = new Set(corrected);
  return new Set(queue.filter((row) => !ids.has(row.card.id)).map((row) => row.card.id)).size;
}
