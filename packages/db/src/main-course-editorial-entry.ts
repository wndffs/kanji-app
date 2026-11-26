import type { CourseEditorialEntry } from "./starter-lesson-editorial";

type Text = { readonly ru: string; readonly en: string };

export type MainCourseEditorialEntry = CourseEditorialEntry &
  (
    | {
        readonly kind: "COMPONENT";
        readonly sourceBatchId: string;
        readonly componentKey: string;
        readonly symbol: string;
      }
    | { readonly kind: "KANJI"; readonly character: string; readonly reading: string }
  );

export function componentNotes(sourceBatchId: string) {
  return (key: string, symbol: string, ru: string, en: string): MainCourseEditorialEntry => ({
    itemKey: `component:${key}`,
    kind: "COMPONENT",
    sourceBatchId,
    componentKey: `component-${key}`,
    symbol,
    hints: { MEANING: { ru, en } },
  });
}

export function kanjiNotes(
  character: string,
  reading: string,
  meaningRu: string,
  meaningEn: string,
  readingRu: string,
  readingEn: string,
  referenceMeanings: readonly Text[] = [],
): MainCourseEditorialEntry {
  return {
    itemKey: `kanji:${character}`,
    kind: "KANJI",
    character,
    reading,
    hints: { MEANING: { ru: meaningRu, en: meaningEn }, READING: { ru: readingRu, en: readingEn } },
    referenceMeanings,
  };
}
