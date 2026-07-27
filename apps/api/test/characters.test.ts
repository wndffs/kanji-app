import { describe, expect, it } from "vitest";

import { type CharacterHubKanaSectionDto } from "@kanji-srs/shared";

import { type CurrentUserDto } from "../src/auth/auth.types";
import { CharactersRepository } from "../src/characters/characters.repository";
import { CharactersService } from "../src/characters/characters.service";
import {
  type CharacterHubCourseRecord,
  type CharacterHubKanjiRecord,
} from "../src/characters/characters.types";
import type { KanaService } from "../src/kana/kana.service";

describe("CharactersService", () => {
  it("keeps kana mastery and kanji SRS progress as separate sections", async () => {
    const service = new CharactersService(
      new StubKanaService() as KanaService,
      new StubCharactersRepository(buildCourse()),
    );

    const response = await service.getHub(buildUser());

    expect(response.kana.hiragana).toMatchObject({
      progressModel: "mastery",
      script: "hiragana",
    });
    expect(response.kana.katakana).toMatchObject({
      progressModel: "mastery",
      script: "katakana",
    });
    expect(response.kanji).toMatchObject({
      progressModel: "srs",
      currentCourse: {
        id: "course-1",
        title: "Основной курс",
        currentLevel: 1,
      },
      counts: {
        total: 4,
        learned: 3,
        passed: 1,
        burned: 1,
        weak: 1,
      },
      filters: {
        levels: [1],
        bands: ["n5"],
        jlptLevels: ["n5"],
      },
    });
    expect(response.kanji.items.map((item) => item.studyState)).toEqual([
      "not-started",
      "learning",
      "passed",
      "burned",
    ]);
    expect(response.kanji.items[1]).toMatchObject({
      character: "二",
      weak: true,
      href: "/kanji/%E4%BA%8C",
    });
  });

  it("returns empty kanji course data without affecting kana sections", async () => {
    const service = new CharactersService(
      new StubKanaService() as KanaService,
      new StubCharactersRepository(null),
    );

    const response = await service.getHub(buildUser());

    expect(response.kanji).toMatchObject({
      progressModel: "srs",
      currentCourse: null,
      counts: { total: 0, learned: 0, passed: 0, burned: 0, weak: 0 },
      items: [],
    });
    expect(response.kana.hiragana.totalCount).toBe(1);
  });

  it("uses the complete course pass policy when the current level has no kanji", async () => {
    const course = buildCourse();
    const service = new CharactersService(
      new StubKanaService() as KanaService,
      new StubCharactersRepository({
        ...course,
        levels: [
          {
            level: 1,
            completedAt: null,
            requiredPercentage: 90,
            policyItemCount: 5,
            passedPolicyItemCount: 1,
            kanji: [],
          },
          {
            ...course.levels[0],
            level: 2,
            kanji: [buildKanji("五", null)],
          },
        ],
      }),
    );

    const response = await service.getHub(buildUser());

    expect(response.kanji.currentCourse?.currentLevel).toBe(1);
    expect(response.kanji.items.map((item) => item.character)).toEqual(["五"]);
  });
});

class StubKanaService {
  async getCharacterHubSection(
    _userId: string,
    script: "hiragana" | "katakana",
  ): Promise<CharacterHubKanaSectionDto> {
    return buildKanaSection(script);
  }
}

class StubCharactersRepository extends CharactersRepository {
  constructor(private readonly course: CharacterHubCourseRecord | null) {
    super();
  }

  async findCurrentCourseKanji(_userId: string): Promise<CharacterHubCourseRecord | null> {
    return this.course;
  }
}

function buildKanaSection(
  script: "hiragana" | "katakana",
): CharacterHubKanaSectionDto {
  return {
    progressModel: "mastery",
    script,
    totalCount: 1,
    attemptedCount: 0,
    masteredCount: 0,
    units: [],
    weakSymbols: [],
    actions: {
      lessonsHref: `/kana?script=${script}&mode=lessons`,
      assessmentHref: `/kana?script=${script}&mode=assessment`,
      practiceHref: `/kana?script=${script}&mode=practice`,
    },
  };
}

function buildCourse(): CharacterHubCourseRecord {
  return {
    id: "course-1",
    title: "Основной курс",
    levels: [
      {
        level: 1,
        completedAt: null,
        requiredPercentage: 90,
        policyItemCount: 4,
        passedPolicyItemCount: 2,
        kanji: [
          buildKanji("一", null),
          buildKanji("二", {
            stageIndex: 2,
            stageName: "Apprentice 3",
            burnedAt: null,
            wrongCount: 10,
            correctStreak: 0,
          }),
          buildKanji("三", {
            stageIndex: 5,
            stageName: "Guru 1",
            burnedAt: null,
            wrongCount: 0,
            correctStreak: 3,
          }),
          buildKanji("四", {
            stageIndex: 8,
            stageName: "Burned",
            burnedAt: new Date("2026-07-20T12:00:00.000Z"),
            wrongCount: 2,
            correctStreak: 8,
          }),
        ],
      },
    ],
  };
}

function buildKanji(
  character: string,
  srs: CharacterHubKanjiRecord["cards"][number]["srs"],
): CharacterHubKanjiRecord {
  return {
    id: `item-${character}`,
    character,
    reading: "いち",
    meaningRu: "значение",
    meaningEn: "meaning",
    jlptLevel: 5,
    level: 1,
    band: "n5",
    sortOrder: character.codePointAt(0) ?? 0,
    passStageIndex: 5,
    cards: [{ id: `card-${character}`, srs }],
  };
}

function buildUser(): CurrentUserDto {
  return {
    id: "user-1",
    email: "user@example.test",
    displayName: "Ученик",
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
