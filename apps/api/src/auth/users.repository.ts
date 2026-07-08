import { Inject, Injectable } from "@nestjs/common";

import { isTranslationDisplayMode } from "@kanji-srs/shared";

import { PrismaService } from "../database/prisma.service";
import { type CreateUserInput, type StoredUser, type UserSettingsDto } from "./auth.types";
import { DEFAULT_USER_SETTINGS, mergeUserSettings } from "./user-settings.defaults";

export abstract class UsersRepository {
  abstract findByEmail(email: string): Promise<StoredUser | null>;
  abstract findById(id: string): Promise<StoredUser | null>;
  abstract createUser(input: CreateUserInput): Promise<StoredUser>;
  abstract enrollInDefaultCourse(userId: string): Promise<void>;
  abstract updateSettings(userId: string, settings: Partial<UserSettingsDto>): Promise<StoredUser>;
}

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
    readonly reviewBudget: number;
    readonly strictMode: boolean;
  } | null;
};

const DEFAULT_STARTER_COURSE_SLUG = "starter-demo";

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

  async enrollInDefaultCourse(userId: string): Promise<void> {
    const course = await this.prisma.db.course.findFirst({
      where: {
        slug: DEFAULT_STARTER_COURSE_SLUG,
        status: "PUBLISHED",
      },
      select: { id: true },
    });

    if (course === null) {
      return;
    }

    await this.prisma.db.userEnrollment.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId: course.id,
        },
      },
      update: { status: "ACTIVE" },
      create: {
        userId,
        courseId: course.id,
        status: "ACTIVE",
      },
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
            reviewBudget: user.settings.reviewBudget,
            strictMode: user.settings.strictMode,
          }),
  };
}
