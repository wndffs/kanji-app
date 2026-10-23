import { describe, expect, it } from "vitest";
import { dashboardNextAction } from "../src/lib/dashboard-next-action";

describe("dashboard next action", () => {
  const base = { dueReviews: 4, availableLessons: 2, hasCourse: true, vacationActive: false };
  it("prioritizes scheduled retrieval and retains its real count", () => {
    expect(dashboardNextAction(base)).toMatchObject({ href: "/reviews", title: "К повторению: 4" });
  });
  it("offers lessons only when available", () => {
    expect(dashboardNextAction({ ...base, dueReviews: 0 })).toMatchObject({ href: "/lessons", title: "Новых материалов: 2" });
  });
  it("does not imply an empty queue completed the course", () => {
    expect(dashboardNextAction({ ...base, dueReviews: 0, availableLessons: 0 })).toMatchObject({ href: "/practice", title: "Сейчас нет новых заданий" });
  });
  it("handles missing enrollment and vacation without fake lesson counts", () => {
    expect(dashboardNextAction({ ...base, dueReviews: 0, availableLessons: 0, hasCourse: false }).href).toBe("/courses");
    expect(dashboardNextAction({ ...base, vacationActive: true }).href).toBe("/settings");
  });
});
