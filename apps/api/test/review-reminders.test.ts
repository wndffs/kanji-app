import "reflect-metadata";
import { type ExecutionContext } from "@nestjs/common";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type Prisma } from "@kanji-srs/db";

import { type AudioAssetRecord } from "../src/audio/audio-asset";
import { AuthGuard } from "../src/auth/auth.guard";
import { AuthService } from "../src/auth/auth.service";
import { type CurrentUserDto } from "../src/auth/auth.types";
import { PasswordService } from "../src/auth/password.service";
import { TokenService } from "../src/auth/token.service";
import { mergeUserSettings } from "../src/auth/user-settings.defaults";
import { PrismaUsersRepository } from "../src/auth/users.repository";
import { AppConfigService } from "../src/config/app-config.service";
import { type CurrentUserDto as PublicUserDto } from "../src/auth/current-user.dto";
import { UsersController } from "../src/users/users.controller";
import { assertEmptyReminderClaimBody } from "../src/users/review-reminder-claim";

const userId = "user-1";
const now = new Date("2026-10-22T09:00:00.000Z");
const user: CurrentUserDto = {
  id: userId,
  email: "learner@example.test",
  displayName: null,
  role: "USER",
  settings: mergeUserSettings(),
};
type Settings = {
  reviewRemindersEnabled?: boolean;
  reviewReminderHour?: number;
  reviewReminderLastClaimedAt: Date | null;
  timezone: string;
  vacationStartedAt: Date | null;
};

function harness(input: Partial<Settings> = {}) {
  let settings: Settings | null = {
    reviewRemindersEnabled: true,
    reviewReminderHour: 9,
    reviewReminderLastClaimedAt: null,
    timezone: "UTC",
    vacationStartedAt: null,
    ...input,
  };
  const findUnique = vi.fn(async () => (settings === null ? null : { ...settings }));
  const findFirst = vi.fn().mockResolvedValue({ id: "due-state" });
  const findMany = vi.fn().mockResolvedValue([]);
  const updateMany = vi.fn(
    async ({
      where,
      data,
    }: {
      where: Settings & { userId: string };
      data: { reviewReminderLastClaimedAt: Date };
    }) => {
      const matches =
        settings !== null &&
        where.userId === userId &&
        Object.entries(where).every(([key, value]) => {
          if (key === "userId") return true;
          const saved = settings![key as keyof Settings];
          return saved instanceof Date && value instanceof Date
            ? saved.getTime() === value.getTime()
            : saved === value;
        });
      if (!matches) return { count: 0 };
      settings = { ...settings!, ...data };
      return { count: 1 };
    },
  );
  const transaction = {
    userSettings: { findUnique, updateMany },
    userSrsState: { findFirst, findMany },
  };
  const transact = vi.fn(async (operation: (db: Prisma.TransactionClient) => unknown) =>
    operation(transaction as unknown as Prisma.TransactionClient),
  );
  const repository = new PrismaUsersRepository({ db: { $transaction: transact } } as never);
  return {
    repository,
    transact,
    findUnique,
    findFirst,
    findMany,
    updateMany,
    setSettings: (next: Settings | null) => {
      settings = next;
    },
    readSettings: () => settings!,
  };
}

