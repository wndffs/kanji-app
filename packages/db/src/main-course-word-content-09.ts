import { type MainCourseWordBatch } from "./main-course-word-content";
import { WAVE09_TEACHING } from "./lexical-wave09-teaching";
import { WAVE09_RU } from "./lexical-wave09-ru";
import { WAVE09_EN } from "./lexical-wave09-en";
import { WAVE09_READINGS } from "./lexical-wave09-readings";
import { WAVE09_EXAMPLES } from "./lexical-wave09-examples";

const BATCH: MainCourseWordBatch = {
  id: "task-127-course-words-09", version: "1", authoredAt: "2026-10-29", reviewedAt: "2026-10-29",
  reviewNotes: "Original RU/EN teaching independently reviewed by AI meaning/context reviewer Lovelace and AI reading/component reviewer Kierkegaard and corrected by parent on 2026-10-29. Twenty unique exact bilingual local JMdict identities matched. Corrections cover transitive/intransitive near-answers, current-month scope, natural accepted equivalents, knowing versus studying, okurigana and valid alternative readings. All original plain-form examples and kana transcriptions reviewed. Not human certification or permission to bypass live source/license/placement/quality preflight.",
  sourceFile: "packages/db/src/main-course-word-content-09.ts", courseSlug: "japanese-ru-n2",
  levelNumber: 15, sortOrderStart: 1,
  words: WAVE09_TEACHING.map((row, index) => ({
    expression: row.expression, reading: row.reading, jmdictEntryId: row.jmdictEntryId,
    partOfSpeech: row.partOfSpeech, sortOrder: index + 1,
    meanings: { ru: WAVE09_RU[row.expression]!.meanings, en: WAVE09_EN[row.expression]!.meanings },
    meaningMnemonic: { ru: WAVE09_RU[row.expression]!.mnemonic, en: WAVE09_EN[row.expression]!.mnemonic },
    meaningHint: { ru: WAVE09_RU[row.expression]!.scope, en: WAVE09_EN[row.expression]!.scope },
    readingMnemonic: WAVE09_READINGS[row.expression]!,
    readingHint: { ru: `Напишите всё слово каной: ${row.reading}.`, en: `Write the whole word in kana: ${row.reading}.` },
    example: WAVE09_EXAMPLES[row.expression]!,
  })),
};
export function buildMainCourseWordBatch09(): MainCourseWordBatch { return BATCH; }
