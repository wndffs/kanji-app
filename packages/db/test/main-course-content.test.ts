import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildMainCourseBlueprint } from "../src/main-course";
import {
  buildMainCourseContentBatches,
  type MainCourseContentBatch,
  validateMainCourseContentBatches,
} from "../src/main-course-content";

describe("main-course content batches", () => {
  it.each([0, 61, 1.5, NaN, Infinity])(
    "rejects unregistered component and kanji level %s in pure validation",
    (levelNumber) => {
      const first = requiredBatch();
      expect(
        validateMainCourseContentBatches([{ ...first, componentLevelNumber: levelNumber }]),
      ).toContain(`${first.id} has an invalid component level`);
      expect(
        validateMainCourseContentBatches([
          { ...first, kanji: [{ ...first.kanji[0]!, levelNumber }] },
        ]),
      ).toContain(`${first.id} kanji 日 has an invalid placement`);
    },
  );
  it("registers the independently reviewed fourth batch without duplicating earlier characters", () => {
    const batches = buildMainCourseContentBatches();
    const batch = batches[3]!;
    expect(batch).toMatchObject({
      id: "task-118-foundation-kanji-04",
      version: "1",
      reviewedAt: "2026-10-22",
      authoredAt: "2026-10-22",
      componentLevelNumber: 1,
      componentSortOrderStart: 41,
    });
    expect(batch.reviewNotes).toContain("Independently reviewed by the parent agent");
    expect(batch.reviewNotes).toContain("AI-authored");
    expect(createHash("sha256").update(JSON.stringify(batch)).digest("hex")).toBe(
      "5547b31673a20cffdfc817b0a95bd8b3e202108529c844f5090e0234fefa7850",
    );
    expect(batch.components).toHaveLength(13);
    expect(batch.kanji.map((item) => item.character).join("")).toBe(
      "四五六七八九口目耳手足雨空天気先生学小文",
    );
    const characters = batches
      .slice(0, 4)
      .flatMap((entry) => entry.kanji.map((item) => item.character));
    expect(characters).toHaveLength(61);
    expect(new Set(characters).size).toBe(61);
    expect(batch.kanji.every((item) => [2, 3, 4].includes(item.levelNumber))).toBe(true);
    expect(batch.kanji.map((item) => [item.reading.source, item.reading.accepted])).toEqual([
      ["シ", ["し"]],
      ["ゴ", ["ご"]],
      ["ロク", ["ろく"]],
      ["シチ", ["しち"]],
      ["ハチ", ["はち"]],
      ["キュウ", ["きゅう"]],
      ["くち", ["くち"]],
      ["モク", ["もく"]],
      ["ジ", ["じ"]],
      ["シュ", ["しゅ"]],
      ["ソク", ["そく"]],
      ["ウ", ["う"]],
      ["クウ", ["くう"]],
      ["テン", ["てん"]],
      ["キ", ["き"]],
      ["セン", ["せん"]],
      ["セイ", ["せい"]],
      ["ガク", ["がく"]],
      ["ショウ", ["しょう"]],
      ["ブン", ["ぶん"]],
    ]);
    expect(validateMainCourseContentBatches(batches)).toEqual([]);
    const mouth = batch.kanji.find((item) => item.character === "口")!;
    expect(mouth.reading.sourceType).toBe("ja_kun");
    const invalid = structuredClone(batch);
    Object.assign(invalid.kanji.find((item) => item.character === "口")!.reading, {
      sourceType: "pinyin",
    });
    expect(validateMainCourseContentBatches([...batches.slice(0, 3), invalid])).toContain(
      `${batch.id} kanji 口 has an invalid taught reading`,
    );
    expect(validateMainCourseContentBatches([batch])).toContain(
      `${batch.id} kanji 四 references missing component-enclosure`,
    );
    expect(
      validateMainCourseContentBatches([
        ...batches.slice(0, 3),
        { ...batch, componentSortOrderStart: 40 },
      ]),
    ).toContain("duplicate component placement 1:40");
    expect(
      validateMainCourseContentBatches([
        ...batches.slice(0, 3),
        {
          ...batch,
          kanji: [{ ...batch.kanji[0]!, levelNumber: 2, sortOrder: 21 }, ...batch.kanji.slice(1)],
        },
      ]),
    ).toContain("duplicate kanji placement 2:21");
  });

  it("defines the reviewed Task 118 foundation batch", () => {
    const batches = buildMainCourseContentBatches();

    expect(validateMainCourseContentBatches(batches)).toEqual([]);
    expect(batches).toHaveLength(5);
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

  it("preserves the entire first manifest, including its card identities and placements", () => {
    expect(createHash("sha256").update(JSON.stringify(requiredBatch())).digest("hex")).toBe(
      "34676566c590fd19d10349e6bb07c75d01471fc618872fa103db2e676fd138b8",
    );
    expect(requiredBatch()).not.toHaveProperty("componentSortOrderStart");
    expect(
      createHash("sha256").update(JSON.stringify(buildMainCourseContentBatches()[1])).digest("hex"),
    ).toBe("99268635c984603c30a1a53c2beb0bcd63a53316b9cb3a83b4e51c54e1c18714");
  });

  it("registers exactly one approved bridge kanji with no new components at free level 2 slot 21", () => {
    const batches = buildMainCourseContentBatches();
    const bridge = batches[2]!;
    expect(bridge).toMatchObject({
      id: "task-118-foundation-kanji-03",
      version: "1",
      authoredAt: "2026-10-22",
      reviewedAt: "2026-10-22",
      componentLevelNumber: 1,
      components: [],
    });
    expect(createHash("sha256").update(JSON.stringify(bridge)).digest("hex")).toBe(
      "fe1998be5842a0ca2f233670318949c51d82c58d68068851c3859f8e3560af92",
    );
    expect(bridge.kanji).toHaveLength(1);
    expect(bridge.kanji[0]).toMatchObject({
      character: "一",
      levelNumber: 2,
      sortOrder: 21,
      componentKeys: ["component-one-stroke"],
      meanings: {
        ru: { primary: "один", accepted: ["один", "единица"] },
        en: { primary: "one", accepted: ["one"] },
      },
      reading: { source: "イチ", primary: "いち", accepted: ["いち"] },
      requireStrokeData: true,
    });
    expect(
      batches
        .slice(0, 2)
        .flatMap((batch) => batch.kanji)
        .filter((content) => content.levelNumber === 2)
        .map((content) => content.sortOrder)
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 15 }, (_, index) => index + 1));
    expect(batches.slice(0, 3).flatMap((batch) => batch.components)).toHaveLength(40);
    expect(validateMainCourseContentBatches([bridge])).toContain(
      `${bridge.id} kanji 一 references missing component-one-stroke`,
    );
    expect(validateMainCourseContentBatches(batches)).toEqual([]);
  });

  it("pure-validates a selected bridge against the whole registry without a database URL", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const stdout = execFileSync(
      process.execPath,
      [
        join(root, "node_modules/tsx/dist/cli.mjs"),
        join(root, "packages/db/prisma/curate-main-course.ts"),
        "--batch",
        "task-118-foundation-kanji-03",
        "--validate-only",
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
    );
    const result = JSON.parse(stdout);
    expect(result).toMatchObject({
      status: "valid",
      selectedBatchId: "task-118-foundation-kanji-03",
      validatedBatchIds: buildMainCourseContentBatches().map((batch) => batch.id),
      batches: [
        {
          id: "task-118-foundation-kanji-03",
          reviewedAt: "2026-10-22",
          components: 0,
          kanji: 1,
          checksumSha256: "fe1998be5842a0ca2f233670318949c51d82c58d68068851c3859f8e3560af92",
        },
      ],
    });
    expect(result.batches).toHaveLength(1);
  });

  it.each([
    ["--unknown"],
    ["--validate-only", "--validate-only"],
    ["--validate-only", "--preflight-only"],
    ["--batch"],
    ["--batch", "--validate-only"],
    ["--batch", "unknown"],
    ["--batch", "task-118-foundation-kanji-03", "--batch", "task-118-foundation-kanji-03"],
  ])("rejects unsafe CLI flags before database construction: %j", (...args) => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const result = spawnSync(
      process.execPath,
      [
        join(root, "node_modules/tsx/dist/cli.mjs"),
        join(root, "packages/db/prisma/curate-main-course.ts"),
        ...args,
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Use no arguments|Unknown registered main-course batch/u);
    expect(result.stderr).not.toContain("DATABASE_URL is required");
    expect(result.stdout).toBe("");
  });

  it("adds only the reviewed bounded second batch with source-exact hiragana answers", () => {
    const batch = buildMainCourseContentBatches()[1]!;
    expect(batch).toMatchObject({
      id: "task-118-foundation-kanji-02",
      reviewedAt: "2026-10-22",
      authoredAt: "2026-10-22",
      componentSortOrderStart: 27,
    });
    expect(batch.reviewNotes).toContain("independently reviewed and corrected by the parent agent");
    expect(batch.components).toHaveLength(14);
    expect(batch.kanji.map((item) => item.character).join("")).toBe(
      "山川木水火土金石上下右左百千円力女男子田",
    );
    expect(batch.kanji.map((item) => [item.reading.source, item.reading.accepted])).toEqual([
      ["サン", ["さん"]],
      ["セン", ["せん"]],
      ["ボク", ["ぼく"]],
      ["スイ", ["すい"]],
      ["カ", ["か"]],
      ["ド", ["ど"]],
      ["キン", ["きん"]],
      ["セキ", ["せき"]],
      ["ジョウ", ["じょう"]],
      ["カ", ["か"]],
      ["ウ", ["う"]],
      ["サ", ["さ"]],
      ["ヒャク", ["ひゃく"]],
      ["セン", ["せん"]],
      ["エン", ["えん"]],
      ["リョク", ["りょく"]],
      ["ジョ", ["じょ"]],
      ["ダン", ["だん"]],
      ["シ", ["し"]],
      ["デン", ["でん"]],
    ]);
    expect(batch.kanji.every((item) => item.requireStrokeData)).toBe(true);
  });

  it("uses distinct glyphs and stable free placements within the real Foundation blueprint", () => {
    const batches = buildMainCourseContentBatches();
    const foundationLevels = new Set(
      buildMainCourseBlueprint()
        .levels.filter((level) => level.band === "FOUNDATION")
        .map((level) => level.levelNumber),
    );
    expect([...foundationLevels]).toEqual([1, 2, 3, 4, 5]);
    const slots: string[] = [];
    const symbols = batches.flatMap((batch) => batch.components.map((content) => content.symbol));
    expect(new Set(symbols).size).toBe(63);
    for (const batch of batches) {
      expect(foundationLevels.has(batch.componentLevelNumber)).toBe(true);
      slots.push(
        ...batch.components.map(
          (_, index) =>
            `${batch.componentLevelNumber}:${(batch.componentSortOrderStart ?? 1) + index}`,
        ),
      );
      for (const item of batch.kanji) {
        expect(foundationLevels.has(item.levelNumber)).toBe(true);
        slots.push(`${item.levelNumber}:${item.sortOrder}`);
      }
    }
    expect(new Set(slots).size).toBe(slots.length);
    expect(batches[1]?.kanji.map((item) => `${item.levelNumber}:${item.sortOrder}`)).toEqual([
      "2:8",
      "2:9",
      "2:10",
      "2:11",
      "2:12",
      "2:13",
      "2:14",
      "2:15",
      "3:6",
      "3:7",
      "3:8",
      "3:9",
      "3:10",
      "3:11",
      "3:12",
      "4:9",
      "4:10",
      "4:11",
      "4:12",
      "4:13",
    ]);
  });

  it("keeps every kanji bilingual, source-backed, and prerequisite-safe", () => {
    const componentKeys = new Set<string>();
    for (const batch of buildMainCourseContentBatches()) {
      for (const component of batch.components) componentKeys.add(component.key);

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
    }
  });

  it("rejects component offsets that collide with prior placements and forward references", () => {
    const [first, second] = buildMainCourseContentBatches() as readonly [
      MainCourseContentBatch,
      MainCourseContentBatch,
    ];
    expect(
      validateMainCourseContentBatches([first, { ...second, componentSortOrderStart: 26 }]),
    ).toContain("duplicate component placement 1:26");
    expect(validateMainCourseContentBatches([second, first])).toContain(
      `${second.id} kanji 山 references missing component-mountain`,
    );
  });

  it("rejects cross-course, later-level and repeated component prerequisites", () => {
    const [first, second] = buildMainCourseContentBatches() as readonly [
      MainCourseContentBatch,
      MainCourseContentBatch,
    ];
    expect(
      validateMainCourseContentBatches([{ ...first, courseSlug: "other-course" }, second]),
    ).toContain(`${second.id} kanji 山 references another course's component-mountain`);
    expect(
      validateMainCourseContentBatches([{ ...first, componentLevelNumber: 5, kanji: [] }, second]),
    ).toContain(`${second.id} kanji 山 needs earlier component-mountain`);
    const mountain = second.kanji[0]!;
    expect(
      validateMainCourseContentBatches([
        first,
        {
          ...second,
          kanji: [
            { ...mountain, componentKeys: ["component-mountain", "component-mountain"] },
            ...second.kanji.slice(1),
          ],
        },
      ]),
    ).toContain(`${second.id} kanji 山 repeats a component reference`);
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

  it("does not accept an untaught reading or katakana as a source-exact hiragana answer", () => {
    const batch = requiredBatch();
    const first = requiredKanji(batch, 0);
    for (const accepted of [
      ["にち", "じつ"],
      ["にち", "ニチ"],
    ]) {
      expect(
        validateMainCourseContentBatches([
          {
            ...batch,
            kanji: [{ ...first, reading: { ...first.reading, accepted } }, ...batch.kanji.slice(1)],
          },
        ]),
      ).toContain(`${batch.id} kanji 日 has an invalid taught reading`);
    }
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
