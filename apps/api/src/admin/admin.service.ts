import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { normalizeJapaneseReading, normalizeMeaning } from "@kanji-srs/japanese";
import {
  type AdminContentStatus,
  type AdminCurriculumCompletenessReportDto,
  type AdminCurationItemDto,
  type AdminImportRunListResponse,
  type AdminImportedCandidateListResponse,
  type AdminReviewQueueResponse,
  type AdminUpdateItemRequest,
  type CardAnswerType,
  type ContentLocale,
  type CourseBand,
  isCourseBand,
} from "@kanji-srs/shared";

import { AdminRepository } from "./admin.repository";
import {
  previewAdminCardAnswersUpdate,
  previewAdminItemUpdate,
  getAdminQualityIssues,
} from "./curriculum-quality";
import {
  type NormalizedAdminCardAnswersInput,
  type NormalizedAdminApproveImportedTranslationInput,
  type NormalizedAdminItemCurationInput,
  type NormalizedAdminPromoteCandidateInput,
  type NormalizedAdminReviewQueueFilters,
  type NormalizedAdminTextInput,
} from "./admin.types";

const MAX_MEANING_LENGTH = 240;
const MAX_ANSWER_LENGTH = 120;
const MAX_ACCEPTED_ANSWERS_PER_LOCALE = 20;
const MAX_BLOCKED_REASON_LENGTH = 500;
const MAX_TEXT_BODY_LENGTH = 4_000;

@Injectable()
export class AdminService {
  constructor(@Inject(AdminRepository) private readonly adminRepository: AdminRepository) {}

  async listImportRuns(): Promise<AdminImportRunListResponse> {
    return {
      importRuns: await this.adminRepository.listImportRuns(),
    };
  }

  async listImportedCandidates(): Promise<AdminImportedCandidateListResponse> {
    return {
      candidates: await this.adminRepository.listImportedCandidates(),
    };
  }

  async listReviewItems(query: unknown = {}): Promise<AdminReviewQueueResponse> {
    const filters = parseReviewQueueFilters(query);

    return {
      items: await this.adminRepository.listReviewItems(filters),
    };
  }

  async getCompletenessReport(): Promise<AdminCurriculumCompletenessReportDto> {
    return this.adminRepository.getCompletenessReport();
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
    const current = await this.getCurationItem(itemId);

    if ((request.status ?? current.status) === "published") {
      assertPublishable(previewAdminItemUpdate(current, request));
    }

    const item = await this.adminRepository.updateItemCuration(itemId, request);

    if (item === null) {
      throw new NotFoundException("Learning item not found.");
    }

    return item;
  }

  async updateCardAnswers(cardId: string, body: unknown): Promise<AdminCurationItemDto> {
    const request = parseUpdateCardAnswersRequest(body);
    const current = await this.adminRepository.findItemByCardId(cardId);

    if (current !== null && current.status === "published") {
      assertPublishable(
        previewAdminCardAnswersUpdate(
          current,
          cardId,
          request.acceptedAnswers.map((answer, index) => ({
            id: `preview-answer-${index}`,
            cardId,
            locale: answer.locale,
            text: answer.text,
            normalizedText: answer.normalizedText,
            answerKind: answer.answerKind,
            isPrimary: answer.isPrimary,
          })),
          request.blockedAnswers.map((answer, index) => ({
            id: `preview-blocked-${index}`,
            cardId,
            text: answer.text,
            normalizedText: answer.normalizedText,
            reason: answer.reason,
          })),
        ),
      );
    }

    const item = await this.adminRepository.updateCardAnswers(cardId, request);

    if (item === null) {
      throw new NotFoundException("Learning card not found.");
    }

    return item;
  }

  async promoteImportedCandidate(body: unknown): Promise<AdminCurationItemDto> {
    const request = parsePromoteCandidateRequest(body);
    const item = await this.adminRepository.promoteImportedCandidate(request);

    if (item === null) {
      throw new NotFoundException("Import-derived target not found.");
    }

    return item;
  }

  async approveImportedTranslation(body: unknown): Promise<AdminCurationItemDto> {
    const request = parseApproveImportedTranslationRequest(body);
    const item = await this.adminRepository.approveImportedTranslation(request);

    if (item === null) {
      throw new NotFoundException("Import-derived bilingual target not found.");
    }

    return item;
  }
}

function parseReviewQueueFilters(query: unknown): NormalizedAdminReviewQueueFilters {
  const record =
    typeof query === "object" && query !== null ? (query as Record<string, unknown>) : {};

  return {
    ...(record.band === undefined ? {} : { band: parseCourseBand(record.band, "band") }),
    ...(record.jlptLevel === undefined ? {} : { jlptLevel: parseJlptLevel(record.jlptLevel) }),
    ...(record.status === undefined ? {} : { status: parseRequiredStatus(record.status) }),
    ...(record.missingAcceptedAnswers === undefined
      ? {}
      : {
          missingAcceptedAnswers: parseBooleanQuery(
            record.missingAcceptedAnswers,
            "missingAcceptedAnswers",
          ),
        }),
    ...(record.missingMnemonics === undefined
      ? {}
      : { missingMnemonics: parseBooleanQuery(record.missingMnemonics, "missingMnemonics") }),
  };
}

