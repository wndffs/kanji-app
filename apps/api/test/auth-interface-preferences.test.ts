import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@kanji-srs/db";
import {
  DEFAULT_INTERFACE_PREFERENCES,
  INTERFACE_PREFERENCE_OPTIONS,
  normalizeInterfacePreferences,
  type InterfacePreferences,
} from "@kanji-srs/shared";

import { AuthService } from "../src/auth/auth.service";
import { DEFAULT_USER_SETTINGS, mergeUserSettings } from "../src/auth/user-settings.defaults";
import { PrismaUsersRepository } from "../src/auth/users.repository";

const CUSTOM_PREFERENCES: InterfacePreferences = {
  interfaceTheme: "dark",
  interfaceDensity: "compact",
  interfaceMotion: "reduced",
  studyTextSize: "extra-large",
  studyInformationDensity: "compact",
};
const PREFERENCE_KEYS = Object.keys(INTERFACE_PREFERENCE_OPTIONS) as (keyof InterfacePreferences)[];
const VALID_OPTIONS = PREFERENCE_KEYS.flatMap((key) =>
  INTERFACE_PREFERENCE_OPTIONS[key].map((value) => ({ key, value })),
);

describe("interface preference normalization", () => {
  it.each([undefined, null, false, 1, "dark", [], ["compact"]])(
    "returns all defaults for non-record input %#",
    (input) => {
      expect(normalizeInterfacePreferences(input)).toEqual(DEFAULT_INTERFACE_PREFERENCES);
    },
  );

  it.each(VALID_OPTIONS)("accepts $key=$value independently", ({ key, value }) => {
    expect(normalizeInterfacePreferences({ [key]: value, unrelated: "ignored" })).toEqual({
      ...DEFAULT_INTERFACE_PREFERENCES,
      [key]: value,
    });
  });

  it("defaults invalid fields independently without changing the input or valid fields", () => {
    const input = Object.freeze({
      interfaceTheme: "sepia",
      interfaceDensity: null,
      interfaceMotion: false,
      studyTextSize: "large",
      studyInformationDensity: "compact",
      unexpected: "discarded",
    });

    expect(normalizeInterfacePreferences(input)).toEqual({
      ...DEFAULT_INTERFACE_PREFERENCES,
      studyTextSize: "large",
      studyInformationDensity: "compact",
    });
    expect(normalizeInterfacePreferences({})).not.toBe(DEFAULT_INTERFACE_PREFERENCES);
  });

  it("fully populates API defaults and merges partial legacy settings", () => {
    expect(DEFAULT_USER_SETTINGS).toMatchObject(DEFAULT_INTERFACE_PREFERENCES);
    expect(mergeUserSettings()).toMatchObject(DEFAULT_INTERFACE_PREFERENCES);
    expect(mergeUserSettings({ interfaceTheme: "light", reviewBudget: 45 })).toMatchObject({
      ...DEFAULT_INTERFACE_PREFERENCES,
      interfaceTheme: "light",
      reviewBudget: 45,
    });
  });
});

