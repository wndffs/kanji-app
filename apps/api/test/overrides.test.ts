import { describe, expect, it, vi } from "vitest";

import { type CurrentUserDto } from "../src/auth/auth.types";
import { OverridesController } from "../src/overrides/overrides.controller";
import {
  OverridesRepository,
  PrismaOverridesRepository,
} from "../src/overrides/overrides.repository";
import { OverridesService } from "../src/overrides/overrides.service";
import {
  AcceptedAnswerCollisionError,
  type CardAnswerValidationRecord,
  type ReplaceAcceptedAnswerInput,
  type UpsertAcceptedAnswerInput,
  type UpsertPrivateMnemonicInput,
  type UserAcceptedAnswerRecord,
  type UserMnemonicRecord,
} from "../src/overrides/overrides.types";

describe("OverridesService", () => {
  it("retains private notes on repeated additions for stable shared cards", async () => {
    const { service } = createHarness();
    const user = createUser("owner");
    const original = await service.addAcceptedAnswer("card-meaning", user, {
      answerKind: "meaning",
      text: "моё число",
      note: "Private note from V5",
    });
    const repeated = await service.addAcceptedAnswer("card-meaning", user, {
      answerKind: "meaning",
      text: " МОЕ ЧИСЛО! ",
    });
    expect(repeated).toEqual(original);
    expect(
      (
        await service.validateAnswerForUser({
          userId: "owner",
          cardId: "card-meaning",
          answerKind: "meaning",
          answer: "моё число",
        })
      ).accepted,
    ).toBe(true);
    expect(
      (
        await service.validateAnswerForUser({
          userId: "other",
          cardId: "card-meaning",
          answerKind: "meaning",
          answer: "моё число",
        })
      ).accepted,
    ).toBe(false);
  });
  it("replaces a private answer in place, preserving its identity and creation time", async () => {
    const { service } = createHarness();
    const original = await service.addAcceptedAnswer("card-meaning", createUser("owner"), {
      answerKind: "meaning",
      text: "single stroke",
    });
    const controller = new OverridesController(service);
    const updated = await controller.replaceAcceptedAnswer(
      "card-meaning",
      original.id,
      createUser("owner"),
      { answerKind: "meaning", text: " SINGLE MARK! ", locale: "en-US", note: "new note" },
    );
    expect(updated).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      text: "SINGLE MARK!",
      normalizedText: "single mark",
      locale: "en-US",
      note: "new note",
    });
    expect(
      (await service.listCardOverrides("card-meaning", createUser("owner"))).overrides,
    ).toEqual([updated]);
  });

  it("preserves the original on invalid input or a failed replacement write", async () => {
    const { service, repository } = createHarness();
    const original = await service.addAcceptedAnswer("card-meaning", createUser("owner"), {
      answerKind: "meaning",
      text: "single stroke",
    });
    for (const body of [
      { answerKind: "meaning", text: "!!!" },
      { answerKind: "reading", text: "いち" },
    ]) {
      await expect(
        service.replaceAcceptedAnswer("card-meaning", original.id, createUser("owner"), body),
      ).rejects.toThrow();
    }
    vi.spyOn(repository, "replaceAcceptedAnswer").mockRejectedValueOnce(new Error("write failed"));
    await expect(
      service.replaceAcceptedAnswer("card-meaning", original.id, createUser("owner"), {
        answerKind: "meaning",
        text: "replacement",
      }),
    ).rejects.toThrow("write failed");
    expect(
      (await service.listCardOverrides("card-meaning", createUser("owner"))).overrides,
    ).toEqual([original]);
  });

  it("rejects another owner, another card, and missing IDs without changing any answers", async () => {
    const { service } = createHarness();
    const owner = createUser("owner");
    const original = await service.addAcceptedAnswer("card-meaning", owner, {
      answerKind: "meaning",
      text: "single stroke",
    });
    for (const [cardId, id, user, answerKind] of [
      ["card-meaning", original.id, createUser("other"), "meaning"],
      ["card-reading", original.id, owner, "reading"],
      ["card-meaning", "missing", owner, "meaning"],
    ] as const) {
      await expect(
        service.replaceAcceptedAnswer(cardId, id, user, { answerKind, text: "replacement" }),
      ).rejects.toThrow("Private accepted answer not found.");
    }
    expect((await service.listCardOverrides("card-meaning", owner)).overrides).toEqual([original]);
  });

  it("rejects normalized collisions without merging or deleting either answer", async () => {
    const { service } = createHarness();
    const owner = createUser("owner");
    const first = await service.addAcceptedAnswer("card-meaning", owner, {
      answerKind: "meaning",
      text: "first",
      locale: "en-US",
    });
    const second = await service.addAcceptedAnswer("card-meaning", owner, {
      answerKind: "meaning",
      text: "second",
      locale: "en-US",
    });
    await expect(
      service.replaceAcceptedAnswer("card-meaning", first.id, owner, {
        answerKind: "meaning",
        text: "SECOND!",
        locale: "en-US",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await service.listCardOverrides("card-meaning", owner)).overrides).toEqual([
      first,
      second,
    ]);
    await expect(
      service.replaceAcceptedAnswer("card-meaning", first.id, owner, {
        answerKind: "meaning",
        text: "FIRST!",
        locale: "en-US",
      }),
    ).resolves.toMatchObject({ id: first.id, text: "FIRST!" });
  });

  it("lists exact locale/type notes for the owner and updates only the selected note", async () => {
    const { service } = createHarness();
    const owner = createUser("owner");
    for (const locale of ["ru-RU", "en-US"] as const) {
      for (const mnemonicType of ["story", "meaning", "reading"] as const) {
        await service.savePrivateMnemonic("item-one", owner, {
          locale,
          mnemonicType,
          body: `${locale}:${mnemonicType}`,
        });
      }
    }
    await service.savePrivateMnemonic("item-two", owner, { body: "other item" });
    await service.savePrivateMnemonic("item-one", createUser("other"), { body: "other owner" });
    const before = await service.listPrivateMnemonics("item-one", owner);
    expect(before).toHaveLength(6);
    await service.savePrivateMnemonic("item-one", owner, {
      locale: "en-US",
      mnemonicType: "reading",
      body: "updated reading",
    });
    const after = await new OverridesController(service).listPrivateMnemonics("item-one", owner);
    expect(after.filter((note) => note.body !== "updated reading")).toEqual(
      before.filter((note) => note.locale !== "en-US" || note.mnemonicType !== "reading"),
    );
    expect(await service.listPrivateMnemonics("item-one", createUser("other"))).toMatchObject([
      { body: "other owner" },
    ]);
    await service.deletePrivateMnemonic("item-one", owner, {
      locale: "en-US",
      mnemonicType: "reading",
    });
    expect(await service.listPrivateMnemonics("item-one", owner)).toHaveLength(5);
  });

  it("accepts a private answer for the owner only", async () => {
    const { service } = createHarness();

    const ownerOverride = await service.addAcceptedAnswer("card-meaning", createUser("owner"), {
      answerKind: "meaning",
      locale: "en-US",
      note: "Personal wording from my notes.",
      text: "single stroke",
    });

    expect(ownerOverride).toMatchObject({
      kind: "accepted-answer",
      locale: "en-US",
      note: "Personal wording from my notes.",
      text: "single stroke",
    });
    await expect(
      service.validateAnswerForUser({
        userId: "owner",
        cardId: "card-meaning",
        answerKind: "meaning",
        answer: "single stroke",
      }),
    ).resolves.toMatchObject({
      accepted: true,
      matchSource: "user",
      reason: "user-exact-match",
    });
    await expect(
      service.validateAnswerForUser({
        userId: "other",
        cardId: "card-meaning",
        answerKind: "meaning",
        answer: "single stroke",
      }),
    ).resolves.toMatchObject({
      accepted: false,
      result: "wrong",
    });
  });

  it("removes a private accepted answer from validation", async () => {
    const { service } = createHarness();
    const override = await service.addAcceptedAnswer("card-meaning", createUser("owner"), {
      answerKind: "meaning",
      text: "single stroke",
    });

    await expect(
      service.deleteAcceptedAnswer("card-meaning", override.id, createUser("owner")),
    ).resolves.toEqual({ deleted: true });
    await expect(
      service.validateAnswerForUser({
        userId: "owner",
        cardId: "card-meaning",
        answerKind: "meaning",
        answer: "single stroke",
      }),
    ).resolves.toMatchObject({
      accepted: false,
      result: "wrong",
    });
  });

  it("does not let another user delete a private accepted answer", async () => {
    const { service } = createHarness();
    const override = await service.addAcceptedAnswer("card-meaning", createUser("owner"), {
      answerKind: "meaning",
      text: "single stroke",
    });

    await expect(
      service.deleteAcceptedAnswer("card-meaning", override.id, createUser("other")),
    ).rejects.toThrow("Private accepted answer not found.");
    await expect(
      service.validateAnswerForUser({
        userId: "owner",
        cardId: "card-meaning",
        answerKind: "meaning",
        answer: "single stroke",
      }),
    ).resolves.toMatchObject({
      accepted: true,
      matchSource: "user",
    });
  });

  it("lets global blocked answers reject exact private overrides", async () => {
    const { service } = createHarness();

    await service.addAcceptedAnswer("card-meaning", createUser("owner"), {
      answerKind: "meaning",
      text: "line",
    });

    await expect(
      service.validateAnswerForUser({
        userId: "owner",
        cardId: "card-meaning",
        answerKind: "meaning",
        answer: "line",
      }),
    ).resolves.toMatchObject({
      accepted: false,
      result: "blocked",
      matchedAnswer: "line",
    });
  });

  it("diagnoses a real kanji reading that is not accepted by this card", async () => {
    const { repository, service } = createHarness();

    await expect(
      service.validateAnswerForUser({
        userId: "owner",
        cardId: "card-reading",
        answerKind: "reading",
        answer: "ヒト",
      }),
    ).resolves.toMatchObject({
      accepted: false,
      result: "wrong",
      relatedAnswer: "ひと",
    });
    expect(repository.kanjiReadingLookupCount).toBe(1);
  });

  it("does not load alternative readings after an accepted answer", async () => {
    const { repository, service } = createHarness();

    await expect(
      service.validateAnswerForUser({
        userId: "owner",
        cardId: "card-reading",
        answerKind: "reading",
        answer: "いち",
      }),
    ).resolves.toMatchObject({ accepted: true, relatedAnswer: null });
    expect(repository.kanjiReadingLookupCount).toBe(0);
  });

  it("recognizes the stem and full form of a dotted KANJIDIC2 reading", async () => {
    const { service } = createHarness();

    for (const answer of ["た", "たべる"]) {
      await expect(
        service.validateAnswerForUser({
          userId: "owner",
          cardId: "card-reading",
          answerKind: "reading",
          answer,
        }),
      ).resolves.toMatchObject({
        accepted: false,
        result: "wrong",
        relatedAnswer: "た.べる",
      });
    }
  });

  it("saves a private item mnemonic with audit timestamps", async () => {
    const { service } = createHarness();

    await expect(
      service.savePrivateMnemonic("item-kanji-one", createUser("owner"), {
        locale: "en-US",
        mnemonicType: "story",
        body: "Imagine one clean stroke.",
      }),
    ).resolves.toMatchObject({
      mnemonic: {
        learningItemId: "item-kanji-one",
        locale: "en-US",
        mnemonicType: "story",
        body: "Imagine one clean stroke.",
      },
    });
  });

  it("deletes a private item mnemonic for the owner", async () => {
    const { service, repository } = createHarness();

    await service.savePrivateMnemonic("item-kanji-one", createUser("owner"), {
      locale: "ru-RU",
      mnemonicType: "story",
      body: "Моя заметка.",
    });

    await expect(
      service.deletePrivateMnemonic("item-kanji-one", createUser("owner"), {
        locale: "ru-RU",
        mnemonicType: "story",
      }),
    ).resolves.toEqual({ deleted: true });
    expect(repository.listMnemonicBodies("owner", "item-kanji-one")).toEqual([]);
  });

  it("does not let another user delete a private item mnemonic", async () => {
    const { service, repository } = createHarness();

    await service.savePrivateMnemonic("item-kanji-one", createUser("owner"), {
      locale: "en-US",
      mnemonicType: "story",
      body: "Owner-only note.",
    });

    await expect(
      service.deletePrivateMnemonic("item-kanji-one", createUser("other"), {
        locale: "en-US",
        mnemonicType: "story",
      }),
    ).rejects.toThrow("Private mnemonic not found.");
    expect(repository.listMnemonicBodies("owner", "item-kanji-one")).toEqual(["Owner-only note."]);
  });
});