function parseUpdateItemRequest(body: unknown): NormalizedAdminItemCurationInput {
  const record = parseRecord(body, "Request body");
  const status = parseOptionalStatus(record.status);
  const band = record.band === undefined ? undefined : parseOptionalCourseBand(record.band, "band");
  const meanings = parseOptionalMeanings(record.meanings);

  return {
    ...(status === undefined ? {} : { status }),
    ...(band === undefined ? {} : { band }),
    ...(meanings === undefined ? {} : { meanings }),
    ...(record.hints === undefined ? {} : { hints: parseTextInputs(record.hints, "hint") }),
    ...(record.mnemonics === undefined
      ? {}
      : { mnemonics: parseTextInputs(record.mnemonics, "mnemonic") }),
  };
}

function parsePromoteCandidateRequest(body: unknown): NormalizedAdminPromoteCandidateInput {
  const record = parseRecord(body, "Request body");
  const targetType = parseItemKind(record.targetType);

  return {
    targetType,
    targetId: parseRequiredString(record.targetId, "targetId", { maxLength: 80 }),
    title: parseRequiredString(record.title, "title", { maxLength: 160 }),
    band: parseCourseBand(record.band, "band"),
    level: parseOptionalPositiveInteger(record.level, "level"),
  };
}

function parseApproveImportedTranslationRequest(
  body: unknown,
): NormalizedAdminApproveImportedTranslationInput {
  const record = parseRecord(body, "Request body");
  const targetType = parseImportedTranslationTargetType(record.targetType);
  const meanings = parseRecord(record.meanings, "meanings");
  const answers = parseRecord(record.acceptedAnswers, "acceptedAnswers");

  return {
    targetType,
    targetId: parseRequiredString(record.targetId, "targetId", { maxLength: 80 }),
    title: parseRequiredString(record.title, "title", { maxLength: 160 }),
    band: parseCourseBand(record.band, "band"),
    level: parseOptionalPositiveInteger(record.level, "level"),
    meanings: {
      ru: parseRequiredString(meanings.ru, "meanings.ru", { maxLength: MAX_MEANING_LENGTH }),
      en: parseRequiredString(meanings.en, "meanings.en", { maxLength: MAX_MEANING_LENGTH }),
    },
    acceptedAnswers: [
      ...parseAcceptedMeaningAnswers(answers.ru, "acceptedAnswers.ru", "ru-RU"),
      ...parseAcceptedMeaningAnswers(answers.en, "acceptedAnswers.en", "en-US"),
    ],
  };
}

function parseAcceptedMeaningAnswers(
  value: unknown,
  label: string,
  locale: ContentLocale,
): readonly NormalizedAdminApproveImportedTranslationInput["acceptedAnswers"][number][] {
  const normalized = new Set<string>();
  const values = parseArray(value, label);

  if (values.length > MAX_ACCEPTED_ANSWERS_PER_LOCALE) {
    throw new BadRequestException(
      `${label} must contain at most ${MAX_ACCEPTED_ANSWERS_PER_LOCALE} answers.`,
    );
  }

  const answers = values.map((answer, index) => {
    const text = parseRequiredString(answer, `${label}[${index}]`, {
      maxLength: MAX_ANSWER_LENGTH,
    });
    const normalizedText = normalizeMeaning(text, locale);

    if (normalizedText === "") {
      throw new BadRequestException(`${label}[${index}] is empty after normalization.`);
    }

    return { locale, text, normalizedText, answerKind: "meaning" as const };
  });

  if (answers.length === 0) {
    throw new BadRequestException(`${label} must contain at least one answer.`);
  }

  const uniqueAnswers = answers.filter((answer) => {
    if (normalized.has(answer.normalizedText)) {
      return false;
    }

    normalized.add(answer.normalizedText);
    return true;
  });

  return uniqueAnswers.map((answer, index) => ({ ...answer, isPrimary: index === 0 }));
}

function parseImportedTranslationTargetType(
  value: unknown,
): NormalizedAdminApproveImportedTranslationInput["targetType"] {
  if (value === "kanji" || value === "word") {
    return value;
  }

  throw new BadRequestException("targetType must be kanji or word.");
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

  return parseRequiredStatus(value);
}

function parseRequiredStatus(value: unknown): AdminContentStatus {
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

function parseCourseBand(value: unknown, label: string): CourseBand {
  if (typeof value === "string" && isCourseBand(value)) {
    return value;
  }

  throw new BadRequestException(`${label} must be foundation, n5, n4, n3, or n2.`);
}

function parseOptionalCourseBand(value: unknown, label: string): CourseBand | null {
  if (value === null || value === "") {
    return null;
  }

  return parseCourseBand(value, label);
}

function parseJlptLevel(value: unknown): "N5" | "N4" | "N3" | "N2" {
  if (value === "N5" || value === "N4" || value === "N3" || value === "N2") {
    return value;
  }

  throw new BadRequestException("jlptLevel must be N5, N4, N3, or N2.");
}

function parseBooleanQuery(value: unknown, label: string): boolean {
  if (value === true || value === "true" || value === "1") {
    return true;
  }

  if (value === false || value === "false" || value === "0") {
    return false;
  }

  throw new BadRequestException(`${label} must be true or false.`);
}

function parseItemKind(value: unknown): NormalizedAdminPromoteCandidateInput["targetType"] {
  if (value === "component" || value === "kanji" || value === "word" || value === "sentence") {
    return value;
  }

  throw new BadRequestException("targetType must be component, kanji, word, or sentence.");
}

function parseOptionalPositiveInteger(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`${label} must be a positive integer.`);
  }

  return parsed;
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

function assertPublishable(item: AdminCurationItemDto): void {
  const issues = getAdminQualityIssues(item);

  if (issues.length === 0) {
    return;
  }

  throw new BadRequestException(
    `Нельзя опубликовать материал: ${issues.map((issue) => issue.message).join(" ")}`,
  );
}
