import { type DashboardDto } from "@kanji-srs/shared";

export const DASHBOARD_SNAPSHOT_MAX_AGE_MS = 30_000;
export type DashboardSnapshotIdentity = {
  readonly accountId: string;
  readonly token: string;
  readonly settingsKey: string;
};
export type DashboardSnapshot = { readonly dashboard: DashboardDto; readonly confirmedAt: number };
let snapshot: (DashboardSnapshot & { readonly key: string }) | null = null;
let generation = 0;

export function dashboardSnapshotKey(owner: DashboardSnapshotIdentity): string {
  return JSON.stringify([owner.accountId, owner.token, owner.settingsKey]);
}

export function dashboardSnapshotGeneration(): number { return generation; }

export function invalidateDashboardSnapshot(): void {
  generation += 1;
  snapshot = null;
}

export function readDashboardSnapshot(owner: DashboardSnapshotIdentity, now = Date.now()): DashboardSnapshot | null {
  if (snapshot === null || snapshot.key !== dashboardSnapshotKey(owner)) return null;
  const age = now - snapshot.confirmedAt;
  if (age < 0 || age > DASHBOARD_SNAPSHOT_MAX_AGE_MS) { snapshot = null; return null; }
  return snapshot;
}

export function storeDashboardSnapshot(owner: DashboardSnapshotIdentity, dashboard: DashboardDto, expectedGeneration: number, now = Date.now()): boolean {
  if (generation !== expectedGeneration || dashboard.user.id !== owner.accountId) return false;
  snapshot = { key: dashboardSnapshotKey(owner), dashboard, confirmedAt: now };
  return true;
}
