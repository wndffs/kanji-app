import { type ExecutionContext } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_DASHBOARD_WIDGET_PREFERENCES } from "@kanji-srs/shared";

import { AdminGuard } from "../src/auth/admin.guard";
import { AuthGuard } from "../src/auth/auth.guard";
import { AuthService } from "../src/auth/auth.service";
import {
  type CreateUserInput,
  type RequestWithCurrentUser,
  type StoredUser,
  type UserSettingsDto,
} from "../src/auth/auth.types";
import { PasswordService } from "../src/auth/password.service";
import { TokenService } from "../src/auth/token.service";
import { mergeUserSettings } from "../src/auth/user-settings.defaults";
import { PrismaUsersRepository, UsersRepository } from "../src/auth/users.repository";
import { AppConfigService } from "../src/config/app-config.service";
import { UsersController } from "../src/users/users.controller";

describe("Auth and users", () => {
  it("registers a user with hashed password and default USER role", async () => {
    const { authService, repository } = createAuthHarness();

    const session = await authService.register({
      email: "Learner@Example.Test",
      password: "correct-password",
      displayName: " Learner ",
      settings: {
        translationDisplayMode: "ru-en",
        timezone: "Europe/Moscow",
      },
    });

    const storedUser = await repository.findByEmail("learner@example.test");

    expect(session).toMatchObject({
      tokenType: "Bearer",
      user: {
        email: "learner@example.test",
        displayName: "Learner",
        role: "USER",
        settings: {
          locale: "ru-RU",
          translationDisplayMode: "ru-en",
          timezone: "Europe/Moscow",
        },
      },
    });
    expect(session.accessToken).toContain(".");
    expect(storedUser?.passwordHash).toMatch(/^scrypt\$v1\$/);
    expect(storedUser?.passwordHash).not.toContain("correct-password");
    expect(repository.defaultCourseEnrollmentUserIds).toEqual(["user-1"]);
  });

  it("rejects duplicate registration by normalized email", async () => {
    const { authService } = createAuthHarness();

    await authService.register({
      email: "learner@example.test",
      password: "correct-password",
    });

    await expect(
      authService.register({
        email: "LEARNER@example.test",
        password: "correct-password",
      }),
    ).rejects.toThrow("Email is already registered.");
  });

  it("logs in with a valid password and rejects invalid credentials", async () => {
    const { authService } = createAuthHarness();

    await authService.register({
      email: "learner@example.test",
      password: "correct-password",
    });

    await expect(
      authService.login({
        email: "learner@example.test",
        password: "correct-password",
      }),
    ).resolves.toMatchObject({
      tokenType: "Bearer",
      user: {
        email: "learner@example.test",
      },
    });

    await expect(
      authService.login({
        email: "learner@example.test",
        password: "wrong-password",
      }),
    ).rejects.toThrow("Invalid email or password.");
  });

  it("rejects oversized passwords before hashing or verification", async () => {
    const { authService } = createAuthHarness();
    const oversizedPassword = "a".repeat(257);

    await expect(
      authService.register({
        email: "learner@example.test",
        password: oversizedPassword,
      }),
    ).rejects.toThrow("password must be at most 256 characters.");
    await expect(
      authService.login({
        email: "learner@example.test",
        password: oversizedPassword,
      }),
    ).rejects.toThrow("password must be at most 256 characters.");
  });

  it("protects the current user endpoint with bearer auth", async () => {
    const { authGuard, authService } = createAuthHarness();
    const usersController = new UsersController(authService);
    const session = await authService.register({
      email: "learner@example.test",
      password: "correct-password",
    });
    const { context, request } = createHttpContext({
      authorization: `Bearer ${session.accessToken}`,
    });

    await expect(authGuard.canActivate(context)).resolves.toBe(true);

    expect(usersController.getCurrentUser(requireCurrentUser(request))).toMatchObject({
      email: "learner@example.test",
      role: "USER",
    });
  });

  it("rejects bearer tokens with extra segments", async () => {
    const { authGuard, authService } = createAuthHarness();
    const session = await authService.register({
      email: "learner@example.test",
      password: "correct-password",
    });
    const { context } = createHttpContext({
      authorization: `Bearer ${session.accessToken}.extra`,
    });

    await expect(authGuard.canActivate(context)).rejects.toThrow("Invalid token.");
  });

  it("updates user settings after bearer auth", async () => {
    const { authGuard, authService } = createAuthHarness();
    const usersController = new UsersController(authService);
    const session = await authService.register({
      email: "learner@example.test",
      password: "correct-password",
    });
    const { context, request } = createHttpContext({
      authorization: `Bearer ${session.accessToken}`,
    });

    await authGuard.canActivate(context);
    const dashboardWidgets = [...DEFAULT_DASHBOARD_WIDGET_PREFERENCES]
      .reverse()
      .map((widget, index) => ({
        ...widget,
        visible: index !== 0,
        presentation: index === 1 ? ("expanded" as const) : widget.presentation,
      }));

    await expect(
      usersController.updateSettings(requireCurrentUser(request), {
        translationDisplayMode: "en",
        timezone: "Asia/Tokyo",
        dailyLessonLimit: 12,
        lessonBatchSize: 3,
        lessonOrderMode: "interleaved",
        reviewBudget: 80,
        strictMode: true,
        dashboardWidgets,
      }),
    ).resolves.toMatchObject({
      settings: {
        translationDisplayMode: "en",
        timezone: "Asia/Tokyo",
        dailyLessonLimit: 12,
        lessonBatchSize: 3,
        lessonOrderMode: "interleaved",
        reviewBudget: 80,
        strictMode: true,
        dashboardWidgets,
      },
    });
  });

  it("rejects incomplete or duplicate dashboard widget settings", async () => {
    const { authService } = createAuthHarness();
    const usersController = new UsersController(authService);
    const session = await authService.register({
      email: "learner@example.test",
      password: "correct-password",
    });

    await expect(
      usersController.updateSettings(session.user, {
        dashboardWidgets: [
          { id: "summary", visible: true, presentation: "expanded" },
          { id: "summary", visible: false, presentation: "compact" },
        ],
      }),
    ).rejects.toThrow("dashboardWidgets must contain every dashboard widget exactly once.");

    const duplicateWidgets = DEFAULT_DASHBOARD_WIDGET_PREFERENCES.map((widget, index) =>
      index === DEFAULT_DASHBOARD_WIDGET_PREFERENCES.length - 1
        ? { ...DEFAULT_DASHBOARD_WIDGET_PREFERENCES[0] }
        : widget,
    );

    await expect(
      usersController.updateSettings(session.user, {
        dashboardWidgets: duplicateWidgets,
      }),
    ).rejects.toThrow("dashboardWidgets contains an invalid widget.");
  });

  it("rejects invalid lesson pacing preferences", async () => {
    const { authService } = createAuthHarness();
    const usersController = new UsersController(authService);
    const session = await authService.register({
      email: "learner@example.test",
      password: "correct-password",
    });

    await expect(
      usersController.updateSettings(session.user, { lessonBatchSize: 6 }),
    ).rejects.toThrow("lessonBatchSize must be an integer between 1 and 5.");
    await expect(
      usersController.updateSettings(session.user, { lessonOrderMode: "random" }),
    ).rejects.toThrow("lessonOrderMode must be course or interleaved.");
  });

  it("rejects a normal user from admin guarded endpoints", async () => {
    const { adminGuard, authService } = createAuthHarness();
    const session = await authService.register({
      email: "learner@example.test",
      password: "correct-password",
    });
    const { context } = createHttpContext({
      authorization: `Bearer ${session.accessToken}`,
    });

    await expect(adminGuard.canActivate(context)).rejects.toThrow("Admin role is required.");
  });

  it("treats malformed stored password hashes as invalid credentials", async () => {
    const passwordService = new PasswordService();

    await expect(
      passwordService.verifyPassword("correct-password", "scrypt$v1$bad$8$1$salt$key"),
    ).resolves.toBe(false);
  });
});

