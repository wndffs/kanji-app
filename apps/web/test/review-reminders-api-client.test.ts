import { afterEach, describe, expect, it, vi } from "vitest";
import { API_RESPONSE_CONFIRMED_EVENT, ApiError, claimReviewReminder } from "../src/lib/api-client";

afterEach(() => vi.unstubAllGlobals());

describe("claimReviewReminder", () => {
  it("posts an empty authenticated no-store body with AbortSignal and preserves confirmation events", async () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const confirmed = vi.fn();
    target.addEventListener(API_RESPONSE_CONFIRMED_EVENT, confirmed);
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe("{}");
      expect(init?.cache).toBe("no-store");
      expect(init?.signal).toBe(controller.signal);
      expect((init?.headers as Headers).get("Authorization")).toBe("Bearer secret");
      return new Response(JSON.stringify({ shouldNotify: true }));
    });
    await expect(
      claimReviewReminder("secret", { signal: controller.signal, fetchImpl }),
    ).resolves.toEqual({ shouldNotify: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      "http://localhost:3001/users/me/review-reminders/claim",
    );
    expect(confirmed).toHaveBeenCalledTimes(1);
    expect(confirmed.mock.calls[0]![0]).not.toHaveProperty("detail");
  });

  it.each([null, [], {}, { shouldNotify: "true" }, { shouldNotify: 1 }])(
    "rejects malformed response %j",
    async (body) => {
      await expect(
        claimReviewReminder("token", { fetchImpl: async () => new Response(JSON.stringify(body)) }),
      ).rejects.toThrow("подтвердить");
    },
  );

  it("returns false without treating it as a notification authorization", async () => {
    await expect(
      claimReviewReminder("token", {
        fetchImpl: async () => new Response('{"shouldNotify":false}'),
      }),
    ).resolves.toEqual({ shouldNotify: false });
  });

  it("preserves HTTP errors and never retries network failures or aborts", async () => {
    await expect(
      claimReviewReminder("token", {
        fetchImpl: async () => new Response('{"message":"Нет доступа"}', { status: 401 }),
      }),
    ).rejects.toBeInstanceOf(ApiError);
    for (const failure of [new TypeError("offline"), new DOMException("aborted", "AbortError")]) {
      const fetchImpl = vi.fn().mockRejectedValue(failure);
      await expect(claimReviewReminder("token", { fetchImpl })).rejects.toThrow();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
});
