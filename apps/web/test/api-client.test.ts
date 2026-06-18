import { describe, expect, it } from "vitest";

import { ApiError, apiRequest } from "../src/lib/api-client";

describe("apiRequest", () => {
  it("sends JSON requests with bearer tokens", async () => {
    let capturedInput: RequestInfo | URL | null = null;
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedInput = input;
      capturedInit = init;

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await expect(
      apiRequest<{ readonly ok: true }>("/dashboard", {
        token: "token-1",
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: true });

    expect(capturedInput).toBe("http://localhost:3001/dashboard");
    expect(capturedInit?.method).toBe("GET");
    expect(capturedInit?.headers).toBeInstanceOf(Headers);
    expect((capturedInit?.headers as Headers).get("Authorization")).toBe("Bearer token-1");
  });

  it("normalizes API error responses", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "Bad request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    await expect(apiRequest("/broken", { fetchImpl })).rejects.toEqual(
      new ApiError("Bad request", 400),
    );
  });
});
