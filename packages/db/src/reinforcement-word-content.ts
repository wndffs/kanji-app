import type { MainCourseContentBatch, MainCourseLocalizedText } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { REINFORCEMENT_EXTRA_WORDS } from "./reinforcement-word-extras";
import { validateReinforcementReadings } from "./reinforcement-reading-evidence";

type Pair = readonly [ru: string, en: string];
export type ReinforcementWordRow = readonly [
  expression: string,
  reading: string,
  sequence: string,
  ru: readonly string[],
  en: readonly string[],
  scope: Pair,
  memory: Pair,
  sound: Pair,
  example: readonly [jp: string, kana: string, ru: string, en: string],
];

// Project-authored text. The exact pair and sense IDs were checked in pinned local JMdict.
const GAP_WORDS: readonly ReinforcementWordRow[] = [
  [
    "上映",
    "じょうえい",
    "1352650",
    ["показ фильма", "кинопоказ"],
    ["film screening", "screening a movie"],
    [
      "Показ фильма на экране; с する — показывать фильм.",
      "Showing a film on a screen; add する for the action.",
    ],
    [
      "Изображение 映 поднимается 上 на большой экран: начинается кинопоказ.",
      "The image 映 goes up 上 onto a big screen: the screening begins.",
    ],
    [
      "じょ・う・え・い — четыре моры: う удлиняет о, а えい обычно звучит как долгое э. Не じょえ.",
      "じょ・う・え・い has four morae: う lengthens the o, and えい usually sounds like a long e. Not じょえ.",
    ],
    [
      "この映画は、あした上映されます。",
      "このえいがは、あしたじょうえいされます。",
      "Этот фильм покажут завтра.",
      "This film will be screened tomorrow.",
    ],
  ],
  [
    "駅員",
    "えきいん",
    "1175150",
    ["работник станции", "сотрудник станции"],
    ["station attendant", "station employee"],
    [
      "Работник железнодорожной станции, не пассажир.",
      "An employee of a railway station, not a passenger.",
    ],
    [
      "Сотрудник 員 помогает людям на станции 駅 найти поезд.",
      "An employee 員 helps people at the station 駅 find their train.",
    ],
    [
      "え・き・い・ん — четыре моры: соседние и дают долгий гласный; не пропускайте い или ん.",
      "え・き・い・ん has four morae: the adjacent i sounds form a long vowel; do not drop い or ん.",
    ],
    [
      "駅員に、ホームを聞きました。",
      "えきいんに、ほーむをききました。",
      "Я спросил работника станции, где платформа.",
      "I asked a station attendant where the platform was.",
    ],
  ],
  [
    "強化",
    "きょうか",
    "1236200",
    ["усиление", "укрепление"],
    ["strengthening", "reinforcement"],
    [
      "Укрепление возможностей или защиты; не простая смена состояния.",
      "Making capabilities or defenses stronger, not just changing state.",
    ],
    [
      "Сильное 強 становится ещё сильнее через изменение 化: добавили укрепление.",
      "Something strong 強 becomes stronger through change 化: reinforcement was added.",
    ],
    [
      "きょう・か: маленькое ょ и долгое きょう, затем короткое か.",
      "きょう・か: small ょ and long きょう, followed by short か.",
    ],
    [
      "チームの強化に力を入れます。",
      "ちーむのきょうかにちからをいれます。",
      "Мы сосредоточимся на усилении команды.",
      "We will focus on strengthening the team.",
    ],
  ],
  [
    "業界",
    "ぎょうかい",
    "1239380",
    ["отрасль", "сфера бизнеса"],
    ["industry", "business sector"],
    [
      "Круг компаний и специалистов одной отрасли, а не мир вообще.",
      "Companies and professionals in one business sector, not the world in general.",
    ],
    [
      "Дела 業 образуют свой мир 界: целую отрасль.",
      "Businesses 業 form their own world 界: an industry.",
    ],
    [
      "ぎょう・かい: звонкое ぎ с маленьким ょ; оба окончания сохраняются.",
      "ぎょう・かい: voiced ぎ with small ょ; retain both vowel endings.",
    ],
    [
      "この業界では、新しいしごとがふえています。",
      "このぎょうかいでは、あたらしいしごとがふえています。",
      "В этой отрасли становится больше новых рабочих мест.",
      "New jobs are increasing in this industry.",
    ],
  ],
  [
    "寒気",
    "かんき",
    "2866134",
    ["холодный воздух", "холод"],
    ["cold air", "cold weather"],
    [
      "かんき — холод в атмосфере. Озноб さむけ — другая словарная пара, не альтернативный ответ здесь.",
      "かんき refers to atmospheric cold. Bodily chills, さむけ, are a separate dictionary pair, not an accepted alternative here.",
    ],
    [
      "Холод 寒 заполняет воздух 気: надвигается холодная воздушная масса.",
      "Cold 寒 fills the air 気: a cold air mass approaches.",
    ],
    [
      "かん・き: после отдельного ん идёт короткое き; не さむけ.",
      "かん・き: a separate ん followed by short き; not さむけ.",
    ],
    [
      "きたから寒気が入ります。",
      "きたからかんきがはいります。",
      "С севера придёт холодный воздух.",
      "Cold air will move in from the north.",
    ],
  ],
  [
    "漢語",
    "かんご",
    "1213150",
    ["слово китайского происхождения", "синояпонское слово"],
    ["Sino-Japanese word", "Japanese word of Chinese origin"],
    [
      "Слово китайского происхождения в японском. Это не название всего китайского языка.",
      "A word of Chinese origin used in Japanese, not a name for the entire Chinese language.",
    ],
    [
      "Китайское наследие 漢 вошло в японскую речь 語 как отдельное слово.",
      "Chinese heritage 漢 enters Japanese speech 語 as a word.",
    ],
    [
      "かん・ご: звонкое ご, не こ; сохраните ん после か.",
      "かん・ご: voiced ご, not こ; retain the nasal ん.",
    ],
    [
      "「学校」は漢語です。",
      "がっこうはかんごです。",
      "«学校» («школа») — слово китайского происхождения.",
      "学校, meaning school, is a Sino-Japanese word.",
    ],
  ],
  [
    "顔面",
    "がんめん",
    "1217860",
    ["лицо", "лицевая часть головы"],
    ["face", "facial surface"],
    [
      "Анатомическая поверхность лица; не выражение лица и не репутация.",
      "The physical surface of a person's face, not an expression or reputation.",
    ],
    [
      "Лицо 顔 рассматривают как поверхность 面: анатомический вид спереди.",
      "The face 顔 is viewed as a surface 面: the physical front of the head.",
    ],
    [
      "がん・めん: два отдельных ん; 顔 здесь がん, не かお.",
      "がん・めん: two separate nasal ん morae; 顔 is がん here, not かお.",
    ],
    [
      "ボールが顔面にあたりました。",
      "ぼーるががんめんにあたりました。",
      "Мяч попал мне в лицо.",
      "The ball hit me in the face.",
    ],
  ],
  [
    "近代",
    "きんだい",
    "1242420",
    ["новое время", "современная эпоха"],
    ["modern era", "modern times"],
    [
      "Историческая эпоха перехода к современному обществу; её даты зависят от страны и дисциплины. Не просто сегодняшний день.",
      "A historical era of transition to modern society; its dates depend on country and field. Not simply today.",
    ],
    [
      "Близкая 近 нам эпоха 代 лежит между стариной и нынешним днём.",
      "An era 代 near 近 us lies between older history and the present.",
    ],
    [
      "きん・だい: звонкое だ и отдельное ん; не きんたい.",
      "きん・だい: voiced だ and a separate ん; not きんたい.",
    ],
    [
      "近代の日本について学びます。",
      "きんだいのにほんについてまなびます。",
      "Мы изучаем Японию нового времени.",
      "We study Japan in the modern era.",
    ],
  ],
  [
    "上京",
    "じょうきょう",
    "1352980",
    ["поездка в Токио", "переезд в Токио"],
    ["going to Tokyo", "moving to Tokyo"],
    [
      "Поездка или переезд в столицу, в современной Японии — в Токио.",
      "Going or moving to the capital, normally Tokyo in modern Japan.",
    ],
    [
      "Путник поднимается 上 к столице 京: едет в Токио.",
      "A traveler goes up 上 to the capital 京: to Tokyo.",
    ],
    [
      "じょう・きょう: две долгие части с маленьким ょ; не じょきょ.",
      "じょう・きょう: two long parts with small ょ; not じょきょ.",
    ],
    [
      "兄はしごとのために上京しました。",
      "あにはしごとのためにじょうきょうしました。",
      "Старший брат переехал в Токио ради работы.",
      "My older brother moved to Tokyo for work.",
    ],
  ],
  [
    "教員",
    "きょういん",
    "1236980",
    ["преподаватель", "учитель"],
    ["teacher", "teaching staff member"],
    [
      "Преподаватель как сотрудник учебного учреждения, не обращение к человеку.",
      "A teacher employed by an educational institution, not a form of address.",
    ],
    ["Обучать 教 — работа этого сотрудника 員.", "Teaching 教 is this employee's 員 job."],
    [
      "きょう・いん: после долгого きょう начинается отдельное いん.",
      "きょう・いん: a separate いん follows long きょう.",
    ],
    [
      "母は学校の教員です。",
      "はははがっこうのきょういんです。",
      "Моя мать — школьный преподаватель.",
      "My mother is a schoolteacher.",
    ],
  ],
  [
    "工業",
    "こうぎょう",
    "1278040",
    ["промышленность", "обрабатывающая промышленность"],
    ["manufacturing industry", "manufacturing"],
    [
      "Промышленное производство, не любая отрасль бизнеса.",
      "Industrial manufacturing, not every kind of business sector.",
    ],
    [
      "Мастерская 工 выросла в целую производственную отрасль 業.",
      "A workshop 工 grows into an entire manufacturing industry 業.",
    ],
    [
      "こう・ぎょう: две долгие части; во второй звонкое ぎ.",
      "こう・ぎょう: two long parts; the second starts with voiced ぎ.",
    ],
    [
      "この県では工業がさかんです。",
      "このけんではこうぎょうがさかんです。",
      "В этой префектуре развита промышленность.",
      "Manufacturing thrives in this prefecture.",
    ],
  ],
  [
    "局員",
    "きょくいん",
    "1239580",
    ["сотрудник бюро", "сотрудник почты"],
    ["bureau employee", "postal clerk"],
    [
      "Сотрудник учреждения, называемого 局, например почты; не всякий служащий вообще.",
      "An employee of a bureau or office called 局, such as a post office; not every employee generally.",
    ],
    [
      "В бюро 局 у каждого сотрудника 員 есть своё место.",
      "Each employee 員 has a place in the bureau 局.",
    ],
    [
      "きょく・いん: маленькое ょ, но полное く; не きょういん.",
      "きょく・いん: small ょ but full く; do not confuse it with きょういん.",
    ],
    [
      "ゆうびんきょくの局員に名前をつたえました。",
      "ゆうびんきょくのきょくいんになまえをつたえました。",
      "Я назвал своё имя сотруднику почты.",
      "I gave my name to the postal clerk.",
    ],
  ],
  [
    "苦心",
    "くしん",
    "1244530",
    ["кропотливые усилия", "мучительные усилия"],
    ["painstaking effort", "taking pains"],
    [
      "Большие старания ради результата; не просто душевная боль.",
      "Great effort to achieve a result, not merely emotional pain.",
    ],
    [
      "Сердце 心 терпит трудности 苦, пока решает сложную задачу.",
      "The heart 心 endures difficulty 苦 while solving a hard problem.",
    ],
    [
      "く・しん: короткое く, затем し и отдельное ん.",
      "く・しん: short く, then し and a separate ん.",
    ],
    [
      "このえの色には苦心しました。",
      "このえのいろにはくしんしました。",
      "Я немало потрудился над цветами этой картины.",
      "I took great pains over the colors in this picture.",
    ],
  ],
  [
    "県立",
    "けんりつ",
    "1258940",
    ["префектуральный", "учреждённый префектурой"],
    ["prefectural", "established by a prefecture"],
    [
      "Учреждённый или управляемый префектурой; обычно перед названием школы или больницы.",
      "Established or run by a prefecture; often before a school or hospital name.",
    ],
    [
      "Префектура 県 поставила 立 на ноги собственную школу.",
      "The prefecture 県 sets up 立 its own school.",
    ],
    ["けん・りつ: финальное つ полное, не っ.", "けん・りつ: final つ is full-sized, not っ."],
    [
      "姉は県立の学校に通っています。",
      "あねはけんりつのがっこうにかよっています。",
      "Старшая сестра учится в префектуральной школе.",
      "My older sister attends a prefectural school.",
    ],
  ],
  [
    "向上",
    "こうじょう",
    "1277250",
    ["улучшение", "повышение уровня"],
    ["improvement", "advancement"],
    [
      "Повышение качества или уровня; не увеличение любого числа.",
      "An improvement in quality or level, not any numerical increase.",
    ],
    [
      "Направление 向 вверх 上: качество поднимается выше.",
      "The direction 向 is up 上: quality rises.",
    ],
    [
      "こう・じょう: обе части долгие. 工場（こうじょう） — другое слово с тем же звучанием.",
      "こう・じょう: both parts are long. 工場 (こうじょう), factory, is a different word with the same sound.",
    ],
    [
      "読む力の向上をめざしています。",
      "よむちからのこうじょうをめざしています。",
      "Я стремлюсь улучшить умение читать.",
      "I aim to improve my reading ability.",
    ],
  ],
  [
    "広大",
    "こうだい",
    "1278600",
    ["обширный", "огромный"],
    ["vast", "extensive"],
    [
      "Об огромном пространстве; перед существительным — 広大な.",
      "Describes a vast area; use 広大な before a noun.",
    ],
    [
      "Широкое 広 и большое 大 пространство простирается до горизонта.",
      "A wide 広 and big 大 expanse reaches the horizon.",
    ],
    [
      "こう・だい: долгое こう и звонкое だ; не こうたい.",
      "こう・だい: long こう and voiced だ; not こうたい.",
    ],
    [
      "広大なそうげんが見えます。",
      "こうだいなそうげんがみえます。",
      "Виден обширный луг.",
      "A vast grassland is visible.",
    ],
  ],
  [
    "黒色",
    "こくしょく",
    "1287790",
    ["чёрный цвет", "чёрный"],
    ["black", "black color"],
    [
      "Название цвета; не существительное со значением темноты.",
      "The name of a color, not darkness as a condition.",
    ],
    [
      "Чёрный 黒 образец цвета 色 стоит рядом с белым.",
      "A black 黒 color 色 sample sits beside a white one.",
    ],
    [
      "Основное чтение — こく・しょく: 黒 здесь こく, 色 — しょく. Словарный вариант くろいろ тоже принимается.",
      "The primary reading is こく・しょく: 黒 is こく and 色 is しょく here. The dictionary alternative くろいろ is also accepted.",
    ],
    [
      "黒色の紙を二まいください。",
      "こくしょくのかみをにまいください。",
      "Дайте, пожалуйста, два листа чёрной бумаги.",
      "Two sheets of black paper, please.",
    ],
  ],
  [
    "天才",
    "てんさい",
    "1439090",
    ["гений", "гениальность"],
    ["genius"],
    [
      "Выдающийся природный талант или человек с таким талантом.",
      "Exceptional natural talent or a person who possesses it.",
    ],
    [
      "Небо 天 подарило человеку необычайный талант 才.",
      "The heavens 天 give a person exceptional talent 才.",
    ],
    [
      "てん・さい: ん отделяет части; さい не ざい.",
      "てん・さい: ん separates the parts; use さい, not ざい.",
    ],
    [
      "あの人は音楽の天才です。",
      "あのひとはおんがくのてんさいです。",
      "Тот человек — музыкальный гений.",
      "That person is a musical genius.",
    ],
  ],
  [
    "意思",
    "いし",
    "1156610",
    ["намерение", "воля"],
    ["intention", "will"],
    [
      "Сознательное намерение человека. Не медицинский специалист 医師, тоже いし.",
      "A person's conscious intention. Not a physician, 医師, also read いし.",
    ],
    [
      "Намерение 意 соединяется с мыслью 思: человек знает, чего хочет.",
      "Intention 意 joins thought 思: a person knows what they want.",
    ],
    [
      "い・し: две короткие моры, без долгих гласных.",
      "い・し: two short morae, without a long vowel.",
    ],
    [
      "自分の意思で、このしごとをえらびました。",
      "じぶんのいしで、このしごとをえらびました。",
      "Я выбрал эту работу по собственной воле.",
      "I chose this job of my own free will.",
    ],
  ],
  [
    "住人",
    "じゅうにん",
    "1334110",
    ["житель", "обитатель"],
    ["resident", "inhabitant"],
    [
      "Человек, живущий в доме или месте; не посетитель.",
      "Someone living in a house or place, not a visitor.",
    ],
    [
      "Живущий 住 здесь человек 人 открывает дверь своего дома.",
      "The person 人 who lives 住 here opens their own door.",
    ],
    [
      "じゅう・にん: маленькое ゅ и долгое じゅう, затем にん; не じゅにん.",
      "じゅう・にん: small ゅ and long じゅう, followed by にん; not じゅにん.",
    ],
    [
      "このアパートの住人は、みな親切です。",
      "このあぱーとのじゅうにんは、みなしんせつです。",
      "Все жильцы этого дома очень доброжелательны.",
      "All the residents of this apartment building are kind.",
    ],
  ],
  [
    "昭和",
    "しょうわ",
    "1349820",
    ["эпоха Сёва", "период Сёва"],
    ["Showa era", "Showa period"],
    [
      "Японская эпоха с 25 декабря 1926 по 7 января 1989 года; не нынешняя эпоха.",
      "The Japanese era from December 25, 1926 to January 7, 1989; not the current era.",
    ],
    [
      "Сияние 昭 и гармония 和 стоят на старом календаре эпохи Сёва.",
      "Brightness 昭 and harmony 和 appear on an old Showa-era calendar.",
    ],
    [
      "しょう・わ: маленькое ょ и долгое しょう, затем короткое わ.",
      "しょう・わ: small ょ and long しょう, then short わ.",
    ],
    [
      "父は昭和に生まれました。",
      "ちちはしょうわにうまれました。",
      "Мой отец родился в эпоху Сёва.",
      "My father was born in the Showa era.",
    ],
  ],
  [
    "勝者",
    "しょうしゃ",
    "1346180",
    ["победитель"],
    ["winner", "victor"],
    [
      "Тот, кто выиграл состязание; не само действие победы.",
      "The person who wins a contest, not the act of winning.",
    ],
    [
      "Победа 勝 досталась этому человеку 者: он победитель.",
      "Victory 勝 belongs to this person 者: the winner.",
    ],
    [
      "しょう・しゃ: первое しょう долгое, второе しゃ короткое; оба с маленьким ょ или ゃ.",
      "しょう・しゃ: long first しょう, short second しゃ; keep ょ and ゃ small.",
    ],
    [
      "勝者には、この本をおくります。",
      "しょうしゃには、このほんをおくります。",
      "Победителю мы подарим эту книгу.",
      "We will give this book to the winner.",
    ],
  ],
  [
    "色紙",
    "しきし",
    "1357760",
    ["картон для автографов", "карточка для автографов"],
    ["autograph board", "shikishi board"],
    [
      "Декоративный квадратный картон для автографов, стихов или рисунков. Цветная бумага いろがみ — отдельная пара.",
      "A decorative square board for autographs, poems or drawings. Colored paper, いろがみ, is a separate pair.",
    ],
    [
      "Нарядная 色 карточка из бумаги 紙 хранит подпись любимого автора.",
      "A decorative 色 paper 紙 board preserves a favorite author's signature.",
    ],
    [
      "しき・し: 色 здесь しき, 紙 — し; не いろがみ.",
      "しき・し: 色 is しき and 紙 is し here; not いろがみ.",
    ],
    [
      "色紙に名前を書いてもらいました。",
      "しきしになまえをかいてもらいました。",
      "Мне написали имя на карточке для автографов.",
      "I had a name written on an autograph board.",
    ],
  ],
  [
    "組成",
    "そせい",
    "1397670",
    ["состав", "компонентный состав"],
    ["composition", "makeup"],
    [
      "Из каких веществ или частей состоит материал; не музыкальное сочинение.",
      "What substances or parts make up a material, not a musical composition.",
    ],
    [
      "Группа 組 частей образует 成 целое: так описывают состав материала.",
      "A group 組 of parts forms 成 a whole: the composition of a material.",
    ],
    [
      "そ・せい: 組 читается そ, не くみ; 成 — долгое せい.",
      "そ・せい: 組 is そ, not くみ; 成 is long せい.",
    ],
    [
      "水の組成について学びます。",
      "みずのそせいについてまなびます。",
      "Мы изучаем состав воды.",
      "We study the composition of water.",
    ],
  ],
  [
    "一族",
    "いちぞく",
    "1164440",
    ["род", "клан"],
    ["clan", "extended family"],
    [
      "Родственная группа, а не только родители с детьми в одном доме.",
      "A group sharing family ancestry, not just parents and children in one home.",
    ],
    [
      "Одна 一 большая родственная группа 族 собирается вместе.",
      "One 一 large kinship group 族 gathers together.",
    ],
    [
      "いち・ぞく: звонкое ぞ и полное く; не いっぞく.",
      "いち・ぞく: voiced ぞ and full く; not いっぞく.",
    ],
    [
      "その一族は、このまちに長く住んでいます。",
      "そのいちぞくは、このまちにながくすんでいます。",
      "Этот род давно живёт в этом городе.",
      "That family has lived in this town for a long time.",
    ],
  ],
  [
    "待機",
    "たいき",
    "1410600",
    ["ожидание в готовности", "готовность к действию"],
    ["standing by", "standby"],
    [
      "Ожидание с готовностью начать действие, не всякое ожидание вообще.",
      "Waiting while ready to act, not waiting in every sense.",
    ],
    [
      "Ожидающий 待 механизм 機 включится по сигналу.",
      "A waiting 待 mechanism 機 will start on a signal.",
    ],
    [
      "たい・き: 待 — たい, 機 — короткое き; не たいぎ.",
      "たい・き: 待 is たい and 機 is short き; not たいぎ.",
    ],
    [
      "駅で待機してください。",
      "えきでたいきしてください。",
      "Оставайтесь на станции в готовности.",
      "Please stand by at the station.",
    ],
  ],
  [
    "台風",
    "たいふう",
    "1596780",
    ["тайфун"],
    ["typhoon"],
    [
      "Тропический циклон в западной части северного Тихого океана, не любой сильный ветер.",
      "A tropical cyclone in the western North Pacific, not just any strong wind.",
    ],
    [
      "Ветер 風 переворачивает подставку 台: приближается тайфун. Это образ для слова, не буквальный перевод.",
      "Wind 風 overturns a stand 台: a typhoon approaches. This is a word memory image, not a literal translation.",
    ],
    ["たい・ふう: 風 — долгое ふう, не короткое ふ.", "たい・ふう: 風 is long ふう, not short ふ."],
    [
      "台風のため、学校は休みです。",
      "たいふうのため、がっこうはやすみです。",
      "Из-за тайфуна занятия в школе отменены.",
      "School is closed because of the typhoon.",
    ],
  ],
  [
    "題名",
    "だいめい",
    "1415490",
    ["название", "заглавие"],
    ["title", "name of a work"],
    [
      "Название книги, фильма или произведения; не должность и не обращение.",
      "The title of a book, film or other work, not a job title or form of address.",
    ],
    [
      "Тема 題 получила имя 名 на обложке книги.",
      "The subject 題 receives its name 名 on a book cover.",
    ],
    [
      "だい・めい: звонкое だ, затем めい; не たいめい.",
      "だい・めい: voiced だ followed by めい; not たいめい.",
    ],
    [
      "この本の題名を教えてください。",
      "このほんのだいめいをおしえてください。",
      "Скажите, пожалуйста, название этой книги.",
      "Please tell me the title of this book.",
    ],
  ],
  [
    "着用",
    "ちゃくよう",
    "1423270",
    ["ношение", "надевание"],
    ["wearing", "putting on"],
    [
      "Ношение одежды или средств защиты; не износ предмета.",
      "Wearing clothing or protective equipment, not wear and tear.",
    ],
    [
      "Надетая 着 вещь находится в использовании 用: её носят.",
      "A put-on 着 item is in use 用: it is being worn.",
    ],
    [
      "ちゃく・よう: маленькое ゃ, полное く и долгое よう.",
      "ちゃく・よう: small ゃ, full く and long よう.",
    ],
    [
      "ここでは、ヘルメットを着用してください。",
      "ここでは、へるめっとをちゃくようしてください。",
      "Здесь необходимо надеть шлем.",
      "Please wear a helmet here.",
    ],
  ],
  [
    "労働",
    "ろうどう",
    "1606450",
    ["труд", "трудовая деятельность"],
    ["labor", "labour", "work"],
    [
      "Трудовая деятельность человека; не механическая работа в физике.",
      "Human labor or work, not mechanical work in physics.",
    ],
    [
      "Труд 労 заставляет человека работать 働 весь рабочий день.",
      "Labor 労 keeps a person working 働 through the working day.",
    ],
    [
      "ろう・どう: два долгих гласных; 働 читается どう, а не はたら.",
      "ろう・どう: two long vowels; 働 is どう here, not はたら.",
    ],
    [
      "労働のあとには、休みがひつようです。",
      "ろうどうのあとには、やすみがひつようです。",
      "После труда необходим отдых.",
      "Rest is necessary after work.",
    ],
  ],
  [
    "通行",
    "つうこう",
    "1433180",
    ["проход", "проезд"],
    ["passage", "passing through"],
    [
      "Движение людей или транспорта через место; не билет и не литературный отрывок.",
      "People or vehicles passing through a place, not a ticket or a passage of text.",
    ],
    [
      "Через 通 ворота идут 行 люди: открыт проход.",
      "People go 行 through 通 the gate: passage is open.",
    ],
    ["つう・こう: обе части долгие, не つこ.", "つう・こう: both parts are long, not つこ."],
    [
      "ここは車の通行が多いです。",
      "ここはくるまのつうこうがおおいです。",
      "Здесь проходит много машин.",
      "Many vehicles pass through here.",
    ],
  ],
  [
    "持病",
    "じびょう",
    "1315830",
    ["хроническая болезнь", "хроническое заболевание"],
    ["chronic illness", "chronic disease"],
    [
      "Давно имеющееся заболевание, не всякое краткое недомогание.",
      "A longstanding medical condition, not just any brief illness.",
    ],
    [
      "Болезнь 病 словно держится 持 рядом долгое время.",
      "The illness 病 seems to stay held 持 close for a long time.",
    ],
    [
      "じ・びょう: 持 — じ, 病 — долгое びょう с маленьким ょ.",
      "じ・びょう: 持 is じ and 病 is long びょう with small ょ.",
    ],
    [
      "持病があるので、毎日くすりを飲みます。",
      "じびょうがあるので、まいにちくすりをのみます。",
      "У меня хроническое заболевание, поэтому я каждый день принимаю лекарство.",
      "I take medicine every day because I have a chronic illness.",
    ],
  ],
  [
    "皮下",
    "ひか",
    "1483820",
    ["подкожный", "под кожей"],
    ["subcutaneous", "under the skin"],
    [
      "Место под кожей; обычно часть медицинского словосочетания.",
      "A location beneath the skin, usually within a medical expression.",
    ],
    [
      "Слой находится не на коже 皮, а ниже 下 неё.",
      "The layer is not on the skin 皮 but below 下 it.",
    ],
    [
      "ひ・か: две короткие моры; 皮 — ひ, не かわ.",
      "ひ・か: two short morae; 皮 is ひ, not かわ.",
    ],
    [
      "皮下にしぼうがあります。",
      "ひかにしぼうがあります。",
      "Под кожей находится жировая ткань.",
      "There is fatty tissue under the skin.",
    ],
  ],
  [
    "悲鳴",
    "ひめい",
    "1483350",
    ["крик", "вопль"],
    ["scream", "shriek"],
    [
      "Резкий крик от страха, боли или потрясения, не обычный громкий голос.",
      "A sharp cry from fear, pain or shock, not an ordinary loud voice.",
    ],
    [
      "Печаль 悲 заставляет голос прозвучать 鳴 резким криком.",
      "Distress 悲 makes the voice sound 鳴 in a sharp scream.",
    ],
    ["ひ・めい: ひ короткое, めい долгое; не ひめ.", "ひ・めい: short ひ and long めい; not ひめ."],
    [
      "大きな音におどろいて、悲鳴を上げました。",
      "おおきなおとにおどろいて、ひめいをあげました。",
      "Испугавшись громкого звука, я вскрикнул.",
      "Startled by a loud noise, I screamed.",
    ],
  ],
  [
    "美人",
    "びじん",
    "1486530",
    ["красивая женщина", "красавица"],
    ["beautiful woman", "beauty"],
    [
      "В выбранном значении — красивая женщина, а не красота как качество.",
      "In the selected sense, a beautiful woman, not beauty as an abstract quality.",
    ],
    [
      "Красивый 美 человек 人: в этом слове обычно говорят о женщине.",
      "A beautiful 美 person 人: this word usually refers to a woman.",
    ],
    [
      "び・じん: оба начала звонкие; не ひしん.",
      "び・じん: both initial consonants are voiced; not ひしん.",
    ],
    [
      "あの女の人は美人ですね。",
      "あのおんなのひとはびじんですね。",
      "Та женщина очень красивая, правда?",
      "That woman is beautiful, isn't she?",
    ],
  ],
  [
    "自筆",
    "じひつ",
    "1318590",
    ["написанное собственноручно", "написанное собственной рукой"],
    ["one's own handwriting", "written in one's own hand"],
    [
      "Текст, написанный самим человеком; не только подпись и не чужой почерк.",
      "Text written by the person themself, not only a signature or someone else's handwriting.",
    ],
    [
      "Сам 自 человек берёт кисть 筆 и пишет своей рукой.",
      "The person themself 自 takes a brush 筆 and writes in their own hand.",
    ],
    [
      "じ・ひつ: полное つ; здесь нет превращения ひつ в ひっ, как в 筆記.",
      "じ・ひつ: full つ; there is no ひつ to ひっ change as in 筆記.",
    ],
    [
      "これは母の自筆の手紙です。",
      "これはははのじひつのてがみです。",
      "Это письмо, которое мать написала собственноручно.",
      "This is a letter written in my mother's own hand.",
    ],
  ],
  [
    "幸福",
    "こうふく",
    "1278400",
    ["счастье", "благополучие"],
    ["happiness", "well-being"],
    [
      "Состояние счастливой жизни, не только удачный случай.",
      "A state of happiness or well-being, not merely a lucky event.",
    ],
    [
      "Счастье 幸 встречается с благом 福: человек доволен жизнью.",
      "Happiness 幸 meets good fortune 福: a person is content with life.",
    ],
    [
      "こう・ふく: долгое こう и полное く, не こうふ.",
      "こう・ふく: long こう and full く, not こうふ.",
    ],
    [
      "みんなの幸福をねがっています。",
      "みんなのこうふくをねがっています。",
      "Я желаю всем счастья.",
      "I wish everyone happiness.",
    ],
  ],
  [
    "平日",
    "へいじつ",
    "1507720",
    ["будний день", "будни"],
    ["weekday", "weekdays"],
    [
      "Будни, в отличие от выходных и праздников. Не название отдельного дня недели.",
      "Weekdays as opposed to weekends and holidays, not the name of a day of the week.",
    ],
    [
      "Ровная 平 череда обычных дней 日 между выходными.",
      "A level 平 run of ordinary days 日 between weekends.",
    ],
    [
      "へい・じつ: долгое へい, затем звонкое じ и полное つ.",
      "へい・じつ: long へい, then voiced じ and full つ.",
    ],
    [
      "平日は、毎あさ七時におきます。",
      "へいじつは、まいあさしちじにおきます。",
      "По будням я встаю в семь утра.",
      "On weekdays, I get up at seven every morning.",
    ],
  ],
  [
    "近辺",
    "きんぺん",
    "1242530",
    ["окрестности", "ближайшая местность"],
    ["vicinity", "surrounding area"],
    [
      "Местность поблизости от названного места, не знакомый сосед-человек.",
      "The area near a specified place, not a neighboring person.",
    ],
    [
      "Близкий 近 край 辺 вокруг станции образует её окрестности.",
      "The nearby 近 area 辺 around a station is its vicinity.",
    ],
    [
      "きん・ぺん: чтение 辺 меняется с へん на ぺん после ん; это проверенное чтение целого слова.",
      "きん・ぺん: 辺 changes from へん to ぺん after ん in this checked whole-word reading.",
    ],
    [
      "駅の近辺に本屋はありますか。",
      "えきのきんぺんにほんやはありますか。",
      "Есть ли книжный магазин около станции?",
      "Is there a bookstore near the station?",
    ],
  ],
  [
    "心理",
    "しんり",
    "1361000",
    ["психическое состояние", "душевное состояние"],
    ["state of mind", "mental state"],
    [
      "Психическое состояние и внутренние переживания; наука психология — 心理学.",
      "A mental state and inner experience; the academic discipline psychology is 心理学.",
    ],
    [
      "Сердце 心 имеет внутреннюю логику 理: поймите душевное состояние человека.",
      "The heart 心 has an inner logic 理: understand a person's state of mind.",
    ],
    ["しん・り: сохраняйте ん перед り; не しり.", "しん・り: retain ん before り; not しり."],
    [
      "子どもの心理を学んでいます。",
      "こどものしんりをまなんでいます。",
      "Я изучаю внутренний мир детей.",
      "I am studying children's mental states.",
    ],
  ],
  [
    "良心",
    "りょうしん",
    "1554590",
    ["совесть"],
    ["conscience"],
    [
      "Внутреннее нравственное чувство; не сознание и не родители 両親.",
      "An inner moral sense, not consciousness or parents, 両親.",
    ],
    [
      "Доброе 良 сердце 心 напоминает человеку поступать честно.",
      "A good 良 heart 心 reminds a person to act honestly.",
    ],
    [
      "りょう・しん: долгое りょう с маленьким ょ, затем しん.",
      "りょう・しん: long りょう with small ょ, then しん.",
    ],
    [
      "良心にしたがって、ほんとうのことを話しました。",
      "りょうしんにしたがって、ほんとうのことをはなしました。",
      "Я поступил по совести и сказал правду.",
      "I followed my conscience and told the truth.",
    ],
  ],
  [
    "新緑",
    "しんりょく",
    "1362460",
    ["свежая зелень", "молодая листва"],
    ["fresh green foliage", "new greenery"],
    [
      "Свежая зелень молодой листвы, особенно весной; не овощи и не просто зелёный цвет.",
      "Fresh young green leaves, especially in spring, not vegetables or merely the color green.",
    ],
    [
      "Новая 新 зелень 緑 покрыла ветви после зимы.",
      "New 新 greenery 緑 covers the branches after winter.",
    ],
    [
      "しん・りょく: маленькое ょ, но короткое りょ; не りょうく.",
      "しん・りょく: small ょ but short りょ; not りょうく.",
    ],
    [
      "新緑の山を歩きました。",
      "しんりょくのやまをあるきました。",
      "Мы гуляли в горах среди молодой зелени.",
      "We walked in the mountains among fresh green leaves.",
    ],
  ],
  [
    "礼金",
    "れいきん",
    "1557500",
    ["невозвратный платёж арендодателю"],
    ["key money", "non-refundable landlord payment"],
    [
      "В этом уроке — 礼金 при аренде жилья в Японии: невозвратный платёж арендодателю, не возвращаемый залог.",
      "This lesson selects rental 礼金 in Japan: a non-refundable payment to a landlord, not a refundable deposit.",
    ],
    [
      "Благодарность 礼 выражают деньгами 金: при аренде этот платёж назад не возвращают.",
      "Thanks 礼 is expressed in money 金: this rental payment is not returned.",
    ],
    [
      "れい・きん: долгое れい, затем отдельное ん; не れきん.",
      "れい・きん: long れい and a separate ん; not れきん.",
    ],
    [
      "このアパートは礼金がいりません。",
      "このあぱーとはれいきんがいりません。",
      "Для этой квартиры невозвратный платёж арендодателю не требуется.",
      "This apartment does not require key money.",
    ],
  ],
  [
    "新雪",
    "しんせつ",
    "1362090",
    ["свежий снег", "свежевыпавший снег"],
    ["fresh snow", "new-fallen snow"],
    [
      "Недавно выпавший снег; не доброта 親切, хотя чтение совпадает.",
      "Snow that has just fallen, not kindness, 親切, despite the shared reading.",
    ],
    ["Новый 新 снег 雪 ещё не хранит ни одного следа.", "New 新 snow 雪 has no footprints yet."],
    [
      "しん・せつ: 雪 читается せつ, не ゆき; полное つ.",
      "しん・せつ: 雪 is せつ here, not ゆき; keep full つ.",
    ],
    [
      "新雪の上を歩きました。",
      "しんせつのうえをあるきました。",
      "Мы прошли по свежему снегу.",
      "We walked on fresh snow.",
    ],
  ],
  [
    "終日",
    "しゅうじつ",
    "1332980",
    ["весь день", "целый день"],
    ["all day", "the whole day"],
    [
      "С начала до конца дня; не конец дня и не каждый день.",
      "Throughout a whole day, not the end of the day or every day.",
    ],
    [
      "До самого конца 終 дня 日 действует одно и то же расписание.",
      "The same schedule lasts to the end 終 of the day 日.",
    ],
    [
      "しゅう・じつ: маленькое ゅ и долгое しゅう, затем звонкое じ.",
      "しゅう・じつ: small ゅ and long しゅう, then voiced じ.",
    ],
    [
      "きのうは終日、雨でした。",
      "きのうはしゅうじつ、あめでした。",
      "Вчера весь день шёл дождь.",
      "It rained all day yesterday.",
    ],
  ],
];

