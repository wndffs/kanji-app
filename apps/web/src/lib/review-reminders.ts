export type ReviewReminderPermission = NotificationPermission | "unsupported";

export function reviewReminderPermission(): ReviewReminderPermission {
  return typeof window === "undefined" || typeof window.Notification !== "function"
    ? "unsupported"
    : window.Notification.permission;
}

// Call only from the opt-in control's user gesture, never from a lifecycle effect.
export async function requestReviewReminderPermission(): Promise<ReviewReminderPermission> {
  const permission = reviewReminderPermission();
  if (permission !== "default") return permission;
  try {
    return await window.Notification.requestPermission();
  } catch {
    return reviewReminderPermission();
  }
}

export function normalizeReviewReminderSettings(settings: {
  readonly reviewRemindersEnabled?: unknown;
  readonly reviewReminderHour?: unknown;
}) {
  const hour = settings.reviewReminderHour;
  return {
    reviewRemindersEnabled: settings.reviewRemindersEnabled === true,
    reviewReminderHour:
      typeof hour === "number" && Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9,
  };
}

export function parseReviewReminderHour(value: string): number {
  const hour = Number(value);
  if (value.trim() === "" || !Number.isInteger(hour) || hour < 0 || hour > 23)
    throw new Error("Час напоминания должен быть целым числом от 0 до 23.");
  return hour;
}

export function reviewReminderPreferencePatch(
  enabled: boolean,
  savedEnabled: boolean,
  permission: ReviewReminderPermission,
): { readonly reviewRemindersEnabled?: boolean } {
  if (enabled === savedEnabled) return {};
  if (enabled && permission !== "granted")
    throw new Error("Для включения напоминаний разрешите уведомления в браузере.");
  return { reviewRemindersEnabled: enabled };
}

export type ReviewReminderConfirmation = {
  readonly accountId: string;
  readonly token: string;
  readonly dueReviews: number;
  readonly confirmedAt: number;
};

export type ReviewReminderSession = {
  readonly accountId: string;
  readonly token: string;
  readonly enabled: boolean;
  readonly vacationActive: boolean;
};

export type ReviewReminderEnvironment = {
  readonly now: () => number;
  readonly session: () => ReviewReminderSession | null;
  readonly visible: () => boolean;
  readonly online: () => boolean;
  readonly permission: () => ReviewReminderPermission;
  readonly claim: (
    token: string,
    signal: AbortSignal,
  ) => Promise<{ readonly shouldNotify: boolean }>;
  readonly notify: () => { close(): void };
};

// One bounded attempt marker and one notification handle, scoped to this dashboard mount.
export function createReviewReminderController(
  environment: ReviewReminderEnvironment,
  attempted: { current: ReviewReminderConfirmation | null } = { current: null },
) {
  let pending: AbortController | null = null;
  let notification: { close(): void } | null = null;
  let disposed = false;
  let currentConfirmation: ReviewReminderConfirmation | null = null;

  function eligible(confirmation: ReviewReminderConfirmation): boolean {
    const session = environment.session();
    const age = environment.now() - confirmation.confirmedAt;
    return (
      !disposed &&
      session !== null &&
      session.accountId === confirmation.accountId &&
      session.token === confirmation.token &&
      session.enabled &&
      !session.vacationActive &&
      Number.isFinite(confirmation.dueReviews) &&
      confirmation.dueReviews > 0 &&
      age >= 0 &&
      age <= 60_000 &&
      environment.visible() &&
      environment.online() &&
      environment.permission() === "granted"
    );
  }

  function cancel() {
    pending?.abort();
    pending = null;
    notification?.close();
    notification = null;
  }

  return {
    async check(confirmation: ReviewReminderConfirmation) {
      if (currentConfirmation !== confirmation) {
        cancel();
        currentConfirmation = confirmation;
      }
      if (attempted.current === confirmation || !eligible(confirmation)) return;
      attempted.current = confirmation;
      cancel();
      const request = new AbortController();
      pending = request;
      try {
        const result = await environment.claim(confirmation.token, request.signal);
        if (
          !request.signal.aborted &&
          pending === request &&
          currentConfirmation === confirmation &&
          result.shouldNotify === true &&
          eligible(confirmation)
        ) {
          notification = environment.notify();
        }
      } catch {
        // A failed/aborted claim is not replayed: server delivery is unconfirmed.
      } finally {
        if (pending === request) pending = null;
      }
    },
    cancel,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
