import { BadRequestException } from "@nestjs/common";

import { type Prisma } from "@kanji-srs/db";

import { isEligibleListeningAudio } from "../audio/audio-asset";

const DAY_MS = 24 * 60 * 60 * 1_000;

export function assertEmptyReminderClaimBody(body: unknown): void {
  if (body === undefined) return;
  if (
    typeof body !== "object" ||
    body === null ||
    Object.getPrototypeOf(body) !== Object.prototype ||
    Reflect.ownKeys(body).length !== 0
  ) {
    throw new BadRequestException("Запрос напоминания не должен содержать данные.");
  }
}

function localTime(now: Date, timezone: string): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value;
  return { day: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")) };
}

export async function claimReviewReminder(
  db: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<boolean> {
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: {
      reviewRemindersEnabled: true,
      reviewReminderHour: true,
      reviewReminderLastClaimedAt: true,
      timezone: true,
      vacationStartedAt: true,
    },
  });
  if (settings?.reviewRemindersEnabled !== true || settings.vacationStartedAt != null) return false;
  if (typeof settings.timezone !== "string" || settings.timezone.trim() === "") return false;
  const hour = settings.reviewReminderHour ?? 9;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isFinite(now.getTime()))
    return false;
  const lastClaim = settings.reviewReminderLastClaimedAt ?? null;
  try {
    const local = localTime(now, settings.timezone);
    if (local.hour < hour) return false;
    if (
      lastClaim !== null &&
      (now.getTime() - lastClaim.getTime() < DAY_MS ||
        localTime(lastClaim, settings.timezone).day === local.day)
    )
      return false;
  } catch {
    // Legacy invalid timezone data must fail closed, not claim in a guessed timezone.
    return false;
  }
  if (!(await hasEligibleDueReview(db, userId, now))) return false;
  const result = await db.userSettings.updateMany({
    where: {
      userId,
      reviewReminderLastClaimedAt: lastClaim,
      reviewRemindersEnabled: true,
      reviewReminderHour: hour,
      timezone: settings.timezone,
      vacationStartedAt: null,
    },
    data: { reviewReminderLastClaimedAt: now },
  });
  return result.count === 1;
}

async function hasEligibleDueReview(
  db: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<boolean> {
  const due = { userId, burnedAt: null, availableAt: { lte: now } };
  const other = await db.userSrsState.findFirst({
    where: {
      ...due,
      learningCard: { learningItem: { status: "PUBLISHED" }, promptType: { not: "LISTENING" } },
    },
    select: { id: true },
  });
  if (other !== null) return true;

  // Reuse the review audio validator, including provenance, checksum and item binding.
  // Keyset pages avoid materializing an entire due backlog when audio is ineligible.
  let cursor: string | undefined;
  for (;;) {
    const states = await db.userSrsState.findMany({
      where: {
        ...due,
        ...(cursor === undefined ? {} : { id: { gt: cursor } }),
        learningCard: {
          promptType: "LISTENING",
          learningItem: { status: "PUBLISHED", kind: { in: ["WORD", "SENTENCE"] } },
          audioAsset: { is: { status: "PUBLISHED" } },
        },
      },
      select: {
        id: true,
        learningCard: {
          select: {
            learningItemId: true,
            learningItem: { select: { kind: true } },
            audioAsset: { include: { dataSource: true, license: true } },
          },
        },
      },
      orderBy: { id: "asc" },
      take: 100,
    });
    if (
      states.some(({ learningCard: card }) =>
        isEligibleListeningAudio(
          card.audioAsset,
          card.learningItemId,
          card.learningItem.kind === "WORD" ? "word" : "sentence",
        ),
      )
    )
      return true;
    if (states.length < 100) return false;
    cursor = states[states.length - 1].id;
  }
}
