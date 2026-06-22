export const CONTENT_IMPORTERS_PACKAGE_NAME = "@kanji-srs/content-importers";

export type SupportedSourceFamily = "KANJIDIC2" | "JMdict" | "KanjiVG" | "Tatoeba";

export const supportedSourceFamilies: SupportedSourceFamily[] = [
  "KANJIDIC2",
  "JMdict",
  "KanjiVG",
  "Tatoeba",
];

export * from "./kanjidic2";
