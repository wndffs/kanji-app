import { describe, expect, it } from "vitest";

import { AppConfigService } from "../src/config/app-config.service";
import { HealthController } from "../src/health/health.controller";
import { HealthService } from "../src/health/health.service";

describe("HealthController", () => {
  it("returns a stable health response", () => {
    const controller = new HealthController(
      new HealthService(
        new AppConfigService({
          NODE_ENV: "test",
          AUTH_MODE: "dev",
        }),
      ),
    );

    expect(controller.getHealth()).toEqual({
      service: "kanji-srs-api",
      status: "ok",
      environment: "test",
      authMode: "dev",
      revision: null,
    });
  });

  it("reports only the provider's validated revision without exposing other environment data", () => {
    const revision = "abcdef0123456789abcdef0123456789abcdef01";
    const service = new HealthService(
      new AppConfigService({
        RENDER_GIT_COMMIT: revision.toUpperCase(),
        AUTH_TOKEN_SECRET: "private-token-secret",
      }),
    );
    expect(service.getHealth().revision).toBe(revision);
    expect(JSON.stringify(service.getHealth())).not.toContain("private-token-secret");
    expect(
      new HealthService(
        new AppConfigService({ RENDER_GIT_COMMIT: "private-token-secret" }),
      ).getHealth().revision,
    ).toBeNull();
  });
});