function audio(overrides: Partial<AudioAssetRecord> = {}): AudioAssetRecord {
  return {
    id: "audio-1",
    learningItemId: "item-1",
    mediaUrl: "https://audio.example.test/a.mp3",
    storageKey: null,
    checksumSha256: "a".repeat(64),
    durationMs: 1000,
    speakerName: null,
    voiceMetadataJson: null,
    locale: "ja-JP",
    attributionText: "Project audio",
    importRunId: null,
    status: "PUBLISHED",
    dataSource: { name: "Project", homepageUrl: null },
    license: { name: "Project owned", url: null },
    ...overrides,
  };
}
const listeningState = (asset: AudioAssetRecord | null, id = "state-1") => ({
  id,
  learningCard: { learningItemId: "item-1", learningItem: { kind: "WORD" }, audioAsset: asset },
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("review reminder claims", () => {
  it("claims once inside a transaction with scoped due/publication filters and timestamp CAS", async () => {
    const test = harness();
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(true);
    expect(test.transact).toHaveBeenCalledOnce();
    expect(test.findUnique).toHaveBeenCalledWith({
      where: { userId },
      select: {
        reviewRemindersEnabled: true,
        reviewReminderHour: true,
        reviewReminderLastClaimedAt: true,
        timezone: true,
        vacationStartedAt: true,
      },
    });
    expect(test.findFirst).toHaveBeenCalledWith({
      where: {
        userId,
        burnedAt: null,
        availableAt: { lte: now },
        learningCard: {
          learningItem: { status: "PUBLISHED" },
          promptType: { not: "LISTENING" },
        },
      },
      select: { id: true },
    });
    expect(test.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        reviewReminderLastClaimedAt: null,
        reviewRemindersEnabled: true,
        reviewReminderHour: 9,
        timezone: "UTC",
        vacationStartedAt: null,
      },
      data: { reviewReminderLastClaimedAt: now },
    });
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(false);
    expect(test.updateMany).toHaveBeenCalledOnce();
  });

  it.each([
    { reviewRemindersEnabled: false },
    { reviewRemindersEnabled: undefined },
    { vacationStartedAt: now },
    { reviewReminderHour: 10 },
    { reviewReminderHour: -1 },
    { reviewReminderHour: 24 },
    { timezone: "Not/AZone" },
  ])(
    "fails closed before querying due cards for disabled/ineligible settings %#",
    async (settings) => {
      const test = harness(settings);
      expect(await test.repository.claimReviewReminder(userId, now)).toBe(false);
      expect(test.findFirst).not.toHaveBeenCalled();
      expect(test.updateMany).not.toHaveBeenCalled();
    },
  );

  it("does not create missing legacy settings or notify without any eligible scheduled card", async () => {
    const test = harness();
    test.setSettings(null);
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(false);
    test.setSettings({
      reviewRemindersEnabled: true,
      reviewReminderHour: 9,
      reviewReminderLastClaimedAt: null,
      vacationStartedAt: null,
      timezone: "UTC",
    });
    test.findFirst.mockResolvedValue(null);
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(false);
    expect(test.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["2026-10-22T08:59:59.999Z", false],
    ["2026-10-22T09:00:00.000Z", true],
    ["2026-10-22T23:59:59.999Z", true],
  ])("uses the selected local hour at %s", async (instant, expected) => {
    expect(
      await harness().repository.claimReviewReminder(userId, new Date(instant as string)),
    ).toBe(expected);
  });

  it.each([
    ["Asia/Tokyo", "2026-10-22T00:00:00Z", 9, true],
    ["America/New_York", "2026-10-22T09:00:00Z", 9, false],
    ["UTC", "2026-10-22T00:00:00Z", 0, true],
    ["Asia/Kathmandu", "2026-10-22T03:15:00Z", 9, true],
  ])("honors %s timezone and hour boundaries", async (timezone, instant, hour, expected) => {
    const test = harness({ timezone: timezone as string, reviewReminderHour: hour as number });
    expect(await test.repository.claimReviewReminder(userId, new Date(instant as string))).toBe(
      expected,
    );
  });

  it.each([
    ["2026-10-21T09:00:00.001Z", false],
    ["2026-10-21T09:00:00.000Z", true],
    ["2026-10-23T09:00:00.000Z", false],
  ])("enforces the 24-hour boundary and rejects future claims: %s", async (last, expected) => {
    const test = harness({ reviewReminderLastClaimedAt: new Date(last as string) });
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(expected);
  });

  it("does not notify on a 23-hour DST day, but can after 24 hours", async () => {
    const last = new Date("2026-03-07T14:00:00Z");
    const test = harness({ timezone: "America/New_York", reviewReminderLastClaimedAt: last });
    expect(
      await test.repository.claimReviewReminder(userId, new Date("2026-03-08T13:00:00Z")),
    ).toBe(false);
    expect(
      await test.repository.claimReviewReminder(userId, new Date("2026-03-08T14:00:00Z")),
    ).toBe(true);
  });

  it("blocks a second claim on the same 25-hour local day even after 24 hours", async () => {
    const test = harness({
      timezone: "America/New_York",
      reviewReminderHour: 0,
      reviewReminderLastClaimedAt: new Date("2026-11-01T04:00:00Z"),
    });
    expect(
      await test.repository.claimReviewReminder(userId, new Date("2026-11-02T04:30:00Z")),
    ).toBe(false);
    expect(
      await test.repository.claimReviewReminder(userId, new Date("2026-11-02T05:00:00Z")),
    ).toBe(true);
  });

  it("does not let timezone changes or opt-out/in reset the 24-hour limit", async () => {
    const test = harness({
      reviewReminderLastClaimedAt: new Date("2026-10-22T00:00:00Z"),
      timezone: "Pacific/Kiritimati",
    });
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(false);
    test.setSettings({
      ...test.readSettings(),
      timezone: "Pacific/Honolulu",
      reviewRemindersEnabled: false,
    });
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(false);
    test.setSettings({ ...test.readSettings(), reviewRemindersEnabled: true });
    expect(
      await test.repository.claimReviewReminder(userId, new Date("2026-10-22T23:59:59Z")),
    ).toBe(false);
  });

  it("allows only one concurrent timestamp compare-and-swap winner", async () => {
    const test = harness();
    const results = await Promise.all([
      test.repository.claimReviewReminder(userId, now),
      test.repository.claimReviewReminder(userId, now),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect(test.updateMany).toHaveBeenCalledTimes(2);
    for (const [input] of test.updateMany.mock.calls)
      expect(input.where.reviewReminderLastClaimedAt).toBeNull();
  });

  it.each([
    { reviewRemindersEnabled: false },
    { reviewReminderHour: 10 },
    { timezone: "Asia/Tokyo" },
    { vacationStartedAt: now },
  ])("rejects CAS when preferences/vacation change while checking due cards %#", async (change) => {
    const test = harness();
    test.findFirst.mockImplementation(async () => {
      test.setSettings({ ...test.readSettings(), ...change });
      return { id: "due-state" };
    });
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(false);
    expect(test.readSettings().reviewReminderLastClaimedAt).toBeNull();
  });

  it("propagates transaction failures instead of pretending a notification was claimed", async () => {
    const test = harness();
    test.updateMany.mockRejectedValueOnce(new Error("database failed"));
    await expect(test.repository.claimReviewReminder(userId, now)).rejects.toThrow(
      "database failed",
    );
  });
});

describe("listening reminder eligibility", () => {
  it.each([
    null,
    audio({ status: "DRAFT" }),
    audio({ learningItemId: "another-item" }),
    audio({ mediaUrl: "http://audio.example.test/a.mp3" }),
    audio({ mediaUrl: null }),
    audio({ durationMs: 0 }),
    audio({ checksumSha256: "broken" }),
    audio({ attributionText: " " }),
    audio({ dataSource: { name: " ", homepageUrl: null } }),
    audio({ license: { name: " ", url: null } }),
  ])("does not count unplayable/unpublished/unattributed listening cards %#", async (asset) => {
    const test = harness();
    test.findFirst.mockResolvedValue(null);
    test.findMany.mockResolvedValue([listeningState(asset)]);
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(false);
    expect(test.updateMany).not.toHaveBeenCalled();
  });

  it("counts published playable listening cards and scopes the database query", async () => {
    const test = harness();
    test.findFirst.mockResolvedValue(null);
    test.findMany.mockResolvedValue([listeningState(audio())]);
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(true);
    expect(test.findMany.mock.calls[0][0]).toMatchObject({
      where: {
        userId,
        burnedAt: null,
        availableAt: { lte: now },
        learningCard: {
          promptType: "LISTENING",
          learningItem: { status: "PUBLISHED", kind: { in: ["WORD", "SENTENCE"] } },
          audioAsset: { is: { status: "PUBLISHED" } },
        },
      },
      orderBy: { id: "asc" },
      take: 100,
    });
  });

  it("continues by keyset beyond a page of invalid audio rather than fabricating or missing a due card", async () => {
    const test = harness();
    test.findFirst.mockResolvedValue(null);
    test.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 100 }, (_, index) => listeningState(null, `state-${index}`)),
      )
      .mockResolvedValueOnce([listeningState(audio(), "valid-state")]);
    expect(await test.repository.claimReviewReminder(userId, now)).toBe(true);
    expect(test.findMany.mock.calls[1][0].where.id).toEqual({ gt: "state-99" });
  });
});