class InMemoryOverridesRepository extends OverridesRepository {
  kanjiReadingLookupCount = 0;
  private readonly cards = new Map<string, CardAnswerValidationRecord>([
    [
      "card-meaning",
      {
        cardId: "card-meaning",
        answerKind: "meaning",
        acceptedAnswers: ["one"],
        blockedAnswers: ["line"],
      },
    ],
    [
      "card-reading",
      {
        cardId: "card-reading",
        answerKind: "reading",
        acceptedAnswers: ["いち"],
        blockedAnswers: [],
        kanjiTargetId: "kanji-one",
      },
    ],
  ]);
  private readonly acceptedAnswers = new Map<string, UserAcceptedAnswerRecord>();
  private readonly mnemonics = new Map<string, UserMnemonicRecord>();
  private nextId = 1;

  async findCardForValidation(cardId: string): Promise<CardAnswerValidationRecord | null> {
    return this.cards.get(cardId) ?? null;
  }

  async listKanjiReadings(kanjiId: string): Promise<readonly string[]> {
    this.kanjiReadingLookupCount += 1;
    return kanjiId === "kanji-one" ? ["いち", "ひと", "た.べる"] : [];
  }

  async listAcceptedAnswers(
    userId: string,
    cardId: string,
  ): Promise<readonly UserAcceptedAnswerRecord[]> {
    return [...this.acceptedAnswers.values()].filter(
      (override) => override.userId === userId && override.learningCardId === cardId,
    );
  }

