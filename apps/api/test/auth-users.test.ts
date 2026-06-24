import { type ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";

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
import { UsersRepository } from "../src/auth/users.repository";
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

    await expect(
      usersController.updateSettings(requireCurrentUser(request), {
        translationDisplayMode: "en",
        timezone: "Asia/Tokyo",
        dailyLessonLimit: 12,
        reviewBudget: 80,
        strictMode: true,
      }),
    ).resolves.toMatchObject({
      settings: {
        translationDisplayMode: "en",
        timezone: "Asia/Tokyo",
        dailyLessonLimit: 12,
        reviewBudget: 80,
        strictMode: true,
      },
    });
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

class InMemoryUsersRepository extends UsersRepository {
  private readonly usersById = new Map<string, StoredUser>();
  private readonly usersByEmail = new Map<string, StoredUser>();
  private nextId = 1;

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
