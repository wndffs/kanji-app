import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeJapaneseReading, validateAnswer } from "@kanji-srs/japanese";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
} from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  validateMainCourseWordBatch,
  validateMainCourseWordBatches,
  wordHanCharacters,
  mainCourseWordAcceptedReadings,
} from "../src/main-course-word-content";
import { buildCourseExpansionKanji } from "../src/course-expansion-kanji-content";
import {
  buildCourseExpansionWordBatches,
  EXPANSION_READING_LINKS,
  validateExpansionReadings,
} from "../src/course-expansion-word-content";
import { EXPANSION_CUES, EXPANSION_KANJI } from "../src/course-expansion-kanji-rows";
import {
  EXPANSION_READING_ALIGNMENTS,
  isReviewedExpansionReadingAlignment,
} from "../src/course-expansion-reading-alignments";
import { buildEditorialRegistryInventory } from "../src/editorial-registry-inventory";

const kanji = buildMainCourseContentBatches();
const words = buildMainCourseWordBatches();
const batch = kanji.find((batch) => batch.id === "full-course-kanji-expansion")!;
const block = words.filter((batch) => batch.id.startsWith("full-course-vocabulary-expansion-"));
const priorKanji = kanji.slice(0, kanji.indexOf(batch));
const priorWords = words.slice(0, words.indexOf(block[0]!));
const vocabulary = block.flatMap((batch) => batch.words);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("large source-backed course expansion", () => {
  it("seals the independently accepted manifests and reading attributions", () => {
    expect([batch, ...block].map((batch) => [batch.id, hash(batch)])).toEqual([
      [
        "full-course-kanji-expansion",
        "925d118141bfff0cf1906cedc563ad03f52ad08d5949413f77105a56835a31dc",
      ],
      [
        "full-course-vocabulary-expansion-01",
        "4c06f7a9a222a7bf7d25e6917f1b53fa837832c8563d1a8e24a20f367fd70d2b",
      ],
      [
        "full-course-vocabulary-expansion-02",
        "e216b16aa8a4d639d6200de0f2227b87e344d279a44923ba79cc549fde3d3f05",
      ],
      [
        "full-course-vocabulary-expansion-03",
        "87013b422a6c7598f3d658924a58340d4561e282939050b64c2e1dc404f260c2",
      ],
      [
        "full-course-vocabulary-expansion-04",
        "31a32bfe02cb8afd4b97c191fa0553ab4a036058aac110acd1cfbac83ca19144",
      ],
      [
        "full-course-vocabulary-expansion-05",
        "fe258e2f78fb9a879e8bc77597dc99a9f331ff2866e90860ad47011c140fbe07",
      ],
      [
        "full-course-vocabulary-expansion-06",
        "b00e290227aa134de8fc35b9d4fa5394381919ad16040a814f9363f8ecd40e09",
      ],
      [
        "full-course-vocabulary-expansion-07",
        "b7f8df607af92b9d74df466b9edadda52c0fd622530e636ada9cd405c8543c1f",
      ],
      [
        "full-course-vocabulary-expansion-08",
        "404da7de445ae9b109fa11a3d7a07c07c01fed2eb001ccdc3cb64b58aab35a87",
      ],
      [
        "full-course-vocabulary-expansion-09",
        "a19d0b3b032e535692f8f92111b49ef90c803aa447d2db277d2e80603c83d533",
      ],
      [
        "full-course-vocabulary-expansion-10",
        "e2ef646678355fc127bbdd615381a12ab6154f33c442d9250afbc8618d15b5cb",
      ],
      [
        "full-course-vocabulary-expansion-11",
        "a719a1fdcbfd3a7b900c24fa4f2c0efb8d01fabf4fba98badd31d032d2308c41",
      ],
      [
        "full-course-vocabulary-expansion-12",
        "2700dc9e2199915648f413d0eb5b2b81c36b2c307e0f054a8b70c35bc76beec7",
      ],
      [
        "full-course-vocabulary-expansion-13",
        "9f5c45a85ba3ba8450da5117ed739cc525f263d532a5879cef2d19247e8b6fa6",
      ],
      [
        "full-course-vocabulary-expansion-14",
        "0f408c4016504e83bda726002659b56d3f93e551ac8e6d06968f85f997c242fe",
      ],
      [
        "full-course-vocabulary-expansion-15",
        "d57e8a394df993a65e336558d615fb3978b5f313f002f56c2997dd9bb892dba3",
      ],
      [
        "full-course-vocabulary-expansion-16",
        "205b747066f62753b50be9b5e3e851f0bc90dd589f15a7796de738a99709189b",
      ],
      [
        "full-course-vocabulary-expansion-17",
        "86b2c7adf611e53b2c0aae5c01ccf825e3b6e9e3b2d182b807d7de256f0f88f1",
      ],
      [
        "full-course-vocabulary-expansion-18",
        "2b3160f85e65236c9d0e96a972355b1da151ea0fa03f8bf7627102f5e9a82134",
      ],
      [
        "full-course-vocabulary-expansion-19",
        "c8445c109633295c2f1f5e924c2aafdce26fe77dbe39a29a6e3448a2f8fefbd6",
      ],
      [
        "full-course-vocabulary-expansion-20",
        "700e7f8beb9f04789853f746e8e911dea1ab3d9eb68a9ec3845fa6cb33f2551e",
      ],
      [
        "full-course-vocabulary-expansion-21",
        "0f7456aadeada9421f78d1ab24c9bff896d0341a653587d14c733952923f6d56",
      ],
      [
        "full-course-vocabulary-expansion-22",
        "dc9066cbcc0b14961c38335ca8e7c2412994d006bbaaa62ddb8b0b57823c852f",
      ],
    ]);
    expect(hash(EXPANSION_READING_ALIGNMENTS)).toBe(
      "2652be809157d5487f85604279f8eb7e7da9f5a7fde214b0a57d4e5e9c1d7447",
    );
    expect(batch.reviewedAt).toBe("2026-11-01");
    expect(block.every((batch) => batch.reviewedAt === "2026-11-01")).toBe(true);
    expect(batch.kanji.flatMap((kanji) => kanji.meanings.ru.blocked ?? [])).toHaveLength(4);
    expect(
      vocabulary.flatMap((word) => [
        ...(word.meanings.ru.blocked ?? []),
        ...(word.meanings.en.blocked ?? []),
      ]),
    ).toHaveLength(76);
  });
  it.each([
    ["現場", "ru", "место событий"],
    ["現地", "ru", "место события"],
    ["役割", "ru", "обязанность"],
    ["方向", "en", "directions"],
    ["指示", "en", "direction"],
    ["指示", "en", "instruction"],
    ["指導", "en", "instructions"],
    ["日常", "en", "every day"],
    ["特に", "en", "in particular"],
  ] as const)(
    "preserves the reviewed valid near-answer for %s: %s %s",
    (expression, locale, answer) => {
      const meanings = vocabulary.find((word) => word.expression === expression)!.meanings[locale];
      expect(
        validateAnswer({
          answerKind: "meaning",
          answer,
          acceptedAnswers: meanings.accepted,
          blockedAnswers: meanings.blocked?.map((answer) => answer.text),
        }).accepted,
      ).toBe(true);
    },
  );
  it.each([
    ["議", "осуждение"],
    ["企", "предприниматель"],
    ["提", "предполагать"],
    ["輸", "отравлять"],
  ])("rejects the reviewed semantic near-miss for %s", (character, answer) => {
    const meanings = batch.kanji.find((kanji) => kanji.character === character)!.meanings.ru;
    expect(
      validateAnswer({
        answerKind: "meaning",
        answer: answer!,
        acceptedAnswers: meanings.accepted,
        blockedAnswers: meanings.blocked!.map((answer) => answer.text),
      }),
    ).toMatchObject({ accepted: false, result: "blocked" });
    for (const correct of meanings.accepted)
      expect(
        validateAnswer({
          answerKind: "meaning",
          answer: correct,
          acceptedAnswers: meanings.accepted,
          blockedAnswers: meanings.blocked!.map((answer) => answer.text),
        }).accepted,
      ).toBe(true);
  });
  it("rejects a real reading substring attributed to the wrong character", () => {
    const correct = EXPANSION_READING_ALIGNMENTS.find((link) => link.character === "示")!;
    expect(correct).toMatchObject({
      expression: "指示",
      wordReading: "しじ",
      kanjiReading: "じ",
      characterIndex: 1,
      readingOffset: 1,
    });
    expect(isReviewedExpansionReadingAlignment(correct)).toBe(true);
    expect(
      isReviewedExpansionReadingAlignment({ ...correct, kanjiReading: "し", readingOffset: 0 }),
    ).toBe(false);
    expect(isReviewedExpansionReadingAlignment({ ...correct, characterIndex: 0 })).toBe(false);
    expect(isReviewedExpansionReadingAlignment({ ...correct, wordReading: "しし" })).toBe(false);
    expect(EXPANSION_READING_ALIGNMENTS.every(isReviewedExpansionReadingAlignment)).toBe(true);
  });
  it("preserves all 514/800 prior payloads and all finite-course seals", () => {
    expect(hash(priorKanji)).toBe(
      "6d9f442949125997b5d2ab3aef3387a3da6041d423babec8e5ca269e8b198d7a",
    );
    expect(hash(priorWords)).toBe(
      "a7a371debde81c710972374248bdf0c114e3f6485c6e2e1c78f5283e7669c9c6",
    );
    expect(
      buildEditorialRegistryInventory().sourceSeals.every((seal) => seal.status === "complete"),
    ).toBe(true);
  });
  it("adds 200 kanji and 500 distinct primary word forms, not numeric padding", () => {
    expect(batch.kanji).toHaveLength(200);
    expect(vocabulary).toHaveLength(500);
    expect(new Set(vocabulary.map((word) => word.expression)).size).toBe(500);
    const oldExpressions = new Set(
      priorWords.flatMap((batch) => batch.words.map((word) => word.expression)),
    );
    for (const word of vocabulary) {
      expect(oldExpressions.has(word.expression)).toBe(false);
      expect(word.expression).not.toMatch(/[0-9０-９]/u);
      expect(
        word.expression.length > 1 &&
          /^[一二三四五六七八九十百千万億兆〇零]+$/u.test(word.expression),
      ).toBe(false);
    }
    expect(buildEditorialRegistryInventory().prepared.distinctTotals).toMatchObject({
      kanji: 714,
      words: 1300,
    });
    expect(validateMainCourseContentBatches(kanji)).toEqual([]);
    expect(validateMainCourseWordBatches(words)).toEqual([]);
  });
  it("uses free capacity without moving old words or exhausting sixty levels", () => {
    expect(buildCourseExpansionKanji(priorKanji)).toEqual(batch);
    expect(buildCourseExpansionWordBatches(kanji, priorWords)).toEqual(block);
    for (let level = 1; level <= 60; level++) {
      const count = (batches: typeof kanji) =>
        batches.flatMap((batch) => batch.kanji).filter((kanji) => kanji.levelNumber === level)
          .length;
      expect(count(kanji)).toBeLessThanOrEqual(Math.max(40, count(priorKanji)));
    }
    const slots = [
      ...kanji.flatMap((batch) => [
        ...batch.kanji.map((kanji) => `${kanji.levelNumber}:${kanji.sortOrder}`),
        ...batch.components.map(
          (_, i) => `${batch.componentLevelNumber}:${(batch.componentSortOrderStart ?? 1) + i}`,
        ),
      ]),
      ...words.flatMap((batch) =>
        batch.words.map((word) => `${batch.levelNumber}:${word.sortOrder}`),
      ),
    ];
    expect(new Set(slots).size).toBe(slots.length);
    expect(
      block.every(
        (batch) =>
          batch.wordCount === batch.words.length &&
          batch.words.length <= 200 &&
          batch.levelNumber <= 60,
      ),
    ).toBe(true);
  });
  it("requires earlier visual cues and the exact earliest readable word/example level", () => {
    const cueLevels = new Map(
      kanji.flatMap((batch) =>
        batch.components.map((cue) => [cue.key, batch.componentLevelNumber] as const),
      ),
    );
    const kanjiLevels = new Map(
      kanji.flatMap((batch) =>
        batch.kanji.map((kanji) => [kanji.character, kanji.levelNumber] as const),
      ),
    );
    for (const kanji of batch.kanji) {
      expect(kanji.requireStrokeData).toBe(true);
      expect(kanji.componentKeys.length).toBeGreaterThan(0);
      for (const cue of kanji.componentKeys)
        expect(cueLevels.get(cue)!).toBeLessThan(kanji.levelNumber);
    }
    for (const group of block)
      for (const word of group.words) {
        const chars = wordHanCharacters(word.expression + word.example.japaneseText);
        expect(group.levelNumber).toBe(
          Math.max(2, ...chars.map((character) => kanjiLevels.get(character)! + 1)),
        );
        expect(word.example.japaneseText).toContain(word.expression);
        expect(word.example.readingText).not.toMatch(/\p{Script=Han}/u);
      }
  });
  it("only introduces new unique visual cue symbols", () => {
    const old = new Set(priorKanji.flatMap((batch) => batch.components.map((cue) => cue.symbol)));
    expect(batch.components).toHaveLength(EXPANSION_CUES.length);
    expect(new Set(batch.components.map((cue) => cue.symbol)).size).toBe(batch.components.length);
    for (const cue of batch.components) expect(old.has(cue.symbol)).toBe(false);
  });
  it("binds all 200 taught readings to an exact primary vocabulary pair", () => {
    expect(EXPANSION_READING_LINKS).toHaveLength(200);
    expect(new Set(EXPANSION_READING_LINKS.map((link) => link.character)).size).toBe(200);
    expect(validateExpansionReadings(kanji, words)).toEqual([]);
    for (const row of EXPANSION_KANJI) {
      const taught = batch.kanji.find((kanji) => kanji.character === row[0])!;
      expect(taught.reading.source).toBe(row[1]);
      expect(taught.reading.primary).toBe(normalizeJapaneseReading(row[1]));
      expect(taught.reading.accepted).toEqual([taught.reading.primary]);
      expect(
        vocabulary.some((word) => word.expression === row[9] && word.reading === row[10]),
      ).toBe(true);
    }
  });
  it("rejects a reinforcement supplied only as another word reading or a wrong source identity", () => {
    const link = EXPANSION_READING_LINKS[0]!;
    for (const mode of ["primary", "source"] as const) {
      const changed = structuredClone(words);
      const word = changed
        .flatMap((batch) => batch.words)
        .find((word) => word.expression === link.expression && word.reading === link.wordReading)!;
      Object.assign(
        word,
        mode === "primary"
          ? { reading: "あいう", acceptedReadings: [link.wordReading] }
          : { jmdictEntryId: "jmdict:999999999" },
      );
      expect(validateExpansionReadings(kanji, changed)).toContain(
        `Missing expansion primary reinforcement: ${link.character}`,
      );
    }
  });
  it("keeps every curated accepted and blocked answer coherent in both languages", () => {
    for (const word of vocabulary) {
      for (const locale of ["ru", "en"] as const) {
        const meaning = word.meanings[locale];
        expect(meaning.primary).toBe(meaning.accepted[0]);
        for (const answer of meaning.accepted) {
          expect(answer).not.toMatch(/[,;|/]/u);
          expect(
            validateAnswer({
              answerKind: "meaning",
              answer,
              acceptedAnswers: meaning.accepted,
              blockedAnswers: meaning.blocked?.map((answer) => answer.text),
            }).accepted,
          ).toBe(true);
        }
        for (const answer of meaning.blocked ?? [])
          expect(
            validateAnswer({
              answerKind: "meaning",
              answer: answer.text,
              acceptedAnswers: meaning.accepted,
              blockedAnswers: meaning.blocked!.map((answer) => answer.text),
            }),
          ).toMatchObject({ accepted: false, result: "blocked" });
      }
      for (const reading of mainCourseWordAcceptedReadings(word))
        expect(
          validateAnswer({
            answerKind: "reading",
            answer: reading,
            acceptedAnswers: mainCourseWordAcceptedReadings(word),
          }).accepted,
        ).toBe(true);
    }
  });
  it.each(["prefix", "suffix", "counter", "proper-noun", "numeral"] as const)(
    "preserves explicit %s metadata without recategorizing legacy words",
    (partOfSpeech) => {
      const changed = structuredClone(block[0]!);
      Object.assign(changed.words[0]!, { partOfSpeech });
      expect(validateMainCourseWordBatch(changed)).toEqual([]);
      expect(hash(priorWords)).toBe(
        "a7a371debde81c710972374248bdf0c114e3f6485c6e2e1c78f5283e7669c9c6",
      );
    },
  );
});
