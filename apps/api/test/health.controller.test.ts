import { describe, expect, it } from "vitest";

import { HealthController } from "../src/health.controller";

describe("HealthController", () => {
  it("returns a stable health response", () => {
    expect(new HealthController().getHealth()).toEqual({
      service: "kanji-srs-api",
      status: "ok",
    });
  });
});
