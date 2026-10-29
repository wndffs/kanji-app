import { describe, expect, it } from "vitest";

import { buildMainCourseContentBatches } from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  mainCourseWordBatchChecksum,
  validateMainCourseWordBatches,
  wordHanCharacters,
} from "../src/main-course-word-content";

describe("calendar and next-level vocabulary expansion", () => {
  it("keeps six distinct reviewed twenty-word slices and original earlier prerequisites", () => {
    const batches = buildMainCourseWordBatches().slice(0, 6);
    expect(batches).toHaveLength(6);
    expect(validateMainCourseWordBatches(batches)).toEqual([]);
    expect(
      new Set(
        batches.flatMap((batch) => batch.words.map((word) => `${word.expression}:${word.reading}`)),
      ).size,
    ).toBe(120);
    const earlier = new Map(
      buildMainCourseContentBatches().flatMap((batch) =>
        batch.kanji.map((item) => [item.character, item.levelNumber] as const),
      ),
    );
    for (const batch of batches.slice(3)) {
      expect(batch.reviewedAt).toBe("2026-10-22");
      expect(batch.words).toHaveLength(20);
      for (const word of batch.words) {
        for (const character of wordHanCharacters(word.expression + word.example.japaneseText))
          expect(earlier.get(character), `${word.expression}: ${character}`).toBeLessThan(
            batch.levelNumber,
          );
        expect(word.example.readingText).toMatch(/^[ぁ-ゖー、。！？\s]+$/u);
        expect(word.example.readingText).toContain(word.reading);
        expect(word.example.japaneseText).toContain(word.expression);
        expect(Object.values(word.example).every((text) => text.trim() !== "")).toBe(true);
      }
    }
  });

  it("pins the new calendar and counter exact source identities at free Foundation slots", () => {
    const batch = buildMainCourseWordBatches()[3]!;
    expect(batch).toMatchObject({
      id: "task-127-foundation-words-04",
      levelNumber: 5,
      sortOrderStart: 61,
    });
    expect(mainCourseWordBatchChecksum(batch)).toBe(
      "81496c6ffcb91d0d7fa046b8f075b4b1aff6e2ccec7f69d48c48708bb043b5b6",
    );
    expect(batch.words.map((word) => [word.expression, word.reading, word.jmdictEntryId])).toEqual([
      ["六月", "ろくがつ", "jmdict:1561330"],
      ["七月", "しちがつ", "jmdict:1319280"],
      ["八月", "はちがつ", "jmdict:1476730"],
      ["九月", "くがつ", "jmdict:1243660"],
      ["十月", "じゅうがつ", "jmdict:1334570"],
      ["十一月", "じゅういちがつ", "jmdict:1334480"],
      ["十二月", "じゅうにがつ", "jmdict:1334910"],
      ["四日", "よっか", "jmdict:1307320"],
      ["五日", "いつか", "jmdict:1268570"],
      ["六日", "むいか", "jmdict:1561470"],
      ["七日", "なのか", "jmdict:1579630"],
      ["八日", "ようか", "jmdict:1476920"],
      ["九日", "ここのか", "jmdict:1243850"],
      ["二十日", "はつか", "jmdict:1600850"],
      ["三人", "さんにん", "jmdict:1301000"],
      ["四人", "よにん", "jmdict:1985310"],
      ["水中", "すいちゅう", "jmdict:1371840"],
      ["大雨", "おおあめ", "jmdict:1413070"],
      ["小川", "おがわ", "jmdict:1348460"],
      ["手足", "てあし", "jmdict:1328080"],
    ]);
    expect(batch.words.map((word) => word.sortOrder)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 61),
    );
    for (const word of batch.words.slice(0, 7)) {
      expect(word.meanings.en.accepted).toHaveLength(1);
      expect(word.meanings.en.accepted[0]).not.toMatch(/months|days/u);
    }
    for (const word of batch.words.slice(7, 14)) {
      expect(word.meanings.en.accepted.some((text) => text.includes("days"))).toBe(true);
      expect(word.meanings.en.accepted.some((text) => text.includes("day of the month"))).toBe(
        true,
      );
    }
    expect(batch.words.every((word) => word.acceptedReadings === undefined)).toBe(true);
  });

  it("opens registered level six without moving any Foundation word", () => {
    const batches = buildMainCourseWordBatches();
    const batch = batches[4]!;
    expect(batch).toMatchObject({
      id: "task-127-course-words-05",
      levelNumber: 6,
      sortOrderStart: 1,
    });
    expect(mainCourseWordBatchChecksum(batch)).toBe(
      "e1fd34111d46183f4376934d9d55429c191524e7d319ec367b8bdb2c4d972f36",
    );
    expect(batch.words.map((word) => word.sortOrder)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(batches.slice(0, 4).every((entry) => entry.levelNumber === 5)).toBe(true);
    expect(batch.words.map((word) => [word.expression, word.reading, word.jmdictEntryId])).toEqual([
      ["日本人", "にほんじん", "jmdict:1464700"],
      ["本人", "ほんにん", "jmdict:1522750"],
      ["中年", "ちゅうねん", "jmdict:1425240"],
      ["年月", "ねんげつ", "jmdict:1582870"],
      ["学年", "がくねん", "jmdict:1207030"],
      ["先月", "せんげつ", "jmdict:1387500"],
      ["本日", "ほんじつ", "jmdict:1523110"],
      ["年上", "としうえ", "jmdict:1468870"],
      ["年下", "としした", "jmdict:1468230"],
      ["目上", "めうえ", "jmdict:1535490"],
      ["目下", "めした", "jmdict:1535320"],
      ["気分", "きぶん", "jmdict:1222590"],
      ["天文学", "てんもんがく", "jmdict:1440280"],
      ["中学生", "ちゅうがくせい", "jmdict:1423660"],
      ["月見", "つきみ", "jmdict:1255630"],
      ["見本", "みほん", "jmdict:1260100"],
      ["大会", "たいかい", "jmdict:1413180"],
      ["日中", "にっちゅう", "jmdict:1464250"],
      ["出国", "しゅっこく", "jmdict:1580020"],
      ["会社", "かいしゃ", "jmdict:1198550"],
    ]);
  });

  it("adds a separately reviewed reinforcement slice without changing the sealed v3 set", () => {
    const batch = buildMainCourseWordBatches()[5]!;
    expect(batch).toMatchObject({
      id: "task-127-course-words-06",
      levelNumber: 6,
      sortOrderStart: 21,
    });
    expect(mainCourseWordBatchChecksum(batch)).toBe(
      "8a9e0cef7dc10ec355125ffb7bb989d96cd531d0f85767280b735b6ad9790858",
    );
    expect(batch.words.map((word) => word.sortOrder)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 21),
    );
    expect(batch.words.map((word) => [word.expression, word.reading, word.jmdictEntryId])).toEqual([
      ["入口", "いりぐち", "jmdict:1582820"],
      ["入学", "にゅうがく", "jmdict:1465850"],
      ["休み", "やすみ", "jmdict:1227500"],
      ["休日", "きゅうじつ", "jmdict:1228040"],
      ["体", "からだ", "jmdict:1409140"],
      ["体力", "たいりょく", "jmdict:1409760"],
      ["林", "はやし", "jmdict:1555440"],
      ["森林", "しんりん", "jmdict:1362530"],
      ["森", "もり", "jmdict:1362490"],
      ["犬", "いぬ", "jmdict:1258330"],
      ["夕日", "ゆうひ", "jmdict:1542750"],
      ["名", "な", "jmdict:1531330"],
      ["外", "そと", "jmdict:1203250"],
      ["国外", "こくがい", "jmdict:1286270"],
      ["王", "おう", "jmdict:1629200"],
      ["王国", "おうこく", "jmdict:1181480"],
      ["玉", "たま", "jmdict:1240530"],
      ["白", "しろ", "jmdict:1474900"],
      ["糸", "いと", "jmdict:1311450"],
      ["車", "くるま", "jmdict:1323080"],
    ]);
    const byWord = new Map(batch.words.map((word) => [word.expression, word]));
    expect(byWord.get("玉")!.meanings.en.accepted).toEqual(["ball", "sphere", "gem", "jewel"]);
    expect(byWord.get("白")!.meanings.ru.accepted).toEqual(["белый цвет"]);
    expect(byWord.get("夕日")!.reading).toBe("ゆうひ");
    expect(batch.words.every((word) => word.acceptedReadings === undefined)).toBe(true);
  });

  it.each([0, -1, 1.5, 61, NaN, Infinity])(
    "rejects unregistered destination level %s",
    (levelNumber) => {
      const batch = { ...buildMainCourseWordBatches()[4]!, levelNumber };
      expect(validateMainCourseWordBatches([batch])).toContain(
        "Word batch requires a registered course level.",
      );
    },
  );
});
