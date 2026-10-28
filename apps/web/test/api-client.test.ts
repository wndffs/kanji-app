import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  API_RESPONSE_CONFIRMED_EVENT,
  apiRequest,
  applyAdminMainCourseEnrollmentRollout,
  applyAdminCourseAllocation,
  createTextDeck,
  enqueueAdminCandidatePlan,
  getAdminCandidatePlan,
  getAdminCourseAllocationPreview,
  getAdminCoursePlacements,
  getAdminImportedCandidateRejections,
  getAdminMainCoursePublicationReadiness,
  getAdminMainCourseEnrollmentRolloutPreview,
  getAdminPrerequisiteCandidates,
  getAdminReviewQueueWithFilters,
  getCharacterHub,
  getActiveLessonSession,
  getActiveReviewSession,
  getReviewQueue,
  getLessonQueue,
  getItemDetails,
  getKanjiDetails,
  getConfusablePairs,
  getPrivateMnemonics,
  publishAdminMainCourse,
  rejectAdminImportedCandidate,
  restoreAdminImportedCandidate,
  searchItems,
  updateDeckStatus,
  updateAdminCoursePlacements,
  updateAdminPrerequisites,
} from "../src/lib/api-client";

describe("apiRequest", () => {
  it("cancels both review reads without retries or changing bearer scope", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer review-token");
      return new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Cancelled", "AbortError")),
          { once: true },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const active = getActiveReviewSession("review-token", { signal: controller.signal });
      const queue = getReviewQueue("review-token", { signal: controller.signal });
      controller.abort();
      await expect(active).rejects.toHaveProperty("name", "AbortError");
      await expect(queue).rejects.toHaveProperty("name", "AbortError");
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        expect.stringContaining("/reviews/active"),
        expect.stringContaining("/reviews/queue"),
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("aborts active and queue lesson GETs without retrying and keeps encoded source/auth", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer lesson-token");
      return new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Cancelled", "AbortError")),
          { once: true },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const active = getActiveLessonSession("lesson-token", { signal: controller.signal });
      const queue = getLessonQueue("lesson-token", "deck/one", { signal: controller.signal });
      controller.abort();
      await expect(active).rejects.toHaveProperty("name", "AbortError");
      await expect(queue).rejects.toHaveProperty("name", "AbortError");
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        expect.stringContaining("/lessons/active"),
        expect.stringContaining("/lessons/queue?deckId=deck%2Fone"),
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("forwards cancellation to each material companion GET with unchanged auth and encoding", async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(signal);
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer material-token");
      return new Response(JSON.stringify({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await getItemDetails("item/one", "material-token", { signal });
      await getKanjiDetails("一", "material-token", { signal });
      await getPrivateMnemonics("material-token", "item/one", { signal });
      await getConfusablePairs("material-token", "item/one", { signal });
      expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
        expect.stringContaining("/items/item%2Fone"),
        expect.stringContaining("/kanji/%E4%B8%80"),
        expect.stringContaining("/items/item%2Fone/private-mnemonics"),
        expect.stringContaining("/confusables?itemId=item%2Fone"),
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("forwards catalogue cancellation without retrying or swallowing abort", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      expect(init?.method).toBe("GET");
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Cancelled", "AbortError")),
          { once: true },
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const pending = getCharacterHub("catalogue-token", controller.signal);
      controller.abort();
      await expect(pending).rejects.toHaveProperty("name", "AbortError");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("confirms reachability only after a successful response body, without exposing request data", async () => {
    const target = new EventTarget();
    const events: Event[] = [];
    target.addEventListener(API_RESPONSE_CONFIRMED_EVENT, (event) => events.push(event));
    vi.stubGlobal("window", target);
    try {
      await apiRequest("/dashboard", {
        token: "private-token",
        fetchImpl: async () => new Response(JSON.stringify({ private: "content" })),
      });
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe(API_RESPONSE_CONFIRMED_EVENT);
      expect(events[0]).not.toHaveProperty("detail");
      for (const response of [
        new Response(JSON.stringify({ message: "Сессия истекла" }), { status: 401 }),
        new Response(JSON.stringify({ message: "Ошибка сервера" }), { status: 503 }),
        new Response("invalid-json"),
      ]) {
        await expect(
          apiRequest("/dashboard", { fetchImpl: async () => response }),
        ).rejects.toThrow();
      }
      await expect(
        apiRequest("/dashboard", {
          fetchImpl: async () => {
            throw new TypeError("network");
          },
        }),
      ).rejects.toThrow("не подтверждён");
      expect(events).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

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
    expect(capturedInit?.cache).toBe("no-store");
    expect(capturedInit?.headers).toBeInstanceOf(Headers);
    expect((capturedInit?.headers as Headers).get("Authorization")).toBe("Bearer token-1");
  });

  it("does not cache writes or retry network failures", async () => {
    let calls = 0;
    const failure = new TypeError("Failed to fetch");
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls++;
      expect(init?.cache).toBe("no-store");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ answer: "солнце" }));
      expect((init?.headers as Headers).get("Content-Type")).toBe("application/json");
      throw failure;
    };
    await expect(
      apiRequest("/reviews/session/answer", {
        method: "POST",
        body: { answer: "солнце" },
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("Результат запроса не подтверждён"),
      cause: failure,
    });
    expect(calls).toBe(1);
  });

  it("preserves abort and other non-network rejection identities", async () => {
    for (const error of [new DOMException("Cancelled", "AbortError"), new Error("other")]) {
      const fetchImpl: typeof fetch = async () => {
        throw error;
      };
      await expect(apiRequest("/dashboard", { fetchImpl })).rejects.toBe(error);
    }
  });

  it("preserves unauthorized status and server feedback", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "Сессия истекла" }), { status: 401 });
    await expect(apiRequest("/dashboard", { fetchImpl })).rejects.toEqual(
      new ApiError("Сессия истекла", 401),
    );
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

  it("updates a deck status through the typed API client", async () => {
    let capturedInput: RequestInfo | URL | null = null;
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedInput = input;
      capturedInit = init;
      return new Response(JSON.stringify({ id: "deck-1", status: "archived", items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await expect(
      updateDeckStatus("token-1", "deck-1", { status: "archived" }, fetchImpl),
    ).resolves.toMatchObject({ id: "deck-1", status: "archived" });
    expect(capturedInput).toBe("http://localhost:3001/decks/deck-1/status");
    expect(capturedInit?.method).toBe("PATCH");
    expect(capturedInit?.body).toBe(JSON.stringify({ status: "archived" }));
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

    await expect(searchItems("school", "token-1", { fetchImpl })).resolves.toMatchObject({
      query: "school",
      items: [],
    });

    expect(capturedInput).toBe("http://localhost:3001/search?q=school");
    expect(capturedInit?.method).toBe("GET");
    expect((capturedInit?.headers as Headers).get("Authorization")).toBe("Bearer token-1");
  });

  it("enqueues an exact candidate-plan page through the typed API client", async () => {
    let capturedInput: RequestInfo | URL | null = null;
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedInput = input;
      capturedInit = init;

      return new Response(
        JSON.stringify({
          planVersion: "plan-version-one",
          requestedCount: 1,
          enqueuedCount: 1,
          alreadyQueuedCount: 0,
          items: [
            {
              learningItemId: "learning-item-one",
              targetId: "plan-kanji-one",
              itemType: "kanji",
              status: "needs-review",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const input = {
      planVersion: "plan-version-one",
      candidates: [{ itemType: "kanji" as const, targetId: "plan-kanji-one" }],
    };

    await expect(enqueueAdminCandidatePlan("token-1", input, fetchImpl)).resolves.toMatchObject({
      enqueuedCount: 1,
      alreadyQueuedCount: 0,
    });
    expect(capturedInput).toBe("http://localhost:3001/admin/curriculum/candidate-plan/enqueue");
    expect(capturedInit?.method).toBe("POST");
    expect((capturedInit?.headers as Headers).get("Authorization")).toBe("Bearer token-1");
    expect(capturedInit?.body).toBe(JSON.stringify(input));
  });

  it("requests a bounded admin review-queue cursor page", async () => {
    let capturedInput: RequestInfo | URL | null = null;
    const fetchImpl: typeof fetch = async (input) => {
      capturedInput = input;
      return new Response(
        JSON.stringify({ items: [], pagination: { limit: 20, nextCursor: null } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    await expect(
      getAdminReviewQueueWithFilters(
        "token-1",
        { status: "needs-review", cursor: "next-page", limit: 20 },
        fetchImpl,
      ),
    ).resolves.toEqual({ items: [], pagination: { limit: 20, nextCursor: null } });
    expect(capturedInput).toBe(
      "http://localhost:3001/admin/items/review-queue?status=needs-review&cursor=next-page&limit=20",
    );
  });

  it("encodes stable candidate-plan search and coverage filters", async () => {
    let capturedInput: RequestInfo | URL | null = null;
    const fetchImpl: typeof fetch = async (input) => {
      capturedInput = input;
      return Response.json({
        planVersion: "plan-version-one",
        generatedAt: "2026-07-14T08:00:00.000Z",
        summary: {},
        page: {
          itemType: "kanji",
          search: "イチ",
          band: "n5",
          coverage: "missing-russian",
          offset: 0,
          limit: 20,
          total: 1,
          hasMore: false,
        },
        candidates: [],
      });
    };

    await getAdminCandidatePlan(
      "token-1",
      {
        itemType: "kanji",
        offset: 0,
        limit: 20,
        planVersion: "plan-version-one",
        search: "イチ",
        band: "n5",
        coverage: "missing-russian",
      },
      fetchImpl,
    );

    expect(capturedInput).toBe(
      "http://localhost:3001/admin/curriculum/candidate-plan?itemType=kanji&offset=0&limit=20&planVersion=plan-version-one&search=%E3%82%A4%E3%83%81&band=n5&coverage=missing-russian",
    );
  });

  it("lists, rejects, and restores imported candidates through typed admin routes", async () => {
    const requests: { readonly input: string; readonly init: RequestInit | undefined }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ input: String(input), init });

      if (init?.method === "PUT") {
        return Response.json({
          id: "rejection-1",
          targetType: "word",
          targetId: "word/one",
          reason: "data-quality",
          note: "Broken source row.",
          rejectedByUserId: "admin-1",
          createdAt: "2026-07-14T08:00:00.000Z",
          updatedAt: "2026-07-14T08:00:00.000Z",
        });
      }

      if (init?.method === "DELETE") {
        return Response.json({ targetType: "word", targetId: "word/one", restored: true });
      }

      return Response.json({ rejections: [] });
    };
    const rejectionInput = { reason: "data-quality" as const, note: "Broken source row." };

    await expect(getAdminImportedCandidateRejections("token-1", fetchImpl)).resolves.toEqual({
      rejections: [],
    });
    await expect(
      rejectAdminImportedCandidate("token-1", "word", "word/one", rejectionInput, fetchImpl),
    ).resolves.toMatchObject({ reason: "data-quality", note: "Broken source row." });
    await expect(
      restoreAdminImportedCandidate("token-1", "word", "word/one", fetchImpl),
    ).resolves.toEqual({ targetType: "word", targetId: "word/one", restored: true });

    expect(requests.map((request) => [request.input, request.init?.method ?? "GET"])).toEqual([
      ["http://localhost:3001/admin/imported-candidates/rejections", "GET"],
      ["http://localhost:3001/admin/imported-candidates/word/word%2Fone/rejection", "PUT"],
      ["http://localhost:3001/admin/imported-candidates/word/word%2Fone/rejection", "DELETE"],
    ]);
    expect(requests[1]?.init?.body).toBe(JSON.stringify(rejectionInput));
  });

  it("loads and replaces prerequisites through encoded admin item routes", async () => {
    const requests: { readonly input: string; readonly init: RequestInit | undefined }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ input: String(input), init });

      return Response.json(
        init?.method === "PUT"
          ? { id: "item/one", dependencies: [] }
          : { itemId: "item/one", candidates: [] },
      );
    };
    const request = {
      prerequisites: [{ prerequisiteItemId: "component-1", requiredStage: 2 }],
    };

    await expect(getAdminPrerequisiteCandidates("token-1", "item/one", fetchImpl)).resolves.toEqual(
      { itemId: "item/one", candidates: [] },
    );
    await updateAdminPrerequisites("token-1", "item/one", request, fetchImpl);

    expect(requests.map(({ input, init }) => [input, init?.method ?? "GET"])).toEqual([
      ["http://localhost:3001/admin/items/item%2Fone/prerequisite-candidates", "GET"],
      ["http://localhost:3001/admin/items/item%2Fone/prerequisites", "PUT"],
    ]);
    expect(requests[1]?.init?.body).toBe(JSON.stringify(request));
  });

  it("loads and replaces course placements through encoded admin item routes", async () => {
    const requests: { readonly input: string; readonly init: RequestInit | undefined }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({ input: String(input), init });
      return Response.json({ itemId: "item/one", levels: [] });
    };
    const request = { courseLevelIds: ["level-2"] };

    await expect(getAdminCoursePlacements("token-1", "item/one", fetchImpl)).resolves.toEqual({
      itemId: "item/one",
      levels: [],
    });
    await updateAdminCoursePlacements("token-1", "item/one", request, fetchImpl);

    expect(requests.map(({ input, init }) => [input, init?.method ?? "GET"])).toEqual([
      ["http://localhost:3001/admin/items/item%2Fone/course-placements", "GET"],
      ["http://localhost:3001/admin/items/item%2Fone/course-placements", "PUT"],
    ]);
    expect(requests[1]?.init?.body).toBe(JSON.stringify(request));
  });

  it("loads the read-only main-course allocation preview", async () => {
    let capturedInput = "";
    let capturedMethod = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedInput = String(input);
      capturedMethod = init?.method ?? "GET";
      return Response.json({
        policyVersion: "balanced-prerequisite-levels-v1",
        course: { slug: "japanese-ru-n2" },
      });
    };

    await expect(getAdminCourseAllocationPreview("token-1", fetchImpl)).resolves.toMatchObject({
      policyVersion: "balanced-prerequisite-levels-v1",
      course: { slug: "japanese-ru-n2" },
    });
    expect(capturedInput).toBe(
      "http://localhost:3001/admin/curriculum/main-course/allocation-preview",
    );
    expect(capturedMethod).toBe("GET");
  });

  it("posts the confirmed main-course allocation version", async () => {
    let capturedInput = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedInput = String(input);
      capturedInit = init;
      return Response.json({
        appliedPlanVersion: "course-allocation:test-plan",
        createdPlacements: 2,
      });
    };
    const request = { planVersion: "course-allocation:test-plan" };

    await applyAdminCourseAllocation("token-1", request, fetchImpl);

    expect(capturedInput).toBe("http://localhost:3001/admin/curriculum/main-course/allocation");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.body).toBe(JSON.stringify(request));
  });

  it("loads the main-course publication readiness audit", async () => {
    let capturedInput = "";
    const fetchImpl: typeof fetch = async (input) => {
      capturedInput = String(input);
      return Response.json({
        policyVersion: "main-course-publication-readiness-v1",
        readyToPublish: false,
      });
    };

    await expect(
      getAdminMainCoursePublicationReadiness("token-1", fetchImpl),
    ).resolves.toMatchObject({
      policyVersion: "main-course-publication-readiness-v1",
      readyToPublish: false,
    });
    expect(capturedInput).toBe(
      "http://localhost:3001/admin/curriculum/main-course/publication-readiness",
    );
  });

  it("posts the confirmed main-course readiness version for publication", async () => {
    let capturedInput = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedInput = String(input);
      capturedInit = init;
      return Response.json({
        appliedReadinessVersion: "main-course-readiness:test",
        statusChanged: true,
      });
    };
    const request = { readinessVersion: "main-course-readiness:test" };

    await publishAdminMainCourse("token-1", request, fetchImpl);

    expect(capturedInput).toBe("http://localhost:3001/admin/curriculum/main-course/publication");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.body).toBe(JSON.stringify(request));
  });

  it("loads the read-only main-course enrollment rollout preview", async () => {
    let capturedInput = "";
    const fetchImpl: typeof fetch = async (input) => {
      capturedInput = String(input);
      return Response.json({
        policyVersion: "main-course-enrollment-rollout-v1",
        strategy: "add-only",
        readyToApply: false,
      });
    };

    await expect(
      getAdminMainCourseEnrollmentRolloutPreview("token-1", fetchImpl),
    ).resolves.toMatchObject({
      policyVersion: "main-course-enrollment-rollout-v1",
      strategy: "add-only",
    });
    expect(capturedInput).toBe(
      "http://localhost:3001/admin/curriculum/main-course/enrollment-rollout-preview",
    );
  });

  it("posts the confirmed enrollment rollout version", async () => {
    let capturedInput = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedInput = String(input);
      capturedInit = init;
      return Response.json({
        appliedRolloutVersion: "main-course-enrollment-rollout:test",
        createdEnrollments: 2,
      });
    };
    const request = { rolloutVersion: "main-course-enrollment-rollout:test" };

    await applyAdminMainCourseEnrollmentRollout("token-1", request, fetchImpl);

    expect(capturedInput).toBe(
      "http://localhost:3001/admin/curriculum/main-course/enrollment-rollout",
    );
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.body).toBe(JSON.stringify(request));
  });
});