  async upsertAcceptedAnswer(input: UpsertAcceptedAnswerInput): Promise<UserAcceptedAnswerRecord> {
    const key = [
      input.userId,
      input.cardId,
      input.answerKind,
      input.locale,
      input.normalizedText,
    ].join(":");
    const now = new Date("2026-06-18T09:00:00.000Z");
    const existing = this.acceptedAnswers.get(key);
    if (existing) return existing;
    const override: UserAcceptedAnswerRecord = {
      id: `override-${this.nextId++}`,
      userId: input.userId,
      learningCardId: input.cardId,
      overrideType: input.answerKind === "reading" ? "accepted-reading" : "accepted-meaning",
      locale: input.locale,
      text: input.text,
      normalizedText: input.normalizedText,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    };

    this.acceptedAnswers.set(key, override);

    return override;
  }

  async deleteAcceptedAnswer(userId: string, cardId: string, overrideId: string): Promise<boolean> {
    const entry = [...this.acceptedAnswers.entries()].find(
      ([, override]) =>
        override.userId === userId &&
        override.learningCardId === cardId &&
        override.id === overrideId,
    );

    if (entry === undefined) {
      return false;
    }

    this.acceptedAnswers.delete(entry[0]);

    return true;
  }

  async replaceAcceptedAnswer(
    input: ReplaceAcceptedAnswerInput,
  ): Promise<UserAcceptedAnswerRecord | null> {
    const entry = [...this.acceptedAnswers.entries()].find(
      ([, answer]) =>
        answer.id === input.overrideId &&
        answer.userId === input.userId &&
        answer.learningCardId === input.cardId &&
        answer.overrideType ===
          (input.answerKind === "reading" ? "accepted-reading" : "accepted-meaning"),
    );
    if (entry === undefined) return null;
    const key = [
      input.userId,
      input.cardId,
      input.answerKind,
      input.locale,
      input.normalizedText,
    ].join(":");
    if (key !== entry[0] && this.acceptedAnswers.has(key)) throw new AcceptedAnswerCollisionError();
    const updated = {
      ...entry[1],
      locale: input.locale,
      text: input.text,
      normalizedText: input.normalizedText,
      note: input.note,
    };
    this.acceptedAnswers.delete(entry[0]);
    this.acceptedAnswers.set(key, updated);
    return updated;
  }