describe("interface preference API and persistence", () => {
  it.each(VALID_OPTIONS)(
    "persists $key=$value and preserves omitted preferences on partial updates",
    async ({ key, value }) => {
      const { service, repository, update } = createHarness();
      const user = await repository.findById("user-1");
      if (user === null) throw new Error("Missing test user.");

      const result = await service.updateSettings(user, { [key]: value });
      const expected = { ...CUSTOM_PREFERENCES, [key]: value };

      expect(result.settings).toMatchObject(expected);
      expect(update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          settings: {
            upsert: {
              create: expect.objectContaining({
                ...DEFAULT_INTERFACE_PREFERENCES,
                [key]: value,
              }),
              update: { [key]: value },
            },
          },
        },
        include: { settings: true },
      });
      await expect(service.authenticateToken("test-session")).resolves.toMatchObject({
        settings: expected,
      });
    },
  );

  it.each(PREFERENCE_KEYS)(
    "rejects invalid %s on update and registration with Russian errors",
    async (key) => {
      const { service, repository, update, create, hashPassword } = createHarness();
      const user = await repository.findById("user-1");
      if (user === null) throw new Error("Missing test user.");
      const message = `Поле ${key} должно иметь одно из значений: ${INTERFACE_PREFERENCE_OPTIONS[key].join(", ")}.`;

      for (const value of ["unsupported", " DARK ", "", null, false, 42, [], {}]) {
        await expect(service.updateSettings(user, { [key]: value })).rejects.toThrow(message);
        await expect(
          service.register({
            email: "new@example.test",
            password: "test-password",
            settings: { [key]: value },
          }),
        ).rejects.toThrow(message);
      }

      expect(update).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(hashPassword).not.toHaveBeenCalled();
    },
  );

  it("accepts custom preferences during registration", async () => {
    const { service, repository, create } = createHarness();
    vi.spyOn(repository, "findByEmail").mockResolvedValue(null);
    vi.spyOn(repository, "enrollInDefaultCourses").mockResolvedValue(undefined);

    const session = await service.register({
      email: "new@example.test",
      password: "test-password",
      settings: CUSTOM_PREFERENCES,
    });

    expect(session.user.settings).toMatchObject(CUSTOM_PREFERENCES);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settings: { create: expect.objectContaining(CUSTOM_PREFERENCES) },
        }),
      }),
    );
  });

  it("normalizes invalid stored strings without losing valid stored preferences", async () => {
    const { repository } = createHarness({
      ...DEFAULT_USER_SETTINGS,
      interfaceTheme: "unknown",
      interfaceDensity: "dense",
      interfaceMotion: "REDUCED",
      studyTextSize: "large",
      studyInformationDensity: "compact",
    });

    await expect(repository.findById("user-1")).resolves.toMatchObject({
      settings: {
        ...DEFAULT_INTERFACE_PREFERENCES,
        studyTextSize: "large",
        studyInformationDensity: "compact",
      },
    });
  });

  it("supports legacy stored settings missing every new field", async () => {
    const settings: Record<string, unknown> = { ...DEFAULT_USER_SETTINGS };
    for (const key of PREFERENCE_KEYS) delete settings[key];
    const { repository } = createHarness(settings);

    await expect(repository.findByEmail("learner@example.test")).resolves.toMatchObject({
      settings: DEFAULT_INTERFACE_PREFERENCES,
    });
  });

  it("creates fully defaulted settings when updating a user without a settings row", async () => {
    const { repository } = createHarness(null);
    const before = await repository.findById("user-1");
    expect(before?.settings).toMatchObject(DEFAULT_INTERFACE_PREFERENCES);

    await expect(
      repository.updateSettings("user-1", { interfaceTheme: "light" }),
    ).resolves.toMatchObject({
      settings: { ...DEFAULT_INTERFACE_PREFERENCES, interfaceTheme: "light" },
    });
  });
});

describe("interface preference schema contract", () => {
  it("keeps the five additive TEXT defaults aligned with the generated Prisma model", () => {
    const migration = readFileSync(
      join(
        __dirname,
        "../../../packages/db/prisma/migrations/20261021180000_add_interface_preferences/migration.sql",
      ),
      "utf8",
    );
    const model = Prisma.dmmf.datamodel.models.find(
      (candidate) => candidate.name === "UserSettings",
    );

    expect(migration.match(/ADD COLUMN IF NOT EXISTS/gu)).toHaveLength(5);
    expect(migration).not.toMatch(/\b(?:DROP|DELETE|UPDATE|TRUNCATE)\b/u);
    for (const key of PREFERENCE_KEYS) {
      expect(migration).toContain(
        `ADD COLUMN IF NOT EXISTS "${key}" TEXT NOT NULL DEFAULT '${DEFAULT_INTERFACE_PREFERENCES[key]}'`,
      );
      expect(model?.fields.find((field) => field.name === key)).toMatchObject({
        type: "String",
        isRequired: true,
        default: DEFAULT_INTERFACE_PREFERENCES[key],
      });
    }
  });
});

function createHarness(
  initialSettings: Record<string, unknown> | null = {
    ...DEFAULT_USER_SETTINGS,
    ...CUSTOM_PREFERENCES,
  },
) {
  const row = {
    id: "user-1",
    email: "learner@example.test",
    passwordHash: "test-hash",
    displayName: null,
    role: "USER",
    settings: initialSettings === null ? null : { ...initialSettings },
  };
  const update = vi.fn(
    async ({ data }: { data: { settings: { upsert: { create: object; update: object } } } }) => {
      if (row.settings === null) row.settings = { ...data.settings.upsert.create };
      else Object.assign(row.settings, data.settings.upsert.update);
      return structuredClone(row);
    },
  );
  const create = vi.fn(
    async ({ data }: { data: { email: string; settings: { create: object } } }) => {
      row.email = data.email;
      row.settings = { ...data.settings.create };
      return structuredClone(row);
    },
  );
  const repository = new PrismaUsersRepository({
    db: {
      user: {
        findUnique: vi.fn(async () => structuredClone(row)),
        update,
        create,
      },
    },
  } as never);
  const hashPassword = vi.fn().mockResolvedValue("test-hash");
  const service = new AuthService(
    repository,
    { hashPassword } as never,
    {
      createSessionToken: () => ({ token: "test-session", expiresAt: new Date("2026-10-22") }),
      verifySessionToken: () => ({ sub: row.id }),
    } as never,
  );

  return { service, repository, update, create, hashPassword };
}
