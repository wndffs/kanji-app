import type { MainCourseAcceptedMeanings } from "./main-course-content";

function contrast(reason: string, ...answers: string[]): MainCourseAcceptedMeanings["blocked"] {
  return answers.map((text) => ({ text, reason }));
}

// Distinct exact answers from other course items that would otherwise pass as typos.
export const DEEPENING_KANJI_BLOCKS = {
  ru: {
    房: contrast("Речь о помещении, а не о факте посещения.", "посещение"),
    越: contrast("Речь о переходе через границу, не о взаимном пересечении.", "пересекаться"),
    掲: contrast("Речь о поднятии или вывешивании, а не о понимании.", "понимать"),
    棄: contrast("Речь об отказе от чего-либо или выбрасывании, а не об открытии.", "открываться"),
    似: contrast("Речь о похожести, а не о движении или пригодности.", "проходить", "подходить"),
    沖: contrast("Это воды вдали от берега, не открытый участок суши.", "открытое поле"),
    揮: contrast(
      "Речь о взмахе или руководстве, а не об отправлении в командировку.",
      "командировать",
    ),
    紹: contrast(
      "Речь о знакомстве и представлении, а не о предоставлении чего-либо.",
      "предоставлять",
    ),
    衝: contrast("Речь о столкновении, а не о падении или удалении.", "сваливаться", "удаляться"),
    促: contrast("Побуждать к действию не значит одерживать победу.", "побеждать"),
    詰: contrast("Речь о плотном заполнении или давлении, а не о приёме.", "принимать"),
    訳: contrast(
      "Речь о переводе между языками, не о перевозке или переходе.",
      "перевозить",
      "переходить",
    ),
    賀: contrast("Поздравлять не значит подавлять.", "подавление"),
    敬: contrast("Знак выражает уважение, не чтение текста.", "прочитать"),
  },
  en: {
    患: contrast("Illness or affliction is not affiliation with a group.", "be affiliated"),
    属: contrast("Belonging to a group does not mean suffering from an illness.", "be afflicted"),
  },
};

export const DEEPENING_WORD_BLOCKS = {
  法学: { ru: ["проведение"] },
  変更: { ru: ["измерение"] },
  上司: { ru: ["руководить"] },
  紹介: { ru: ["предоставление"] },
  提案: { ru: ["предположение"] },
  学者: { ru: ["исследовать"] },
  寄付: { ru: ["повествование"] },
  予想: { ru: ["предложение"] },
  物語: { ru: ["пожертвование"] },
  有効: { ru: ["действительно"] },
  有力: { ru: ["перспективы"] },
  提供: { ru: ["представление"] },
  行列: { ru: ["профессия"], en: ["profession"] },
  獲得: { ru: ["поручение"] },
  免許: { ru: ["разрушение"] },
  許す: { ru: ["разрезать", "разрушать"] },
  抑制: { ru: ["поздравление"] },
  委託: { ru: ["получение"] },
  依頼: { ru: ["получение"] },
  複数: { ru: ["нисколько"] },
  改造: { en: ["conversation"] },
  前向き: { en: ["construction"] },
  保全: { en: ["conversation"] },
  節約: { en: ["conversation"] },
  輸送: { en: ["transformation"] },
  評価: { en: ["evacuation"] },
  対話: { en: ["conversion", "conservation"] },
  避難: { en: ["evaluation"] },
};
