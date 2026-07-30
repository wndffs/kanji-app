import { describe, expect, it } from "vitest";

import { kanjiReadingOrderBy } from "../src/database/kanji-reading-order";

describe("kanji reading order", () => {
  it("treats the lowest KANJIDIC2 source position as the primary reading", () => {
    expect(kanjiReadingOrderBy()).toEqual([{ priority: "asc" }, { reading: "asc" }]);
  });
});