describe("claim endpoint and settings security", () => {
  it.each([undefined, {}])("accepts only an empty body %#", (body) => {
    expect(() => assertEmptyReminderClaimBody(body)).not.toThrow();
  });
  it.each([
    null,
    [],
    "",
    false,
    0,
    { userId: "other" },
    { shouldNotify: true },
    { count: 5 },
    { timezone: "UTC" },
    { reviewReminderLastClaimedAt: now },
    new Date(),
  ])("rejects payload injection %#", (body) => {
    expect(() => assertEmptyReminderClaimBody(body)).toThrow("не должен содержать данные");
  });

  it("requires bearer auth at the controller and preserves the legacy settings route", async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, UsersController)).toContain(AuthGuard);
    expect(Reflect.getMetadata(PATH_METADATA, UsersController.prototype.claimReminder)).toBe(
      "me/review-reminders/claim",
    );
    expect(Reflect.getMetadata(PATH_METADATA, UsersController.prototype.updateSettings)).toEqual([
      "settings",
      "me/settings",
    ]);
    const authenticateToken = vi.fn();
    const guard = new AuthGuard({ authenticateToken } as never);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(authenticateToken).not.toHaveBeenCalled();
  });

  it("returns exactly the boolean claim, scopes to the authenticated user and rejects data before DB work", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const test = harness();
    const controller = new UsersController({} as AuthService, test.repository);
    expect(await controller.claimReminder(user, {})).toEqual({ shouldNotify: true });
    expect(test.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }));
    expect(await controller.claimReminder(user, undefined)).toEqual({ shouldNotify: false });
    test.findUnique.mockClear();
    await expect(controller.claimReminder(user, { userId: "another" })).rejects.toThrow();
    expect(test.findUnique).not.toHaveBeenCalled();
  });

  it("normalizes legacy DTOs to required default-off fields without exposing the private timestamp", () => {
    const controller = new UsersController({} as AuthService, harness().repository);
    const {
      reviewRemindersEnabled: _enabled,
      reviewReminderHour: _hour,
      ...legacy
    } = user.settings;
    const result: PublicUserDto = controller.getCurrentUser({
      ...user,
      settings: { ...legacy, reviewReminderLastClaimedAt: now } as never,
    });
    expect(result.settings.reviewRemindersEnabled).toBe(false);
    expect(result.settings.reviewReminderHour).toBe(9);
    expect(result.settings).not.toHaveProperty("reviewReminderLastClaimedAt");
  });

  function settingsHarness() {
    let settings = mergeUserSettings({ reviewBudget: 45, interfaceTheme: "dark" });
    const update = vi.fn(
      async ({ data }: { data: { settings: { upsert: { update: object } } } }) => {
        settings = mergeUserSettings({ ...settings, ...data.settings.upsert.update });
        return {
          ...user,
          passwordHash: "hash",
          settings: { ...settings, reviewReminderLastClaimedAt: now },
        };
      },
    );
    const repository = new PrismaUsersRepository({ db: { user: { update } } } as never);
    const service = new AuthService(
      repository,
      new PasswordService(),
      new TokenService(
        new AppConfigService({ NODE_ENV: "test", AUTH_TOKEN_SECRET: "test-secret" }),
      ),
    );
    return { service, update };
  }

  it("persists each reminder field partially, reuses timezone validation and preserves other preferences", async () => {
    const { service, update } = settingsHarness();
    const first = await service.updateSettings(user, {
      reviewRemindersEnabled: true,
      reviewReminderHour: 0,
      timezone: "Asia/Tokyo",
    });
    const second = await service.updateSettings(first, { reviewReminderHour: 23 });
    expect(second.settings).toMatchObject({
      reviewRemindersEnabled: true,
      reviewReminderHour: 23,
      timezone: "Asia/Tokyo",
      reviewBudget: 45,
      interfaceTheme: "dark",
    });
    expect(second.settings).not.toHaveProperty("reviewReminderLastClaimedAt");
    expect(update.mock.calls[1][0].data.settings.upsert.update).toEqual({ reviewReminderHour: 23 });
    await expect(
      service.updateSettings(second, { reviewReminderHour: 9, timezone: "Invalid/Zone" }),
    ).rejects.toThrow("timezone is invalid");
    expect(update).toHaveBeenCalledTimes(2);
  });

  it.each([
    { reviewRemindersEnabled: "true" },
    { reviewRemindersEnabled: 1 },
    { reviewRemindersEnabled: null },
    { reviewReminderHour: -1 },
    { reviewReminderHour: 24 },
    { reviewReminderHour: 9.5 },
    { reviewReminderHour: "9" },
    { reviewReminderHour: null },
    { reviewReminderLastClaimedAt: "2020-01-01" },
  ])(
    "rejects invalid fields or a private-timestamp-only patch before persistence %#",
    async (body) => {
      const { service, update } = settingsHarness();
      await expect(service.updateSettings(user, body)).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("never writes an injected private claim timestamp alongside valid preferences", async () => {
    const { service, update } = settingsHarness();
    const result = await service.updateSettings(user, {
      reviewRemindersEnabled: true,
      reviewReminderLastClaimedAt: null,
    });
    expect(update.mock.calls[0][0].data.settings.upsert.update).toEqual({
      reviewRemindersEnabled: true,
    });
    expect(result.settings).not.toHaveProperty("reviewReminderLastClaimedAt");
  });
});