describe("PrismaUsersRepository", () => {
  it("persists and restores structured user preferences", async () => {
    const dashboardWidgets = [...DEFAULT_DASHBOARD_WIDGET_PREFERENCES].reverse();
    const update = vi.fn().mockResolvedValue({
      id: "user-1",
      email: "learner@example.test",
      passwordHash: "hash",
      displayName: "Learner",
      role: "USER",
      settings: {
        locale: "ru-RU",
        translationDisplayMode: "ru-en",
        timezone: "Europe/Moscow",
        dailyLessonLimit: 10,
        lessonBatchSize: 3,
        lessonOrderMode: "interleaved",
        reviewBudget: 100,
        strictMode: false,
        dashboardWidgets,
      },
    });
    const repository = new PrismaUsersRepository({
      db: { user: { update } },
    } as never);

    const stored = await repository.updateSettings("user-1", {
      dashboardWidgets,
      lessonBatchSize: 3,
      lessonOrderMode: "interleaved",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          settings: {
            upsert: expect.objectContaining({
              update: {
                dashboardWidgets,
                lessonBatchSize: 3,
                lessonOrderMode: "interleaved",
              },
            }),
          },
        },
      }),
    );
    expect(stored.settings.dashboardWidgets).toEqual(dashboardWidgets);
    expect(stored.settings).toMatchObject({
      lessonBatchSize: 3,
      lessonOrderMode: "interleaved",
    });
  });

  it("enrolls a new learner in the starter and published main course atomically", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "course-main", slug: "japanese-ru-n2" },
      { id: "course-starter", slug: "starter-demo" },
    ]);
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const transactionDatabase = {
      course: { findMany },
      userEnrollment: { createMany },
    };
    const transaction = vi.fn(
      async (callback: (database: typeof transactionDatabase) => Promise<void>) =>
        callback(transactionDatabase),
    );
    const repository = new PrismaUsersRepository({ db: { $transaction: transaction } } as never);

    await repository.enrollInDefaultCourses("user-1");

    expect(findMany).toHaveBeenCalledWith({
      where: {
        slug: { in: ["starter-demo", "japanese-ru-n2"] },
        status: "PUBLISHED",
      },
      select: { id: true, slug: true },
      orderBy: { slug: "asc" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", courseId: "course-main", status: "ACTIVE" },
        { userId: "user-1", courseId: "course-starter", status: "ACTIVE" },
      ],
      skipDuplicates: true,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("keeps starter enrollment working when the main course is unavailable", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const transactionDatabase = {
      course: {
        findMany: vi.fn().mockResolvedValue([{ id: "course-starter", slug: "starter-demo" }]),
      },
      userEnrollment: { createMany },
    };
    const repository = new PrismaUsersRepository({
      db: {
        $transaction: async (callback: (database: typeof transactionDatabase) => Promise<void>) =>
          callback(transactionDatabase),
      },
    } as never);

    await repository.enrollInDefaultCourses("user-1");

    expect(createMany).toHaveBeenCalledWith({
      data: [{ userId: "user-1", courseId: "course-starter", status: "ACTIVE" }],
      skipDuplicates: true,
    });
  });

  it("leaves registration usable when no default course is published", async () => {
    const createMany = vi.fn();
    const transactionDatabase = {
      course: { findMany: vi.fn().mockResolvedValue([]) },
      userEnrollment: { createMany },
    };
    const repository = new PrismaUsersRepository({
      db: {
        $transaction: async (callback: (database: typeof transactionDatabase) => Promise<void>) =>
          callback(transactionDatabase),
      },
    } as never);

    await expect(repository.enrollInDefaultCourses("user-1")).resolves.toBeUndefined();
    expect(createMany).not.toHaveBeenCalled();
  });
});

