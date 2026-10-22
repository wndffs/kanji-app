/* global self, caches */
"use strict";

const CACHE_PREFIX = "kanji-srs-public-offline-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const PUBLIC_PATHS = ["/offline.html", "/icons/app-192.png"];
const NAVIGATION_PATHS = new Set([
  "/",
  "/dashboard",
  "/lessons",
  "/reviews",
  "/characters",
  "/kana",
  "/search",
  "/settings",
  "/courses",
  "/decks",
  "/practice",
  "/practice/confusables",
  "/login",
  "/register",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(
        PUBLIC_PATHS.map(
          (path) =>
            new Request(new URL(path, self.location.origin), {
              credentials: "omit",
              cache: "no-store",
              redirect: "error",
              referrerPolicy: "no-referrer",
            }),
        ),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("Authorization")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.username || url.password) return;
  if (
    [
      "RSC",
      "Next-Router-Prefetch",
      "Next-Router-Segment-Prefetch",
      "Next-Router-State-Tree",
      "X-Middleware-Prefetch",
    ].some((header) => request.headers.has(header)) ||
    request.headers.get("Accept")?.toLowerCase().includes("text/x-component") ||
    ["Purpose", "Sec-Purpose"].some((header) =>
      request.headers.get(header)?.toLowerCase().includes("prefetch"),
    ) ||
    url.searchParams.has("_rsc")
  )
    return;

  if (
    PUBLIC_PATHS.includes(url.pathname) &&
    url.href === new URL(url.pathname, self.location.origin).href
  ) {
    event.respondWith(
      (async () => {
        try {
          return (await caches.match(request, { cacheName: CACHE_NAME })) ?? (await fetch(request));
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }

  const knownNavigation =
    NAVIGATION_PATHS.has(url.pathname) ||
    /^\/items\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(url.pathname);
  if (request.mode !== "navigate" || !knownNavigation) return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(request, { cache: "no-store" });
      } catch {
        try {
          return (
            (await caches.match(new URL("/offline.html", self.location.origin).href, {
              cacheName: CACHE_NAME,
            })) ?? Response.error()
          );
        } catch {
          return Response.error();
        }
      }
    })(),
  );
});
