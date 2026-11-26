import { type UserSettingsDto } from "../auth/auth.types";
import { DEFAULT_USER_SETTINGS } from "../auth/user-settings.defaults";

type LessonBudgetSettings = Pick<UserSettingsDto, "dailyLessonLimit" | "timezone">;

type LessonCompletion = {
  readonly learningItemId: string;
  readonly createdAt: Date;
};

export function getLessonBudget(
  settings: LessonBudgetSettings,
  progress: readonly LessonCompletion[],
  now: Date,
) {
  const { dailyLessonLimit, timezone } = settings;
  const dailyLimit =
    Number.isInteger(dailyLessonLimit) && dailyLessonLimit > 0
      ? dailyLessonLimit
      : DEFAULT_USER_SETTINGS.dailyLessonLimit;
  const dateKey = createLocalDateKey(timezone);
  const today = dateKey(now);
  const completedItems = new Set<string>();
  for (const { learningItemId, createdAt } of progress) {
    if (dateKey(createdAt) === today) completedItems.add(learningItemId);
  }

  const completedToday = completedItems.size;
  return { completedToday, dailyLimit, remainingToday: Math.max(0, dailyLimit - completedToday) };
}

export function createLocalDateKey(timezone: string): (date: Date) => string {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return (date) => date.toISOString().slice(0, 10);
  }

  return (date) => {
    const parts = formatter.formatToParts(date);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "00";
    return `${read("year")}-${read("month")}-${read("day")}`;
  };
}
