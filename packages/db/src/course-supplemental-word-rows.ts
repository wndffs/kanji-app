import type { ExpansionWordRow } from "./course-expansion-content-types";

export type SupplementalWordRow = readonly [
  expression: ExpansionWordRow[0],
  reading: ExpansionWordRow[1],
  sourceSequence: ExpansionWordRow[2],
  partOfSpeech: ExpansionWordRow[9]["partOfSpeech"],
  meaningsRu: ExpansionWordRow[3],
  meaningsEn: ExpansionWordRow[4],
  scope: ExpansionWordRow[5],
  example: ExpansionWordRow[8],
  options?: Omit<ExpansionWordRow[9], "partOfSpeech"> & { readonly readingChunks?: string },
];

export function supplementWordRows(rows: readonly SupplementalWordRow[]): ExpansionWordRow[] {
  return rows.map(
    ([expression, reading, sequence, partOfSpeech, ru, en, scope, example, extra]) => {
      const { readingChunks, ...metadata } = extra ?? {};
      if (readingChunks !== undefined) {
        const chunks = readingChunks.split("・");
        if (chunks.length < 2 || chunks.some((chunk) => !chunk) || chunks.join("") !== reading)
          throw new Error(`Invalid reading chunks for ${expression}.`);
      }
      return [
        expression,
        reading,
        sequence,
        ru,
        en,
        scope,
        [`Сцена из примера: ${example[2]}`, `Picture the scene: ${example[3]}`],
        readingChunks
          ? [
              `Произнесите ${readingChunks} слитно: ${reading}.`,
              `Say ${readingChunks} as one word: ${reading}.`,
            ]
          : [
              `Прочитайте ${expression} как ${reading}, затем произнесите японский пример целиком.`,
              `Read ${expression} as ${reading}, then say the full Japanese example.`,
            ],
        example,
        { partOfSpeech, ...metadata },
      ];
    },
  );
}
