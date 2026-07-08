import { describe, expect, it } from "vitest";

import {
  formatAccuracy,
  formatCount,
  formatForecastBucket,
  formatSrsStageName,
  formatTranslationDisplayMode,
} from "../src/lib/dashboard-format";

describe("dashboard formatters", () => {
  it("formats translation display modes", () => {
    expect(formatTranslationDisplayMode("ru")).toBe("Русский");
    expect(formatTranslationDisplayMode("en")).toBe("English");
    expect(formatTranslationDisplayMode("ru-en")).toBe("Русский + English");
  });

  it("formats forecast buckets and accuracy", () => {
    expect(
      formatForecastBucket({
        bucketKey: "2026-06-18T13:00",
        localDate: "2026-06-18",
        localHour: 13,
        dueCount: 2,
      }),
    ).toBe("18.06.2026, 13:00");
    expect(formatAccuracy(0.667)).toBe("67%");
    expect(formatAccuracy(null)).toBe("нет данных");
  });

  it("formats Russian count forms", () => {
    expect(formatCount(1, "карточка", "карточки", "карточек")).toBe("1 карточка");
    expect(formatCount(3, "карточка", "карточки", "карточек")).toBe("3 карточки");
    expect(formatCount(11, "карточка", "карточки", "карточек")).toBe("11 карточек");
  });

  it("formats SRS stage names for learner-facing UI", () => {
    expect(formatSrsStageName("Apprentice 2")).toBe("Знакомство 2");
    expect(formatSrsStageName("Guru 1")).toBe("Закрепление 1");
    expect(formatSrsStageName("Enlightened")).toBe("Долгая память");
    expect(formatSrsStageName(null)).toBe("ещё не изучается");
  });
});
