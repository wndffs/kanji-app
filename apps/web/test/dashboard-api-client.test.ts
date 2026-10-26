import { afterEach, expect, it, vi } from "vitest";
import { apiRequest, getDashboard } from "../src/lib/api-client";
import { dashboardSnapshotGeneration } from "../src/lib/dashboard-snapshot";

afterEach(() => vi.unstubAllGlobals());

it("forwards cancellation to the dashboard GET without retrying or wrapping AbortError", async () => {
  const controller = new AbortController();
  const error = new DOMException("Aborted", "AbortError");
  const fetch = vi.fn().mockRejectedValue(error);
  vi.stubGlobal("fetch", fetch);
  await expect(getDashboard("fixture-token", controller.signal)).rejects.toBe(error);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({method:"GET", signal:controller.signal,cache:"no-store"});
});

it("invalidates only confirmed mutations, never reads or failed writes", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{}')));
  const before = dashboardSnapshotGeneration();
  await apiRequest('/fixture');
  expect(dashboardSnapshotGeneration()).toBe(before);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{}', {status:503})));
  await expect(apiRequest('/fixture',{method:'POST'})).rejects.toThrow();
  expect(dashboardSnapshotGeneration()).toBe(before);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{}')));
  await apiRequest('/fixture',{method:'POST'});
  expect(dashboardSnapshotGeneration()).toBe(before+1);
});
