import { describe, expect, it } from "vitest";
import { listKana } from "@kanji-srs/japanese";
import { type KanaLessonUnitDto } from "@kanji-srs/shared";
import {
  filterKanaUnits,
  findKanaLessonUnits,
  groupKanaCharacters,
  summarizeKanaContent,
  selectKanaResumeUnit,
  findKanaPrerequisite,
} from "../src/lib/kana-unit-groups";

const items = listKana("hiragana").map((item) => ({
  ...item,
  attemptCount: 3,
  correctCount: 3,
  currentStreak: 3,
  mastered: item.variant === "basic",
  lastAnsweredAt: null,
}));
const units: readonly KanaLessonUnitDto[] = [
  {
    id: "mixed",
    script: "hiragana",
    title: "Fixture",
    order: 1,
    unlocked: false,
    complete: false,
    masteredCount: 46,
    totalCount: items.length,
    items,
  },
];
describe("kana chart groups", () => {
  it("explains the first unmet prerequisite using original units, never filtered ordinals", () => {
    const open = { ...units[0]!, id: 'first', unlocked: true };
    const locked = { ...units[0]!, id: 'later' };
    expect(findKanaPrerequisite([open, locked], 'later')).toBe(open);
    expect(findKanaPrerequisite([open, locked], 'first')).toBeNull();
    expect(findKanaPrerequisite([open, locked], 'missing')).toBeNull();
    expect(findKanaPrerequisite([{ ...open, complete: true }, locked], 'later')).toBeNull();
  });
  it("resumes only nonempty unlocked lessons and handles complete or empty paths", () => {
    const completed = { ...units[0]!, id: 'complete', unlocked: true, complete: true };
    const next = { ...units[0]!, id: 'next', unlocked: true };
    expect(selectKanaResumeUnit([completed, next, units[0]!])).toBe(next);
    expect(selectKanaResumeUnit([completed, units[0]!])).toBe(completed);
    expect(selectKanaResumeUnit([units[0]!])).toBeNull();
    expect(selectKanaResumeUnit([{ ...next, items: [] }])).toBeNull();
    expect(selectKanaResumeUnit([])).toBeNull();
  });
  it.each([
    ["hiragana", 11],
    ["katakana", 9],
  ] as const)("separates 46 signs from combinations and exercises for %s", (script, exercises) => {
    const content = listKana(script).map((item) => ({
      ...item,
      mastered: item.variant === "basic",
    }));
    expect(summarizeKanaContent(content)).toEqual([
      { id: "basic", label: "Основные знаки", total: 46, mastered: 46 },
      { id: "modified", label: "Дакутэн и хандакутэн", total: 25, mastered: 0 },
      { id: "combinations", label: "Сочетания", total: 33, mastered: 0 },
      { id: "exercises", label: "Упражнения", total: exercises, mastered: 0 },
    ]);
    expect(summarizeKanaContent([])).toEqual([]);
  });
  it("groups every assessment sign once in teaching order and preserves progress objects", () => {
    const groups = groupKanaCharacters(items);
    expect(groups[0]?.variant).toBe("basic");
    expect(groups[0]?.items).toHaveLength(46);
    expect(groups.flatMap((group) => group.items)).toHaveLength(items.length);
    for (const group of groups) {
      expect(group.items.every((item) => item.variant === group.variant)).toBe(true);
      expect(group.items.every((item) => items.some((original) => original === item))).toBe(true);
    }
    expect(groupKanaCharacters([])).toEqual([]);
  });
  it("finds title, glyph and normalized romaji while returning the original locked unit", () => {
    for (const query of ["fixture", "が", " ＧＡ "])
      expect(findKanaLessonUnits(units, query, "dakuten")[0]).toBe(units[0]);
    expect(findKanaLessonUnits(units, "が", "basic")).toEqual([]);
    expect(findKanaLessonUnits(units, "absent", "all")).toEqual([]);
    expect(findKanaLessonUnits(units, "", "all")[0]?.items).toBe(units[0]?.items);
  });
  it("keeps exactly 46 basic signs separate from modified and combined sounds", () => {
    const original = structuredClone(units);
    expect(filterKanaUnits(units, "basic")[0]).toMatchObject({
      totalCount: 46,
      masteredCount: 46,
      complete: true,
      unlocked: false,
    });
    expect(
      filterKanaUnits(units, "dakuten")[0]?.items.every((item) => item.variant === "dakuten"),
    ).toBe(true);
    expect(filterKanaUnits(units, "handakuten")[0]?.totalCount).toBe(5);
    expect(filterKanaUnits(units, "all")).toBe(units);
    expect(units).toEqual(original);
  });
  it("omits empty groups without unlocking lessons or inventing mastery", () => {
    expect(
      filterKanaUnits(
        [{ ...units[0]!, items: items.filter((item) => item.variant === "basic") }],
        "yoon",
      ),
    ).toEqual([]);
    expect(filterKanaUnits(units, "yoon")[0]).toMatchObject({
      masteredCount: 0,
      complete: false,
      unlocked: false,
    });
  });
});
