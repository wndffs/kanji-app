import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import {
  findKana,
  isKanaRomajiAccepted,
  listKana,
  normalizeRomaji,
  type KanaCharacter,
} from "@kanji-srs/japanese";
import {
  type KanaAssessmentAnswerRequest,
  type KanaAssessmentAnswerResponse,
  type KanaAssessmentItemDto,
  type KanaAssessmentProgressDto,
  type KanaLessonPathDto,
  type KanaLessonUnitDto,
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

  async getLessonPath(userId: string, scriptValue: unknown): Promise<KanaLessonPathDto> {
    const script = parseScript(scriptValue);
    const progress = await this.kanaRepository.listProgress(userId, script);

    return buildLessonPathDto(script, progress);
  }

  async answer(userId: string, body: unknown): Promise<KanaAssessmentAnswerResponse> {
    const request = parseAnswerRequest(body);
    const kana = findKana(request.character);

    if (kana === null) {
      throw new BadRequestException("Неизвестный знак кана.");
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

  if (typeof record.character !== "string") {
    throw new BadRequestException("character должен содержать один знак или сочетание кана.");
  }

  const character = record.character.trim();
  const characterLength = Array.from(character).length;

  if (characterLength < 1 || characterLength > 2) {
    throw new BadRequestException("character должен содержать один знак или сочетание кана.");
  }

  if (typeof record.answer !== "string") {
    throw new BadRequestException("answer должен быть строкой.");
  }

  if (record.answer.trim().length > MAX_ANSWER_LENGTH) {
    throw new BadRequestException("Ответ слишком длинный.");
  }

  return { character, answer: record.answer };
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
    items: listKana(script).map((kana) =>
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
  const characters = new Set(listKana(script).map((kana) => kana.character));
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
    variant: kana.variant,
    baseCharacter: kana.baseCharacter,
    attemptCount: progress?.attemptCount ?? 0,
    correctCount: progress?.correctCount ?? 0,
    currentStreak: progress?.currentStreak ?? 0,
    mastered: progress?.masteredAt !== null && progress?.masteredAt !== undefined,
    lastAnsweredAt: progress?.lastAnsweredAt?.toISOString() ?? null,
  };
}

const KANA_LESSON_GROUPS = [
  { id: "vowels", rows: ["vowels"], title: "Гласные" },
  { id: "k", rows: ["k"], title: "Ряд K" },
  { id: "s", rows: ["s"], title: "Ряд S" },
  { id: "t", rows: ["t"], title: "Ряд T" },
  { id: "n", rows: ["n"], title: "Ряд N" },
  { id: "h", rows: ["h"], title: "Ряд H" },
  { id: "m", rows: ["m"], title: "Ряд M" },
  { id: "y", rows: ["y"], title: "Ряд Y" },
  { id: "r", rows: ["r"], title: "Ряд R" },
  { id: "w-n", rows: ["w", "n-final"], title: "Ряд W и финальный N" },
  { id: "g", rows: ["g"], title: "Дакутэн: G" },
  { id: "z", rows: ["z"], title: "Дакутэн: Z" },
  { id: "d", rows: ["d"], title: "Дакутэн: D" },
  { id: "b", rows: ["b"], title: "Дакутэн: B" },
  { id: "p", rows: ["p"], title: "Хандакутэн: P" },
  { id: "ky", rows: ["ky"], title: "Ёон: KY" },
  { id: "sh", rows: ["sh"], title: "Ёон: SH" },
  { id: "ch", rows: ["ch"], title: "Ёон: CH" },
  { id: "ny", rows: ["ny"], title: "Ёон: NY" },
  { id: "hy", rows: ["hy"], title: "Ёон: HY" },
  { id: "my", rows: ["my"], title: "Ёон: MY" },
  { id: "ry", rows: ["ry"], title: "Ёон: RY" },
  { id: "gy", rows: ["gy"], title: "Ёон: GY" },
  { id: "j", rows: ["j"], title: "Ёон: J" },
  { id: "by", rows: ["by"], title: "Ёон: BY" },
  { id: "py", rows: ["py"], title: "Ёон: PY" },
  { id: "sokuon", rows: ["sokuon"], title: "Малая っ: удвоение" },
  { id: "long-vowels", rows: ["long-vowel"], title: "Долгие гласные" },
] as const;

function buildLessonPathDto(
  script: KanaScript,
  progress: readonly KanaProgressRecord[],
): KanaLessonPathDto {
  const progressByCharacter = new Map(progress.map((item) => [item.character, item]));
  const kana = listKana(script);
  let previousComplete = true;

  const units: KanaLessonUnitDto[] = KANA_LESSON_GROUPS.map((group, order) => {
    const items = kana
      .filter((item) => (group.rows as readonly string[]).includes(item.row))
      .map((item) => ({
        ...toItemDto(item, progressByCharacter.get(item.character) ?? null),
        romaji: item.romaji,
      }));
    const masteredCount = items.filter((item) => item.mastered).length;
    const complete = items.length > 0 && masteredCount === items.length;
    const unlocked = order === 0 || previousComplete;

    previousComplete = previousComplete && complete;

    return {
      id: `${script}-${group.id}`,
      script,
      title: group.title,
      order,
      unlocked,
      complete,
      masteredCount,
      totalCount: items.length,
      items,
    };
  });

  return {
    script,
    masteryThreshold: KANA_MASTERY_STREAK,
    masteredCount: units.reduce((count, unit) => count + unit.masteredCount, 0),
    totalCount: kana.length,
    units,
  };
}
