import { afterEach, describe, expect, it, vi } from "vitest";

import { dynamic, GET } from "../src/app/api/health/route";

afterEach(() => vi.unstubAllEnvs());

describe("public deployment-aware web health", () => {
  it.each([undefined, "private-token-secret", "abc1234"])(
    "returns unknown rather than exposing invalid metadata %#",
    async (value) => {
      vi.stubEnv("VERCEL_GIT_COMMIT_SHA", value);
      const response = GET();
      expect(dynamic).toBe("force-dynamic");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual({ ok: true, service: "web", revision: null });
    },
  );

  it("reports the exact normalized provider revision", async () => {
    const revision = "abcdef0123456789abcdef0123456789abcdef01";
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", revision.toUpperCase());
    vi.stubEnv("AUTH_TOKEN_SECRET", "private-token-secret");
    expect(await GET().json()).toEqual({ ok: true, service: "web", revision });
  });
});
