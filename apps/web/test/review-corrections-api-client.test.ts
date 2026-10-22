import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, getActiveReviewSession, submitReviewCorrection } from "../src/lib/api-client";

afterEach(() => vi.unstubAllGlobals());

describe("resumable review API client", () => {
  it("loads the authenticated active session without a queue mutation", async () => {
    const response = { session: null, items: [], currentIndex: 0, corrections: [], progress: null };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getActiveReviewSession("token")).resolves.toEqual(response);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:3001/reviews/active");
    expect(request.method).toBe("GET");
    expect(request.headers.get("Authorization")).toBe("Bearer token");
  });

  it("uses the dedicated correction endpoint, never the scheduling-answer endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ corrected: true })));
    vi.stubGlobal("fetch", fetchMock);
    const request = { cardId: "card-1", answer: "солнце", answerType: "meaning" as const };
    await submitReviewCorrection("token", "session/1", request);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, input] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:3001/reviews/session%2F1/correction");
    expect(input.method).toBe("POST");
    expect(JSON.parse(input.body)).toEqual(request);
    expect(input.headers.get("Authorization")).toBe("Bearer token");
  });

  it("propagates failed correction writes without manufacturing a success", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: "Недоступно" }), { status: 503 }),
        ),
    );
    await expect(
      submitReviewCorrection("token", "session-1", {
        cardId: "card-1",
        answer: "x",
        answerType: "meaning",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
