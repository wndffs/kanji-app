import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const origin = "https://app.example.test";
const cacheName = "kanji-srs-public-offline-v1";
type WorkerRequest = {
  url: string;
  method: string;
  mode: string;
  headers: Headers;
};

function request(path: string, options: Partial<WorkerRequest> = {}): WorkerRequest {
  return {
    url: new URL(path, origin).href,
    method: "GET",
    mode: "navigate",
    headers: new Headers(),
    ...options,
  };
}

function harness() {
  const handlers = new Map<string, (event: unknown) => void>();
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi
      .fn()
      .mockResolvedValue(["unrelated-private-cache", "kanji-srs-public-offline-v0", cacheName]),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn().mockResolvedValue(new Response("PUBLIC_OFFLINE")),
  };
  const fetch = vi.fn().mockResolvedValue(new Response("FRESH_SERVER"));
  const claim = vi.fn().mockResolvedValue(undefined);
  const skipWaiting = vi.fn();
  runInNewContext(worker, {
    self: {
      location: { origin },
      clients: { claim },
      skipWaiting,
      addEventListener: (type: string, listener: (event: unknown) => void) =>
        handlers.set(type, listener),
    },
    caches,
    fetch,
    Request,
    Response,
    URL,
  });
  async function lifecycle(type: "install" | "activate") {
    let pending: Promise<unknown> | undefined;
    handlers.get(type)!({
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    expect(pending).toBeDefined();
    await pending;
  }
  function intercept(incoming: WorkerRequest): Promise<Response> | undefined {
    let pending: Promise<Response> | undefined;
    handlers.get("fetch")!({
      request: incoming,
      respondWith: (promise: Promise<Response>) => {
        pending = promise;
      },
    });
    return pending;
  }
  return { cache, caches, fetch, claim, skipWaiting, lifecycle, intercept, handlers };
}

describe("public-only offline worker", () => {
  it("precaches exactly two credential-free public resources and has no background handlers", async () => {
    const h = harness();
    await h.lifecycle("install");
    expect([...h.handlers.keys()]).toEqual(["install", "activate", "fetch"]);
    expect(h.caches.open).toHaveBeenCalledExactlyOnceWith(cacheName);
    expect(h.cache.addAll).toHaveBeenCalledTimes(1);
    const resources = h.cache.addAll.mock.calls[0][0] as Request[];
    expect(resources.map(({ url }) => url)).toEqual([
      `${origin}/offline.html`,
      `${origin}/icons/app-192.png`,
    ]);
    for (const resource of resources) {
      expect(resource.credentials).toBe("omit");
      expect(resource.cache).toBe("no-store");
      expect(resource.redirect).toBe("error");
      expect(resource.referrerPolicy).toBe("no-referrer");
      expect([...resource.headers]).toEqual([]);
    }
    expect(h.cache.put).not.toHaveBeenCalled();
    expect(h.skipWaiting).not.toHaveBeenCalled();
  });

  it("rejects a failed precache installation instead of reporting success", async () => {
    const h = harness();
    h.cache.addAll.mockRejectedValueOnce(new Error("install unavailable"));
    await expect(h.lifecycle("install")).rejects.toThrow("install unavailable");
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.skipWaiting).not.toHaveBeenCalled();
  });

  it("removes only obsolete owned public caches and then claims clients", async () => {
    const h = harness();
    await h.lifecycle("activate");
    expect(h.caches.delete).toHaveBeenCalledExactlyOnceWith("kanji-srs-public-offline-v0");
    expect(h.claim).toHaveBeenCalledTimes(1);
  });

  it.each([
    request("/api/health"),
    request("/api/reviews/answer", { method: "POST" }),
    request("/reviews", { method: "POST" }),
    request("/reviews/queue", { mode: "cors" }),
    request("/dashboard", { mode: "cors" }),
    request("https://api.example.test/dashboard"),
    request("/unknown"),
    request("/_next/static/chunks/private.js", { mode: "cors" }),
    request("/kanji/日"),
    request("/offline.html?token=private", { mode: "cors" }),
    request("/icons/app-192.png?token=private", { mode: "cors" }),
    request("/dashboard", { headers: new Headers({ Authorization: "Bearer private" }) }),
    request("/offline.html", { headers: new Headers({ Authorization: "Bearer private" }) }),
    request("/dashboard?_rsc=private"),
    ...[
      "RSC",
      "Next-Router-Prefetch",
      "Next-Router-Segment-Prefetch",
      "Next-Router-State-Tree",
      "X-Middleware-Prefetch",
    ].map((header) => request("/dashboard", { headers: new Headers({ [header]: "1" }) })),
    request("/dashboard", { headers: new Headers({ Accept: "text/x-component" }) }),
    request("/dashboard", { headers: new Headers({ Purpose: "prefetch" }) }),
    request("/dashboard", { headers: new Headers({ "Sec-Purpose": "prefetch" }) }),
  ])("leaves private/API/non-navigation/prefetch traffic untouched: $url", (incoming) => {
    const h = harness();
    expect(h.intercept(incoming)).toBeUndefined();
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.caches.match).not.toHaveBeenCalled();
    expect(h.caches.open).not.toHaveBeenCalled();
    expect(h.cache.addAll).not.toHaveBeenCalled();
    expect(h.cache.put).not.toHaveBeenCalled();
  });

  it.each(["/dashboard", "/items/00000000-0000-4000-8000-000000000001", "/kana?script=katakana"])(
    "always uses fresh network HTML for allowed navigation %s",
    async (path) => {
      const h = harness();
      const incoming = request(path);
      expect(await (await h.intercept(incoming))!.text()).toBe("FRESH_SERVER");
      expect(h.fetch).toHaveBeenCalledExactlyOnceWith(incoming, { cache: "no-store" });
      expect(h.caches.match).not.toHaveBeenCalled();
      expect(h.cache.put).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403, 404, 500, 503])(
    "passes HTTP %s through rather than hiding it behind an offline page",
    async (status) => {
      const h = harness();
      h.fetch.mockResolvedValueOnce(new Response("SERVER_ERROR", { status }));
      expect((await h.intercept(request("/dashboard")))!.status).toBe(status);
      expect(h.caches.match).not.toHaveBeenCalled();
    },
  );

  it("uses only the constant public fallback after actual navigation rejection, with no retry/cache writes", async () => {
    const h = harness();
    h.fetch.mockRejectedValueOnce(new TypeError("offline"));
    expect(await (await h.intercept(request("/dashboard?private=secret")))!.text()).toBe(
      "PUBLIC_OFFLINE",
    );
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.caches.match).toHaveBeenCalledExactlyOnceWith(`${origin}/offline.html`, { cacheName });
    expect(h.caches.open).not.toHaveBeenCalled();
    expect(h.cache.addAll).not.toHaveBeenCalled();
    expect(h.cache.put).not.toHaveBeenCalled();
  });

  it.each(["missing", "unavailable"])(
    "returns a network error when fallback storage is %s",
    async (condition) => {
      const h = harness();
      h.fetch.mockRejectedValueOnce(new TypeError("offline"));
      if (condition === "missing") h.caches.match.mockResolvedValueOnce(undefined);
      else h.caches.match.mockRejectedValueOnce(new Error("storage denied"));
      const response = await h.intercept(request("/dashboard"));
      expect(response!.type).toBe("error");
      expect(response!.status).toBe(0);
    },
  );

  it.each(["/offline.html", "/icons/app-192.png"])(
    "serves only the explicitly cached public resource %s",
    async (path) => {
      const h = harness();
      const incoming = request(path, { mode: "cors" });
      expect(await (await h.intercept(incoming))!.text()).toBe("PUBLIC_OFFLINE");
      expect(h.caches.match).toHaveBeenCalledExactlyOnceWith(incoming, { cacheName });
      expect(h.fetch).not.toHaveBeenCalled();
      h.caches.match.mockResolvedValueOnce(undefined);
      expect(await (await h.intercept(incoming))!.text()).toBe("FRESH_SERVER");
      expect(h.fetch).toHaveBeenCalledExactlyOnceWith(incoming);
      expect(h.cache.put).not.toHaveBeenCalled();
    },
  );

  it("keeps the fallback small and inert, without user storage, forms, external resources or app scripts", () => {
    const html = readFileSync(new URL("../public/offline.html", import.meta.url), "utf8");
    expect(html.length).toBeLessThan(8192);
    expect(html).toContain("Нет соединения");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('<a href="">Повторить подключение</a>');
    expect(html).toContain('src="/icons/app-192.png"');
    expect(html).not.toMatch(/<script|<form|localStorage|indexedDB|https?:|\/_next\/|\/api\//iu);
  });
});
