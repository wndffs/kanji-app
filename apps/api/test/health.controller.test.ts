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
    });
  });
});
