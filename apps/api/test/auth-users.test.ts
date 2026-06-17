import { describe, expect, it } from "vitest";

import { AuthService } from "../src/auth/auth.service";
import { AppConfigService } from "../src/config/app-config.service";
import { UsersController } from "../src/users/users.controller";

describe("AuthService", () => {
  it("returns a dev login response without touching the database", () => {
    const service = new AuthService(
      new AppConfigService({
        NODE_ENV: "test",
        DEV_TRANSLATION_DISPLAY_MODE: "en",
      }),
    );

    expect(
      service.login({
        email: "learner@example.test",
        displayName: "Learner",
      }),
    ).toMatchObject({
      tokenType: "dev",
      user: {
        email: "learner@example.test",
        displayName: "Learner",
        translationDisplayMode: "en",
      },
    });
  });

  it("backs /users/me with the current auth skeleton", () => {
    const service = new AuthService(new AppConfigService({ NODE_ENV: "test" }));
    const controller = new UsersController(service);

    expect(
      controller.getCurrentUser({
        "x-dev-user-email": "header@example.test",
        "x-dev-user-name": "Header User",
      }),
    ).toMatchObject({
      email: "header@example.test",
      displayName: "Header User",
      locale: "ru-RU",
      translationDisplayMode: "ru",
    });
  });
});
