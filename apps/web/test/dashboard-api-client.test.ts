import { afterEach, expect, it, vi } from "vitest";
import { getDashboard } from "../src/lib/api-client";

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