  async upsertPrivateMnemonic(input: UpsertPrivateMnemonicInput): Promise<UserMnemonicRecord> {
    const key = [input.userId, input.learningItemId, input.locale, input.mnemonicType].join(":");
    const now = new Date("2026-06-18T09:00:00.000Z");
    const existing = this.mnemonics.get(key);
    const mnemonic: UserMnemonicRecord = {
      id: existing?.id ?? `mnemonic-${this.nextId++}`,
      userId: input.userId,
      learningItemId: input.learningItemId,
      locale: input.locale,
      mnemonicType: input.mnemonicType,
      body: input.body,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.mnemonics.set(key, mnemonic);

    return mnemonic;
  }

  async deletePrivateMnemonic(
    userId: string,
    learningItemId: string,
    locale: UpsertPrivateMnemonicInput["locale"],
    mnemonicType: UpsertPrivateMnemonicInput["mnemonicType"],
  ): Promise<boolean> {
    const key = [userId, learningItemId, locale, mnemonicType].join(":");

    return this.mnemonics.delete(key);
  }

  listMnemonicBodies(userId: string, learningItemId: string): readonly string[] {
    return [...this.mnemonics.values()]
      .filter(
        (mnemonic) => mnemonic.userId === userId && mnemonic.learningItemId === learningItemId,
      )
      .map((mnemonic) => mnemonic.body);
  }

  async listPrivateMnemonics(
    userId: string,
    learningItemId: string,
  ): Promise<readonly UserMnemonicRecord[]> {
    return [...this.mnemonics.values()].filter(
      (note) => note.userId === userId && note.learningItemId === learningItemId,
    );
  }
}

describe("PrismaOverridesRepository replacement", () => {
  it("does not overwrite the stored answer or note on duplicate Add", async () => {
    const saved = {
      id: "saved",
      userId: "owner",
      learningCardId: "card-meaning",
      overrideType: "ACCEPTED_MEANING",
      locale: "en-US",
      text: "original",
      normalizedText: "original",
      note: "Keep me",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const upsert = vi.fn().mockResolvedValue(saved);
    const repo = new PrismaOverridesRepository({ db: { userItemOverride: { upsert } } } as never);
    expect(
      await repo.upsertAcceptedAnswer({
        userId: "owner",
        cardId: "card-meaning",
        answerKind: "meaning",
        locale: "en-US",
        text: "ORIGINAL!",
        normalizedText: "original",
        note: null,
      }),
    ).toMatchObject({ id: "saved", text: "original", note: "Keep me" });
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      update: {},
      where: {
        userId_learningCardId_overrideType_locale_normalizedText: {
          userId: "owner",
          learningCardId: "card-meaning",
          overrideType: "ACCEPTED_MEANING",
          locale: "en-US",
          normalizedText: "original",
        },
      },
    });
  });
  const input: ReplaceAcceptedAnswerInput = {
    userId: "owner",
    cardId: "card-meaning",
    overrideId: "original",
    answerKind: "meaning",
    locale: "en-US",
    text: "new",
    normalizedText: "new",
    note: null,
  };

  it("uses one owner/card/type-scoped UPDATE without a delete or upsert", async () => {
    const update = vi.fn().mockResolvedValue({
      id: "original",
      userId: "owner",
      learningCardId: "card-meaning",
      overrideType: "ACCEPTED_MEANING",
      locale: "en-US",
      text: "new",
      normalizedText: "new",
      note: null,
      createdAt: new Date(0),
      updatedAt: new Date(1),
    });
    const repository = new PrismaOverridesRepository({
      db: { userItemOverride: { update } },
    } as never);
    expect(await repository.replaceAcceptedAnswer(input)).toMatchObject({
      id: "original",
      text: "new",
    });
    expect(update).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: "original",
        userId: "owner",
        learningCardId: "card-meaning",
        overrideType: "ACCEPTED_MEANING",
      },
      data: { locale: "en-US", text: "new", normalizedText: "new", note: null },
    });
  });

  it("maps missing targets and unique collisions without a fallback write", async () => {
    const update = vi
      .fn()
      .mockRejectedValueOnce({ code: "P2025" })
      .mockRejectedValueOnce({ code: "P2002" });
    const repository = new PrismaOverridesRepository({
      db: { userItemOverride: { update } },
    } as never);
    await expect(repository.replaceAcceptedAnswer(input)).resolves.toBeNull();
    await expect(repository.replaceAcceptedAnswer(input)).rejects.toBeInstanceOf(
      AcceptedAnswerCollisionError,
    );
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("scopes mnemonic reads to the authenticated owner and item", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PrismaOverridesRepository({
      db: { userMnemonic: { findMany } },
    } as never);
    await expect(repository.listPrivateMnemonics("owner", "item-one")).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: "owner", learningItemId: "item-one" },
      orderBy: [{ locale: "asc" }, { mnemonicType: "asc" }],
    });
  });
});

function createHarness(): {
  readonly service: OverridesService;
  readonly repository: InMemoryOverridesRepository;
} {
  const repository = new InMemoryOverridesRepository();

  return {
    service: new OverridesService(repository),
    repository,
  };
}

function createUser(id: string): CurrentUserDto {
  return {
    id,
    email: `${id}@example.test`,
    displayName: id,
    role: "USER",
    settings: {
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
      dailyLessonLimit: 10,
      reviewBudget: 100,
      strictMode: false,
    },
  };
}
