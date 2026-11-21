import type { MainCourseAcceptedMeanings } from "./main-course-content";

const block = (text: string, reason: string) => [{ text, reason }];

export const FOLLOWTHROUGH_KANJI_BLOCKS: Readonly<
  Partial<Record<"ru" | "en", Readonly<Record<string, MainCourseAcceptedMeanings["blocked"]>>>>
> = {
  ru: {
    揺: block("раскалываться", "Здесь речь о движении из стороны в сторону, а не о трещине."),
    浴: block("обугливаться", "Этот знак связан с купанием или обливанием, а не с огнём."),
    較: block("составлять", "Здесь сравнивают, а не составляют."),
    尊: block("прочитать", "Здесь уважают или почитают, а не читают."),
    敷: block("прокалывать", "Здесь что-то стелют или прокладывают, не делают отверстие."),
    凍: block("заворачивать", "Здесь замерзают или замораживают, а не заворачивают."),
    冒: block("рисовать", "Речь о риске, а не о рисунке."),
  },
  en: {
    繰: block("turnover", "Here someone handles or turns something; turnover has other senses."),
    仲: block("personal reactions", "This refers to relationships, not reactions."),
  },
};

export const FOLLOWTHROUGH_WORD_BLOCKS: Readonly<
  Record<string, { readonly ru?: readonly string[]; readonly en?: readonly string[] }>
> = {
  交える: { ru: ["выключать", "перемещать"] },
  渡す: { ru: ["передаваться", "предавать"] },
  命じる: { ru: ["переписывать"] },
  著作: { ru: ["проведение"] },
  呼びかける: { ru: ["прибывать"] },
  物語る: { ru: ["раскалывать"] },
  安らぐ: { ru: ["успокаивать"] },
  下ろす: { ru: ["отпускать"] },
  寄せる: { ru: ["продвигать"] },
  通る: { ru: ["приходить", "походить"] },
  見つける: { ru: ["обыскивать"] },
  乗りこえる: { ru: ["продлевать"] },
  上げる: { ru: ["понимать"] },
  断る: { ru: ["открываться"] },
  断つ: { ru: ["покрывать", "прекращаться"] },
  治まる: { ru: ["приходить", "проводить", "походить"] },
  長びく: { ru: ["затягивать"] },
  外れる: { ru: ["отсоединять"] },
  定める: { ru: ["определяться"] },
  冒険: { ru: ["переключение"] },
  雰囲気: { ru: ["остановка"] },
  裏切る: { ru: ["продавать"] },
  装飾: { ru: ["декларирование"] },
  戻る: { ru: ["возвращать"] },
  届く: { ru: ["доставлять"] },
  談話: { en: ["conversion", "conservation"] },
  冷える: { en: ["to come down"] },
  伝わる: { en: ["to go across", "to cut across"] },
  静まる: { en: ["to lie down"] },
  削る: { en: ["to put back"] },
  乗用車: { en: ["passenger fare"] },
  詳細: { en: ["particular", "particularly"] },
  薬剤: { en: ["mediation"] },
  備える: { en: ["to prepare food"] },
  仲介: { en: ["medication"] },
  休まる: { ru: ["успокаивать"], en: ["to be seated"] },
  受け継ぐ: { en: ["to carry out"] },
  はみ出す: { en: ["to pick out"] },
  冷める: { en: ["to come down"] },
  表彰: { en: ["compensation"] },
  介入: { en: ["interception"] },
  幅広い: { en: ["expensive"] },
  連携: { en: ["coordinator"] },
  倒れる: { en: ["to talk over"] },
  道徳: { en: ["mortality"] },
};
