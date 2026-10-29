import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildMainCourseContentBatches } from "../src/main-course-content";
import {
  buildMainCourseWordBatch,
  buildMainCourseWordBatches,
  mainCourseWordBatchChecksum,
  mainCourseWordAcceptedReadings,
  validateMainCourseWordBatch,
  validateMainCourseWordBatches,
  wordHanCharacters,
  authoredWordPartOfSpeech,
} from "../src/main-course-word-content";

describe("first bounded main-course vocabulary manifest", () => {
  it("keeps legacy noun metadata and rejects unsupported explicit authoring classes", () => {
    expect(authoredWordPartOfSpeech({})).toBe("noun (course-authored)");
    expect(authoredWordPartOfSpeech({partOfSpeech:"verb"})).toBe("verb (course-authored)");
    const batch = structuredClone(buildMainCourseWordBatch());
    Object.assign(batch.words[0]!,{partOfSpeech:"invented"});
    expect(validateMainCourseWordBatch(batch)).toContain("Invalid authored part of speech for 山.");
  });
  it("pins the independently reviewed manifest and exact twenty verified identities", () => {
    const batch = buildMainCourseWordBatch();
    expect(validateMainCourseWordBatch(batch)).toEqual([]);
    expect(batch).toMatchObject({
      id: "task-127-foundation-words-01",
      version: "1",
      reviewedAt: "2026-10-22",
      levelNumber: 5,
    });
    expect(batch.reviewNotes).toContain("Independently reviewed and corrected by the parent agent");
    expect(mainCourseWordBatchChecksum(batch)).toBe(
      "1ceeb2467961f707e57047ab0c46a91badaa048f036ac3299a5a7d0685f99daf",
    );
    expect(batch.words.map((word) => [word.expression, word.reading, word.jmdictEntryId])).toEqual([
      ["山", "やま", "jmdict:1302680"],
      ["川", "かわ", "jmdict:1390020"],
      ["水", "みず", "jmdict:1371260"],
      ["火", "ひ", "jmdict:1193610"],
      ["木", "き", "jmdict:1534520"],
      ["石", "いし", "jmdict:1382440"],
      ["土", "つち", "jmdict:1445270"],
      ["金", "かね", "jmdict:1242590"],
      ["女", "おんな", "jmdict:1344930"],
      ["男", "おとこ", "jmdict:1419990"],
      ["子", "こ", "jmdict:1307770"],
      ["田", "た", "jmdict:1442730"],
      ["上", "うえ", "jmdict:1352130"],
      ["下", "した", "jmdict:1184140"],
      ["右", "みぎ", "jmdict:1171010"],
      ["左", "ひだり", "jmdict:1290800"],
      ["円", "えん", "jmdict:1175570"],
      ["力", "ちから", "jmdict:1554820"],
      ["人", "ひと", "jmdict:1580640"],
      ["月", "つき", "jmdict:1255430"],
    ]);
    expect(batch.words.map((word) => word.sortOrder)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it("keeps bilingual teaching and original kana-readable examples within registered earlier kanji", () => {
    const registered = new Set(
      buildMainCourseContentBatches().flatMap((batch) =>
        batch.kanji.map((kanji) => kanji.character),
      ),
    );
    for (const word of buildMainCourseWordBatch().words) {
      expect(word.example.japaneseText).toContain(word.expression);
      expect(word.example.readingText).toContain(word.reading);
      expect(Object.values(word.example).every((text) => text.trim() !== "")).toBe(true);
      expect(
        wordHanCharacters(word.expression + word.example.japaneseText).every((character) =>
          registered.has(character),
        ),
      ).toBe(true);
      expect(word.meanings.ru.accepted[0]).toBe(word.meanings.ru.primary);
      expect(word.meanings.en.accepted[0]).toBe(word.meanings.en.primary);
      for (const text of [
        word.meaningMnemonic,
        word.readingMnemonic,
        word.meaningHint,
        word.readingHint,
      ])
        expect(text.ru.trim() !== "" && text.en.trim() !== "").toBe(true);
    }
    expect(
      buildMainCourseWordBatch().words.find((word) => word.expression === "金")?.meanings.en
        .accepted,
    ).toEqual(["money"]);
    expect(
      buildMainCourseWordBatch().words.find((word) => word.expression === "月")?.meanings.en
        .accepted,
    ).toEqual(["moon"]);
  });

  it("does not mutate existing kanji batches and hashes repeated builds identically", () => {
    const hash = () =>
      createHash("sha256").update(JSON.stringify(buildMainCourseContentBatches())).digest("hex");
    const before = hash();
    const batch = buildMainCourseWordBatch();
    validateMainCourseWordBatch(batch);
    expect(hash()).toBe(before);
    expect(mainCourseWordBatchChecksum(buildMainCourseWordBatch())).toBe(
      mainCourseWordBatchChecksum(batch),
    );
    expect(mainCourseWordBatchChecksum({ ...batch, reviewedAt: "2026-10-23" })).not.toBe(
      mainCourseWordBatchChecksum(batch),
    );
  });

  it.each(["reading", "placement", "bilingual", "example", "count", "meanings"])(
    "rejects invalid %s content before source reads",
    (condition) => {
      const batch = structuredClone(buildMainCourseWordBatch());
      const first = batch.words[0]!;
      const word =
        condition === "reading"
          ? { ...first, reading: "サン" }
          : condition === "placement"
            ? { ...first, sortOrder: 2 }
            : condition === "bilingual"
              ? { ...first, readingHint: { ru: "", en: "" } }
              : condition === "example"
                ? { ...first, example: { ...first.example, translationRu: "" } }
                : condition === "meanings"
                  ? {
                      ...first,
                      meanings: {
                        ...first.meanings,
                        en: { primary: "mountain", accepted: ["mountain", "MOUNTAIN"] },
                      },
                    }
                  : first;
      const invalid = {
        ...batch,
        words: condition === "count" ? batch.words.slice(1) : [word, ...batch.words.slice(1)],
      };
      expect(validateMainCourseWordBatch(invalid).length).toBeGreaterThan(0);
    },
  );

  it("dry-validates the guarded CLI with no database URL", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const stdout = execFileSync(
      process.execPath,
      [
        join(root, "node_modules/tsx/dist/cli.mjs"),
        join(root, "packages/db/prisma/curate-main-course-words.ts"),
        "--validate-only",
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
    );
    expect(JSON.parse(stdout)).toMatchObject({
      status: "valid-manifests",
      selectedBatchId: null,
      batches: [
        {
          batchId: "task-127-foundation-words-01",
          reviewedAt: "2026-10-22",
          words: 20,
          cards: 40,
          examples: 20,
          checksumSha256: mainCourseWordBatchChecksum(buildMainCourseWordBatch()),
        },
        {
          batchId: "task-127-foundation-words-02",
          reviewedAt: "2026-10-22",
          checksumSha256: "0110505331b1066653f4b62ce20f4c8bbb98e94ccf701eafac26ecda9a0e6a4f",
          words: 20,
          cards: 40,
          examples: 20,
        },
        {
          batchId: "task-127-foundation-words-03",
          reviewedAt: "2026-10-22",
          words: 20,
          cards: 40,
          examples: 20,
        },
        {
          batchId: "task-127-foundation-words-04",
          reviewedAt: "2026-10-22",
          words: 20,
          cards: 40,
          examples: 20,
        },
        {
          batchId: "task-127-course-words-05",
          reviewedAt: "2026-10-22",
          words: 20,
          cards: 40,
          examples: 20,
        },
        {
          batchId: "task-127-course-words-06",
          reviewedAt: "2026-10-22",
          words: 20,
          cards: 40,
          examples: 20,
        },
        {
          batchId: "task-127-course-words-07",
          reviewedAt: "2026-10-29",
          words: 20,
          cards: 40,
          examples: 20,
          checksumSha256: "8a7c53c07b87b31ecfa27173731c8213f755a3349332f40ef5372c46e521ebf4",
        },
      ],
    });
  });

  it.each([
    ["--prefligt-only"],
    ["--validate-only", "--preflight-only"],
    ["--validate-only", "--validate-only"],
    ["--batch"],
    ["--batch", "--validate-only"],
    ["--batch", "task-127-foundation-words-02", "--batch", "task-127-foundation-words-02"],
    ["--batch", "task-127-foundation-words-02", "--unknown"],
  ])("rejects unsafe or ambiguous CLI flags before database construction: %s", (...args) => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const result = spawnSync(
      process.execPath,
      [
        join(root, "node_modules/tsx/dist/cli.mjs"),
        join(root, "packages/db/prisma/curate-main-course-words.ts"),
        ...args,
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Use no arguments to apply");
    expect(result.stderr).not.toContain("DATABASE_URL is required");
  });

  it("rejects an unknown selected batch and requires a database URL for an approved selection before client construction", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    for (const [id, message] of [
      ["unknown", "Unknown registered word batch"],
      ["task-127-foundation-words-02", "DATABASE_URL is required"],
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          join(root, "node_modules/tsx/dist/cli.mjs"),
          join(root, "packages/db/prisma/curate-main-course-words.ts"),
          "--batch",
          id!,
        ],
        { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(message);
      if (id === "unknown") expect(result.stderr).not.toContain("DATABASE_URL is required");
      else expect(result.stderr).not.toContain("needs independent parent review");
    }
  });

  it("dry-validates a selected batch while still reporting the whole registered preflight set", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const stdout = execFileSync(
      process.execPath,
      [
        join(root, "node_modules/tsx/dist/cli.mjs"),
        join(root, "packages/db/prisma/curate-main-course-words.ts"),
        "--batch",
        "task-127-foundation-words-02",
        "--validate-only",
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
    );
    expect(JSON.parse(stdout)).toMatchObject({
      status: "valid-manifests",
      selectedBatchId: "task-127-foundation-words-02",
      batches: [
        { batchId: "task-127-foundation-words-01" },
        { batchId: "task-127-foundation-words-02", reviewedAt: "2026-10-22" },
        { batchId: "task-127-foundation-words-03", reviewedAt: "2026-10-22" },
        { batchId: "task-127-foundation-words-04", reviewedAt: "2026-10-22" },
        { batchId: "task-127-course-words-05", reviewedAt: "2026-10-22" },
        { batchId: "task-127-course-words-06", reviewedAt: "2026-10-22" },
        { batchId: "task-127-course-words-07", reviewedAt: "2026-10-29" },
      ],
    });
  });
});

describe("second bounded vocabulary batch and registry", () => {
  it("adds the exact approved twenty pairs at level 5 slots 21-40 without changing the frozen first batch", () => {
    const [first, second] = buildMainCourseWordBatches();
    expect(first).toBe(buildMainCourseWordBatch());
    expect(Object.hasOwn(first!, "sortOrderStart")).toBe(false);
    expect(mainCourseWordBatchChecksum(first!)).toBe(
      "1ceeb2467961f707e57047ab0c46a91badaa048f036ac3299a5a7d0685f99daf",
    );
    expect(second).toMatchObject({
      id: "task-127-foundation-words-02",
      version: "1",
      authoredAt: "2026-10-22",
      reviewedAt: "2026-10-22",
      levelNumber: 5,
      sortOrderStart: 21,
    });
    expect(mainCourseWordBatchChecksum(second!)).toBe(
      "0110505331b1066653f4b62ce20f4c8bbb98e94ccf701eafac26ecda9a0e6a4f",
    );
    expect(validateMainCourseWordBatches()).toEqual([]);
    expect(
      second!.words.map((word) => [word.expression, word.reading, word.jmdictEntryId]),
    ).toEqual([
      ["本", "ほん", "jmdict:1522150"],
      ["日本", "にほん", "jmdict:1582710"],
      ["一人", "ひとり", "jmdict:1576150"],
      ["二人", "ふたり", "jmdict:1582670"],
      ["大人", "おとな", "jmdict:1414170"],
      ["男子", "だんし", "jmdict:1420070"],
      ["女子", "じょし", "jmdict:1345140"],
      ["火山", "かざん", "jmdict:1193910"],
      ["水田", "すいでん", "jmdict:1371890"],
      ["上下", "じょうげ", "jmdict:1352710"],
      ["左右", "さゆう", "jmdict:1290810"],
      ["一月", "いちがつ", "jmdict:1162120"],
      ["二月", "にがつ", "jmdict:1461560"],
      ["三月", "さんがつ", "jmdict:1300250"],
      ["一日", "いちにち", "jmdict:1576260"],
      ["二日", "ふつか", "jmdict:1462900"],
      ["三日", "みっか", "jmdict:1301330"],
      ["十日", "とおか", "jmdict:1335000"],
      ["国", "くに", "jmdict:1592250"],
      ["中", "なか", "jmdict:1423310"],
    ]);
    expect(second!.words.map((word) => word.sortOrder)).toEqual(
      Array.from({ length: 20 }, (_, index) => 21 + index),
    );
  });

  it("has eighty RU/EN mnemonic texts, eighty hints and twenty varied original examples with no other scripts", () => {
    const second = buildMainCourseWordBatches()[1]!;
    const earlierHan = new Set(
      buildMainCourseContentBatches().flatMap((batch) =>
        batch.kanji.map((kanji) => kanji.character),
      ),
    );
    for (const kind of ["Mnemonic", "Hint"] as const) {
      const texts = second.words.flatMap((word) => [
        ...Object.values(word[`meaning${kind}`]),
        ...Object.values(word[`reading${kind}`]),
      ]);
      expect(texts).toHaveLength(80);
      expect(texts.every((text) => text.trim().length > 0)).toBe(true);
    }
    for (const word of second.words) {
      expect(word.example.japaneseText).toMatch(/^[\p{Script=Han}ぁ-ゖー、。！？\s]+$/u);
      expect(word.example.readingText).toMatch(/^[ぁ-ゖー、。！？\s]+$/u);
      expect(word.example.japaneseText).toContain(word.expression);
      expect(
        wordHanCharacters(word.example.japaneseText).every((character) =>
          earlierHan.has(character),
        ),
      ).toBe(true);
      expect(word.example.readingText).toContain(word.reading);
      expect(Object.values(word.example).every((text) => text.trim())).toBe(true);
    }
    expect(
      second.words.filter((word) => word.example.japaneseText.endsWith("です。")).length,
    ).toBeLessThan(5);
    const words = new Map(second.words.map((word) => [word.expression, word]));
    expect(words.get("一日")!.meanings.en.accepted).toEqual(["one day", "a whole day"]);
    expect(words.get("一日")!.reading).toBe("いちにち");
    for (const [expression, meaning] of [
      ["一月", "January"],
      ["二月", "February"],
      ["三月", "March"],
    ])
      expect(words.get(expression!)!.meanings.en.accepted).toEqual([meaning]);
    for (const [expression, en, ru] of [
      ["二日", ["two days", "second day of the month"], ["два дня", "второе число"]],
      ["三日", ["three days", "third day of the month"], ["три дня", "третье число"]],
      ["十日", ["ten days", "tenth day of the month"], ["десять дней", "десятое число"]],
    ] as const) {
      expect(words.get(expression)!.meanings.en.accepted).toEqual(en);
      expect(words.get(expression)!.meanings.ru.accepted).toEqual(ru);
    }
    expect(
      second.words
        .filter((word) => word.acceptedReadings !== undefined)
        .map((word) => [word.expression, mainCourseWordAcceptedReadings(word)]),
    ).toEqual([
      ["日本", ["にほん", "にっぽん"]],
      ["一人", ["ひとり", "いちにん"]],
      ["二人", ["ふたり", "ににん"]],
      ["水田", ["すいでん", "みずた"]],
      ["左右", ["さゆう", "そう"]],
    ]);
    expect(
      buildMainCourseWordBatch().words.every((word) => !Object.hasOwn(word, "acceptedReadings")),
    ).toBe(true);
  });

  it.each([
    { acceptedReadings: ["ほん"] },
    { acceptedReadings: ["ホン"] },
    { acceptedReadings: ["ほ ん"] },
    { acceptedReadings: ["ほーん", "ほーん"] },
  ])(
    "rejects invalid or normalized-duplicate extra readings $acceptedReadings",
    ({ acceptedReadings }) => {
      const batch = buildMainCourseWordBatches()[1]!;
      const invalid = {
        ...batch,
        words: [{ ...batch.words[0]!, acceptedReadings }, ...batch.words.slice(1)],
      };
      expect(validateMainCourseWordBatch(invalid)).toContain(
        "Invalid or duplicate accepted readings for 本:ほん.",
      );
    },
  );

  it.each(["batch-id", "word", "slot", "offset", "empty"])(
    "rejects cross-batch %s conflicts",
    (condition) => {
      const [first, second] = buildMainCourseWordBatches();
      const invalid =
        condition === "batch-id"
          ? { ...second!, id: first!.id }
          : condition === "word"
            ? {
                ...second!,
                words: [{ ...first!.words[0]!, sortOrder: 21 }, ...second!.words.slice(1)],
              }
            : condition === "slot"
              ? {
                  ...second!,
                  sortOrderStart: 1,
                  words: second!.words.map((word, index) => ({ ...word, sortOrder: index + 1 })),
                }
              : { ...second!, sortOrderStart: 0 };
      expect(
        validateMainCourseWordBatches(condition === "empty" ? [] : [first!, invalid]).length,
      ).toBeGreaterThan(0);
    },
  );
});

describe("reviewed third vocabulary batch", () => {
  it("adds twenty distinct beginner words at free slots with verified source identities", () => {
    const batches = buildMainCourseWordBatches();
    expect(batches).toHaveLength(7);
    const third = batches[2]!;
    expect(third).toMatchObject({
      id: "task-127-foundation-words-03",
      version: "1",
      authoredAt: "2026-10-22",
      reviewedAt: "2026-10-22",
      levelNumber: 5,
      sortOrderStart: 41,
    });
    expect(third.reviewNotes).toContain("Independently reviewed and corrected by the parent agent");
    expect(third.reviewNotes).toContain("AI-authored");
    expect(third.reviewNotes).toContain("no provenance exception");
    expect(mainCourseWordBatchChecksum(third)).toBe(
      "ef7090a4cea8c4b74c04a3cebfe85dc9832d64e1b7d071e409232287e7cf2ff4",
    );
    expect(third.words.map((word) => [word.expression, word.reading])).toEqual([
      ["口", "くち"],
      ["目", "め"],
      ["耳", "みみ"],
      ["手", "て"],
      ["足", "あし"],
      ["雨", "あめ"],
      ["空", "そら"],
      ["天気", "てんき"],
      ["空気", "くうき"],
      ["先生", "せんせい"],
      ["学生", "がくせい"],
      ["大学", "だいがく"],
      ["大学生", "だいがくせい"],
      ["小学生", "しょうがくせい"],
      ["一年生", "いちねんせい"],
      ["文学", "ぶんがく"],
      ["四月", "しがつ"],
      ["五月", "ごがつ"],
      ["出口", "でぐち"],
      ["人口", "じんこう"],
    ]);
    expect(third.words.map((word) => word.sortOrder)).toEqual(
      Array.from({ length: 20 }, (_, i) => 41 + i),
    );
    expect(third.words.map((word) => [word.expression, word.jmdictEntryId])).toEqual([
      ["口", "jmdict:1275640"],
      ["目", "jmdict:1604890"],
      ["耳", "jmdict:1317170"],
      ["手", "jmdict:1327190"],
      ["足", "jmdict:1404630"],
      ["雨", "jmdict:1171900"],
      ["空", "jmdict:1245290"],
      ["天気", "jmdict:1438690"],
      ["空気", "jmdict:1245470"],
      ["先生", "jmdict:1387990"],
      ["学生", "jmdict:1206900"],
      ["大学", "jmdict:1413240"],
      ["大学生", "jmdict:1413260"],
      ["小学生", "jmdict:1347880"],
      ["一年生", "jmdict:1165580"],
      ["文学", "jmdict:1505190"],
      ["四月", "jmdict:1307180"],
      ["五月", "jmdict:1268170"],
      ["出口", "jmdict:1338850"],
      ["人口", "jmdict:1367300"],
    ]);
    expect(
      third.words
        .filter((word) => word.jmdictEntryId === "jmdict:0")
        .map((word) => word.expression),
    ).toEqual([]);
    expect(third.words.every((word) => !Object.hasOwn(word, "acceptedReadings"))).toBe(true);
    expect(
      new Set(batches.slice(0, 3).flatMap((batch) => batch.words.map((word) => word.expression)))
        .size,
    ).toBe(60);
    expect(validateMainCourseWordBatches()).toEqual([]);
    const earlier = new Map(
      buildMainCourseContentBatches().flatMap((batch) =>
        batch.kanji.map((kanji) => [kanji.character, kanji.levelNumber] as const),
      ),
    );
    for (const word of third.words) {
      for (const character of wordHanCharacters(word.expression + word.example.japaneseText)) {
        expect(earlier.has(character), `${word.expression}: ${character}`).toBe(true);
        expect(earlier.get(character)).toBeLessThan(third.levelNumber);
      }
      expect(word.example.japaneseText).toContain(word.expression);
      expect(word.example.japaneseText).toMatch(/^[\p{Script=Han}ぁ-ゖー、。！？\s]+$/u);
      expect(word.example.readingText).toMatch(/^[ぁ-ゖー、。！？\s]+$/u);
      expect(word.example.readingText).toContain(word.reading);
      expect(Object.values(word.example).every((text) => text.trim())).toBe(true);
      for (const text of [
        word.meaningMnemonic,
        word.readingMnemonic,
        word.meaningHint,
        word.readingHint,
      ])
        expect(Object.values(text).every((value) => value.trim())).toBe(true);
      expect(mainCourseWordAcceptedReadings(word)).toEqual([word.reading]);
    }
    const words = new Map(third.words.map((word) => [word.expression, word]));
    expect(words.get("空")!.meanings.en.accepted).toEqual(["sky"]);
    expect(words.get("四月")!.meanings.en.accepted).toEqual(["April"]);
    expect(words.get("五月")!.meanings.en.accepted).toEqual(["May"]);
    expect(words.get("小学生")!.meanings.en.accepted).not.toContain("child");
  });

  it("rejects third-batch collisions without weakening registry validation", () => {
    const [first, second, third] = buildMainCourseWordBatches();
    expect(
      validateMainCourseWordBatches([
        first!,
        second!,
        {
          ...third!,
          sortOrderStart: 21,
          words: third!.words.map((word, index) => ({ ...word, sortOrder: 21 + index })),
        },
      ]),
    ).toContain("Duplicate registered word slot japanese-ru-n2:5:21.");
    expect(
      validateMainCourseWordBatches([
        first!,
        second!,
        {
          ...third!,
          words: [{ ...first!.words[0]!, sortOrder: 41 }, ...third!.words.slice(1)],
        },
      ]),
    ).toContain("Duplicate registered word 山:やま.");
  });

  it.each(["jmdict:0", "jmdict:01", "jmdict:-1"])(
    "rejects unresolved or noncanonical source ID %s",
    (jmdictEntryId) => {
      const batch = buildMainCourseWordBatches()[2]!;
      expect(
        validateMainCourseWordBatch({
          ...batch,
          words: [{ ...batch.words[0]!, jmdictEntryId }, ...batch.words.slice(1)],
        }).length,
      ).toBeGreaterThan(0);
    },
  );
});
