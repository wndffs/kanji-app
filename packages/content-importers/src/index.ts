import { type ContentImportSource } from "./progress";

export const CONTENT_IMPORTERS_PACKAGE_NAME = "@kanji-srs/content-importers";

export type SupportedSourceFamily = ContentImportSource;

export const supportedSourceFamilies: SupportedSourceFamily[] = [
  "KANJIDIC2",
  "JMdict",
  "KanjiVG",
  "Tatoeba",
];

export * from "./checksum";
export * from "./corpus-stats";
export * from "./concurrency";
export * from "./jmdict";
export * from "./import-metadata";
export * from "./import-run";
export * from "./kanjidic2";
export * from "./kanjivg";
export * from "./progress";
export * from "./tatoeba";
