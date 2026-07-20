import { describe, expect, it } from "vitest";

import { romanizeKana } from "../src";

describe("kana romanization", () => {
  it("romanizes basic, modified, and combined kana with longest matching", () => {
    expect(romanizeKana("いち")).toBe("ichi");
    expect(romanizeKana("がくせい")).toBe("gakusei");
    expect(romanizeKana("きょう")).toBe("kyou");
    expect(romanizeKana("ショウ")).toBe("shou");
  });

  it("handles sokuon, long vowels, spaces, and punctuation", () => {
    expect(romanizeKana("いっかい")).toBe("ikkai");
    expect(romanizeKana("コーヒー")).toBe("koohii");
    expect(romanizeKana("ひとつ ください。")).toBe("hitotsu kudasai。");
  });

  it("returns null instead of presenting a partial reading", () => {
    expect(romanizeKana("")).toBeNull();
    expect(romanizeKana("日本語")).toBeNull();
    expect(romanizeKana("っ")).toBeNull();
  });
});
