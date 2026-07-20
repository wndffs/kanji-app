import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  CONFUSABLE_RELATION_KINDS,
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  type ActiveConfusablePracticeSessionResponse,
  type AdminConfusablePairDto,
  type AdminConfusablePairListResponse,
  type BilingualTextDto,
  type ConfusableComparisonDto,
  type ConfusablePairListResponse,
  type ConfusablePairSummaryDto,
  type ConfusablePracticeAnswerResponse,
  type ConfusablePracticeSessionDto,
  type ConfusablePracticeSessionResponse,
  type ConfusableRelationKind,
  type FinishConfusablePracticeSessionResponse,
  type PracticeAnswerResponse,
  type ReviewQueueCardDto,
  type TranslationBundleDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { type CurrentUserDto } from "../auth/auth.types";
import { OverridesService } from "../overrides/overrides.service";
import {
  getPracticeBlockedReason,
  getPracticeFeedbackMessage,
  toExpectedPracticeAnswers,
  toPracticeAnswerDiagnostic,
} from "../reviews/practice-answer-feedback";
import { ReviewsRepository } from "../reviews/reviews.repository";
import { type PracticeSessionRecord, type ReviewCardRecord } from "../reviews/reviews.types";
import { rankConfusablePairs } from "./confusable-ranking";
import { ConfusablesRepository } from "./confusables.repository";
import {
  type ConfusableComparisonRecord,
  type ConfusablePairRecord,
  type NormalizedCreateConfusablePairInput,
  type UpdateConfusablePairRecordInput,
} from "./confusables.types";

const CONFUSABLE_RECENT_MISTAKE_DAYS = 30;
const CONFUSABLE_PAIR_LIMIT = 20;
const MAX_ANSWER_LENGTH = 500;
const MAX_EXPLANATION_LENGTH = 2_000;
const MAX_SOURCE_NOTE_LENGTH = 500;

@Injectable()
export class ConfusablesService {
  constructor(
    @Inject(ConfusablesRepository)
    private readonly confusablesRepository: ConfusablesRepository,
    @Inject(ReviewsRepository) private readonly reviewsRepository: ReviewsRepository,
    @Inject(OverridesService) private readonly overridesService: OverridesService,
  ) {}

  async listPairs(user: CurrentUserDto, itemId?: string): Promise<ConfusablePairListResponse> {
    const normalizedItemId = normalizeOptionalId(itemId);
    const pairs = await this.confusablesRepository.listPublishedPairs(
      user.id,
      addDays(new Date(), -CONFUSABLE_RECENT_MISTAKE_DAYS),
      normalizedItemId,
    );

    return {
      pairs: rankConfusablePairs(pairs).slice(0, CONFUSABLE_PAIR_LIMIT).map(toPairSummaryDto),
    };
  }

  async getActiveSession(
    user: CurrentUserDto,
    pairId: string,
  ): Promise<ActiveConfusablePracticeSessionResponse> {
    const pair = await this.requirePublishedPair(pairId);
    const active = await this.reviewsRepository.findActivePracticeSession(
      user.id,
      "confusable-kanji",
      pair.id,
    );

    if (active === null) {
      return {
        pair: toPairSummaryDto(pair),
        session: null,
        cards: await this.loadPairCards(pair.id),
      };
    }

    if (active.currentIndex >= active.cardIds.length) {
      await this.reviewsRepository.finishPracticeSession(user.id, active.id, new Date());

      return {
        pair: toPairSummaryDto(pair),
        session: null,
        cards: await this.loadPairCards(pair.id),
      };
    }

    return this.toSessionResponse(pair, active);
  }

