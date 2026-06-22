import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { normalizeJapaneseReading, normalizeMeaning } from "@kanji-srs/japanese";
import {
  type AdminContentStatus,
  type AdminCurationItemDto,
  type AdminReviewQueueResponse,
  type AdminUpdateCardAnswersRequest,
  type AdminUpdateItemRequest,
  type CardAnswerType,
  type ContentLocale,
} from "@kanji-srs/shared";

import { AdminRepository } from "./admin.repository";
import {
  type NormalizedAdminCardAnswersInput,
  type NormalizedAdminItemCurationInput,
  type NormalizedAdminTextInput,
} from "./admin.types";

const MAX_MEANING_LENGTH = 240;
const MAX_ANSWER_LENGTH = 120;
const MAX_BLOCKED_REASON_LENGTH = 500;
const MAX_TEXT_BODY_LENGTH = 4_000;

@Injectable()
export class AdminService {
  constructor(@Inject(AdminRepository) private readonly adminRepository: AdminRepository) {}

  async listReviewItems(): Promise<AdminReviewQueueResponse> {
    return {
      items: await this.adminRepository.listReviewItems(),
    };
  }

  async getCurationItem(itemId: string): Promise<AdminCurationItemDto> {
    const item = await this.adminRepository.findCurationItem(itemId);

    if (item === null) {
      throw new NotFoundException("Learning item not found.");
    }

    return item;
  }

  async updateItem(itemId: string, body: unknown): Promise<AdminCurationItemDto> {
    const request = parseUpdateItemRequest(body);
    const item = await this.adminRepository.updateItemCuration(itemId, request);

    if (item === null) {
      throw new NotFoundException("Learning item not found.");
    }

    return item;
  }

  async updateCardAnswers(cardId: string, body: unknown): Promise<AdminCurationItemDto> {
    const request = parseUpdateCardAnswersRequest(body);
    const item = await this.adminRepository.updateCardAnswers(cardId, request);

    if (item === null) {
      throw new NotFoundException("Learning card not found.");
    }

    return item;
  }
}

function parseUpdateItemRequest(body: unknown): NormalizedAdminItemCurationInput {
  const record = parseRecord(body, "Request body");
  const status = parseOptionalStatus(record.status);
  const meanings = parseOptionalMeanings(record.meanings);

  return {
    ...(status === undefined ? {} : { status }),
    ...(meanings === undefined ? {} : { meanings }),
    ...(record.hints === undefined ? {} : { hints: parseTextInputs(record.hints, "hint") }),
    ...(record.mnemonics === undefined
      ? {}
      : { mnemonics: parseTextInputs(record.mnemonics, "mnemonic") }),
  };
}

function parseUpdateCardAnswersRequest(body: unknown): NormalizedAdminCardAnswersInput {
  const record = parseRecord(body, "Request body");
  const acceptedAnswerRecords = parseArray(record.acceptedAnswers, "acceptedAnswers");
  const blockedAnswerRecords = parseArray(record.blockedAnswers, "blockedAnswers");

  return {
    acceptedAnswers: acceptedAnswerRecords.map((value, index) => {
      const answer = parseRecord(value, `acceptedAnswers[${index}]`);
      const answerKind = parseAnswerKind(answer.answerKind);
      const locale = parseContentLocale(answer.locale);
      const text = parseRequiredString(answer.text, `acceptedAnswers[${index}].text`, {
        maxLength: MAX_ANSWER_LENGTH,
      });
      const normalizedText =
        answerKind === "reading" ? normalizeJapaneseReading(text) : normalizeMeaning(text, locale);

      if (normalizedText === "") {
        throw new BadRequestException(
          `acceptedAnswers[${index}].text is empty after normalization.`,
        );
      }

      return {
        locale,
        text,
        normalizedText,
        answerKind,
        isPrimary: answer.isPrimary === true,
      };
    }),
    blockedAnswers: blockedAnswerRecords.map((value, index) => {
      const answer = parseRecord(value, `blockedAnswers[${index}]`);
      const text = parseRequiredString(answer.text, `blockedAnswers[${index}].text`, {
        maxLength: MAX_ANSWER_LENGTH,
      });
      const normalizedText = normalizeMeaning(text, "ru-RU");

      if (normalizedText === "") {
        throw new BadRequestException(
          `blockedAnswers[${index}].text is empty after normalization.`,
        );
      }

      return {
        text,
        normalizedText,
        reason: parseOptionalString(answer.reason, `blockedAnswers[${index}].reason`, {
          maxLength: MAX_BLOCKED_REASON_LENGTH,
        }),
      };
    }),
  };
}

function parseOptionalStatus(value: unknown): AdminContentStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === "draft" ||
    value === "needs-review" ||
    value === "published" ||
    value === "archived"
  ) {
    return value;
  }

  throw new BadRequestException("status must be draft, needs-review, published, or archived.");
}

function parseOptionalMeanings(
  value: unknown,
): NonNullable<AdminUpdateItemRequest["meanings"]> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = parseRecord(value, "meanings");

  return {
    ...(record.ru === undefined
      ? {}
      : {
          ru: parseRequiredString(record.ru, "meanings.ru", {
            maxLength: MAX_MEANING_LENGTH,
          }),
        }),
    ...(record.en === undefined
      ? {}
      : {
          en: parseRequiredString(record.en, "meanings.en", {
            maxLength: MAX_MEANING_LENGTH,
          }),
        }),
  };
}

function parseTextInputs(
  value: unknown,
  label: "hint" | "mnemonic",
): readonly NormalizedAdminTextInput[] {
  return parseArray(value, `${label}s`).map((item, index) => {
    const record = parseRecord(item, `${label}s[${index}]`);
    const type = label === "hint" ? parseHintType(record.type) : parseMnemonicType(record.type);

    return {
      locale: parseContentLocale(record.locale),
      type,
      body:
        parseOptionalString(record.body, `${label}s[${index}].body`, {
          maxLength: MAX_TEXT_BODY_LENGTH,
        }) ?? "",
    };
  });
}

function parseHintType(
  value: unknown,
): NonNullable<AdminUpdateItemRequest["hints"]>[number]["type"] {
  if (value === "meaning" || value === "reading" || value === "usage") {
    return value;
  }

  throw new BadRequestException("hint type must be meaning, reading, or usage.");
}

function parseMnemonicType(
  value: unknown,
): NonNullable<AdminUpdateItemRequest["mnemonics"]>[number]["type"] {
  if (value === "meaning" || value === "reading" || value === "story") {
    return value;
  }

  throw new BadRequestException("mnemonic type must be meaning, reading, or story.");
}

function parseAnswerKind(value: unknown): CardAnswerType {
  if (value === "meaning" || value === "reading") {
    return value;
  }

  throw new BadRequestException("answerKind must be meaning or reading.");
}

function parseContentLocale(value: unknown): ContentLocale {
  if (value === "ru-RU" || value === "en-US") {
    return value;
  }

  throw new BadRequestException("locale must be ru-RU or en-US.");
}

function parseArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${label} must be an array.`);
  }

  return value;
}

function parseRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function parseRequiredString(
  value: unknown,
  label: string,
  options: { readonly maxLength: number },
): string {
  const parsed = parseOptionalString(value, label, options);

  if (parsed === null || parsed === "") {
    throw new BadRequestException(`${label} is required.`);
  }

  return parsed;
}

function parseOptionalString(
  value: unknown,
  label: string,
  options: { readonly maxLength: number },
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestException(`${label} must be a string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > options.maxLength) {
    throw new BadRequestException(`${label} is too long.`);
  }

  return trimmed;
}
