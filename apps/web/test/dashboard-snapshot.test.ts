import { beforeEach, expect, it } from "vitest";
import { type DashboardDto } from "@kanji-srs/shared";
import {
  DASHBOARD_SNAPSHOT_MAX_AGE_MS,
  dashboardSnapshotGeneration,
  invalidateDashboardSnapshot,
  readDashboardSnapshot,
  storeDashboardSnapshot,
} from "../src/lib/dashboard-snapshot";

const owner = { accountId: "a", token: "fixture-a", settingsKey: "ru" };
const data = { user: { id: "a" }, counts: { dueReviews: 7 } } as DashboardDto;
beforeEach(invalidateDashboardSnapshot);

it("keeps only a bounded, exact-owner/settings in-memory snapshot", () => {
  expect(storeDashboardSnapshot(owner, data, dashboardSnapshotGeneration(), 1000)).toBe(true);
  expect(readDashboardSnapshot(owner, 1001)?.dashboard).toBe(data);
  for (const changed of [{ accountId: "b" }, { token: "fixture-b" }, { settingsKey: "en" }])
    expect(readDashboardSnapshot({ ...owner, ...changed }, 1001)).toBeNull();
  expect(readDashboardSnapshot(owner, 1000 + DASHBOARD_SNAPSHOT_MAX_AGE_MS + 1)).toBeNull();
});

it("rejects invalidated pending results, another owner and clock reversal", () => {
  const previous = dashboardSnapshotGeneration();
  invalidateDashboardSnapshot();
  expect(storeDashboardSnapshot(owner, data, previous)).toBe(false);
  expect(
    storeDashboardSnapshot({ ...owner, accountId: "b" }, data, dashboardSnapshotGeneration()),
  ).toBe(false);
  storeDashboardSnapshot(owner, data, dashboardSnapshotGeneration(), 1000);
  expect(readDashboardSnapshot(owner, 999)).toBeNull();
});
