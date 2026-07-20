import { Inject, Injectable } from "@nestjs/common";

import { Prisma } from "@kanji-srs/db";
import {
  isLessonOrderMode,
  isLessonPronunciationMode,
  isReviewOrderMode,
  isTranslationDisplayMode,
  normalizeDashboardWidgetPreferences,
} from "@kanji-srs/shared";

import { PrismaService } from "../database/prisma.service";
import { type CreateUserInput, type StoredUser, type UserSettingsDto } from "./auth.types";
import { DEFAULT_USER_SETTINGS, mergeUserSettings } from "./user-settings.defaults";

export abstract class UsersRepository {
  abstract findByEmail(email: string): Promise<StoredUser | null>;
  abstract findById(id: string): Promise<StoredUser | null>;
  abstract createUser(input: CreateUserInput): Promise<StoredUser>;
  abstract enrollInDefaultCourses(userId: string): Promise<void>;
  abstract updateSettings(userId: string, settings: Partial<UserSettingsDto>): Promise<StoredUser>;
  abstract setVacationMode(
    userId: string,
    enabled: boolean,
    now: Date,
  ): Promise<VacationModeUpdateResult>;
}

export type VacationModeUpdateResult = {
  readonly user: StoredUser;
  readonly shiftedReviewCount: number;
  readonly vacationDurationSeconds: number;
};

type PrismaUserWithSettings = {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string | null;
  readonly role: "USER" | "ADMIN";
  readonly settings: {
    readonly locale: string;
    readonly translationDisplayMode: string;
    readonly timezone: string;
    readonly dailyLessonLimit: number;
    readonly lessonBatchSize: number;
    readonly lessonOrderMode: string;
    readonly reviewBudget: number;
    readonly reviewOrderMode: string;
    readonly strictMode: boolean;
    readonly vacationStartedAt: Date | null;
    readonly speechVoiceUri: string | null;
    readonly speechRate: number;
    readonly speechAutoplay: boolean;
    readonly soundFeedback: boolean;
    readonly lessonPronunciationMode: string;
    readonly lessonRomaji: boolean;
    readonly dashboardWidgets: unknown;
  } | null;
};

const DEFAULT_COURSE_SLUGS = ["starter-demo", "japanese-ru-n2"] as const;

@Injectable()
export class PrismaUsersRepository extends UsersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    const user = await this.prisma.db.user.findUnique({
      where: { email },
      include: { settings: true },
    });

    return user === null ? null : toStoredUser(user as PrismaUserWithSettings);
  }

  async findById(id: string): Promise<StoredUser | null> {
    const user = await this.prisma.db.user.findUnique({
      where: { id },
      include: { settings: true },
    });

    return user === null ? null : toStoredUser(user as PrismaUserWithSettings);
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    const user = await this.prisma.db.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: input.role,
        settings: {
          create: input.settings,
        },
      },
      include: { settings: true },
    });

    return toStoredUser(user as PrismaUserWithSettings);
  }

  async enrollInDefaultCourses(userId: string): Promise<void> {
    await this.prisma.db.$transaction(async (db) => {
      const courses = await db.course.findMany({
        where: {
          slug: { in: [...DEFAULT_COURSE_SLUGS] },
          status: "PUBLISHED",
        },
        select: { id: true, slug: true },
        orderBy: { slug: "asc" },
      });

      if (courses.length === 0) {
        return;
      }

      await db.userEnrollment.createMany({
        data: courses.map((course) => ({
          userId,
          courseId: course.id,
          status: "ACTIVE" as const,
        })),
        skipDuplicates: true,
      });
    });
  }

  async updateSettings(userId: string, settings: Partial<UserSettingsDto>): Promise<StoredUser> {
    const merged = mergeUserSettings(settings);
    const user = await this.prisma.db.user.update({
      where: { id: userId },
      data: {
        settings: {
          upsert: {
            create: merged,
            update: settings,
          },
        },
      },
      include: { settings: true },
    });

    return toStoredUser(user as PrismaUserWithSettings);
  }

  async setVacationMode(
    userId: string,
    enabled: boolean,
    now: Date,
  ): Promise<VacationModeUpdateResult> {
    return this.prisma.db.$transaction(async (db) => {
      const [settings] = await db.$queryRaw<
        readonly { readonly vacationStartedAt: Date | null }[]
      >(Prisma.sql`
        SELECT "vacationStartedAt"
        FROM "UserSettings"
        WHERE "userId" = ${userId}::uuid
        FOR UPDATE
      `);

      if (settings === undefined) {
        throw new Error("User settings not found.");
      }

      let shiftedReviewCount = 0;
      let vacationDurationSeconds = 0;

      if (enabled && settings.vacationStartedAt === null) {
        await db.userSettings.update({
          where: { userId },
          data: { vacationStartedAt: now },
        });
      } else if (!enabled && settings.vacationStartedAt !== null) {
        const startedAt = settings.vacationStartedAt;
        const endedAt = new Date(Math.max(now.getTime(), startedAt.getTime()));
        vacationDurationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1_000);
        shiftedReviewCount = await db.$executeRaw(
          Prisma.sql`
            UPDATE "UserSrsState"
            SET "availableAt" = "availableAt" + (
              ${endedAt}::timestamp - GREATEST(${startedAt}::timestamp, "createdAt")
            )
            WHERE "userId" = ${userId}::uuid
              AND "burnedAt" IS NULL
              AND "createdAt" < ${endedAt}::timestamp
              AND "availableAt" > GREATEST(${startedAt}::timestamp, "createdAt")
          `,
        );
        await db.userSettings.update({
          where: { userId },
          data: { vacationStartedAt: null },
        });
      }

      const user = await db.user.findUnique({
        where: { id: userId },
        include: { settings: true },
      });

      if (user === null) {
        throw new Error("User not found after vacation mode update.");
      }

      return {
        user: toStoredUser(user as PrismaUserWithSettings),
        shiftedReviewCount,
        vacationDurationSeconds,
      };
    });
  }
}

function toStoredUser(user: PrismaUserWithSettings): StoredUser {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    displayName: user.displayName,
    role: user.role,
    settings:
      user.settings === null
        ? DEFAULT_USER_SETTINGS
        : mergeUserSettings({
            locale: "ru-RU",
            translationDisplayMode: isTranslationDisplayMode(user.settings.translationDisplayMode)
              ? user.settings.translationDisplayMode
              : undefined,
            timezone: user.settings.timezone,
            dailyLessonLimit: user.settings.dailyLessonLimit,
            lessonBatchSize: user.settings.lessonBatchSize,
            lessonOrderMode: isLessonOrderMode(user.settings.lessonOrderMode)
              ? user.settings.lessonOrderMode
              : undefined,
            reviewBudget: user.settings.reviewBudget,
            reviewOrderMode: isReviewOrderMode(user.settings.reviewOrderMode)
              ? user.settings.reviewOrderMode
              : undefined,
            strictMode: user.settings.strictMode,
            vacationStartedAt: user.settings.vacationStartedAt?.toISOString() ?? null,
            speechVoiceUri: user.settings.speechVoiceUri,
            speechRate: user.settings.speechRate,
            speechAutoplay: user.settings.speechAutoplay,
            soundFeedback: user.settings.soundFeedback,
            lessonPronunciationMode: isLessonPronunciationMode(
              user.settings.lessonPronunciationMode,
            )
              ? user.settings.lessonPronunciationMode
              : undefined,
            lessonRomaji: user.settings.lessonRomaji,
            dashboardWidgets: normalizeDashboardWidgetPreferences(user.settings.dashboardWidgets),
          }),
  };
}