  async startSession(
    user: CurrentUserDto,
    pairId: string,
  ): Promise<ConfusablePracticeSessionResponse> {
    const pair = await this.requirePublishedPair(pairId);
    const active = await this.reviewsRepository.findActivePracticeSession(
      user.id,
      "confusable-kanji",
      pair.id,
    );

    if (active !== null) {
      return this.toSessionResponse(pair, active);
    }

    const cardIds = await this.confusablesRepository.findPairCardIds(pair.id);

    if (cardIds === null || cardIds.length !== 4) {
      throw new ConflictException("Для пары нужны карточки значения и чтения каждого кандзи.");
    }

    const session = await this.reviewsRepository.createPracticeSession({
      userId: user.id,
      now: new Date(),
      source: "confusable-kanji",
      contextId: pair.id,
      cardIds,
    });

    return this.toSessionResponse(pair, session);
  }

  async submitAnswer(
    user: CurrentUserDto,
    sessionId: string,
    body: unknown,
  ): Promise<ConfusablePracticeAnswerResponse> {
    const request = parseAnswer(body);
    const session = await this.requireSession(user.id, sessionId);
    const expectedCardId = session.cardIds[session.currentIndex];

    if (expectedCardId === undefined) {
      throw new BadRequestException("Сессия готова к завершению.");
    }

    if (request.cardId !== expectedCardId) {
      throw new BadRequestException("Карточка не совпадает с текущим шагом практики.");
    }

    const card = await this.reviewsRepository.findPublicPracticeCard(request.cardId);

    if (card === null) {
      throw new NotFoundException("Карточка практики не найдена.");
    }

    if (card.answerType !== request.answerType) {
      throw new BadRequestException(`answerType должен быть ${card.answerType}.`);
    }

    const validation = await this.overridesService.validateAnswerForUser({
      userId: user.id,
      cardId: card.id,
      answerKind: request.answerType,
      answer: request.answer,
    });
    const displayMode = user.settings.translationDisplayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE;
    const answer: PracticeAnswerResponse = {
      cardId: card.id,
      accepted: validation.accepted,
      result: validation.result,
      normalizedAnswer: validation.normalizedAnswer,
      matchedAnswer: validation.matchedAnswer,
      retry: validation.relatedAnswer !== undefined && validation.relatedAnswer !== null,
      feedback: {
        message: getPracticeFeedbackMessage(validation.result, validation.relatedAnswer),
        expected: toExpectedPracticeAnswers(card, displayMode),
        blockedReason: getPracticeBlockedReason(card, validation.matchedAnswer),
        diagnostic: toPracticeAnswerDiagnostic(validation.relatedAnswer),
      },
    };
    const comparisonRecord = await this.confusablesRepository.findComparison(session.contextId);

    if (comparisonRecord === null) {
      throw new NotFoundException("Сравнение пары больше недоступно.");
    }

    if (answer.retry) {
      return {
        answer,
        session: toSessionDto(session),
        comparison: toComparisonDto(comparisonRecord, displayMode),
      };
    }

    const updated = await this.reviewsRepository.updatePracticeSessionProgress({
      userId: user.id,
      sessionId,
      currentIndex: session.currentIndex + 1,
      progress: {
        answered: session.progress.answered + 1,
        accepted: session.progress.accepted + (answer.accepted ? 1 : 0),
        missed: session.progress.missed + (answer.accepted ? 0 : 1),
      },
    });

    if (updated === null) {
      throw new ConflictException("Прогресс практики изменился. Перезагрузите сессию.");
    }

    return {
      answer,
      session: toSessionDto(updated),
      comparison: toComparisonDto(comparisonRecord, displayMode),
    };
  }

  async finishSession(
    user: CurrentUserDto,
    sessionId: string,
  ): Promise<FinishConfusablePracticeSessionResponse> {
    const active = await this.requireSession(user.id, sessionId);

    if (active.currentIndex < active.cardIds.length) {
      throw new BadRequestException("В сессии остались карточки без ответа.");
    }

    const finished = await this.reviewsRepository.finishPracticeSession(
      user.id,
      sessionId,
      new Date(),
    );

    if (finished === null || finished.finishedAt === null) {
      throw new ConflictException("Не удалось завершить практику.");
    }

    return toFinishedResponse(
      finished as PracticeSessionRecord & { readonly contextId: string; readonly finishedAt: Date },
    );
  }

