import { type KanaScript, type KanaVariant } from "@kanji-srs/shared";

const NOTES: Readonly<Record<KanaVariant, { readonly ru: string; readonly en: string }>> = {
  basic: {
    ru: "Основной знак азбуки. Запомните его форму и чтение; латинская запись чтения называется ромадзи.",
    en: "A basic kana sign. Connect its shape with its reading; the Latin spelling of the reading is called romaji.",
  },
  dakuten: {
    ru: "Дакутэн — две короткие черты справа вверху. Они меняют согласный: сравните исходный знак с новым чтением.",
    en: "Dakuten are the two short marks at the upper right. They change the consonant: compare the base sign with the new reading.",
  },
  handakuten: {
    ru: "Хандакутэн — маленький кружок справа вверху. Он меняет согласный ряда H на P.",
    en: "Handakuten is the small circle at the upper right. It changes an H-row consonant to P.",
  },
  yoon: {
    ru: "Маленькие ゃ・ゅ・ょ (ャ・ュ・ョ) соединяются с предыдущим знаком. Произносите сочетание слитно, а не как два отдельных слога.",
    en: "Small ゃ・ゅ・ょ (ャ・ュ・ョ) join the preceding sign. Read the combination together, not as two separate syllables.",
  },
  sokuon: {
    ru: "Маленький っ (ッ) удваивает следующую согласную. Перед ней есть короткая задержка: например, kka вместо ka.",
    en: "Small っ (ッ) doubles the following consonant. Hold briefly before it: for example, kka rather than ka.",
  },
  "long-vowel": {
    ru: "Долгий гласный длится два ритмических счёта. В хирагане えい и おう часто передают долгие e и o; написание сохраняется в ромадзи.",
    en: "A long vowel lasts two rhythmic beats. Hiragana えい and おう often represent long e and o; their spelling is retained in romaji here.",
  },
};

export function getKanaTeachingNote(item: { readonly script: KanaScript; readonly variant: KanaVariant }) {
  if (item.variant === "long-vowel" && item.script === "katakana") return {
    ru: "Знак ー продлевает предыдущий гласный. Долгий гласный занимает два ритмических счёта; в ромадзи здесь гласный записан дважды.",
    en: "The mark ー lengthens the preceding vowel. A long vowel takes two rhythmic beats; romaji here writes the vowel twice.",
  };
  return NOTES[item.variant];
}
