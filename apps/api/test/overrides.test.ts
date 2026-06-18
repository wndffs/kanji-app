import { describe, expect, it } from "vitest";

import { type CurrentUserDto } from "../src/auth/auth.types";
import { OverridesRepository } from "../src/overrides/overrides.repository";
import { OverridesService } from "../src/overrides/overrides.service";
import {
  type CardAnswerValidationRecord,
  type UpsertAcceptedAnswerInput,
  type UpsertPrivateMnemonicInput,
  type UserAcceptedAnswerRecord,
  type UserMnemonicRecord,
} from "../src/overrides/overrides.types";

describe("OverridesService", () => {
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
});

class InMemoryOverridesRepository extends OverridesRepository {
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
  ]);
  private readonly acceptedAnswers = new Map<string, UserAcceptedAnswerRecord>();
  private readonly mnemonics = new Map<string, UserMnemonicRecord>();
  private nextId = 1;

  async findCardForValidation(cardId: string): Promise<CardAnswerValidationRecord | null> {
    return this.cards.get(cardId) ?? null;
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
    const override: UserAcceptedAnswerRecord = {
      id: existing?.id ?? `override-${this.nextId++}`,
      userId: input.userId,
      learningCardId: input.cardId,
      overrideType: input.answerKind === "reading" ? "accepted-reading" : "accepted-meaning",
      locale: input.locale,
      text: input.text,
      normalizedText: input.normalizedText,
      note: input.note,
      createdAt: existing?.createdAt ?? now,
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
}

function createHarness(): { readonly service: OverridesService } {
  return {
    service: new OverridesService(new InMemoryOverridesRepository()),
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
