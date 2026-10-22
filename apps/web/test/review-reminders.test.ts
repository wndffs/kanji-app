import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createReviewReminderController,
  normalizeReviewReminderSettings,
  parseReviewReminderHour,
  requestReviewReminderPermission,
  reviewReminderPermission,
  reviewReminderPreferencePatch,
  type ReviewReminderConfirmation,
  type ReviewReminderPermission,
  type ReviewReminderSession,
} from "../src/lib/review-reminders";

afterEach(() => vi.unstubAllGlobals());

function harness() {
  const confirmation: ReviewReminderConfirmation = {
    accountId: "account-a",
    token: "token-a",
    dueReviews: 3,
    confirmedAt: 1_000,
  };
  const state = {
    now: 1_000,
    visible: true,
    online: true,
    permission: "granted" as ReviewReminderPermission,
    session: {
      accountId: "account-a",
      token: "token-a",
      enabled: true,
      vacationActive: false,
    } as ReviewReminderSession | null,
  };
  const close = vi.fn();
  const notify = vi.fn(() => ({ close }));
  const claim = vi.fn(async (_token: string, _signal: AbortSignal) => ({ shouldNotify: true }));
  const environment = {
    now: () => state.now,
    session: () => state.session,
    visible: () => state.visible,
    online: () => state.online,
    permission: () => state.permission,
    claim,
    notify,
  };
  return {
    confirmation,
    state,
    close,
    notify,
    claim,
    environment,
    controller: createReviewReminderController(environment),
  };
}

