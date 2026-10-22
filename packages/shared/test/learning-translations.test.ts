import { describe, expect, it } from "vitest";
import {
  buildLearningTranslationBundle,
  type BilingualTextDto,
  type LocalizedTextDto,
} from "../src/index";

const ru = (
  text: string,
  sourceKind: LocalizedTextDto["sourceKind"],
  isPrimary = false,
): LocalizedTextDto => ({ locale: "ru-RU", text, sourceKind, isPrimary });
const en = (
  text: string,
  sourceKind: LocalizedTextDto["sourceKind"],
  isPrimary = false,
): LocalizedTextDto => ({ locale: "en-US", text, sourceKind, isPrimary });

describe("learning translation selection", () => {
  it.each(["ru", "en", "ru-en"] as const)(
    "prefers reviewed meanings over an imported primary in %s mode",
    (mode) => {
      const target: BilingualTextDto = {
        ru: [ru("1) луна, месяц", "imported", true), ru("луна", "curated")],
        en: [en("(a) moon", "imported", true), en("moon", "curated")],
      };
      const original = structuredClone(target);
      expect(buildLearningTranslationBundle(target, mode)).toEqual({
        ru: [ru("луна", "curated")],
        en: [en("moon", "curated")],
        displayMode: mode,
        primaryRu: "луна",
        primaryEn: "moon",
      });
      expect(target).toEqual(original);
    },
  );

  it("uses the meaning card's explicit primary, not dictionary or alphabetic ordering", () => {
    const target = { ru: [ru("второе число", "curated", true), ru("два дня", "curated")], en: [] };
    const result = buildLearningTranslationBundle(target, "ru", [
      ru("второе число", "curated"),
      ru("два дня", "curated", true),
    ]);
    expect(result.primaryRu).toBe("два дня");
    expect(result.primaryEn).toBeNull();
  });

  it("keeps fallback independent per locale and does not hide untranslated dictionary material", () => {
    const target = { ru: [ru("луна", "curated")], en: [en("moon", "imported", true)] };
    expect(buildLearningTranslationBundle(target, "ru-en")).toMatchObject({
      primaryRu: "луна",
      primaryEn: "moon",
      en: target.en,
    });
  });

  it("does not turn private accepted answers into global learning definitions", () => {
    const target = { ru: [ru("луна", "curated", true)], en: [] };
    expect(
      buildLearningTranslationBundle(target, "ru", [ru("личный вариант", "user", true)]).ru,
    ).toEqual(target.ru);
  });

  it("deduplicates meanings without losing an explicit primary", () => {
    const answers = [ru("луна", "curated", true), ru("луна", "curated")];
    const result = buildLearningTranslationBundle({ ru: [], en: [] }, "ru", answers);
    expect(result.ru).toEqual([answers[0]]);
    expect(result.primaryRu).toBe("луна");
  });

  it("keeps missing values unknown and filters a foreign locale from a malformed bundle", () => {
    const wrong = {
      locale: "fr-FR",
      text: "lune",
      sourceKind: "curated",
    } as unknown as LocalizedTextDto;
    expect(buildLearningTranslationBundle({ ru: [wrong], en: [] }, "ru-en")).toMatchObject({
      ru: [],
      en: [],
      primaryRu: null,
      primaryEn: null,
    });
  });
});