  async abandonSession(
    user: CurrentUserDto,
    sessionId: string,
  ): Promise<FinishConfusablePracticeSessionResponse> {
    await this.requireSession(user.id, sessionId);
    const finished = await this.reviewsRepository.abandonPracticeSession(
      user.id,
      sessionId,
      new Date(),
    );

    if (finished === null || finished.finishedAt === null) {
      throw new ConflictException("Не удалось завершить практику.");
    }

    return toFinishedResponse(
      finished as PracticeSessionRecord & { readonly contextId: string; readonly finishedAt: Date },
    );
  }

  async listAdminPairs(): Promise<AdminConfusablePairListResponse> {
    return {
      pairs: (await this.confusablesRepository.listAdminPairs()).map(toAdminPairDto),
    };
  }

  async createAdminPair(userId: string, body: unknown): Promise<AdminConfusablePairDto> {
    const input = parseCreatePair(body);
    const [left, right] = await Promise.all([
      this.confusablesRepository.findKanjiRefByItemId(input.leftItemId),
      this.confusablesRepository.findKanjiRefByItemId(input.rightItemId),
    ]);

    if (left === null || right === null) {
      throw new BadRequestException("Оба item ID должны указывать на кандзи.");
    }

    if (left.kanjiId === right.kanjiId) {
      throw new BadRequestException("Пара должна содержать два разных кандзи.");
    }

    const [canonicalLeft, canonicalRight] =
      left.kanjiId.localeCompare(right.kanjiId) < 0 ? [left, right] : [right, left];

    try {
      return toAdminPairDto(
        await this.confusablesRepository.createPair({
          ...input,
          left: canonicalLeft,
          right: canonicalRight,
          createdByUserId: userId,
        }),
      );
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Такая пара кандзи уже существует.");
      }

      throw error;
    }
  }

  async updateAdminPair(id: string, body: unknown): Promise<AdminConfusablePairDto> {
    const updated = await this.confusablesRepository.updatePair(id, parseUpdatePair(body));

    if (updated === null) {
      throw new NotFoundException("Пара кандзи не найдена.");
    }

    return toAdminPairDto(updated);
  }

  async publishAdminPair(userId: string, id: string): Promise<AdminConfusablePairDto> {
    const pair = (await this.confusablesRepository.listAdminPairs()).find(
      (candidate) => candidate.id === id,
    );

    if (pair === undefined) {
      throw new NotFoundException("Пара кандзи не найдена.");
    }

    if (pair.status === "published" || pair.status === "archived") {
      throw new ConflictException("Эта пара не ожидает публикации.");
    }

    const availableCardIds = await this.confusablesRepository.findPairCardIdsForApproval(id);

    if (availableCardIds === null || availableCardIds.length !== 4) {
      throw new BadRequestException(
        "Для публикации у обоих кандзи нужны опубликованные карточки значения и чтения.",
      );
    }

    const published = await this.confusablesRepository.publishPair(id, userId, new Date());

    if (published === null) {
      throw new ConflictException("Статус пары изменился. Обновите список.");
    }

    return toAdminPairDto(published);
  }

  private async requirePublishedPair(pairId: string): Promise<ConfusablePairRecord> {
    const pair = await this.confusablesRepository.findPublishedPair(pairId);

    if (pair === null) {
      throw new NotFoundException("Опубликованная пара кандзи не найдена.");
    }

    return pair;
  }

  private async requireSession(
    userId: string,
    sessionId: string,
  ): Promise<PracticeSessionRecord & { readonly contextId: string }> {
    const session = await this.reviewsRepository.findPracticeSession(userId, sessionId);

    if (session === null || session.source !== "confusable-kanji" || session.contextId === null) {
      throw new NotFoundException("Активная практика похожих кандзи не найдена.");
    }

    return session as PracticeSessionRecord & { readonly contextId: string };
  }

  private async loadPairCards(pairId: string): Promise<readonly ReviewQueueCardDto[]> {
    const cardIds = await this.confusablesRepository.findPairCardIds(pairId);

    if (cardIds === null) {
      throw new ConflictException("Материалы пары пока не готовы к практике.");
    }

    return this.loadCards(cardIds);
  }

  private async loadCards(cardIds: readonly string[]): Promise<readonly ReviewQueueCardDto[]> {
    const cards = await this.reviewsRepository.listPublicPracticeCardsByIds(cardIds);

    if (cards.length !== cardIds.length) {
      throw new NotFoundException("В сессии есть недоступные карточки.");
    }

    return cards.map(toCardDto);
  }

  private async toSessionResponse(
    pair: ConfusablePairRecord,
    session: PracticeSessionRecord,
  ): Promise<ConfusablePracticeSessionResponse> {
    return {
      pair: toPairSummaryDto(pair),
      session: toSessionDto(session),
      cards: await this.loadCards(session.cardIds),
    };
  }
}

