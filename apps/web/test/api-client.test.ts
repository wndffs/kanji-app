import { describe, expect, it } from "vitest";

import { ApiError, apiRequest, createTextDeck, searchItems } from "../src/lib/api-client";

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

  it("creates text decks through the typed API client", async () => {
    let capturedInput: RequestInfo | URL | null = null;
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedInput = input;
      capturedInit = init;

      return new Response(
        JSON.stringify({
          deck: {
            id: "deck-1",
            title: "Text deck",
            description: "Dynamic text deck",
            status: "active",
            itemCount: 0,
            newItemCount: 0,
            translationDisplayMode: "ru-en",
            createdAt: "2026-06-24T09:00:00.000Z",
            updatedAt: "2026-06-24T09:00:00.000Z",
            items: [],
          },
          tokenization: {
            strategy: "dictionary-longest-match",
            candidateCount: 1,
            matchedItemCount: 0,
            unmatchedCandidateCount: 1,
            discardedOverlapCount: 0,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    };

    await expect(
      createTextDeck(
        "token-1",
        {
          title: "Text deck",
          text: "学校",
          maxItems: 10,
        },
        fetchImpl,
      ),
    ).resolves.toMatchObject({
      deck: {
        id: "deck-1",
      },
    });

    expect(capturedInput).toBe("http://localhost:3001/decks/from-text");
    expect(capturedInit?.method).toBe("POST");
    expect((capturedInit?.headers as Headers).get("Authorization")).toBe("Bearer token-1");
    expect(capturedInit?.body).toBe(
      JSON.stringify({ title: "Text deck", text: "学校", maxItems: 10 }),
    );
  });
  it("searches items through the typed API client", async () => {
    let capturedInput: RequestInfo | URL | null = null;
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedInput = input;
      capturedInit = init;

      return new Response(
        JSON.stringify({
          query: "school",
          items: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            hasNextPage: false,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    };

    await expect(searchItems("school", "token-1", fetchImpl)).resolves.toMatchObject({
      query: "school",
      items: [],
    });

    expect(capturedInput).toBe("http://localhost:3001/search?q=school");
    expect(capturedInit?.method).toBe("GET");
    expect((capturedInit?.headers as Headers).get("Authorization")).toBe("Bearer token-1");
  });
});
