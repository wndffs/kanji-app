import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";

import {
  buildAdaptiveKanaSession,
  findKana,
  isKanaRomajiAccepted,
  listKana,
  normalizeRomaji,
  type AdaptiveKanaCandidate,
  type KanaCharacter,
} from "@kanji-srs/japanese";
import {
  type KanaAssessmentAnswerRequest,
  type KanaAssessmentAnswerResponse,
  type KanaAssessmentItemDto,
  type KanaAssessmentProgressDto,
  type KanaLessonPathDto,
  type KanaLessonUnitDto,
  type KanaPracticeAnswerRequest,
  type KanaPracticeAnswerResponse,
  type KanaPracticeExerciseKind,
  type KanaPracticeSessionDto,
  type KanaPracticeScript,
  type KanaScript,
} from "@kanji-srs/shared";

import { KanaRepository } from "./kana.repository";
import {
  type KanaPracticeSessionRecord,
  KanaPracticeSessionConflictError,
  type KanaProgressRecord,
} from "./kana.types";

export const KANA_MASTERY_STREAK = 3;
const MAX_ANSWER_LENGTH = 24;
const KANA_PRACTICE_SESSION_SIZE = 12;

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

    const correct =
      request.selectedCharacter === undefined
        ? isKanaRomajiAccepted(kana, request.answer)
        : request.selectedCharacter === kana.character;
    const updated = await this.kanaRepository.recordAttempt({
      userId,
      character: kana.character,
      script: kana.script,
      correct,
      submittedAnswer: request.answer,
      selectedCharacter: request.selectedCharacter ?? null,
      exerciseKind: request.exerciseKind ?? "typing",
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

  async getPracticeSession(
    userId: string,
    scriptValue: unknown,
  ): Promise<KanaPracticeSessionDto> {
    const script = parsePracticeScript(scriptValue);
    const active = await this.kanaRepository.findActivePracticeSession(userId, script);

    if (active !== null) {
      return toPracticeSessionDto(active);
    }

    const now = new Date();
    const scripts: readonly KanaScript[] =
      script === "mixed" ? ["hiragana", "katakana"] : [script];
    const progressByScript = await Promise.all(
      scripts.map(async (candidateScript) => ({
        script: candidateScript,
        progress: await this.kanaRepository.listProgress(userId, candidateScript),
      })),
    );
    const attempts = await this.kanaRepository.listAttempts(userId, scripts);
    const candidates = progressByScript.flatMap(({ script: candidateScript, progress }) =>
      buildAdaptiveCandidates(candidateScript, progress),
    );
    const items = buildAdaptiveKanaSession({
      candidates,
      attempts,
      script,
      now,
      seed: `${userId}:${script}:${now.toISOString()}`,
      size: KANA_PRACTICE_SESSION_SIZE,
    });
    const session = await this.kanaRepository.createPracticeSession({
      userId,
      script,
      items,
      startedAt: now,
    });

    return toPracticeSessionDto(session);
  }

  async answerPractice(
    userId: string,
    body: unknown,
  ): Promise<KanaPracticeAnswerResponse> {
    const request = parsePracticeAnswerRequest(body);
    const session = await this.kanaRepository.findPracticeSession(userId, request.sessionId);

    if (session === null || session.finishedAt !== null) {
      throw new BadRequestException("Сессия практики не найдена или уже завершена.");
    }

    const exercise = session.items[session.currentIndex];

    if (exercise === undefined || exercise.id !== request.exerciseId) {
      throw new ConflictException("Очередь практики уже перешла к следующему заданию.");
    }

    const kana = findKana(exercise.character);

    if (kana === null) {
      throw new BadRequestException("В сессии находится неизвестный знак каны.");
    }

    const characterChoice = usesCharacterChoice(exercise.exerciseKind);
    const submittedAnswer = characterChoice ? null : request.answer?.trim() ?? null;
    const selectedCharacter = characterChoice ? request.selectedCharacter?.trim() ?? null : null;

    if (characterChoice && selectedCharacter === null) {
      throw new BadRequestException("selectedCharacter обязателен для этого упражнения.");
    }

    if (!characterChoice && (submittedAnswer === null || submittedAnswer === "")) {
      throw new BadRequestException("answer обязателен для этого упражнения.");
    }

    if (
      selectedCharacter !== null &&
      !exercise.choices.some((choice) => choice.character === selectedCharacter)
    ) {
      throw new BadRequestException("Выбранный знак отсутствует в вариантах ответа.");
    }

    const correct =
      selectedCharacter === null
        ? isKanaRomajiAccepted(kana, submittedAnswer!)
        : selectedCharacter === exercise.character;
    const attempts = await this.kanaRepository.listAttempts(userId, [
      "hiragana",
      "katakana",
    ]);
    const previouslyConfused =
      selectedCharacter !== null &&
      attempts.some(
        (attempt) =>
          attempt.expectedCharacter === exercise.character &&
          attempt.selectedCharacter === selectedCharacter &&
          !attempt.correct,
      );
    const answeredAt = new Date();

    let updatedSession: KanaPracticeSessionRecord;

    try {
      const result = await this.kanaRepository.recordPracticeAttempt({
        userId,
        sessionId: session.id,
        expectedSessionIndex: session.currentIndex,
        sessionItemCount: session.items.length,
        character: exercise.character,
        script: exercise.script,
        correct,
        submittedAnswer,
        selectedCharacter,
        exerciseKind: exercise.exerciseKind,
        masteryThreshold: KANA_MASTERY_STREAK,
        answeredAt,
      });
      updatedSession = result.session;
    } catch (error: unknown) {
      if (error instanceof KanaPracticeSessionConflictError) {
        throw new ConflictException("Очередь практики уже перешла к следующему заданию.");
      }

      throw error;
    }

    return {
      correct,
      normalizedAnswer: submittedAnswer === null ? null : normalizeRomaji(submittedAnswer),
      expectedCharacter: exercise.character,
      expectedRomaji: exercise.romaji,
      selectedCharacter,
      confusionExplanation:
        correct || selectedCharacter === null
          ? null
          : explainKanaConfusion(kana, selectedCharacter, previouslyConfused),
      session: toPracticeSessionDto(updatedSession),
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

  const exerciseKind =
    record.exerciseKind === undefined ? undefined : parseExerciseKind(record.exerciseKind);
  const selectedCharacter =
    record.selectedCharacter === undefined
      ? undefined
      : parseSelectedCharacter(record.selectedCharacter);

  return { character, answer: record.answer, exerciseKind, selectedCharacter };
}

function parsePracticeScript(value: unknown): KanaPracticeScript {
  if (value === undefined || value === null || value === "" || value === "hiragana") {
    return "hiragana";
  }

  if (value === "katakana" || value === "mixed") {
    return value;
  }

  throw new BadRequestException("script должен быть hiragana, katakana или mixed.");
}

function parsePracticeAnswerRequest(value: unknown): KanaPracticeAnswerRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException("Тело запроса должно быть JSON-объектом.");
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.sessionId !== "string" ||
    record.sessionId.trim() === "" ||
    typeof record.exerciseId !== "string" ||
    record.exerciseId.trim() === ""
  ) {
    throw new BadRequestException("sessionId и exerciseId обязательны.");
  }

  if (record.answer !== undefined && typeof record.answer !== "string") {
    throw new BadRequestException("answer должен быть строкой.");
  }

  if (typeof record.answer === "string" && record.answer.trim().length > MAX_ANSWER_LENGTH) {
    throw new BadRequestException("Ответ слишком длинный.");
  }

  return {
    sessionId: record.sessionId,
    exerciseId: record.exerciseId,
    ...(record.answer === undefined ? {} : { answer: record.answer }),
    ...(record.selectedCharacter === undefined
      ? {}
      : { selectedCharacter: parseSelectedCharacter(record.selectedCharacter) }),
  };
}

function parseSelectedCharacter(value: unknown): string {
  if (typeof value !== "string") {
    throw new BadRequestException("selectedCharacter должен быть строкой.");
  }

  const character = value.trim();

  if (Array.from(character).length < 1 || Array.from(character).length > 2) {
    throw new BadRequestException("selectedCharacter должен содержать знак или сочетание каны.");
  }

  return character;
}

function parseExerciseKind(value: unknown): KanaPracticeExerciseKind {
  if (
    value === "typing" ||
    value === "recognition-choice" ||
    value === "reverse-choice" ||
    value === "matching" ||
    value === "listening-choice" ||
    value === "tracing"
  ) {
    return value;
  }

  throw new BadRequestException("Неизвестный тип упражнения.");
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

function buildAdaptiveCandidates(
  script: KanaScript,
  progress: readonly KanaProgressRecord[],
): readonly AdaptiveKanaCandidate[] {
  const path = buildLessonPathDto(script, progress);

  return path.units.flatMap((unit) =>
    unit.items.map((item) => {
      const kana = findKana(item.character);

      if (kana === null) {
        throw new Error(`Unknown kana in lesson path: ${item.character}`);
      }

      return {
        ...kana,
        unlocked: unit.unlocked,
        attemptCount: item.attemptCount,
        correctCount: item.correctCount,
        currentStreak: item.currentStreak,
        mastered: item.mastered,
        lastAnsweredAt: item.lastAnsweredAt === null ? null : new Date(item.lastAnsweredAt),
      };
    }),
  );
}

function toPracticeSessionDto(session: KanaPracticeSessionRecord): KanaPracticeSessionDto {
  return {
    id: session.id,
    script: session.script,
    currentIndex: session.currentIndex,
    completedCount: Math.min(session.currentIndex, session.items.length),
    totalCount: session.items.length,
    startedAt: session.startedAt.toISOString(),
    exercise: session.items[session.currentIndex] ?? null,
  };
}

function usesCharacterChoice(kind: KanaPracticeExerciseKind): boolean {
  return (
    kind === "reverse-choice" ||
    kind === "matching" ||
    kind === "listening-choice" ||
    kind === "tracing"
  );
}

function explainKanaConfusion(
  expected: KanaCharacter,
  selectedCharacter: string,
  previouslyConfused: boolean,
): string {
  const selected = findKana(selectedCharacter);

  if (selected === null) {
    return `Нужно выбрать ${expected.character} (${expected.romaji}), а не ${selectedCharacter}.`;
  }

  if (selected.romaji === expected.romaji && selected.script !== expected.script) {
    return `${selected.character} и ${expected.character} передают звук ${expected.romaji}, но относятся к разным азбукам.`;
  }

  if (
    selected.baseCharacter === expected.baseCharacter &&
    selected.character !== expected.character
  ) {
    return `${selected.character} и ${expected.character} образованы от одного базового знака, но диакритика меняет чтение: ${selected.romaji} и ${expected.romaji}.`;
  }

  if (selected.row === expected.row) {
    return `Оба знака находятся в ряду ${expected.row.toUpperCase()}, поэтому сравните их гласную: ${selected.character} — ${selected.romaji}, ${expected.character} — ${expected.romaji}.`;
  }

  if (previouslyConfused) {
    return `${selected.character} снова появился как отвлекающий вариант из вашей истории ошибок. Сравните ${selected.romaji} с ${expected.romaji}.`;
  }

  return `Сравните форму и чтение: ${selected.character} — ${selected.romaji}, ${expected.character} — ${expected.romaji}.`;
}