function toPairSummaryDto(pair: ConfusablePairRecord): ConfusablePairSummaryDto {
  return {
    id: pair.id,
    kinds: pair.kinds,
    strength: pair.strength,
    recentWrongCount: pair.recentWrongCount,
    kanji: [toKanjiRefDto(pair.kanji[0]), toKanjiRefDto(pair.kanji[1])],
  };
}

function toKanjiRefDto(kanji: ConfusablePairRecord["kanji"][number]) {
  return {
    itemId: kanji.itemId,
    character: kanji.character,
    level: kanji.level,
    jlptLevel: kanji.jlptLevel,
  };
}

function toCardDto(card: ReviewCardRecord): ReviewQueueCardDto {
  return {
    id: card.id,
    learningItemId: card.learningItemId,
    itemType: card.itemType,
    cardType: card.cardType,
    promptType: card.promptType,
    answerType: card.answerType,
    prompt: {
      japanese: card.target.japanese,
      reading: card.target.reading,
    },
    sortOrder: card.sortOrder,
  };
}

function toSessionDto(session: PracticeSessionRecord): ConfusablePracticeSessionDto {
  if (session.contextId === null) {
    throw new Error("Confusable practice session is missing pair context.");
  }

  return {
    id: session.id,
    pairId: session.contextId,
    startedAt: session.startedAt.toISOString(),
    currentIndex: session.currentIndex,
    totalItems: session.cardIds.length,
    progress: session.progress,
  };
}

function toFinishedResponse(
  session: PracticeSessionRecord & { readonly finishedAt: Date },
): FinishConfusablePracticeSessionResponse {
  return {
    session: {
      ...toSessionDto(session),
      finishedAt: session.finishedAt.toISOString(),
    },
    summary: session.progress,
  };
}

function toComparisonDto(
  comparison: ConfusableComparisonRecord,
  displayMode: TranslationDisplayMode,
): ConfusableComparisonDto {
  const toKanji = (
    kanji: ConfusableComparisonRecord["kanji"][number],
  ): ConfusableComparisonDto["kanji"][number] => ({
    ...toKanjiRefDto(kanji),
    meanings: translationBundle(kanji.meanings, displayMode),
    readings: kanji.readings,
    components: kanji.components.map((item) => ({
      ...item,
      translations: translationBundle(item.translations, displayMode),
    })),
    vocabulary: kanji.vocabulary.map((item) => ({
      ...item,
      translations: translationBundle(item.translations, displayMode),
    })),
  });

  return {
    pairId: comparison.pair.id,
    kinds: comparison.pair.kinds,
    explanation: translationBundle(
      {
        ru:
          comparison.pair.explanationRu === null
            ? []
            : [
                {
                  locale: "ru-RU",
                  text: comparison.pair.explanationRu,
                  sourceKind: "curated",
                },
              ],
        en:
          comparison.pair.explanationEn === null
            ? []
            : [
                {
                  locale: "en-US",
                  text: comparison.pair.explanationEn,
                  sourceKind: "curated",
                },
              ],
      },
      displayMode,
    ),
    kanji: [toKanji(comparison.kanji[0]), toKanji(comparison.kanji[1])],
    source: {
      sourceKind: "curated",
      sourceNote: comparison.pair.sourceNote,
    },
  };
}

