import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
} from "../src/main-course-content";

describe("fifth source-checked kanji slice", () => {
  it("adds twenty distinct glyphs and ten components without occupying old placements", () => {
    const registry = buildMainCourseContentBatches().slice(0, 5);
    const batch = registry[4]!;
    expect(registry).toHaveLength(5);
    expect(batch).toMatchObject({
      id: "task-118-foundation-kanji-05",
      version: "1",
      reviewedAt: "2026-10-22",
      componentLevelNumber: 1,
      componentSortOrderStart: 54,
    });
    expect(batch.components).toHaveLength(10);
    expect(batch.components.map((item) => item.symbol)).toEqual([
      "入",
      "犬",
      "夕",
      "卜",
      "立",
      "王",
      "止",
      "赤",
      "糸",
      "車",
    ]);
    expect(
      batch.kanji.map((item) => [
        item.character,
        item.reading.source,
        item.reading.primary,
        item.reading.sourceType,
      ]),
    ).toEqual([
      ["入", "ニュウ", "にゅう", "ja_on"],
      ["休", "キュウ", "きゅう", "ja_on"],
      ["体", "タイ", "たい", "ja_on"],
      ["林", "リン", "りん", "ja_on"],
      ["森", "シン", "しん", "ja_on"],
      ["犬", "ケン", "けん", "ja_on"],
      ["夕", "セキ", "せき", "ja_on"],
      ["名", "メイ", "めい", "ja_on"],
      ["外", "ガイ", "がい", "ja_on"],
      ["多", "タ", "た", "ja_on"],
      ["立", "リツ", "りつ", "ja_on"],
      ["音", "オン", "おん", "ja_on"],
      ["王", "オウ", "おう", "ja_on"],
      ["玉", "ギョク", "ぎょく", "ja_on"],
      ["正", "セイ", "せい", "ja_on"],
      ["止", "シ", "し", "ja_on"],
      ["赤", "セキ", "せき", "ja_on"],
      ["白", "ハク", "はく", "ja_on"],
      ["糸", "シ", "し", "ja_on"],
      ["車", "シャ", "しゃ", "ja_on"],
    ]);
    expect(batch.kanji.every((item) => item.levelNumber === 4 && item.requireStrokeData)).toBe(
      true,
    );
    expect(batch.kanji.map((item) => item.sortOrder)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 22),
    );
    expect(validateMainCourseContentBatches(registry)).toEqual([]);
    expect(
      new Set(registry.flatMap((entry) => entry.kanji.map((item) => item.character))).size,
    ).toBe(81);
    expect(
      new Set(registry.flatMap((entry) => entry.components.map((item) => item.symbol))).size,
    ).toBe(63);
  });

  it("retains independent bilingual teaching and earlier composition without duplicate tree edges", () => {
    const registry = buildMainCourseContentBatches();
    const batch = registry[4]!;
    const components = new Set(
      registry.flatMap((entry) => entry.components.map((item) => item.key)),
    );
    for (const item of batch.kanji) {
      expect(item.componentKeys.length).toBeGreaterThan(0);
      expect(new Set(item.componentKeys).size).toBe(item.componentKeys.length);
      expect(item.componentKeys.every((key) => components.has(key))).toBe(true);
      expect(item.reading.accepted).toEqual([item.reading.primary]);
      for (const text of [item.meaningMnemonic, item.readingMnemonic]) {
        expect(text.ru.trim()).not.toBe("");
        expect(text.en.trim()).not.toBe("");
      }
    }
    const byCharacter = new Map(batch.kanji.map((item) => [item.character, item]));
    expect(byCharacter.get("林")!.componentKeys).toEqual(["component-tree"]);
    expect(byCharacter.get("森")!.componentKeys).toEqual(["component-tree"]);
    expect(byCharacter.get("夕")!.reading.sourceType).toBe("ja_on");
  });
});

describe("first N5-band kanji slice", () => {
  it("uses sixteen free component slots and twenty later kanji slots without moving Foundation", () => {
    const registry = buildMainCourseContentBatches().slice(0, 6);
    expect(registry).toHaveLength(6);
    const batch = registry[5]!;
    expect(batch).toMatchObject({
      id: "task-118-course-kanji-06",
      version: "1",
      reviewedAt: "2026-10-22",
      componentLevelNumber: 6,
      componentSortOrderStart: 41,
    });
    expect(createHash("sha256").update(JSON.stringify(batch)).digest("hex")).toBe(
      "74482be25706778fafe6e18b5ffc144718a3bf7a4181a5aacc8323516b223833",
    );
    expect(batch.components.map((item) => item.symbol)).toEqual([
      "艹",
      "化",
      "午",
      "牛",
      "馬",
      "鳥",
      "魚",
      "肉",
      "米",
      "食",
      "欠",
      "言",
      "舌",
      "売",
      "聿",
      "門",
    ]);
    expect(
      batch.kanji.map((item) => [item.character, item.reading.source, item.reading.primary]),
    ).toEqual([
      ["花", "カ", "か"],
      ["草", "ソウ", "そう"],
      ["早", "ソウ", "そう"],
      ["午", "ゴ", "ご"],
      ["牛", "ギュウ", "ぎゅう"],
      ["馬", "バ", "ば"],
      ["鳥", "チョウ", "ちょう"],
      ["魚", "ギョ", "ぎょ"],
      ["肉", "ニク", "にく"],
      ["米", "ベイ", "べい"],
      ["食", "ショク", "しょく"],
      ["飲", "イン", "いん"],
      ["言", "ゲン", "げん"],
      ["話", "ワ", "わ"],
      ["読", "ドク", "どく"],
      ["語", "ゴ", "ご"],
      ["書", "ショ", "しょ"],
      ["聞", "ブン", "ぶん"],
      ["門", "モン", "もん"],
      ["間", "カン", "かん"],
    ]);
    expect(
      batch.kanji.every(
        (item) =>
          item.levelNumber === 7 && item.requireStrokeData && item.reading.sourceType === "ja_on",
      ),
    ).toBe(true);
    expect(batch.kanji.map((item) => item.sortOrder)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(validateMainCourseContentBatches(registry)).toEqual([]);
    expect(
      new Set(registry.flatMap((entry) => entry.kanji.map((item) => item.character))).size,
    ).toBe(101);
    expect(
      new Set(registry.flatMap((entry) => entry.components.map((item) => item.symbol))).size,
    ).toBe(79);
    for (const item of batch.kanji) {
      expect(item.meanings.ru.accepted).toContain(item.meanings.ru.primary);
      expect(item.meanings.en.accepted).toContain(item.meanings.en.primary);
      expect(item.componentKeys.length).toBeGreaterThan(0);
      expect(Object.values(item.meaningMnemonic).every((text) => text.trim())).toBe(true);
      expect(Object.values(item.readingMnemonic).every((text) => text.trim())).toBe(true);
    }
    const rice = batch.kanji.find((item) => item.character === "米")!;
    expect(rice.meanings.en.accepted).toEqual(["rice"]);
    expect(rice.meanings.ru.accepted).not.toContain("США");
  });
});
