import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { normalizeJapaneseReading, normalizeMeaning, validateAnswer } from "@kanji-srs/japanese";
import { type ContentLocale, type UserMnemonicDto, type UserOverrideDto } from "@kanji-srs/shared";

import { type CurrentUserDto } from "../auth/auth.types";
import { OverridesRepository } from "./overrides.repository";
import {
  type AcceptedAnswerKind,
  type AddAcceptedAnswerRequest,
  type CardAnswerValidationResult,
  type DeleteOverrideResponse,
  type ListOverridesResponse,
  type PrivateMnemonicType,
  type SavePrivateMnemonicRequest,
  type SavePrivateMnemonicResponse,
  type UserAcceptedAnswerRecord,
  type UserMnemonicRecord,
  type ValidateCardAnswerInput,
} from "./overrides.types";

const MAX_OVERRIDE_TEXT_LENGTH = 120;
const MAX_NOTE_LENGTH = 2_000;
const MAX_PRIVATE_MNEMONIC_LENGTH = 4_000;

@Injectable()
export class OverridesService {
  constructor(
    @Inject(OverridesRepository) private readonly overridesRepository: OverridesRepository,
  ) {}

  async listCardOverrides(cardId: string, user: CurrentUserDto): Promise<ListOverridesResponse> {
    const overrides = await this.overridesRepository.listAcceptedAnswers(user.id, cardId);

    return {
      overrides: overrides.map(toUserOverrideDto),
    };
  }

  async addAcceptedAnswer(
    cardId: string,
    user: CurrentUserDto,
    body: unknown,
  ): Promise<UserOverrideDto> {
    const request = parseAddAcceptedAnswerRequest(body);
    const card = await this.overridesRepository.findCardForValidation(cardId);

    if (card === null) {
      throw new NotFoundException("Learning card not found.");
    }

    if (card.answerKind !== request.answerKind) {
      throw new BadRequestException(`answerKind must be ${card.answerKind} for this card.`);
    }

    const normalizedText = normalizeAcceptedText(request);
    const override = await this.overridesRepository.upsertAcceptedAnswer({
      userId: user.id,
      cardId,
      answerKind: request.answerKind,
      locale: request.locale,
      text: request.text,
      normalizedText,
      note: request.note,
    });

    return toUserOverrideDto(override);
  }

  async deleteAcceptedAnswer(
    cardId: string,
    overrideId: string,
    user: CurrentUserDto,
  ): Promise<DeleteOverrideResponse> {
    const deleted = await this.overridesRepository.deleteAcceptedAnswer(
      user.id,
      cardId,
      overrideId,
    );

    if (!deleted) {
      throw new NotFoundException("Private accepted answer not found.");
    }

    return { deleted: true };
  }

  async savePrivateMnemonic(
    learningItemId: string,
    user: CurrentUserDto,
    body: unknown,
  ): Promise<SavePrivateMnemonicResponse> {
    const request = parseSavePrivateMnemonicRequest(body);
    const mnemonic = await this.overridesRepository.upsertPrivateMnemonic({
      userId: user.id,
      learningItemId,
      locale: request.locale,
      mnemonicType: request.mnemonicType,
      body: request.body,
    });

    return {
      mnemonic: toUserMnemonicDto(mnemonic),
    };
  }

  async validateAnswerForUser(input: ValidateCardAnswerInput): Promise<CardAnswerValidationResult> {
    const card = await this.overridesRepository.findCardForValidation(input.cardId);

    if (card === null) {
      throw new NotFoundException("Learning card not found.");
    }

    if (card.answerKind !== input.answerKind) {
      throw new BadRequestException(`answerKind must be ${card.answerKind} for this card.`);
    }

    const overrides = await this.overridesRepository.listAcceptedAnswers(
      input.userId,
      input.cardId,
    );

    return validateAnswer({
      answerKind: input.answerKind,
      answer: input.answer,
      acceptedAnswers: card.acceptedAnswers,
      blockedAnswers: card.blockedAnswers,
      userAcceptedAnswers: overrides
        .filter((override) => override.overrideType === toOverrideType(input.answerKind))
        .map((override) => override.text),
    });
  }
}

function parseAddAcceptedAnswerRequest(body: unknown): Required<AddAcceptedAnswerRequest> {
  const record = parseRecord(body, "Request body");
  const answerKind = parseAnswerKind(record.answerKind);
  const text = parseRequiredString(record.text, "text", MAX_OVERRIDE_TEXT_LENGTH);
  const locale = parseContentLocale(record.locale);
  const note = parseOptionalString(record.note, "note", MAX_NOTE_LENGTH);

  return {
    answerKind,
    text,
    locale,
    note,
  };
}

function parseSavePrivateMnemonicRequest(body: unknown): Required<SavePrivateMnemonicRequest> {
  const record = parseRecord(body, "Request body");

  return {
    body: parseRequiredString(record.body, "body", MAX_PRIVATE_MNEMONIC_LENGTH),
    locale: parseContentLocale(record.locale),
    mnemonicType: parseMnemonicType(record.mnemonicType),
  };
}

function parseRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function parseRequiredString(value: unknown, key: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestException(`${key} must be a non-empty string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${key} is too long.`);
  }

  return trimmed;
}

function parseOptionalString(value: unknown, key: string, maxLength: number): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestException(`${key} must be a string or null.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${key} is too long.`);
  }

  return trimmed === "" ? null : trimmed;
}

function parseAnswerKind(value: unknown): AcceptedAnswerKind {
  if (value === "meaning" || value === "reading") {
    return value;
  }

  throw new BadRequestException("answerKind must be meaning or reading.");
}

function parseContentLocale(value: unknown): ContentLocale {
  if (value === undefined || value === null || value === "") {
    return "ru-RU";
  }

  if (value === "ru-RU" || value === "en-US") {
    return value;
  }

  throw new BadRequestException("locale must be ru-RU or en-US.");
}

function parseMnemonicType(value: unknown): PrivateMnemonicType {
  if (value === undefined || value === null || value === "") {
    return "story";
  }

  if (value === "meaning" || value === "reading" || value === "story") {
    return value;
  }

  throw new BadRequestException("mnemonicType must be meaning, reading, or story.");
}

function normalizeAcceptedText(request: Required<AddAcceptedAnswerRequest>): string {
  const normalized =
    request.answerKind === "reading"
      ? normalizeJapaneseReading(request.text)
      : normalizeMeaning(request.text, request.locale);

  if (normalized.length === 0) {
    throw new BadRequestException("text is empty after normalization.");
  }

  return normalized;
}

function toOverrideType(answerKind: AcceptedAnswerKind) {
  return answerKind === "reading" ? "accepted-reading" : "accepted-meaning";
}

function toUserOverrideDto(override: UserAcceptedAnswerRecord): UserOverrideDto {
  return {
    id: override.id,
    learningCardId: override.learningCardId,
    kind: "accepted-answer",
    locale: override.locale,
    text: override.text,
    normalizedText: override.normalizedText,
    note: override.note,
    createdAt: override.createdAt.toISOString(),
    updatedAt: override.updatedAt.toISOString(),
  };
}

function toUserMnemonicDto(mnemonic: UserMnemonicRecord): UserMnemonicDto {
  return {
    id: mnemonic.id,
    learningItemId: mnemonic.learningItemId,
    locale: mnemonic.locale,
    mnemonicType: mnemonic.mnemonicType,
    body: mnemonic.body,
    createdAt: mnemonic.createdAt.toISOString(),
    updatedAt: mnemonic.updatedAt.toISOString(),
  };
}
