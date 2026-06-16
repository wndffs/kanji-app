import { describe, expect, it } from "vitest";

import { supportedSourceFamilies } from "../src";

describe("supportedSourceFamilies", () => {
  it("tracks the planned open-data importer families", () => {
    expect(supportedSourceFamilies).toEqual(["KANJIDIC2", "JMdict", "KanjiVG", "Tatoeba"]);
  });
});