function translationBundle(
  texts: BilingualTextDto,
  displayMode: TranslationDisplayMode,
): TranslationBundleDto {
  const ru = texts.ru;
  const en = texts.en;

  return {
    ru,
    en,
    displayMode,
    primaryRu: ru.find((text) => text.isPrimary)?.text ?? ru[0]?.text ?? null,
    primaryEn: en.find((text) => text.isPrimary)?.text ?? en[0]?.text ?? null,
  };
}

function toAdminPairDto(pair: ConfusablePairRecord): AdminConfusablePairDto {
  return {
    ...toPairSummaryDto(pair),
    status: pair.status,
    explanationRu: pair.explanationRu,
    explanationEn: pair.explanationEn,
    sourceNote: pair.sourceNote,
    createdByUserId: pair.createdByUserId,
    approvedByUserId: pair.approvedByUserId,
    approvedAt: pair.approvedAt?.toISOString() ?? null,
    createdAt: pair.createdAt.toISOString(),
    updatedAt: pair.updatedAt.toISOString(),
  };
}

function parseCreatePair(body: unknown): NormalizedCreateConfusablePairInput {
  const record = parseRecord(body);

  return {
    leftItemId: requireString(record.leftItemId, "leftItemId", 100),
    rightItemId: requireString(record.rightItemId, "rightItemId", 100),
    ...parsePairContent(record),
  };
}

function parseUpdatePair(body: unknown): UpdateConfusablePairRecordInput {
  return parsePairContent(parseRecord(body));
}

function parsePairContent(record: Record<string, unknown>) {
  const kinds = Array.isArray(record.kinds)
    ? [...new Set(record.kinds.filter(isConfusableKind))]
    : [];

  if (kinds.length === 0) {
    throw new BadRequestException("Укажите visual и/или semantic тип связи.");
  }

  if (
    !Number.isInteger(record.strength) ||
    Number(record.strength) < 1 ||
    Number(record.strength) > 100
  ) {
    throw new BadRequestException("strength должен быть целым числом от 1 до 100.");
  }

  return {
    kinds,
    strength: Number(record.strength),
    explanationRu: optionalString(record.explanationRu, "explanationRu", MAX_EXPLANATION_LENGTH),
    explanationEn: optionalString(record.explanationEn, "explanationEn", MAX_EXPLANATION_LENGTH),
    sourceNote: requireString(record.sourceNote, "sourceNote", MAX_SOURCE_NOTE_LENGTH),
  };
}

function parseAnswer(body: unknown) {
  const record = parseRecord(body);
  const answerType = record.answerType;

  if (answerType !== "meaning" && answerType !== "reading") {
    throw new BadRequestException("answerType должен быть meaning или reading.");
  }

  return {
    cardId: requireString(record.cardId, "cardId", 100),
    answer: requireString(record.answer, "answer", MAX_ANSWER_LENGTH),
    answerType,
  };
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException("Тело запроса должно быть объектом.");
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestException(`${field} обязателен.`);
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw new BadRequestException(`${field} слишком длинный.`);
  }

  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return requireString(value, field, maxLength);
}

function isConfusableKind(value: unknown): value is ConfusableRelationKind {
  return (
    typeof value === "string" && (CONFUSABLE_RELATION_KINDS as readonly string[]).includes(value)
  );
}

function normalizeOptionalId(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized === undefined || normalized === "" ? undefined : normalized;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "P2002"
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
}