describe("review reminder opt-in", () => {
  it.each(["unsupported", "default", "denied", "granted"] as const)(
    "preserves an unchanged account preference with browser permission %s",
    (permission) => {
      expect(reviewReminderPreferencePatch(true, true, permission)).toEqual({});
      expect(reviewReminderPreferencePatch(false, false, permission)).toEqual({});
      expect(reviewReminderPreferencePatch(false, true, permission)).toEqual({
        reviewRemindersEnabled: false,
      });
      if (permission === "granted")
        expect(reviewReminderPreferencePatch(true, false, permission)).toEqual({
          reviewRemindersEnabled: true,
        });
      else
        expect(() => reviewReminderPreferencePatch(true, false, permission)).toThrow(
          "разрешите уведомления",
        );
    },
  );
  it("defaults legacy settings off at hour 9 without requesting browser permission", () => {
    const requestPermission = vi.fn();
    vi.stubGlobal("window", {
      Notification: Object.assign(function () {}, { permission: "default", requestPermission }),
    });
    expect(normalizeReviewReminderSettings({})).toEqual({
      reviewRemindersEnabled: false,
      reviewReminderHour: 9,
    });
    expect(
      normalizeReviewReminderSettings({ reviewRemindersEnabled: "true", reviewReminderHour: 24 }),
    ).toEqual({ reviewRemindersEnabled: false, reviewReminderHour: 9 });
    expect(
      normalizeReviewReminderSettings({ reviewRemindersEnabled: true, reviewReminderHour: 0 }),
    ).toEqual({ reviewRemindersEnabled: true, reviewReminderHour: 0 });
    expect(reviewReminderPermission()).toBe("default");
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("requests default permission synchronously on explicit invocation only", async () => {
    const requestPermission = vi.fn(async () => "granted");
    vi.stubGlobal("window", {
      Notification: Object.assign(function () {}, { permission: "default", requestPermission }),
    });
    expect(requestPermission).not.toHaveBeenCalled();
    const result = requestReviewReminderPermission();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await expect(result).resolves.toBe("granted");
  });

  it.each(["granted", "denied"])(
    "does not request permission again when %s",
    async (permission) => {
      const requestPermission = vi.fn();
      vi.stubGlobal("window", {
        Notification: Object.assign(function () {}, { permission, requestPermission }),
      });
      await expect(requestReviewReminderPermission()).resolves.toBe(permission);
      expect(requestPermission).not.toHaveBeenCalled();
    },
  );

  it("handles unsupported browsers and failed permission requests without enabling", async () => {
    vi.stubGlobal("window", {});
    await expect(requestReviewReminderPermission()).resolves.toBe("unsupported");
    vi.stubGlobal("window", {
      Notification: Object.assign(function () {}, {
        permission: "default",
        requestPermission: vi.fn().mockRejectedValue(new Error("blocked")),
      }),
    });
    await expect(requestReviewReminderPermission()).resolves.toBe("default");
  });

  it.each(["", "24", "-1", "9.5", "x"])("rejects invalid reminder hour %j", (hour) => {
    expect(() => parseReviewReminderHour(hour)).toThrow("от 0 до 23");
  });
  it("accepts midnight and the last hour", () => {
    expect(parseReviewReminderHour("0")).toBe(0);
    expect(parseReviewReminderHour("23")).toBe(23);
  });
});

describe("bounded review reminder claims", () => {
  it("claims once per confirmation, including concurrent visibility checks", async () => {
    const h = harness();
    await Promise.all([h.controller.check(h.confirmation), h.controller.check(h.confirmation)]);
    await h.controller.check(h.confirmation);
    expect(h.claim).toHaveBeenCalledTimes(1);
    expect(h.claim).toHaveBeenCalledWith("token-a", expect.any(AbortSignal));
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.close).not.toHaveBeenCalled();
    h.controller.dispose();
    expect(h.close).toHaveBeenCalledTimes(1);
  });

  it.each([
    "disabled",
    "vacation",
    "no-session",
    "account",
    "token",
    "hidden",
    "offline",
    "denied",
    "unsupported",
    "default",
    "stale",
    "future",
    "no-due",
    "invalid-due",
  ])("does not claim or notify for %s", async (condition) => {
    const h = harness();
    let confirmation = h.confirmation;
    if (condition === "disabled") h.state.session = { ...h.state.session!, enabled: false };
    if (condition === "vacation") h.state.session = { ...h.state.session!, vacationActive: true };
    if (condition === "no-session") h.state.session = null;
    if (condition === "account") h.state.session = { ...h.state.session!, accountId: "other" };
    if (condition === "token") h.state.session = { ...h.state.session!, token: "new-token" };
    if (condition === "hidden") h.state.visible = false;
    if (condition === "offline") h.state.online = false;
    if (["denied", "unsupported", "default"].includes(condition))
      h.state.permission = condition as ReviewReminderPermission;
    if (condition === "stale") h.state.now = 61_001;
    if (condition === "future") h.state.now = 999;
    if (condition === "no-due") confirmation = { ...confirmation, dueReviews: 0 };
    if (condition === "invalid-due") confirmation = { ...confirmation, dueReviews: NaN };
    await h.controller.check(confirmation);
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("allows visibility checks only within sixty seconds of a fresh server confirmation", async () => {
    const h = harness();
    h.state.visible = false;
    await h.controller.check(h.confirmation);
    h.state.now = 61_000;
    h.state.visible = true;
    await h.controller.check(h.confirmation);
    expect(h.claim).toHaveBeenCalledTimes(1);
    h.state.now = 61_001;
    await h.controller.check({ ...h.confirmation });
    expect(h.claim).toHaveBeenCalledTimes(1);
  });

  it("does not replay a failed claim on visibility changes or coming back online", async () => {
    const h = harness();
    h.claim.mockRejectedValue(new TypeError("offline"));
    await h.controller.check(h.confirmation);
    h.state.online = false;
    await h.controller.check(h.confirmation);
    h.state.online = true;
    await h.controller.check(h.confirmation);
    expect(h.claim).toHaveBeenCalledTimes(1);
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("does not notify when the server denies the cross-device claim", async () => {
    const h = harness();
    h.claim.mockResolvedValue({ shouldNotify: false });
    await h.controller.check(h.confirmation);
    await h.controller.check(h.confirmation);
    expect(h.claim).toHaveBeenCalledTimes(1);
    expect(h.notify).not.toHaveBeenCalled();
  });

  it.each(["logout", "account", "disable", "vacation", "hidden", "stale", "unmount", "abort"])(
    "never notifies after %s during a claim",
    async (condition) => {
      const h = harness();
      let resolve!: (value: { shouldNotify: boolean }) => void;
      h.claim.mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const work = h.controller.check(h.confirmation);
      if (condition === "logout") h.state.session = null;
      if (condition === "account") h.state.session = { ...h.state.session!, accountId: "other" };
      if (condition === "disable") h.state.session = { ...h.state.session!, enabled: false };
      if (condition === "vacation") h.state.session = { ...h.state.session!, vacationActive: true };
      if (condition === "hidden") h.state.visible = false;
      if (condition === "stale") h.state.now = 61_001;
      if (condition === "unmount") h.controller.dispose();
      if (condition === "abort") h.controller.cancel();
      resolve({ shouldNotify: true });
      await work;
      expect(h.notify).not.toHaveBeenCalled();
    },
  );

  it("aborts earlier in-flight work for a newer confirmation and closes an existing notification", async () => {
    const h = harness();
    await h.controller.check(h.confirmation);
    expect(h.close).not.toHaveBeenCalled();
    let finish!: (value: { shouldNotify: boolean }) => void;
    h.claim.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const next = { ...h.confirmation, confirmedAt: 1_001 };
    h.state.now = 1_001;
    const work = h.controller.check(next);
    expect(h.close).toHaveBeenCalledTimes(1);
    const signal = h.claim.mock.calls[1]![1];
    h.controller.dispose();
    expect(signal.aborted).toBe(true);
    finish({ shouldNotify: true });
    await work;
    expect(h.notify).toHaveBeenCalledTimes(1);
  });

  it("keeps the bounded attempt marker across effect cleanup/setup without replay", async () => {
    const h = harness();
    const marker = { current: null as ReviewReminderConfirmation | null };
    const first = createReviewReminderController(h.environment, marker);
    await first.check(h.confirmation);
    first.dispose();
    const second = createReviewReminderController(h.environment, marker);
    await second.check(h.confirmation);
    expect(h.claim).toHaveBeenCalledTimes(1);
    second.dispose();
  });

  it("invalidates an earlier in-flight claim when the newest dashboard confirms no due cards", async () => {
    const h = harness();
    let finish!: (value: { shouldNotify: boolean }) => void;
    h.claim.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const work = h.controller.check(h.confirmation);
    await h.controller.check({ ...h.confirmation, dueReviews: 0 });
    expect(h.claim.mock.calls[0]![1].aborted).toBe(true);
    finish({ shouldNotify: true });
    await work;
    expect(h.claim).toHaveBeenCalledTimes(1);
    expect(h.notify).not.toHaveBeenCalled();
  });
});
