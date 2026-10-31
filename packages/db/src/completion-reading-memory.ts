import type { MainCourseLocalizedText } from "./main-course-content";

// Original mental scenes. Kana is authoritative; these are not pronunciation transcriptions.
const SCENES: readonly (readonly [string, string, string])[] = [
  [
    "安",
    "Спокойный человек под крышей выдыхает あん; завершите отдельной носовой морой ん.",
    "A calm person under a roof breathes out あん; finish with a full nasal mora ん.",
  ],
  [
    "意",
    "Прежде чем сказать о намерении, мысленно поставьте одну маленькую точку い в сердце.",
    "Before expressing an intention, picture one tiny い placed inside the heart.",
  ],
  [
    "医",
    "Врач указывает на один инструмент и коротко произносит い; не растягивайте его в いい.",
    "A doctor points to one instrument and says a short い, not a prolonged いい.",
  ],
  [
    "員",
    "Сотрудник получает бейдж с двумя клетками: い и ん; на входе он читает их как いん.",
    "An employee receives a badge with two boxes, い and ん, and reads いん at the entrance.",
  ],
  [
    "院",
    "Вообразите учреждение с вывеской IN: вход в него напоминает いん, но ответ пишется каной.",
    "Picture an INstitution with an IN sign at the entrance, linking it to いん; answer in kana.",
  ],
  [
    "英",
    "Выдающийся ученик поднимает английский словарь с яркой меткой えい на обложке.",
    "An outstanding student raises an English dictionary with a bright えい on its cover.",
  ],
  [
    "映",
    "На экране появляется огромная надпись えい; солнце проецирует её на стену.",
    "A giant えい appears on a screen as the sun projects it onto a wall.",
  ],
  [
    "駅",
    "На станции два турникета: первый открывается на え, второй на き — вместе えき.",
    "At a station, one gate opens for え and the next for き: together, えき.",
  ],
  [
    "園",
    "В саду дорожка ведёт к табличке えん; последняя носовая мора ん занимает отдельный шаг у ограды.",
    "A garden path leads to an えん sign; the final nasal mora ん takes a full step at the fence.",
  ],
  [
    "遠",
    "Посылая письмо далеко, вообразите, как конверт с меткой えん исчезает вдали.",
    "Send a letter far away and picture its envelope marked えん disappearing into the distance.",
  ],
  [
    "屋",
    "У здания есть глубокий угол с коробкой おく: представьте её внутри, а не за дверью.",
    "A building has a deep corner holding a box labelled おく; picture it inside rather than outside.",
  ],
  [
    "温",
    "Включатель тёплой воды переведён в ON: он напоминает おん, а не длинное おう.",
    "The warm-water switch is ON, reminding you of おん rather than a long おう.",
  ],
  [
    "化",
    "Превращение происходит по щелчку: из коробки выскакивает карточка с одним коротким か.",
    "A transformation happens with a click: a card bearing one short か jumps from a box.",
  ],
  [
    "荷",
    "На грузовом ящике крупно написано か; погрузчик поднимает именно этот ящик.",
    "A cargo crate bears a large か; picture a loader lifting that particular crate.",
  ],
  [
    "界",
    "На границе двух миров сначала показывают паспорт か, затем пропуск い: かい.",
    "At the boundary of two worlds, show passport か and then pass い: かい.",
  ],
  [
    "開",
    "Чтобы открыть ворота, поверните ключ с надписью かい; оба знака на одном ключе.",
    "To open a gate, turn a key marked かい, with both kana on the same key.",
  ],
  [
    "楽",
    "На музыкальной репетиции барабан отвечает が, а маленькая палочка — く: がく.",
    "At music practice, a drum answers が and a small drumstick answers く: がく.",
  ],
  [
    "活",
    "Активный спортсмен делает хлопок か и поднимается на ступень с надписью つ: запомните полное かつ, не かっ.",
    "An active athlete claps for か and climbs a step labelled つ: remember the full かつ, not かっ.",
  ],
  [
    "館",
    "В общественном здании хранитель ставит штамп かん; последний ん закрывает дверь за посетителем.",
    "In a public building, a keeper stamps かん; the final ん closes the door behind a visitor.",
  ],
  [
    "感",
    "Сильное чувство отдаётся в сердце коротким звоном かん; вообразите один удар колокольчика.",
    "A strong feeling rings in the heart as かん; picture one strike of a small bell.",
  ],
  [
    "寒",
    "От холода человек прижимает к себе банку с надписью かん; банка остаётся в памяти рядом с 寒.",
    "A cold person hugs a can labelled かん; keep the can beside 寒 in your mental scene.",
  ],
  [
    "漢",
    "В китайском письменном свитке выделено красное かん; это метка начала слова 漢字.",
    "A Chinese-character scroll highlights a red かん, marking the start of 漢字.",
  ],
  [
    "顔",
    "На лице появился грозный рисунок がん; две черты дакутэна делают начало звонким が.",
    "A face carries a fierce がん mark; the dakuten make its opening が voiced.",
  ],
  [
    "急",
    "Срочная посылка несётся по длинному желобу きゅう: маленькое ゅ соединяется с き, затем тянется う.",
    "An urgent parcel races down a long きゅう chute: small ゅ joins き, followed by the lengthening う.",
  ],
  [
    "強",
    "Сильный человек поднимает груз с ярлыком きょう; маленькое ょ и длинный конец держатся вместе.",
    "A strong person lifts a load labelled きょう; keep its small ょ and long ending together.",
  ],
  [
    "近",
    "Близкий сосед стучит в дверь дважды: き, затем носовое ん — きん.",
    "A nearby neighbor knocks twice: き followed by nasal ん, forming きん.",
  ],
  [
    "京",
    "Над столицей светится длинная вывеска きょう; представьте её на карте 東京.",
    "A long きょう sign shines over the capital; picture it on a map of 東京.",
  ],
  [
    "教",
    "Учитель держит указку с надписью きょう и начинает объяснение у двери 教室.",
    "A teacher holds a pointer marked きょう and begins explaining at the classroom door.",
  ],
  [
    "業",
    "Рабочие инструменты гремят звонким ぎょう; дакутэн отличает его от きょう.",
    "Work tools clatter with a voiced ぎょう; its dakuten distinguish it from きょう.",
  ],
  [
    "局",
    "В бюро стоит короткий изогнутый стол きょ и отдельный ящик く: きょく, без удлинения.",
    "An office has a short curved desk きょ and a separate drawer く: きょく, without a long vowel.",
  ],
  [
    "銀",
    "Серебряная монета звенит ぎん, когда попадает в банк; начало ぎ звонкое.",
    "A silver coin rings ぎん as it enters a bank; the opening ぎ is voiced.",
  ],
  [
    "苦",
    "Попробовав горькую траву, человек выдыхает одно короткое く.",
    "After tasting bitter grass, a person exhales one short く.",
  ],
  [
    "具",
    "Тяжёлый инструмент падает на стол с гулким ударом ぐ: начало звонкое, добавьте дакутэн к く.",
    "A heavy tool lands on a table with a dull ぐ: add dakuten to く for its voiced opening.",
  ],
  [
    "計",
    "Счётчик пересчитывает две метки け и い на циферблате: けい.",
    "A counter counts the two marks け and い on a clock face: けい.",
  ],
  [
    "県",
    "Префектура показана на карте с печатью けん; конечное ん отмечает её границу.",
    "A prefecture appears on a map stamped けん; the final ん marks its border.",
  ],
  [
    "元",
    "У самого начала тропы лежит камень げん: звонкое げ указывает на исходную точку.",
    "At the origin of a trail lies a stone labelled げん; voiced げ marks the starting point.",
  ],
  [
    "古",
    "Старая коробка открывается коротким стуком こ; не добавляйте удлиняющее う.",
    "An old box opens with a short knock, こ; do not add a lengthening う.",
  ],
  [
    "戸",
    "Одна дверная створка закрывается с коротким こ; звук такой же короткий, как её движение.",
    "One door leaf closes with a short こ, as brief as its movement.",
  ],
  [
    "庫",
    "На складе у каждой коробки стоит маленькая печать こ: один короткий слог на ящике.",
    "Every crate in a storehouse carries a small こ stamp, one short syllable per crate.",
  ],
  [
    "湖",
    "У озера маленькое эхо отвечает только こ, не длинным こう.",
    "Beside a lake, a small echo answers only こ, not a long こう.",
  ],
  [
    "向",
    "Стрелка направления тянется вдаль, как длинное こう: не обрывайте её на こ.",
    "A direction arrow stretches into the distance like long こう; do not cut it short at こ.",
  ],
  [
    "公",
    "На общественном собрании все вместе долго произносят こう.",
    "At a public gathering, everyone sustains こう together.",
  ],
  [
    "光",
    "Луч света тянется через комнату; столь же длинным представьте конец こう.",
    "A ray of light stretches across a room; imagine the ending of こう equally long.",
  ],
  [
    "工",
    "Ремесленник ведёт длинный ровный шов под звук こう.",
    "A craftsperson makes a long even seam while sounding こう.",
  ],
  [
    "広",
    "Широкий навес растягивается вместе с длинным こう.",
    "A wide canopy expands together with a sustained こう.",
  ],
  [
    "合",
    "Две детали соединяются с гулким ごう: звонкое начало и длинный конец.",
    "Two parts join with a resonant ごう: a voiced start and a long ending.",
  ],
  [
    "黒",
    "На чёрной доске мел пишет こ, затем короткое く — こく, а не こう.",
    "Chalk writes こ and then a short く on a blackboard: こく, not こう.",
  ],
  [
    "才",
    "Талантливый артист показывает две карточки さ и い перед выходом на сцену: вместе さい.",
    "A talented performer shows two cards, さ and い, before going on stage: together, さい.",
  ],
  [
    "細",
    "Тонкая нить прошивает две маленькие метки さ・い: さい.",
    "A fine thread stitches through two tiny marks, さ and い: さい.",
  ],
  [
    "思",
    "Человек думает в тишине, приложив к губам палец с меткой し.",
    "A person thinks silently with a finger marked し held to their lips.",
  ],
  [
    "紙",
    "На листе бумаги напишите большой единственный し и мысленно сверните лист.",
    "Write one large し on a sheet of paper and mentally fold the sheet.",
  ],
  [
    "市",
    "На городском рынке у входа висит короткая вывеска し.",
    "At the city market entrance hangs a short sign reading し.",
  ],
  [
    "寺",
    "В храме звучит звонкий колокольчик じ; не превращайте его в глухое し.",
    "A temple bell sounds a voiced じ; do not turn it into unvoiced し.",
  ],
  [
    "自",
    "Указывая на себя, вообразите на собственном бейдже звонкое じ.",
    "Pointing to yourself, picture a voiced じ on your own badge.",
  ],
  [
    "事",
    "В списке дел каждый важный пункт отмечен одним звонким じ.",
    "In a task list, every important matter is marked with one voiced じ.",
  ],
  [
    "質",
    "Инспектор качества ставит два штампа し・つ: しつ; последний — полноценное つ, не маленькое っ.",
    "A quality inspector applies stamps し and つ: しつ; the latter is full-size つ, not small っ.",
  ],
  [
    "写",
    "Фотограф шепчет しゃ перед снимком: маленькое ゃ соединяет звук, а не добавляет отдельное や.",
    "A photographer whispers しゃ before a picture: small ゃ joins the sound rather than adding a separate や.",
  ],
  [
    "者",
    "У нужного человека бейдж с общим знаком しゃ: свяжите его с последней частью 医者.",
    "The person you need wears a しゃ badge; link it to the last part of 医者.",
  ],
  [
    "主",
    "Главный держит короткую указку しゅ; её длины не хватает для дополнительного う.",
    "The person in charge holds a short pointer labelled しゅ, too short for an extra う.",
  ],
  [
    "集",
    "Птицы собираются в длинную очередь しゅう: вытянутая очередь помогает удержать конечное う.",
    "Birds gather into a long しゅう queue; its length helps you retain the final う.",
  ],
  [
    "住",
    "У жильца длинный ключ じゅう от его дома; звонкое じ и удлинение остаются на ключе.",
    "A resident has a long じゅう key to their home; keep voiced じ and the lengthening on the key.",
  ],
  [
    "重",
    "Тяжёлую гирю медленно поднимают под длинное じゅう.",
    "A heavy weight is lifted slowly to a sustained じゅう.",
  ],
  [
    "春",
    "Весенний росток открывается на しゅ и замирает на ん: しゅん, не しゅう.",
    "A spring shoot opens on しゅ and pauses on ん: しゅん, not しゅう.",
  ],
  [
    "暑",
    "От жары остаётся короткий выдох しょ; не растягивайте его в しょう.",
    "Heat leaves you with a short breath, しょ; do not stretch it into しょう.",
  ],
  [
    "助",
    "Помощник приходит с коротким звонким じょ: помощь быстрая, без длинного う.",
    "A helper arrives with a short voiced じょ: the help is quick, without a long う.",
  ],
  [
    "昭",
    "Яркая лампа долго сияет над надписью しょう; её свет не гаснет после короткого しょ.",
    "A bright lamp shines for a long time over しょう, not stopping after a short しょ.",
  ],
  [
    "消",
    "Пожарный долго льёт воду, пока надпись しょう не погаснет вместе с огнём.",
    "A firefighter pours water until the long しょう sign goes out with the fire.",
  ],
  [
    "商",
    "Торговец растягивает рекламный зов しょう, привлекая покупателей.",
    "A merchant stretches out a sales call, しょう, to attract customers.",
  ],
  [
    "章",
    "В начале главы рассказчик тянет длинное しょう, прежде чем продолжить историю.",
    "At the start of a chapter, a narrator sustains しょう before continuing the story.",
  ],
  [
    "勝",
    "Победитель долго держит кубок под возглас しょう.",
    "A winner holds a trophy aloft to a prolonged しょう cheer.",
  ],
  [
    "乗",
    "При посадке в транспорт длинный звонкий сигнал говорит じょう.",
    "When boarding a vehicle, a long voiced signal says じょう.",
  ],
  [
    "色",
    "Художник кладёт рядом два цвета с метками し и き: палитра читается しき.",
    "An artist places colors labelled し and き side by side: the palette reads しき.",
  ],
  [
    "信",
    "Доверенное письмо запечатано знаком しん; на последнюю носовую мору ん приходится отдельный удар печати.",
    "A trusted letter is sealed with しん; give the final nasal mora ん its own beat of the stamp.",
  ],
  [
    "真",
    "Настоящая фотография помечена печатью しん: свяжите истину с последней частью 写真.",
    "A genuine photograph carries a しん seal: link truth to the last part of 写真.",
  ],
  [
    "進",
    "Продвигаясь вперёд, птица переступает метки し и ん, оставляя しん на дороге.",
    "Advancing along a road, a bird steps over し and ん, leaving しん behind.",
  ],
  [
    "図",
    "На схеме нарисован один звонкий ず; это не полное слово ちず и не づ.",
    "A diagram contains one voiced ず, not the whole word ちず and not づ.",
  ],
  [
    "声",
    "Голос на сцене держит せい, пока диктор показывает две буквы せ・い.",
    "A stage voice sustains せい while an announcer shows the two kana せ and い.",
  ],
  [
    "西",
    "Закат на западе освещает указатель せい; запомните этот указатель отдельно от слова にし.",
    "A western sunset lights a せい sign; remember this sign separately from the word にし.",
  ],
  [
    "切",
    "Нож режет ленту на части せ и つ: вместе せつ.",
    "A knife cuts a ribbon into parts marked せ and つ: together, せつ.",
  ],
  [
    "説",
    "Объясняющий соединяет два пункта せ・つ; произнесите せつ до дальнейшего рассказа.",
    "An explainer links two points, せ and つ; say せつ before the rest of the explanation.",
  ],
  [
    "船",
    "На судне капитан проверяет билет せん; завершите отдельной носовой морой ん.",
    "A ship captain checks a ticket labelled せん; finish with a full nasal mora ん.",
  ],
  [
    "線",
    "Длинная нарисованная линия заканчивается меткой ん: мысленно проведите по ней せん.",
    "A drawn line ends at ん; mentally trace せん along it.",
  ],
  [
    "全",
    "Все предметы в ящике помечены звонким ぜん; ни одного глухого せん среди них нет.",
    "All objects in a box carry voiced ぜん; no unvoiced せん is among them.",
  ],
  [
    "組",
    "Группа связана одной короткой нитью そ; в слове 組織 она стоит первой.",
    "A group is tied by one short thread labelled そ, first in 組織.",
  ],
  [
    "走",
    "Бегун тянет за собой длинную ленту そう; не теряйте её конечное う.",
    "A runner trails a long ribbon labelled そう; do not lose its final う.",
  ],
  [
    "送",
    "Отправляемая посылка едет по длинному конвейеру そう.",
    "A parcel being sent travels down a long conveyor labelled そう.",
  ],
  [
    "族",
    "Семья передаёт друг другу два жетона ぞ・く: вместе ぞく.",
    "A family passes around two tokens, ぞ and く: together, ぞく.",
  ],
  [
    "待",
    "Ожидающий читает на часах た, затем い: ожидание закрепляет たい.",
    "Someone waiting reads た and then い on a clock, fixing たい in memory.",
  ],
  [
    "代",
    "Сменщик получает звонкий пароль だい; дакутэн отличает его от たい.",
    "A replacement worker receives voiced password だい; dakuten distinguish it from たい.",
  ],
  [
    "台",
    "На подставке стоят две фигурки た и い: вместе たい, без дакутэна.",
    "Two figures, た and い, stand on a platform: たい, without dakuten.",
  ],
  [
    "第",
    "Первый в очереди держит порядковый номер だい; это начало слова 第一.",
    "The first person in line holds ordinal marker だい, the start of 第一.",
  ],
  [
    "題",
    "На заглавной странице крупно напечатано だい: представьте эту страницу перед ответом.",
    "A title page bears a large だい; picture that page before answering.",
  ],
  [
    "短",
    "Короткая линейка обрывается на ん: たん, а не たい.",
    "A short ruler stops at ん: たん, not たい.",
  ],
  [
    "着",
    "Прибывший пассажир зацепился рукавом: короткое ちゃ заканчивается на く, образуя ちゃく.",
    "An arriving passenger catches a sleeve: short ちゃ ends in く to form ちゃく.",
  ],
  [
    "注",
    "Струя воды тянется под звук ちゅう; маленькое ゅ образует ちゅ, а конечное う удлиняет гласный.",
    "A stream of water continues to ちゅう; small ゅ forms ちゅ and final う lengthens its vowel.",
  ],
  [
    "都",
    "На карте большого города есть одна короткая отметка と, не とし целиком.",
    "A metropolis map has one short と marker, not the whole word とし.",
  ],
  [
    "度",
    "Термометр поднимается на одну звонкую отметку ど: один градус, короткий звук.",
    "A thermometer rises by one voiced ど mark: one degree, one short sound.",
  ],
  [
    "動",
    "Движущийся тяжёлый груз долго гудит どう; удержите конечное う.",
    "A moving heavy load hums どう for a long time; retain its final う.",
  ],
  [
    "働",
    "Работающий человек продолжает движение под то же длинное どう, что и 動 справа.",
    "A working person keeps moving to the same long どう as 動 on the right.",
  ],
  [
    "特",
    "Особенная корова несёт два жетона と・く, которые вместе дают とく.",
    "A special cow carries two tokens, と and く, together giving とく.",
  ],
  [
    "転",
    "Колесо делает поворот て и ещё один полный такт на носовую мору ん: てん.",
    "A wheel turns for て and takes one more full beat for nasal mora ん: てん.",
  ],
  [
    "通",
    "Длинный проход тянется под вывеской つう; произносите полное つ и удлиняющее う.",
    "A long passage stretches beneath つう; say full-size つ followed by lengthening う.",
  ],
  [
    "同",
    "Два одинаковых колокола звучат одинаковым длинным どう.",
    "Two identical bells sound the same long どう.",
  ],
  [
    "道",
    "Дорога уходит вдаль вместе с длинным どう.",
    "A road stretches into the distance with a long どう.",
  ],
  [
    "場",
    "На большом месте сбора висит длинная вывеска じょう: удержите маленькое ょ и конец う.",
    "A large gathering place has a long じょう sign; retain small ょ and final う.",
  ],
  [
    "新",
    "Новая газета приходит с печатью しん в начале слова 新聞.",
    "A new newspaper arrives with しん stamped at the start of 新聞.",
  ],
  [
    "親",
    "Родитель прикладывает к письму близким печать しん; это не чтение целого слова おや.",
    "A parent seals a letter to loved ones with しん; this is not the whole-word reading おや.",
  ],
  [
    "心",
    "Сердце стучит в два счёта: し и ん, вместе しん.",
    "A heart beats in two counts, し and ん, together forming しん.",
  ],
  [
    "持",
    "В руке зажат один маленький звонкий жетон じ: не добавляйте ещё つ.",
    "A hand holds one small voiced じ token; do not add another つ.",
  ],
  [
    "反",
    "Противоположная сторона таблички показывает はん; конечное ん замыкает поворот.",
    "The opposite side of a sign shows はん; final ん closes the turn.",
  ],
  [
    "坂",
    "На склоне стоят две ступени さ・か. Это целое кунное さか, без добавочного う.",
    "A slope has two steps, さ and か. This is the complete kun reading さか, with no added う.",
  ],
  [
    "皮",
    "Кожура снимается одной короткой полоской ひ: у полоски нет второго слога.",
    "A peel comes off in one short strip labelled ひ, with no second syllable.",
  ],
  [
    "悲",
    "Печальный человек тихо выдыхает ひ, глядя на сердце под 非.",
    "A sad person softly exhales ひ while looking at the heart beneath 非.",
  ],
  [
    "美",
    "Красивый рисунок отмечен звонким び; маленькие две черты отличают его от ひ.",
    "A beautiful drawing is marked with voiced び; two small marks distinguish it from ひ.",
  ],
  [
    "筆",
    "Кисть сначала пишет два знака ひ・つ; в слове 筆記 последний меняется, но карточка кисти хранит ひつ.",
    "A brush first writes ひ and つ; the latter changes in 筆記, but the brush card retains ひつ.",
  ],
  [
    "病",
    "Больничный звонок тянет びょう: звонкое び, маленькое ょ и длинное окончание.",
    "A hospital bell sustains びょう: voiced び, small ょ and a long ending.",
  ],
  [
    "品",
    "На товарной коробке штамп ひん; последняя носовая мора ん занимает отдельный такт закрывания упаковки.",
    "A goods box bears a ひん stamp; the final nasal mora ん takes a full beat as the package closes.",
  ],
  [
    "服",
    "Одежда складывается в два сгиба ふ・く: ふく, не ふうく.",
    "Clothes fold in two creases, ふ and く: ふく, not ふうく.",
  ],
  [
    "福",
    "Счастливый человек получает амулет с двумя знаками ふ・く: счастье хранится в ふく.",
    "A happy person receives a charm bearing ふ and く; good fortune is kept in ふく.",
  ],
  [
    "物",
    "Предмет стукнул по столу: ぶ, затем つ — ぶつ, со звонким началом.",
    "An object hits a table: ぶ followed by つ, forming ぶつ with a voiced start.",
  ],
  [
    "平",
    "Ровная площадка соединяет метки へ и い прямой линией: へい.",
    "A level platform joins marks へ and い with a straight line: へい.",
  ],
  [
    "別",
    "Нож отделяет два жетона べ・つ от остальных: べつ, не べっ.",
    "A knife separates tokens べ and つ from the rest: べつ, not べっ.",
  ],
  [
    "辺",
    "Край карты заканчивается на ん; пройдите по нему, произнося へん.",
    "A map edge ends at ん; trace it while saying へん.",
  ],
  [
    "勉",
    "Усердный ученик закончил упражнение и поставил звонкую печать べん.",
    "A diligent student finishes an exercise and adds a voiced べん seal.",
  ],
  [
    "歩",
    "Один шаг — один короткий выдох ほ. Не превращайте его в длинное ほう.",
    "One step gives one short breath, ほ; do not turn it into long ほう.",
  ],
  [
    "放",
    "Отпущенная птица улетает далеко под длинное ほう, в отличие от короткого шага ほ.",
    "A released bird flies far away to long ほう, unlike the short walking step ほ.",
  ],
  [
    "味",
    "Попробовав еду, человек произносит короткое み и показывает на вкусное блюдо.",
    "After tasting the food, a person says a short み and points at the tasty dish.",
  ],
  [
    "明",
    "Ясный свет высвечивает имя с меткой めい; удержите обе части め・い.",
    "Clear light reveals a name marked めい; retain both parts, め and い.",
  ],
  [
    "夜",
    "Ночная звезда мигает один раз: や. Это короткое や, не целое слово よる.",
    "A night star flashes once: や. It is short や, not the whole word よる.",
  ],
  [
    "有",
    "У владельца есть длинный ключ ゆう: представьте имеющуюся у него вещь вместе с ключом.",
    "An owner has a long key labelled ゆう; picture the possessed object together with that key.",
  ],
  [
    "洋",
    "Океанская волна тянется до горизонта под длинное よう.",
    "An ocean wave stretches to the horizon with a long よう.",
  ],
  [
    "用",
    "Полезный инструмент долго служит владельцу: на его ручке написано よう.",
    "A useful tool serves its owner for a long time; its handle reads よう.",
  ],
  [
    "曜",
    "На календаре каждый день недели имеет длинную цветную ленту よう.",
    "Each weekday on a calendar has a long colored ribbon marked よう.",
  ],
  [
    "理",
    "Правило помечено одним коротким знаком り: мысль ясная, звук короткий.",
    "A principle is marked with one short kana り: a clear idea and a short sound.",
  ],
  [
    "旅",
    "Путешественник берёт короткий билет りょ; не удлиняйте его до りょう.",
    "A traveler takes a short ticket labelled りょ; do not lengthen it to りょう.",
  ],
  [
    "料",
    "На длинном счёте за материалы написано りょう: удержите удлинение, которого нет в 旅 りょ.",
    "A long bill for materials reads りょう; retain the lengthening absent from 旅 りょ.",
  ],
  [
    "良",
    "За хорошую работу выдают длинную ленту りょう.",
    "Good work earns a long ribbon labelled りょう.",
  ],
  [
    "緑",
    "На зелёной коробке два жетона りょ・く: вместе りょく, не りょう.",
    "A green box holds tokens りょ and く: together りょく, not りょう.",
  ],
  [
    "礼",
    "Вежливый поклон проходит по двум меткам れ・い: поклон закрепляет れい.",
    "A polite bow follows two marks, れ and い, fixing れい in memory.",
  ],
  [
    "雪",
    "Снег падает двумя хлопьями せ・つ: вместе せつ, с полным つ.",
    "Snow falls as two flakes marked せ and つ: together, せつ, with full つ.",
  ],
  [
    "回",
    "Один оборот колеса возвращает метки か и い в начало: かい.",
    "One turn of a wheel brings marks か and い back to the start: かい.",
  ],
  [
    "海",
    "Море выбрасывает на берег две ракушки か・い; свяжите берег с かい.",
    "The sea washes shells marked か and い onto the shore; link the shore with かい.",
  ],
  [
    "対",
    "Две стороны стоят друг против друга с табличками た и い: たい.",
    "Two sides stand opposite each other with signs た and い: たい.",
  ],
  [
    "始",
    "В начале истории появляется один короткий сигнал し — после него начинается действие.",
    "At the beginning of a story, one short し signal appears and the action starts.",
  ],
  [
    "終",
    "На конце истории занавес медленно опускается под длинное しゅう.",
    "At the end of a story, the curtain lowers slowly to a sustained しゅう.",
  ],
];

export function completionReadingMemory(character: string): MainCourseLocalizedText {
  const row = SCENES.find(([key]) => key === character);
  if (!row) throw new Error(`Missing authored reading memory for ${character}`);
  return { ru: row[1], en: row[2] };
}

export const COMPLETION_READING_MEMORY_CHARACTERS = SCENES.map(([character]) => character);
