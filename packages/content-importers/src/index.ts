export const CONTENT_IMPORTERS_PACKAGE_NAME = "@kanji-srs/content-importers";

export type SupportedSourceFamily = "KANJIDIC2" | "JMdict" | "KanjiVG" | "Tatoeba";

export const supportedSourceFamilies: SupportedSourceFamily[] = [
  "KANJIDIC2",
  "JMdict",
  "KanjiVG",
  "Tatoeba",
];

export * from "./checksum";
export * from "./jmdict";
export * from "./kanjidic2";
export * from "./kanjivg";
export * from "./tatoeba";
