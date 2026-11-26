import { componentNotes } from "./main-course-editorial-entry";

const continuation = componentNotes("full-course-kanji-continuation");
const expansion = componentNotes("full-course-kanji-expansion");

function forSymbol(notes: ReturnType<typeof componentNotes>, prefix: string) {
  return (symbol: string, ru: string, en: string) =>
    notes(`${prefix}-${symbol.codePointAt(0)!.toString(16)}`, symbol, ru, en);
}

const c = forSymbol(continuation, "continuation");
const e = forSymbol(expansion, "expansion");

export const FOUNDATION_SHAPE_NOTES = [
  c(
    "石",
    "Представьте окошко под нависающим уступом. В 研 ищите слева две части: косой спуск под верхней чертой и квадрат 口 под ним. Здесь «скала с окошком» — подсказка для формы; отдельный кандзи 石 учится как «камень».",
    "Picture a window under a cliff ledge. On the left of 研, look for a sloping stroke below the top bar and a square beneath it. “Cliff with a window” is the shape cue; the standalone kanji 石 means stone.",
  ),
  c(
    "亅",
    "Справа в 町 под верхней чертой 丁 найдите ровную стойку с коротким крючком влево. Это 亅. Простая вертикаль 丨 заканчивается без такого поворота.",
    "In 町, look below the top bar of 丁 for a straight upright ending in a short leftward hook. That stroke is 亅. A plain 丨 stops without turning.",
  ),
  c(
    "冫",
    "Слева в 冷 всего две короткие отметки, а не три, как в 氵 у 海. Верхняя похожа на точку, нижняя поднимается к середине знака. Сначала считайте штрихи, потом вспоминайте образ мороза.",
    "The left side of 冷 has two short marks, not the three in 氵 on 海. The upper mark looks like a dot; the lower rises toward the middle. Count them before reaching for the frost mnemonic.",
  ),
  c(
    "令",
    "В форме 冷 с нижним загибом под правой крышей видны точка и два штриха вроде マ. В других шрифтах низ 令 бывает прямее. Сравнивайте одинаковые начертания, прежде чем решать, что форма отличается.",
    "In the form of 冷 with a bent base, look below the roof for a dot and two strokes like マ. Other fonts draw the base straighter. Compare the same writing style before deciding the shape is different.",
  ),
  c(
    "亥",
    "Справа в 核 под крышкой 亠 расходятся нижние штрихи. Представьте следы, разошедшиеся в разные стороны. Запоминайте всю правую часть, а не крышку отдельно от нижних черт.",
    "On the right of 核, the lower strokes spread out beneath 亠. Picture tracks diverging from a single spot. Take in the whole right-hand shape, not just the cap.",
  ),
  c(
    "匸",
    "В 区 верхняя черта и нижний угол охватывают внутреннее перекрестие слева, но справа остаётся проём. Этот проём надёжнее всего отличает боковую складку от закрытой рамки 囗.",
    "In 区, the top bar and lower corner wrap around the crossing strokes from the left but leave the right side open. That gap is the quickest way to distinguish this side fold from the closed frame 囗.",
  ),
  c(
    "了",
    "За коротким верхним изгибом в 了 идёт длинный крючок; средней перекладины нет. Сравните с 子, где горизонталь пересекает длинную черту. Встречая 予, замечайте похожую пару штрихов под верхним углом.",
    "A long hook follows the short upper bend in 了, with no bar across the middle. In 子 a horizontal crosses the long stroke. In 予, look for a similar pair of strokes below the top corner.",
  ),
  c(
    "彑",
    "В 彙 ступенчатая форма находится наверху, над широкой центральной частью. В 彑 следите за угловым контуром и линиями у его основания: их сочетание отличает ступень от простой горизонтальной крышки.",
    "The bent step sits at the top of 彙, above the wide middle. In 彑, follow the angular outline and the bars near its base: together they distinguish the step from a simple lid.",
  ),
  c(
    "亡",
    "В 忘 верхний навес 亡 стоит над 心; на карточке навеса сердце не входит в форму. Под крышкой найдите боковой сгиб, оставляющий открытое место справа, как у пустого укрытия.",
    "In 忘, the canopy 亡 sits above 心; leave the heart out when identifying the component. Under the cap, follow the bent side down to the opening on the right, like an empty shelter.",
  ),
  c(
    "昔",
    "Справа в 借 рамка 日 находится под верхними перекладинами. Представьте, что солнце спряталось под полкой. Важно собрать весь прямоугольный блок вместе с верхом, а не выделить только 日.",
    "On the right of 借, a 日 shape sits beneath the upper bars. Picture the sun tucked under a shelf. The cue covers the square and the strokes above it, not just 日.",
  ),
  c(
    "甲",
    "В 押 справа вертикальный стержень выходит снизу из клеточки. Сравните 甲 с 由, где выступ находится сверху, и 申, где он есть с обеих сторон. Место выступа важнее ширины клеточки.",
    "On the right of 押, the upright extends below its cell. Compare 甲 with 由, where it sticks out at the top, and 申, where it emerges at both ends. Look at the extension rather than the width.",
  ),
  c(
    "永",
    "В 泳 справа струи расходятся от центрального крючка, а сверху есть точка. Она помогает отличить 永 от 水. Три отметки 氵 слева — отдельная деталь, их не нужно считать частью струи.",
    "On the right of 泳, strokes branch off a central hook beneath a dot. That dot helps tell 永 from 水. The three water marks on the left are separate; do not count them as part of the branching stream.",
  ),
  c(
    "夬",
    "Справа в 決 две нижние черты расходятся, как развилка, а у верхней перекладины есть угол. В 大 такого добавочного угла нет. Представьте небольшой флажок над двумя расходящимися тропами.",
    "On the right of 決, two strokes spread below an angular top like paths at a fork. 大 lacks that extra corner. Picture a small flag above the place where the paths split.",
  ),
  c(
    "民",
    "В 眠 сначала отделите глаз 目 слева. Справа верхняя рамка и длинный нижний поворот принадлежат одной фигуре 民. Одного верхнего окошка мало: заметный крюк у основания отличает форму целиком.",
    "In 眠, separate the eye 目 on the left first. On the right, the frame at the top and the long turn below belong to 民. Its long lower hook is a better clue than the small upper window alone.",
  ),
  c(
    "丁",
    "В 町 справа крюк свисает с верхней горизонтали. На отличие от 十 указывает место стыка: стойка 丁 не продолжается над перекладиной. Сравните верхушки прежде, чем смотреть на остальной знак.",
    "In 町, a hook hangs from the top bar on the right. Unlike the cross in 十, its upright does not rise above the bar. Check the joint at the top before comparing the rest of the character.",
  ),
  c(
    "共",
    "Справа в 供 представьте общую подставку: две стойки между горизонталями, а ниже две отдельные ножки. В 昔 под похожими верхними чертами видно 日, поэтому надёжнее смотреть в самый низ.",
    "On the right of 供, picture a stand: two uprights between horizontal bars with two short feet below. 昔 has 日 under a similar top, so the base makes the better clue.",
  ),
  c(
    "己",
    "В 記 справа виден 己. Сравните, где слева начинается его последний штрих: у 己 на уровне средней черты, у 已 выше неё, у 巳 у самой верхней черты.",
    "Find 己 on the right of 記. Compare where the last stroke starts on the left: at the middle bar in 己, above it in 已, and at the top bar in 巳.",
  ),
  c(
    "勺",
    "В 約 справа под большим загибом находится одна капля. Отделите её от наружного контура 勹: только вместе они образуют 勺. Изгиб сам по себе ещё не вся «капля под крюком».",
    "On the right of 約, one dot sits under the large hooked stroke. Separate that drop from the enclosing 勹: together they make 勺. The enclosure alone is only part of the cue.",
  ),
  c(
    "吉",
    "Справа в 結 над 口 стоит 士. Его верхняя горизонталь длиннее нижней, в отличие от 土. Представьте подставку над окошком, чтобы запомнить порядок двух частей.",
    "On the right of 結, 士 sits over 口. Its top bar is longer than its lower bar, unlike 土. Picture a stand above a window to remember the order of the two parts.",
  ),
  c(
    "戋",
    "Символ 戋 здесь лишь указывает на похожий блок: в 浅 и 残 справа три поперечные линии и шесть штрихов. Представьте насечки на крюке, но сверяйте их число на самом японском знаке, а не по отдельному 戋.",
    "Here 戋 points to a related shape, not an exact tracing. The right side of 浅 and 残 has three crossbars and six strokes. Picture notches on a hook, but count the lines on the Japanese character itself.",
  ),
  c(
    "付",
    "Под навесом 府 спрятаны узкий человек 亻 и мерка 寸. Вместе они образуют 付. Точка у крючка 寸 помогает заметить, что это не только человек рядом с простой перекладиной.",
    "Inside the shelter of 府, a narrow person 亻 stands beside 寸. Together they form 付. The dot by the hook in 寸 reminds you to include more than the person and a single bar.",
  ),
  c(
    "干",
    "В 刊 слева короткая верхняя планка и более длинная средняя соединены стойкой, которая уходит вниз. У 十 только одна перекладина. Чтобы найти 干 в тесном знаке, сначала посчитайте горизонтали.",
    "On the left of 刊, an upright links a short top bar to a longer middle bar and continues below. 十 has only one crossbar. Count the bars first when the component is squeezed in tight.",
  ),
  c(
    "尹",
    "Сверху в 君 длинная наклонная черта проходит через угловатую группу и выходит над 口 слева. Представьте стержень, пропущенный сквозь руку. Окошко 口 ниже к этому силуэту не относится.",
    "At the top of 君, a long slant cuts across the angular strokes and projects to the left of 口 below. Think of a rod passing through a hand. The square underneath is a separate part.",
  ),
  c(
    "亢",
    "Справа в 航 шапка 亠 лежит над двухштриховой опорой 几; справа внизу у опоры есть поворот. В 六 нижние две черты свободно расходятся и такого поворота не образуют.",
    "On the right of 航, a cap 亠 sits above the two-stroke base 几, which turns at the lower right. The two strokes under 六 spread out without that turn.",
  ),
  c(
    "余",
    "В 途 найдите под наклонной крышей перекладины и расходящиеся нижние штрихи. Это 余, крыша над ветвями. Точка и зигзаг слева, а также длинная черта снизу относятся к ⻌, не к 余.",
    "In 途, find the bars and spreading strokes under the roof. That is 余, branches under cover. The dot and zigzag on the left and the long sweep below belong to ⻌, not to 余.",
  ),
  c(
    "𠂤",
    "В 追 справа от точки и зигзага ⻌ стоят две ступеньки с общей левой стойкой. Сверху у них короткий наклон. Если редкий символ 𠂤 не отобразился в шрифте, ищите рисунок прямо в 追.",
    "In 追, look for two stacked steps sharing a left upright, to the right of the dot and zigzag of ⻌. A short slant sits on top. If your font cannot display 𠂤, find the shape in 追.",
  ),
  c(
    "走",
    "В 起 найдите длинный нижний штрих 走: он начинается слева внизу и тянется вправо под 己. Вообразите длинный шаг. Верхушка 土 без этого основания не образует всю фигуру.",
    "In 起, find the long bottom stroke of 走. It starts low on the left and sweeps right beneath 己. Picture a long stride. The 土 at the top is only part of the shape.",
  ),
  c(
    "覀",
    "В 票 плоская рамка расположена над 示. Внутри рамки есть разделительные линии, а сверху идёт сплошная горизонталь. Запоминайте её по месту в знаке: случайно похожие окошки не обязательно тот же компонент.",
    "In 票, the flat frame sits above 示. Look for the divisions inside it and the long horizontal across the top. Its position is a better clue than any other square that happens to look similar.",
  ),
  c(
    "疋",
    "В 疑 опора находится в нижней правой части. Начните с небольшого верхнего изгиба, спуститесь к стойке и закончите на длинном «шаге» у основания. Это помогает собрать разнесённые штрихи в один силуэт.",
    "In 疑, the support is at the lower right. Start at the small upper bend, follow the upright, and finish at the long step along the base. That path groups strokes that might otherwise look unrelated.",
  ),
  c(
    "壬",
    "Справа в 任 над фигурой вроде 士 лежит наклонная черта. Она отличает 壬 от 王 с обычной горизонталью наверху. Сравнивайте направление первой черты, а не только число перекладин.",
    "On the right of 任, a slanted stroke sits above a shape like 士. That slant distinguishes 壬 from 王, whose top bar is horizontal. Compare the direction, not just the number of bars.",
  ),
  c(
    "⺤",
    "В 採 над 木 справа видны короткие штрихи «коготков». Полное 爪 выглядит иначе; здесь его верхний вариант лежит над другой частью. Запоминайте небольшую группу целиком, а не отдельную точку.",
    "In 採, the short claw marks sit above 木 on the right. The full form 爪 looks different; this variant is shaped to sit over another part. Learn the small group rather than just one of its marks.",
  ),
  c(
    "夭",
    "Справа в 妖 найдите дополнительный верхний штрих, который наклонён, а не лежит ровно. У 天 похожая фигура, но верхняя черта горизонтальная. Образ наклонённых плеч помогает вспомнить направление.",
    "On the right of 妖, the extra top stroke slopes rather than lying flat. 天 has a similar outline with a horizontal top. Picture tilted shoulders to remember which way that stroke goes.",
  ),
  c(
    "皮",
    "Справа в 波 верхний сгиб и перекрещённые нижние черты составляют одну фигуру 皮. Снизу видна похожая на 又 часть, но без верхнего покрова весь силуэт не получится.",
    "On the right of 波, the upper bend and crossing strokes below make up 皮. The base resembles 又, but you need the folded cover above it to recognize the whole shape.",
  ),
  c(
    "東",
    "В 凍 справа вертикаль проходит сквозь среднюю рамку, а снизу отходят два коротких штриха. Сравните с 車: там ось тоже выступает, но у её основания нет таких расходящихся штрихов.",
    "On the right of 凍, an upright runs through the middle frame and two short strokes spread out below. The axle in 車 also extends past a frame, but it has no spreading strokes at its base.",
  ),
  e(
    "二",
    "У 二 две не пересекающиеся черты, нижняя шире. В 井 горизонтали уже пересекают стойки, но похожую пару можно выделить глазами. Здесь запоминайте пару планок как форму; отдельный кандзи 二 обозначает число два.",
    "二 has two separate bars, with the longer one below. In 井, uprights cross the bars, but you can still pick out the pair. This component card uses the shape; the standalone kanji 二 means two.",
  ),
  e(
    "卩",
    "В 命 справа внизу короткий угловой крюк стоит рядом с маленьким квадратом 口. Следите за отдельно стоящей вертикалью: у 卩 нет замкнутого окошка. Не соединяйте два соседних силуэта в один.",
    "At the lower right of 命, a small angular hook sits beside the square 口. Look for its separate upright: 卩 has no closed window. Keep the two neighboring shapes distinct.",
  ),
  e(
    "示",
    "Под двумя деревьями в 禁 найдите две перекладины и расходящиеся нижние черты. Это полная форма 示. В некоторых знаках слева она выглядит иначе: например, в 礼 виден боковой вариант 礻, а не этот широкий верх.",
    "Under the two trees in 禁, find the two bars and spreading lower strokes of full-size 示. On the left of 礼 it takes the narrow form 礻 instead. Compare the two as variants rather than expecting a perfect match.",
  ),
  e(
    "彡",
    "Справа в 形 одна под другой идут три косые черты. Они не соединяются, их удобно проследить по очереди сверху вниз. Одиночная 丿 такого ряда не образует.",
    "Three slanting strokes run down the right side of 形, one below the next. They do not touch; trace each in turn from top to bottom. A single 丿 does not make this pattern.",
  ),
  e(
    "廿",
    "В 甘 можно заметить контур 廿 с дополнительной линией внутри. Выделите верхнюю перекладину, выступающие над ней стойки и нижнюю линию. На карточке формы внутреннюю черту 甘 добавлять не нужно.",
    "In 甘, look for the outline of 廿 with one more bar inside. Pick out the top bar, the uprights that rise above it and the line at the base. Leave out the extra inner stroke when identifying the component.",
  ),
  e(
    "谷",
    "Справа в 浴 над 口 есть две пары косых штрихов: короткие сверху, более длинные под ними. Обе пары расходятся вниз в стороны. Представьте склоны над дном долины.",
    "On the right of 浴, two pairs of slanting strokes spread down and outward above 口, with the shorter pair on top. Picture slopes above the floor of a valley.",
  ),
  e(
    "𠂉",
    "Справа в 施 небольшой наклон с примыкающей горизонталью находится над 也. Если 𠂉 выглядит слишком мелко или не отобразился, сравните эти две верхние черты в 施 с остальным контуром.",
    "On the right of 施, a short slant meets a horizontal bar above 也. If your font makes 𠂉 hard to see or does not display it, practice isolating those two marks in 施 itself.",
  ),
  e(
    "勹",
    "В 約 длинный изгиб справа прикрывает точку, как обёртка. Само 勹 включает короткий наклон и наружный крюк; точка внутри превращает эту пару в 勺.",
    "The long bend on the right of 約 covers a dot like a wrapper. 勹 is the short slant and the outer hook; the dot inside turns that pair into 勺.",
  ),
  e(
    "韋",
    "В 違 найдите квадрат между верхним и нижним поворотами. Все три части относятся к 韋. Длинная черта, которая огибает их снизу слева, относится к внешней части 違, а не к этой фигуре.",
    "In 違, find the square between the turns above and below it. All three belong to 韋. The long sweep around the bottom left belongs to the outer part of 違, not to this shape.",
  ),
  e(
    "臣",
    "Слева наверху в 堅 найдите длинную левую стойку и короткие перекладины. Справа нет сплошной стенки, как у 田. Вся эта группа находится над основанием 土.",
    "At the upper left of 堅, find the long left upright and its short crossbars. Unlike 田, it has no continuous right edge. The group sits above the 土 base.",
  ),
  e(
    "曲",
    "Вверху 豊 видна широкая клетка с двумя вертикалями, которые торчат над её верхней линией. У 田 вертикальный разделитель остаётся в пределах рамки. Сначала найдите выступы и только потом смотрите на низ 豊.",
    "At the top of 豊, two uprights stick out above a wide grid. In 田 the vertical divider stays inside the frame. Check for the two protruding strokes before examining the base of 豊.",
  ),
  e(
    "辰",
    "Справа в 振 найдите нависший левый склон и широкий низ с расходящимися штрихами. Верх напоминает уступ, но на карточке нужен весь правый блок, включая края «подола».",
    "On the right of 振, find the left overhang and the wide base with spreading strokes. The top suggests a ledge, but the cue includes the whole right-hand block down to the edges of its hem.",
  ),
  e(
    "⺦",
    "Слева в 壮 длинная стойка и два коротких штриха образуют узкий вариант 爿. Справа стоит 士, его перекладины не относятся к этой форме. Если отдельный ⺦ не виден в вашем шрифте, опирайтесь на пример 壮.",
    "On the left of 壮, an upright and two short strokes form the narrow variant of 爿. The bars in 士 to its right do not belong to it. If your font lacks the standalone ⺦, use the example 壮.",
  ),
] as const;
