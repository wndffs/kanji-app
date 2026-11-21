import type { AuthoredWordPartOfSpeech } from "./main-course-word-content";

export type ExpansionKanjiRow = readonly [
  character: string,
  sourceReading: string,
  meaningsRu: readonly string[],
  meaningsEn: readonly string[],
  componentSymbols: readonly string[],
  meaningImageRu: string,
  meaningImageEn: string,
  readingImageRu: string,
  readingImageEn: string,
  reinforcementExpression: string,
  reinforcementReading: string,
];
export type ExpansionCueRow = readonly [
  symbol: string,
  nameRu: string,
  nameEn: string,
  shapeRu: string,
  shapeEn: string,
];
export type ExpansionWordRow = readonly [
  expression: string,
  reading: string,
  sourceSequence: string,
  meaningsRu: readonly string[],
  meaningsEn: readonly string[],
  scope: readonly [ru: string, en: string],
  meaningImage: readonly [ru: string, en: string],
  readingImage: readonly [ru: string, en: string],
  example: readonly [japanese: string, kana: string, ru: string, en: string],
  metadata: {
    readonly partOfSpeech: AuthoredWordPartOfSpeech;
    readonly acceptedReadings?: readonly string[];
    readonly variantNotes?: readonly [ru: string, en: string];
    readonly blockedRu?: readonly string[];
    readonly blockedEn?: readonly string[];
  },
];

export type ExpansionReinforcementRow = readonly [
  kanji: readonly [
    character: string,
    sourceReading: string,
    symbols: readonly string[],
    meaningsRu: readonly string[],
    meaningsEn: readonly string[],
    image: readonly [ru: string, en: string],
  ],
  location: readonly [characterIndex: number, readingOffset: number],
  word: readonly [
    expression: ExpansionWordRow[0],
    reading: ExpansionWordRow[1],
    sequence: ExpansionWordRow[2],
    meaningsRu: ExpansionWordRow[3],
    meaningsEn: ExpansionWordRow[4],
    scope: ExpansionWordRow[5],
    image: ExpansionWordRow[6],
    example: ExpansionWordRow[8],
    metadata?: ExpansionWordRow[9],
  ],
];
