import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import {
  findBasicKana,
  isKanaRomajiAccepted,
  listBasicKana,
  normalizeRomaji,
  type KanaCharacter,
} from "@kanji-srs/japanese";
import {
  type KanaAssessmentAnswerRequest,
  type KanaAssessmentAnswerResponse,
  type KanaAssessmentItemDto,
  type KanaAssessmentProgressDto,
  type KanaScript,
} from "@kanji-srs/shared";

import { KanaRepository } from "./kana.repository";
import { type KanaProgressRecord } from "./kana.types";

export const KANA_MASTERY_STREAK = 3;
const MAX_ANSWER_LENGTH = 24;

@Injectable()
export class KanaService {
  constructor(@Inject(KanaRepository) private readonly kanaRepository: KanaRepository) {}

  async getProgress(userId: string, scriptValue: unknown): Promise<KanaAssessmentProgressDto> {
    const script = parseScript(scriptValue);
    const progress = await this.kanaRepository.listProgress(userId, script);

    return buildProgressDto(script, progress);
  }

  async answer(userId: string, body: unknown): Promise<KanaAssessmentAnswerResponse> {
    const request = parseAnswerRequest(body);
    const kana = findBasicKana(request.character);

    if (kana === null) {
      throw new BadRequestException("Неизвестный базовый знак кана.");
    }

    const normalizedAnswer = normalizeRomaji(request.answer);

    if (normalizedAnswer === "") {
      throw new BadRequestException("Ответ не должен быть пустым.");
    }

    const correct = isKanaRomajiAccepted(kana, request.answer);
    const updated = await this.kanaRepository.recordAttempt({
      userId,
      character: kana.character,
      script: kana.script,
      correct,
      masteryThreshold: KANA_MASTERY_STREAK,
      answeredAt: new Date(),
    });
    const progress = await this.kanaRepository.listProgress(userId, kana.script);
    const summary = summarizeProgress(kana.script, progress);

    return {
      correct,
      normalizedAnswer,
      expectedRomaji: kana.romaji,
      item: toItemDto(kana, updated),
      attemptedCount: summary.attemptedCount,
      masteredCount: summary.masteredCount,
    };
  }
}

function parseScript(value: unknown): KanaScript {
  if (value === undefined || value === null || value === "" || value === "hiragana") {
    return "hiragana";
  }

  if (value === "katakana") {
    return "katakana";
  }

  throw new BadRequestException("script должен быть hiragana или katakana.");
}

function parseAnswerRequest(value: unknown): KanaAssessmentAnswerRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException("Тело запроса должно быть JSON-объектом.");
  }

  const record = value as Record<string, unknown>;

  if (typeof record.character !== "string" || Array.from(record.character.trim()).length !== 1) {
    throw new BadRequestException("character должен содержать один знак кана.");
  }

  if (typeof record.answer !== "string") {
    throw new BadRequestException("answer должен быть строкой.");
  }

  if (record.answer.trim().length > MAX_ANSWER_LENGTH) {
    throw new BadRequestException("Ответ слишком длинный.");
  }

  return { character: record.character.trim(), answer: record.answer };
}

function buildProgressDto(
  script: KanaScript,
  progress: readonly KanaProgressRecord[],
): KanaAssessmentProgressDto {
  const progressByCharacter = new Map(progress.map((item) => [item.character, item]));
  const summary = summarizeProgress(script, progress);

  return {
    script,
    masteryThreshold: KANA_MASTERY_STREAK,
    totalCount: summary.totalCount,
    attemptedCount: summary.attemptedCount,
    masteredCount: summary.masteredCount,
    items: listBasicKana(script).map((kana) =>
      toItemDto(kana, progressByCharacter.get(kana.character) ?? null),
    ),
  };
}

function summarizeProgress(
  script: KanaScript,
  progress: readonly KanaProgressRecord[],
): {
  readonly totalCount: number;
  readonly attemptedCount: number;
  readonly masteredCount: number;
} {
  const characters = new Set(listBasicKana(script).map((kana) => kana.character));
  const relevant = progress.filter((item) => characters.has(item.character));

  return {
    totalCount: characters.size,
    attemptedCount: relevant.filter((item) => item.attemptCount > 0).length,
    masteredCount: relevant.filter((item) => item.masteredAt !== null).length,
  };
}

function toItemDto(
  kana: KanaCharacter,
  progress: KanaProgressRecord | null,
): KanaAssessmentItemDto {
  return {
    character: kana.character,
    script: kana.script,
    row: kana.row,
    order: kana.order,
    attemptCount: progress?.attemptCount ?? 0,
    correctCount: progress?.correctCount ?? 0,
    currentStreak: progress?.currentStreak ?? 0,
    mastered: progress?.masteredAt !== null && progress?.masteredAt !== undefined,
    lastAnsweredAt: progress?.lastAnsweredAt?.toISOString() ?? null,
  };
}
