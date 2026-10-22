import { describe, expect, it, vi } from "vitest";
import { PrismaCharactersRepository } from "../src/characters/characters.repository";

describe("character target loading", () => {
  it.each([0, 101])(
    "deduplicates and bounds %s targets while retaining course order and cards",
    async (count) => {
      const ids = Array.from({ length: count }, (_, index) => `kanji-${index}`);
      const source = count === 0 ? [] : [...ids, ids[0]!];
      const items = source.map((targetId, index) => ({
        sortOrder: index,
        learningItem: {
          id: `item-${index}`,
          kind: "KANJI",
          targetId,
          cards: [
            {
              id: `card-${index}`,
              answerType: "READING",
              promptType: "READING",
              answers: [{ locale: "ru-RU", answerKind: "READING", text: "ひ", isPrimary: true }],
              srsStates: [],
            },
          ],
        },
      }));
      const findMany = vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        [...where.id.in]
          .reverse()
          .map((id) => ({
            id,
            character: id,
            readings: [{ reading: "ニチ" }],
            meanings: [],
            jlptLevel: null,
            legacyJlptLevel: 4,
          })),
      );
      const db = {
        userSettings: { findUnique: vi.fn().mockResolvedValue({ currentCourseId: "course" }) },
        userEnrollment: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { courseId: "course", course: { slug: "pilot" }, startedAt: new Date(0) },
            ]),
        },
        course: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: "course",
              titleRu: "Курс",
              levels: [
                {
                  levelNumber: 1,
                  band: "FOUNDATION",
                  passPolicyJson: null,
                  completions: [],
                  items,
                },
              ],
            }),
        },
        kanji: { findMany },
      };
      const result = await new PrismaCharactersRepository({ db } as never).findCurrentCourseKanji(
        "owner",
      );
      expect(result!.levels[0]!.kanji.map((entry) => entry.character)).toEqual(source);
      expect(
        result!.levels[0]!.kanji.every(
          (entry) =>
            entry.reading === "ひ" && entry.legacyJlptLevel === 4 && entry.cards.length === 1,
        ),
      ).toBe(true);
      expect(findMany.mock.calls.map(([query]) => query.where.id.in.length)).toEqual(
        count === 0 ? [] : [100, 1],
      );
      expect(findMany.mock.calls.flatMap(([query]) => query.where.id.in)).toEqual(ids);
    },
  );
});
