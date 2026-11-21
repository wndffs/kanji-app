import type { MainCourseComponentContent } from "./main-course-content";

const cue = (
  key: string,
  symbol: string,
  [ru, en]: readonly [string, string],
  [shapeRu, shapeEn]: readonly [string, string],
  [imageRu, imageEn]: readonly [string, string],
): MainCourseComponentContent => ({
  key: `component-extension-${key}`,
  symbol,
  displayName: { ru, en },
  shapeDescription: { ru: shapeRu, en: shapeEn },
  meaning: { ru, en },
  mnemonic: { ru: imageRu, en: imageEn },
});

export const COURSE_EXTENSION_COMPONENTS = [
  cue(
    "split-piece",
    "片",
    ["отдельная пластина", "separate sliver"],
    [
      "Длинный левый штрих изгибается внизу. Короткая вертикаль упирается в верхнюю перекладину; нижний штрих идёт вправо и загибается вниз.",
      "The long left stroke curves at its base. A short upright meets the upper crossbar. The lower stroke runs right, then turns down.",
    ],
    [
      "Вообразите тонкую щепку, отколовшуюся от целой доски.",
      "Picture a thin sliver split off a whole board.",
    ],
  ),
  cue(
    "water-side",
    "氵",
    ["три капли", "three water marks"],
    [
      "Две короткие отметки наклонены вниз вправо; нижний штрих поднимается вправо.",
      "Two short marks slope down to the right; the bottom stroke rises to the right.",
    ],
    [
      "Две капли уже упали, а третья отскочила вверх. Так запомните водную часть слева.",
      "Two drops have fallen and the third splashes back up. Use them to recall the left-side water form.",
    ],
  ),
  cue(
    "hand-side",
    "扌",
    ["рука сбоку", "side hand"],
    [
      "Вертикаль с крючком пересекают короткая горизонталь и восходящий штрих.",
      "A hooked downstroke crossed by a short bar and a rising stroke.",
    ],
    [
      "Вообразите пальцы, которые тянутся вперёд, чтобы поднять или сдвинуть предмет.",
      "Picture fingers reaching forward to lift or move an object.",
    ],
  ),
  cue(
    "person-side",
    "亻",
    ["фигура человека слева", "standing figure on the left"],
    [
      "Вертикаль опускается от середины косого штриха; форма узкая и обычно стоит слева.",
      "An upright descends from partway along the sloping stroke. The form usually fits into the left side.",
    ],
    [
      "Представьте человека, который чуть наклонился в дверном проёме.",
      "Imagine a person leaning slightly into a doorway.",
    ],
  ),
  cue(
    "heart-side",
    "忄",
    ["вертикальное сердце", "upright heart form"],
    [
      "Две короткие отметки по бокам от длинной вертикали.",
      "Two short marks flank a long upright stroke.",
    ],
    [
      "Длинная линия — грудь, короткие отметки — два быстрых удара сердца.",
      "Picture the long line as a chest and the short marks as two quick heartbeats.",
    ],
  ),
  cue(
    "animal-side",
    "⺨",
    ["профиль зверя", "animal profile"],
    [
      "Два коротких штриха идут вниз-влево. Длинный выгибается вправо и внизу загибается влево.",
      "Two short strokes sweep down to the left. The long stroke bows right and hooks back left at the bottom.",
    ],
    [
      "В изгибе угадайте силуэт прижавшегося к земле зверя.",
      "Use the curve to picture an animal crouched low.",
    ],
  ),
  cue(
    "blade-side",
    "刂",
    ["лезвие справа", "right-side blade"],
    [
      "Две почти вертикальные линии; длинная заканчивается крючком.",
      "Two nearly upright strokes, the longer one hooked at the bottom.",
    ],
    [
      "Пусть длинная линия станет лезвием, а короткая — отметкой того, что оно отсекло.",
      "Picture the long line as a blade and the shorter one as a mark of what it has cut away.",
    ],
  ),
] as const;