class InMemoryUsersRepository extends UsersRepository {
  private readonly usersById = new Map<string, StoredUser>();
  private readonly usersByEmail = new Map<string, StoredUser>();
  private nextId = 1;
  readonly defaultCourseEnrollmentUserIds: string[] = [];

  async findByEmail(email: string): Promise<StoredUser | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    return this.usersById.get(id) ?? null;
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    const user: StoredUser = {
      id: `user-${this.nextId++}`,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: input.role,
      settings: input.settings,
    };

    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);

    return user;
  }

  async enrollInDefaultCourses(userId: string): Promise<void> {
    this.defaultCourseEnrollmentUserIds.push(userId);
  }

  async updateSettings(userId: string, settings: Partial<UserSettingsDto>): Promise<StoredUser> {
    const user = this.usersById.get(userId);

    if (user === undefined) {
      throw new Error(`Missing test user ${userId}.`);
    }

    const updatedUser: StoredUser = {
      ...user,
      settings: mergeUserSettings({
        ...user.settings,
        ...settings,
      }),
    };

    this.usersById.set(updatedUser.id, updatedUser);
    this.usersByEmail.set(updatedUser.email, updatedUser);

    return updatedUser;
  }
}

function createAuthHarness(): {
  readonly repository: InMemoryUsersRepository;
  readonly authService: AuthService;
  readonly authGuard: AuthGuard;
  readonly adminGuard: AdminGuard;
} {
  const repository = new InMemoryUsersRepository();
  const config = new AppConfigService({
    NODE_ENV: "test",
    AUTH_TOKEN_SECRET: "test-secret",
    AUTH_SESSION_TTL_MINUTES: "60",
  });
  const passwordService = new PasswordService();
  const tokenService = new TokenService(config);
  const authService = new AuthService(repository, passwordService, tokenService);
  const authGuard = new AuthGuard(authService);

  return {
    repository,
    authService,
    authGuard,
    adminGuard: new AdminGuard(authGuard),
  };
}

function createHttpContext(headers: Record<string, string>): {
  readonly context: ExecutionContext;
  readonly request: RequestWithCurrentUser;
} {
  const request: RequestWithCurrentUser = { headers };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;

  return { context, request };
}

function requireCurrentUser(request: RequestWithCurrentUser) {
  if (request.currentUser === undefined) {
    throw new Error("Expected AuthGuard to attach current user.");
  }

  return request.currentUser;
}
