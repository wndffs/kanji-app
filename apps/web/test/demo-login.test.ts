import { describe, expect, it } from "vitest";

import { resolveDemoLoginPrefill } from "../src/lib/demo-login";

describe("resolveDemoLoginPrefill", () => {
  it("disables demo login prefill in production", () => {
    expect(
      resolveDemoLoginPrefill({
        NODE_ENV: "production",
        NEXT_PUBLIC_ENABLE_DEMO_LOGIN: "true",
        NEXT_PUBLIC_DEV_AUTH_EMAIL: "demo@example.local",
        NEXT_PUBLIC_DEV_AUTH_PASSWORD: "dev-password",
      }),
    ).toEqual({ email: "", password: "" });
  });

  it("requires an explicit non-production flag", () => {
    expect(
      resolveDemoLoginPrefill({
        NODE_ENV: "development",
        NEXT_PUBLIC_DEV_AUTH_EMAIL: "demo@example.local",
        NEXT_PUBLIC_DEV_AUTH_PASSWORD: "dev-password",
      }),
    ).toEqual({ email: "", password: "" });
  });

  it("prefills explicitly configured non-production credentials", () => {
    expect(
      resolveDemoLoginPrefill({
        NODE_ENV: "development",
        NEXT_PUBLIC_ENABLE_DEMO_LOGIN: "true",
        NEXT_PUBLIC_DEV_AUTH_EMAIL: "demo@example.local",
        NEXT_PUBLIC_DEV_AUTH_PASSWORD: "dev-password",
      }),
    ).toEqual({ email: "demo@example.local", password: "dev-password" });
  });
});
