import { ITEM_KINDS, type ItemKind, type ReviewQueueItem } from "@kanji-srs/shared";

export type ReviewBrowserRoute = { readonly kind: ItemKind | "all"; readonly prompt: "all" | "meaning" | "reading" | "listening"; readonly level: number | null; readonly page: number };
export const DEFAULT_REVIEW_BROWSER: ReviewBrowserRoute = { kind: "all", prompt: "all", level: null, page: 1 };
export const REVIEW_PREVIEW_PAGE_SIZE = 12;
export function parseReviewBrowser(params: URLSearchParams): ReviewBrowserRoute {
  const positive = (value: string | null, max: number) => value !== null && /^[1-9]\d*$/u.test(value) && Number(value) <= max ? Number(value) : null;
  const kind = params.get("kind"); const prompt = params.get("prompt");
  return { kind: ITEM_KINDS.includes(kind as ItemKind) ? kind as ItemKind : "all", prompt: ["meaning", "reading", "listening"].includes(prompt ?? "") ? prompt as ReviewBrowserRoute["prompt"] : "all", level: positive(params.get("level"), 60), page: positive(params.get("page"), 10_000) ?? 1 };
}
export function mergeReviewBrowser(current: ReviewBrowserRoute, patch: Partial<ReviewBrowserRoute>): ReviewBrowserRoute {
  return { ...current, ...(Object.keys(patch).some((key) => key !== "page") ? { page: 1 } : {}), ...patch };
}
export function reviewBrowserHref(route: ReviewBrowserRoute): string {
  const params = new URLSearchParams();
  if (route.kind !== "all") params.set("kind", route.kind);
  if (route.prompt !== "all") params.set("prompt", route.prompt);
  if (route.level !== null) params.set("level", String(route.level));
  if (route.page > 1) params.set("page", String(route.page));
  return `/reviews${params.size ? `?${params}` : ""}`;
}
export function filterReviewPreview(queue: readonly ReviewQueueItem[], route: ReviewBrowserRoute) {
  return queue.filter((row) => (route.kind === "all" || row.item.itemType === route.kind) && (route.prompt === "all" || reviewPromptKind(row) === route.prompt) && (route.level === null || row.item.level === route.level));
}

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

export function reviewTimezone(value: string): string {
  try { new Intl.DateTimeFormat("ru-RU", { timeZone: value }).format(0); return value; } catch { return "UTC"; }
}
export function formatReviewDueAt(value: string | null, timezone: string): string {
  if (value === null || !Number.isFinite(new Date(value).getTime())) return "Дата недоступна";
  const zone = reviewTimezone(timezone);
  return `${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(value))} (${zone})`;
}

export function reviewFeedbackTone(feedback: { readonly retry?: boolean; readonly result: string; readonly accepted: boolean }): "neutral" | "success" | "wrong" {
  return feedback.retry || feedback.result === "reveal" || feedback.result === "manual-ignore" ? "neutral" : feedback.accepted ? "success" : "wrong";
}