const localize = ([ru, en]: Pair): MainCourseLocalizedText => ({ ru, en });
const ALTERNATIVE_READINGS: Readonly<Record<string, readonly string[]>> = {
  黒色: ["くろいろ"],
  平日: ["ひらび"],
  文字: ["もんじ"],
  図画: ["とが"],
};
const BLOCKS: Readonly<Record<string, { ru?: readonly string[]; en?: readonly string[] }>> = {
  人気: { ru: ["полярность"] },
  実用: { en: ["practical implication"] },
  成立: { ru: ["вступление в силу"], en: ["coming into effect"] },
  寒気: { ru: ["озноб"], en: ["chills"] },
  漢語: { ru: ["китайский язык"], en: ["Chinese language"] },
  色紙: { ru: ["цветная бумага"], en: ["colored paper", "coloured paper"] },
  良心: { ru: ["сознание", "родители"], en: ["consciousness", "parents"] },
  新雪: { ru: ["доброта"], en: ["kindness"] },
  礼金: { ru: ["возвратный залог", "залог"], en: ["refundable deposit", "deposit"] },
  組成: { ru: ["музыкальное сочинение"], en: ["musical composition"] },
};

export function buildReinforcementWordBatches(
  kanjiBatches: readonly MainCourseContentBatch[],
): readonly MainCourseWordBatch[] {
  const rows = [...GAP_WORDS, ...REINFORCEMENT_EXTRA_WORDS];
  if (rows.length !== 80)
    throw new Error("The reinforcement block must contain eighty reviewed words.");
  const levels = new Map(
    kanjiBatches.flatMap((b) => b.kanji.map((k) => [k.character, k.levelNumber] as const)),
  );
  for (const row of rows)
    for (const c of [...(row[0] + row[8][0])].filter((c) => /\p{Script=Han}/u.test(c))) {
      if (!levels.has(c) || levels.get(c)! >= 33)
        throw new Error(`${row[0]} needs earlier prepared kanji: ${c}`);
    }
  const batches: readonly MainCourseWordBatch[] = Array.from({ length: 4 }, (_, i) => ({
    id: `full-course-vocabulary-reinforcement-${String(i + 1).padStart(2, "0")}`,
    version: "1",
    authoredAt: "2026-10-31",
    reviewedAt: "2026-11-01",
    reviewNotes:
      "Eighty original RU/EN word lessons and JP/kana/RU/EN examples in reinforcement-word-content.ts and reinforcement-word-extras.ts independently read by AI reviewers Dalton (meaning, context and phonology) and Lorentz (source, reading alignment and dependencies), final acceptance 2026-11-01. Parent corrected scope, natural examples, sound guidance, semantic false-positive blocks and four same-sense alternate readings. One nonessential proposed word was replaced by the independently checked 火曜 instead of bypassing the existing source-alias preservation guard. All eighty primary pairs and four alternatives match bilingual entries in the pinned local 2026-10-31 JMdict snapshot. Explicit alignments cover the forty-five completion-block reading gaps and all twelve new support kanji. AI editorial acceptance, not human certification, live license preflight or publication evidence. Four internal storage chunks, no new pilot or old manifest replay.",
    sourceFile: "packages/db/src/reinforcement-word-content.ts",
    courseSlug: "japanese-ru-n2",
    levelNumber: 33,
    sortOrderStart: i * 20 + 1,
    words: rows
      .slice(i * 20, (i + 1) * 20)
      .map(([expression, reading, sequence, ru, en, scope, memory, sound, example], index) => {
        const meanings = (locale: "ru" | "en", answers: readonly string[]) => ({
          primary: answers[0]!,
          accepted: answers,
          ...(BLOCKS[expression]?.[locale]
            ? {
                blocked: BLOCKS[expression]![locale]!.map((text) => ({
                  text,
                  reason: scope[locale === "ru" ? 0 : 1],
                })),
              }
            : {}),
        });
        return {
          expression,
          reading,
          jmdictEntryId: `jmdict:${sequence}`,
          ...(ALTERNATIVE_READINGS[expression]
            ? { acceptedReadings: ALTERNATIVE_READINGS[expression] }
            : {}),
          sortOrder: i * 20 + index + 1,
          meanings: { ru: meanings("ru", ru), en: meanings("en", en) },
          meaningMnemonic: localize(memory),
          meaningHint: localize(scope),
          readingMnemonic: localize(sound),
          readingHint: {
            ru: `Полное чтение слова: ${reading}.`,
            en: `Whole-word reading: ${reading}.`,
          },
          example: {
            japaneseText: example[0],
            readingText: example[1],
            translationRu: example[2],
            translationEn: example[3],
          },
        };
      }),
  }));
  const issues = validateReinforcementReadings(kanjiBatches, batches);
  if (issues.length) throw new Error(issues.join("\n"));
  return batches;
}
