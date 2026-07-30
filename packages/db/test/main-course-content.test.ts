import { describe, expect, it } from "vitest";

import {
  buildMainCourseContentBatches,
  type MainCourseContentBatch,
  validateMainCourseContentBatches,
} from "../src/main-course-content";

describe("main-course content batches", () => {
  it("defines the reviewed Task 118 foundation batch", () => {
    const batches = buildMainCourseContentBatches();

    expect(validateMainCourseContentBatches(batches)).toEqual([]);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({
      id: "task-118-foundation-kanji-01",
      version: "1",
      reviewedAt: "2026-07-29",
      courseSlug: "japanese-ru-n2",
      componentLevelNumber: 1,
    });
    expect(batches[0]?.components).toHaveLength(26);
    expect(batches[0]?.kanji.map((item) => item.character)).toEqual([
      "日",
      "人",
      "大",
      "十",
      "二",
      "三",
      "月",
      "本",
      "中",
      "出",
      "分",
      "見",
      "国",
      "会",
      "年",
      "長",
      "行",
      "社",
      "時",
      "後",
    ]);
  });

  it("keeps every kanji bilingual, source-backed, and prerequisite-safe", () => {
    const batch = requiredBatch();
    const componentKeys = new Set(batch.components.map((item) => item.key));

    for (const item of batch.kanji) {
      expect(item.meanings.ru.primary).not.toBe("");
      expect(item.meanings.en.primary).not.toBe("");
      expect(item.meanings.ru.accepted).toContain(item.meanings.ru.primary);
      expect(item.meanings.en.accepted).toContain(item.meanings.en.primary);
      expect(item.reading.source).not.toBe("");
      expect(item.reading.accepted).toContain(item.reading.primary);
      expect(item.requireStrokeData).toBe(true);
      expect(item.levelNumber).toBeGreaterThan(batch.componentLevelNumber);
      expect(item.componentKeys.length).toBeGreaterThan(0);
      expect(item.componentKeys.every((key) => componentKeys.has(key))).toBe(true);
      expect(item.meaningMnemonic.ru).not.toBe("");
      expect(item.meaningMnemonic.en).not.toBe("");
      expect(item.readingMnemonic.ru).not.toBe("");
      expect(item.readingMnemonic.en).not.toBe("");
    }
  });

  it("rejects duplicate placements and missing component references", () => {
    const batch = requiredBatch();
    const first = requiredKanji(batch, 0);
    const second = requiredKanji(batch, 1);
    const invalid: MainCourseContentBatch = {
      ...batch,
      kanji: [
        { ...first, componentKeys: ["component-not-defined"] },
        { ...second, levelNumber: first.levelNumber, sortOrder: first.sortOrder },
        ...batch.kanji.slice(2),
      ],
    };

    expect(validateMainCourseContentBatches([invalid])).toEqual(
      expect.arrayContaining([
        `duplicate kanji placement ${first.levelNumber}:${first.sortOrder}`,
        `${batch.id} kanji ${first.character} references missing component-not-defined`,
      ]),
    );
  });

  it("rejects a taught reading that differs from its KANJIDIC2 source form", () => {
    const batch = requiredBatch();
    const first = requiredKanji(batch, 0);
    const invalid: MainCourseContentBatch = {
      ...batch,
      kanji: [
        {
          ...first,
          reading: { ...first.reading, source: "ニチ", primary: "じつ", accepted: ["じつ"] },
        },
        ...batch.kanji.slice(1),
      ],
    };

    expect(validateMainCourseContentBatches([invalid])).toContain(
      `${batch.id} kanji ${first.character} has an invalid taught reading`,
    );
  });
});

function requiredBatch(): MainCourseContentBatch {
  const batch = buildMainCourseContentBatches()[0];

  if (batch === undefined) {
    throw new Error("Expected the first main-course content batch.");
  }

  return batch;
}

function requiredKanji(batch: MainCourseContentBatch, index: number) {
  const item = batch.kanji[index];

  if (item === undefined) {
    throw new Error(`Expected kanji at index ${index}.`);
  }

  return item;
}
