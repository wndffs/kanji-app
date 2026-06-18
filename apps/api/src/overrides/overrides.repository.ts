import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import {
  type CardAnswerValidationRecord,
  type UpsertAcceptedAnswerInput,
  type UpsertPrivateMnemonicInput,
  type UserAcceptedAnswerRecord,
  type UserMnemonicRecord,
} from "./overrides.types";

export abstract class OverridesRepository {
  abstract findCardForValidation(cardId: string): Promise<CardAnswerValidationRecord | null>;
  abstract listAcceptedAnswers(
    userId: string,
    cardId: string,
  ): Promise<readonly UserAcceptedAnswerRecord[]>;
  abstract upsertAcceptedAnswer(
    input: UpsertAcceptedAnswerInput,
  ): Promise<UserAcceptedAnswerRecord>;
  abstract deleteAcceptedAnswer(
    userId: string,
    cardId: string,
    overrideId: string,
  ): Promise<boolean>;
  abstract upsertPrivateMnemonic(input: UpsertPrivateMnemonicInput): Promise<UserMnemonicRecord>;
}

type UserItemOverrideRow = {
  readonly id: string;
  readonly userId: string;
  readonly learningCardId: string;
  readonly overrideType: string;
  readonly locale: string;
  readonly text: string;
  readonly normalizedText: string;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

type UserMnemonicRow = {
  readonly id: string;
  readonly userId: string;
  readonly learningItemId: string;
  readonly locale: string;
  readonly mnemonicType: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

@Injectable()
export class PrismaOverridesRepository extends OverridesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async findCardForValidation(cardId: string): Promise<CardAnswerValidationRecord | null> {
    const card = await this.prisma.db.learningCard.findUnique({
      where: { id: cardId },
      include: {
        answers: true,
        blockedAnswers: true,
      },
    });

    if (card === null) {
      return null;
    }

    return {
      cardId: card.id,
      answerKind: card.answerType === "READING" ? "reading" : "meaning",
      acceptedAnswers: card.answers.map((answer) => answer.text),
      blockedAnswers: card.blockedAnswers.map((answer) => answer.text),
    };
  }

  async listAcceptedAnswers(
    userId: string,
    cardId: string,
  ): Promise<readonly UserAcceptedAnswerRecord[]> {
    const overrides = await this.prisma.db.userItemOverride.findMany({
      where: {
        userId,
        learningCardId: cardId,
        overrideType: {
          in: ["ACCEPTED_MEANING", "ACCEPTED_READING"],
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return overrides.map(toAcceptedAnswerRecord);
  }

  async upsertAcceptedAnswer(input: UpsertAcceptedAnswerInput): Promise<UserAcceptedAnswerRecord> {
    const overrideType = input.answerKind === "reading" ? "ACCEPTED_READING" : "ACCEPTED_MEANING";
    const override = await this.prisma.db.userItemOverride.upsert({
      where: {
        userId_learningCardId_overrideType_locale_normalizedText: {
          userId: input.userId,
          learningCardId: input.cardId,
          overrideType,
          locale: input.locale,
          normalizedText: input.normalizedText,
        },
      },
      update: {
        text: input.text,
        note: input.note,
      },
      create: {
        userId: input.userId,
        learningCardId: input.cardId,
        overrideType,
        locale: input.locale,
        text: input.text,
        normalizedText: input.normalizedText,
        note: input.note,
      },
    });

    return toAcceptedAnswerRecord(override as UserItemOverrideRow);
  }

  async deleteAcceptedAnswer(userId: string, cardId: string, overrideId: string): Promise<boolean> {
    const result = await this.prisma.db.userItemOverride.deleteMany({
      where: {
        id: overrideId,
        userId,
        learningCardId: cardId,
        overrideType: {
          in: ["ACCEPTED_MEANING", "ACCEPTED_READING"],
        },
      },
    });

    return result.count > 0;
  }

  async upsertPrivateMnemonic(input: UpsertPrivateMnemonicInput): Promise<UserMnemonicRecord> {
    const mnemonic = await this.prisma.db.userMnemonic.upsert({
      where: {
        userId_learningItemId_locale_mnemonicType: {
          userId: input.userId,
          learningItemId: input.learningItemId,
          locale: input.locale,
          mnemonicType: toPrismaMnemonicType(input.mnemonicType),
        },
      },
      update: {
        body: input.body,
      },
      create: {
        userId: input.userId,
        learningItemId: input.learningItemId,
        locale: input.locale,
        mnemonicType: toPrismaMnemonicType(input.mnemonicType),
        body: input.body,
      },
    });

    return toUserMnemonicRecord(mnemonic as UserMnemonicRow);
  }
}

function toAcceptedAnswerRecord(row: UserItemOverrideRow): UserAcceptedAnswerRecord {
  return {
    id: row.id,
    userId: row.userId,
    learningCardId: row.learningCardId,
    overrideType: row.overrideType === "ACCEPTED_READING" ? "accepted-reading" : "accepted-meaning",
    locale: row.locale === "en-US" ? "en-US" : "ru-RU",
    text: row.text,
    normalizedText: row.normalizedText,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toUserMnemonicRecord(row: UserMnemonicRow): UserMnemonicRecord {
  return {
    id: row.id,
    userId: row.userId,
    learningItemId: row.learningItemId,
    locale: row.locale === "en-US" ? "en-US" : "ru-RU",
    mnemonicType: toApiMnemonicType(row.mnemonicType),
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPrismaMnemonicType(value: "meaning" | "reading" | "story") {
  switch (value) {
    case "meaning":
      return "MEANING";
    case "reading":
      return "READING";
    case "story":
      return "STORY";
  }
}

function toApiMnemonicType(value: string): "meaning" | "reading" | "story" {
  switch (value) {
    case "MEANING":
      return "meaning";
    case "READING":
      return "reading";
    default:
      return "story";
  }
}
