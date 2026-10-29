import { type MainCourseContentBatch } from "./main-course-content";

const BATCH: MainCourseContentBatch = {
  id:"task-118-course-kanji-08", version:"1", authoredAt:"2026-10-29", reviewedAt:null,
  reviewNotes:"Unregistered original RU/EN proposal. Local KANJIDIC2 on-reading and KanjiVG primary graphic matched; no independent editorial approval or publication yet.",
  sourceFile:"packages/db/src/main-course-content-08.ts", courseSlug:"japanese-ru-n2",
  componentLevelNumber:1, components:[],
  kanji:[{
    character:"前", levelNumber:11, sortOrder:1,
    meanings:{
      ru:{primary:"перед",accepted:["перед","впереди","до"]},
      en:{primary:"before",accepted:["before","in front"]},
    },
    reading:{source:"ゼン",sourceType:"ja_on",primary:"ぜん",accepted:["ぜん"]},
    componentKeys:["component-moon","component-knife"],
    meaningMnemonic:{
      ru:"Под верхними штрихами найдите 月-подобную форму и нож справа в виде 刂. Вообразите отметку перед остриём ножа. Это зрительные опоры и вымышленная сцена, не объяснение происхождения 前; нижняя левая форма не означает здесь луну.",
      en:"Below the top strokes, find a 月-like shape and the knife form 刂 on the right. Imagine a mark in front of the blade. These are visual cues and an invented scene, not the origin of 前; the lower-left shape does not mean moon here.",
    },
    readingMnemonic:{
      ru:"В 午前 (ごぜん, до полудня) ответ для 前 — ぜん. В 名前 используется другое чтение まえ; отдельная карточка 前 проверяет только выбранное онное ぜん.",
      en:"In 午前 (ごぜん, before noon), 前 supplies ぜん. 名前 uses the different reading まえ; this separate kanji card tests only the selected on reading ぜん.",
    },
    requireStrokeData:true,
  }],
};
export function buildMainCourseContentBatch08():MainCourseContentBatch { return BATCH; }
