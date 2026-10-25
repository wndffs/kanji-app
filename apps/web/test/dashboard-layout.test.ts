import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_WIDGET_PREFERENCES } from "@kanji-srs/shared";
import { presentDashboardWidgets } from "../src/lib/dashboard-layout";

describe("daily dashboard composition", () => {
  it("puts the course next to the forecast before secondary details without mutating defaults", () => {
    const result = presentDashboardWidgets(DEFAULT_DASHBOARD_WIDGET_PREFERENCES);
    expect(result.slice(0, 3).map((item) => item.id)).toEqual([
      "summary",
      "course-progress",
      "review-forecast",
    ]);
    expect(result.find((item) => item.id === "workload")?.presentation).toBe("compact");
    expect(DEFAULT_DASHBOARD_WIDGET_PREFERENCES[1]?.id).toBe("workload");
    expect(DEFAULT_DASHBOARD_WIDGET_PREFERENCES[1]?.presentation).toBe("expanded");
  });
  it("never rearranges a hidden, resized or reordered personal layout", () => {
    const custom = DEFAULT_DASHBOARD_WIDGET_PREFERENCES.map((item) =>
      item.id === "summary" ? { ...item, visible: false } : item,
    );
    expect(presentDashboardWidgets(custom)).toBe(custom);
    const reversed = [...DEFAULT_DASHBOARD_WIDGET_PREFERENCES].reverse();
    expect(presentDashboardWidgets(reversed)).toBe(reversed);
  });
});
