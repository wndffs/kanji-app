import type { MainCourseComponentContent } from "./main-course-content";

const cue = (
  key: string,
  symbol: string,
  [ru, en]: readonly [string, string],
  [shapeRu, shapeEn]: readonly [string, string],
  [imageRu, imageEn]: readonly [string, string],
): MainCourseComponentContent => ({
  key: `component-closure-${key}`,
  symbol,
  displayName: { ru, en },
  meaning: { ru, en },
  shapeDescription: { ru: shapeRu, en: shapeEn },
  mnemonic: { ru: imageRu, en: imageEn },
});

export const COURSE_CLOSURE_STANDARD_CUES = [
  cue(
    "angular-cap",
    "𠂊",
    ["угловая верхушка", "angled cap"],
    [
      "Косой штрих и верхняя линия с диагональным загибом.",
      "A diagonal stroke and a top bar with an angled bend.",
    ],
    [
      "Представьте козырёк, резко поворачивающий за угол.",
      "Picture a short awning jutting out at a corner.",
    ],
  ),
  cue(
    "stepped-path",
    "⻌",
    ["ступенчатая дорожка", "stepped path"],
    [
      "Точка выше ломаного штриха и длинный след, уходящий вправо снизу.",
      "A dot above a bent stroke and a long bottom sweep to the right.",
    ],
    [
      "Представьте след: короткий шаг у поворота и длинный выход на дорогу.",
      "Picture a short footstep at a bend and a long stride onto the road.",
    ],
  ),
  cue(
    "bent-second",
    "乙",
    ["изогнутая черта", "bent stroke"],
    [
      "Один штрих: полка сверху, спуск влево, плавный загиб вправо внизу.",
      "One stroke: top ledge, a descent to the left, then a curved turn to the right.",
    ],
    [
      "На втором ярлыке расписались одним непрерывным росчерком.",
      "The second label is signed in one unbroken flourish.",
    ],
  ),
  cue(
    "mortar-bowl",
    "臼",
    ["чаша ступки", "mortar bowl"],
    [
      "Чаша из двух стенок и дна; короткие горизонтали обращены друг к другу.",
      "A bowl with two sides and a base; short bars point inward from the sides.",
    ],
    [
      "Представьте тяжёлую чашу с выступами по бокам, в которой толкут зерно.",
      "Picture a heavy bowl with sides that turn inward, used to pound grain.",
    ],
  ),
  cue(
    "can-with-lid",
    "缶",
    ["сосуд с крышкой", "covered container"],
    [
      "Скошенная верхушка с перекладинами стоит над открытой сверху коробкой.",
      "A sloped top with bars sits over a box open at the top.",
    ],
    [
      "У металлической банки приподнялась крышка, но нижний корпус остался на месте.",
      "The lid of a metal can lifts while its lower body stays on the surface.",
    ],
  ),
] as const;
