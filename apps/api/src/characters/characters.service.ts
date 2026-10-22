import { Inject, Injectable } from "@nestjs/common";

import { calculateLeechScore } from "@kanji-srs/srs";
import {
  type CharacterHubKanjiItemDto,
  type CharacterHubKanjiSectionDto,
  type CharacterHubKanjiStudyState,
  type CharacterHubResponseDto,
} from "@kanji-srs/shared";

import { type CurrentUserDto } from "../auth/auth.types";
import { KanaService } from "../kana/kana.service";
import { CharactersRepository } from "./characters.repository";
import {
  type CharacterHubCourseLevelRecord,
  type CharacterHubCourseRecord,
  type CharacterHubKanjiRecord,
} from "./characters.types";

@Injectable()
export class CharactersService {
  constructor(
    @Inject(KanaService) private readonly kanaService: KanaService,
    @Inject(CharactersRepository) private readonly charactersRepository: CharactersRepository,
  ) {}

  async getHub(user: CurrentUserDto): Promise<CharacterHubResponseDto> {
    const [hiragana, katakana, course] = await Promise.all([
      this.kanaService.getCharacterHubSection(user.id, "hiragana"),
      this.kanaService.getCharacterHubSection(user.id, "katakana"),
      this.charactersRepository.findCurrentCourseKanji(user.id),
    ]);

    return {
      kana: { hiragana, katakana },
      kanji: toKanjiSection(course),
    };
  }
}

function toKanjiSection(course: CharacterHubCourseRecord | null): CharacterHubKanjiSectionDto {
  if (course === null) {
    return {
      progressModel: "srs",
      currentCourse: null,
      counts: { total: 0, learned: 0, passed: 0, burned: 0, weak: 0 },
      filters: { levels: [], bands: [], jlptLevels: [] },
      items: [],
    };
  }

  const items = course.levels.flatMap((level) => level.kanji.map((kanji) => toKanjiDto(kanji)));
  const currentLevel = findCurrentLevel(course.levels);

  return {
    progressModel: "srs",
    currentCourse: {
      id: course.id,
      title: course.title,
      currentLevel,
    },
    counts: {
      total: items.length,
      learned: items.filter((item) => item.studyState !== "not-started").length,
      passed: items.filter((item) => item.studyState === "passed").length,
      burned: items.filter((item) => item.studyState === "burned").length,
      weak: items.filter((item) => item.weak).length,
    },
    filters: {
      levels: uniqueSorted(items.map((item) => item.level)),
      bands: uniqueSorted(items.map((item) => item.band)),
      jlptLevels: uniqueSorted(
        items.flatMap((item) => (item.jlptLevel === null ? [] : [item.jlptLevel])),
      ),
    },
    items,
  };
}

function toKanjiDto(kanji: CharacterHubKanjiRecord): CharacterHubKanjiItemDto {
  const studyState = getStudyState(kanji);
  const startedStates = kanji.cards.flatMap((card) => (card.srs === null ? [] : [card.srs]));
  const representative = [...startedStates].sort(
    (left, right) => left.stageIndex - right.stageIndex,
  )[0];
  const weaknessScore = startedStates.reduce((maximum, state) => {
    const score = calculateLeechScore({
      wrongCount: state.wrongCount,
      correctStreak: state.correctStreak,
      burnedAt: state.burnedAt,
    }).score;

    return Math.max(maximum, score);
  }, 0);
  const weak = startedStates.some(
    (state) =>
      calculateLeechScore({
        wrongCount: state.wrongCount,
        correctStreak: state.correctStreak,
        burnedAt: state.burnedAt,
      }).isCandidate,
  );

  return {
    id: kanji.id,
    character: kanji.character,
    reading: kanji.reading,
    meaningRu: kanji.meaningRu,
    meaningEn: kanji.meaningEn,
    level: kanji.level,
    band: kanji.band,
    jlptLevel: toJlptLevel(kanji.jlptLevel),
    legacyJlptLevel: kanji.legacyJlptLevel ?? null,
    studyState,
    stageIndex: representative?.stageIndex ?? null,
    stageName: representative?.stageName ?? null,
    weaknessScore,
    weak,
    href: `/kanji/${encodeURIComponent(kanji.character)}`,
  };
}

function getStudyState(kanji: CharacterHubKanjiRecord): CharacterHubKanjiStudyState {
  if (
    kanji.cards.length > 0 &&
    kanji.cards.every((card) => card.srs !== null && card.srs.burnedAt !== null)
  ) {
    return "burned";
  }

  if (
    kanji.cards.length > 0 &&
    kanji.cards.every((card) => (card.srs?.stageIndex ?? 0) >= kanji.passStageIndex)
  ) {
    return "passed";
  }

  return kanji.cards.some((card) => card.srs !== null) ? "learning" : "not-started";
}

function findCurrentLevel(levels: readonly CharacterHubCourseLevelRecord[]): number {
  const withPolicyItems = levels.filter((level) => level.policyItemCount > 0);
  const current = withPolicyItems.find((level) => {
    if (level.completedAt !== null) {
      return false;
    }

    const required = Math.ceil((level.policyItemCount * level.requiredPercentage) / 100);

    return required === 0 || level.passedPolicyItemCount < required;
  });

  return current?.level ?? withPolicyItems.at(-1)?.level ?? levels.at(-1)?.level ?? 0;
}

function toJlptLevel(value: number | null): CharacterHubKanjiItemDto["jlptLevel"] {
  return value !== null && value >= 1 && value <= 5
    ? (`n${value}` as CharacterHubKanjiItemDto["jlptLevel"])
    : null;
}

function uniqueSorted<T extends string | number>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) =>
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right)),
  );
}
