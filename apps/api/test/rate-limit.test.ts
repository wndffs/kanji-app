import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { AuthController } from "../src/auth/auth.controller";
import { type AuthService } from "../src/auth/auth.service";
import { type CurrentUserDto } from "../src/auth/auth.types";
import {
  RATE_LIMIT_POLICIES,
  RateLimitService,
  type RequestRateLimitSource,
} from "../src/security/rate-limit.service";
import { ReviewsController } from "../src/reviews/reviews.controller";
import { type ReviewsService } from "../src/reviews/reviews.service";

describe("rate limiting", () => {
  it("limits login attempts by IP and email before calling auth service", async () => {
    const authService = {
      login: async () => {
        throw new Error("Auth service should not be called after the limit is exceeded.");
      },
    } as unknown as AuthService;
    const controller = new AuthController(authService, new RateLimitService());
    const request = createRequest("203.0.113.10");
    const body = { email: "learner@example.test", password: "wrong-password" };

    for (let index = 0; index < RATE_LIMIT_POLICIES["auth-login-email"].max; index += 1) {
      await expect(controller.login(request, body)).rejects.toThrow("Auth service should not");
    }

    await expect(controller.login(request, body)).rejects.toMatchObject({
      status: 429,
      message: "Too many requests.",
    });
  });

  it("limits registration attempts by IP", async () => {
    let registerCalls = 0;
    const authService = {
      register: async () => {
        registerCalls += 1;
        throw new Error("Registration service called.");
      },
    } as unknown as AuthService;
    const controller = new AuthController(authService, new RateLimitService());
    const request = createRequest("203.0.113.11");

    for (let index = 0; index < RATE_LIMIT_POLICIES["auth-register-ip"].max; index += 1) {
      await expect(controller.register(request, {})).rejects.toThrow(
        "Registration service called.",
      );
    }

    await expect(controller.register(request, {})).rejects.toMatchObject({
      status: 429,
      message: "Too many requests.",
    });
    expect(registerCalls).toBe(RATE_LIMIT_POLICIES["auth-register-ip"].max);
  });

  it("limits review answer submissions per user before calling review service", async () => {
    let submitCalls = 0;
    const reviewsService = {
      submitAnswer: async () => {
        submitCalls += 1;
        return { ok: true };
      },
    } as unknown as ReviewsService;
    const controller = new ReviewsController(reviewsService, new RateLimitService());
    const user = createUser("owner");

    for (let index = 0; index < RATE_LIMIT_POLICIES["review-answer-user"].max; index += 1) {
      await controller.submitAnswer("session-1", user, { cardId: "card-1" });
    }

    await expect(
      Promise.resolve(controller.submitAnswer("session-1", user, { cardId: "card-1" })),
    ).rejects.toMatchObject({
      status: 429,
      message: "Too many requests.",
    });
    expect(submitCalls).toBe(RATE_LIMIT_POLICIES["review-answer-user"].max);
  });

  it("raises a 429 HTTP exception at the policy boundary", () => {
    const limiter = new RateLimitService();

    for (let index = 0; index < RATE_LIMIT_POLICIES["auth-register-email"].max; index += 1) {
      limiter.assertAllowed("auth-register-email", "learner@example.test");
    }

    expect(() => limiter.assertAllowed("auth-register-email", "learner@example.test")).toThrow(
      HttpException,
    );
  });
});

function createRequest(ip: string): RequestRateLimitSource {
  return {
    headers: {
      "x-forwarded-for": ip,
    },
    ip,
    socket: {
      remoteAddress: ip,
    },
  };
}

function createUser(id: string): CurrentUserDto {
  return {
    id,
    email: `${id}@example.test`,
    displayName: id,
    role: "USER",
    settings: {
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
      dailyLessonLimit: 10,
      reviewBudget: 100,
      strictMode: false,
    },
  };
}
