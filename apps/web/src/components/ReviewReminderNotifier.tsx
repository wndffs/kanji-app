"use client";

import { useEffect, useRef } from "react";

import { claimReviewReminder } from "../lib/api-client";
import { AUTH_CHANGED_EVENT, readStoredSession } from "../lib/auth-storage";
import {
  createReviewReminderController,
  normalizeReviewReminderSettings,
  reviewReminderPermission,
  type ReviewReminderConfirmation,
} from "../lib/review-reminders";

export function ReviewReminderNotifier({
  confirmation,
}: {
  readonly confirmation: ReviewReminderConfirmation;
}) {
  const latest = useRef(confirmation);
  latest.current = confirmation;
  const controller = useRef<ReturnType<typeof createReviewReminderController> | null>(null);
  const attempted = useRef<ReviewReminderConfirmation | null>(null);

  useEffect(() => {
    const instance = createReviewReminderController(
      {
        now: Date.now,
        session: () => {
          const session = readStoredSession();
          return session === null
            ? null
            : {
                accountId: session.user.id,
                token: session.token,
                enabled: normalizeReviewReminderSettings(session.user.settings)
                  .reviewRemindersEnabled,
                vacationActive: session.user.settings.vacationStartedAt != null,
              };
        },
        visible: () => document.visibilityState === "visible",
        online: () => navigator.onLine,
        permission: reviewReminderPermission,
        claim: (token, signal) => claimReviewReminder(token, { signal }),
        notify: () => {
          const notification = new window.Notification("Пора повторить", {
            body: "Повторения готовы. Можно продолжить занятия.",
          });
          notification.onclick = () => {
            const session = readStoredSession();
            if (
              session?.user.id === latest.current.accountId &&
              session.token === latest.current.token
            ) {
              window.focus();
              window.location.assign("/dashboard");
            }
            notification.close();
          };
          return notification;
        },
      },
      attempted,
    );
    controller.current = instance;
    const check = () => void instance.check(latest.current);
    const sessionChanged = () => {
      const session = readStoredSession();
      if (session?.user.id !== latest.current.accountId || session.token !== latest.current.token) {
        instance.dispose();
      } else if (
        !normalizeReviewReminderSettings(session.user.settings).reviewRemindersEnabled ||
        session.user.settings.vacationStartedAt != null
      )
        instance.cancel();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener(AUTH_CHANGED_EVENT, sessionChanged);
    window.addEventListener("storage", sessionChanged);
    check();
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener(AUTH_CHANGED_EVENT, sessionChanged);
      window.removeEventListener("storage", sessionChanged);
      instance.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    void controller.current?.check(confirmation);
  }, [confirmation]);
  return null;
}
