import { type MainCourseWordBatch } from "./main-course-word-content";
import { WAVE08_TEACHING } from "./lexical-wave08-teaching";
import { WAVE08_RU, WAVE08_EN } from "./lexical-wave08-answers";
import { WAVE08_READINGS } from "./lexical-wave08-readings";
import { WAVE08_EXAMPLES } from "./lexical-wave08-examples";

const BATCH:MainCourseWordBatch = {
  id:"task-127-course-words-08",version:"1",authoredAt:"2026-10-29",reviewedAt:null,
  reviewNotes:"Unregistered original bilingual proposal: ten verbs, five i-adjectives and five nouns. Twenty exact bilingual JMdict identities observed in the verified local snapshot. Independent educational review and live source/placement preflight are still required; no publication approval.",
  sourceFile:"packages/db/src/main-course-word-content-08.ts",courseSlug:"japanese-ru-n2",
  levelNumber:12,sortOrderStart:1,
  words:WAVE08_TEACHING.map((row,index)=>({
    expression:row.expression,reading:row.reading,jmdictEntryId:row.jmdictEntryId,
    partOfSpeech:row.partOfSpeech,sortOrder:index+1,
    meanings:{ru:WAVE08_RU[row.expression]!,en:WAVE08_EN[row.expression]!},
    meaningMnemonic:{ru:row.memoryRu,en:row.memoryEn},
    readingMnemonic:WAVE08_READINGS[row.expression]!,
    meaningHint:{ru:`Здесь выбран смысл «${row.ru}».`,en:`This card selects '${row.en}'.`},
    readingHint:{ru:`Напишите всё слово каной: ${row.reading}.`,en:`Write the whole word in kana: ${row.reading}.`},
    example:WAVE08_EXAMPLES[row.expression]!,
  })),
};
export function buildMainCourseWordBatch08():MainCourseWordBatch { return BATCH; }
