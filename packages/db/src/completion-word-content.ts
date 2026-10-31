import type {
  MainCourseAcceptedMeanings,
  MainCourseContentBatch,
  MainCourseLocalizedText,
} from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";

type Pair = readonly [ru: string, en: string];
type Row = readonly [
  expression: string,
  reading: string,
  sequence: string,
  ru: readonly string[],
  en: readonly string[],
  scope: Pair,
  memory: Pair,
  readingMemory: Pair,
  example: readonly [japanese: string, kana: string, ru: string, en: string],
];

// Original teaching, not imported glosses. IDs identify exact locally checked JMdict pairs.
const WORDS: readonly Row[] = [
  [
    "安心",
    "あんしん",
    "1153890",
    ["спокойствие", "душевный покой"],
    ["peace of mind", "relief"],
    [
      "Спокойствие без тревоги, не безопасность места.",
      "A mind free from worry, not the safety of a location.",
    ],
    [
      "Спокойное 安 сердце 心 перестало тревожиться после хорошей новости.",
      "A peaceful 安 heart 心 stops worrying after good news.",
    ],
    [
      "У спокойного сердца две части: あん・しん; в каждой ん занимает отдельную мору.",
      "Give the peaceful heart two parts, あん・しん; each nasal ん takes its own mora.",
    ],
    [
      "その話を聞いて、安心しました。",
      "そのはなしをきいて、あんしんしました。",
      "Услышав об этом, я успокоился.",
      "I felt relieved when I heard about it.",
    ],
  ],
  [
    "意味",
    "いみ",
    "1156800",
    ["значение", "смысл"],
    ["meaning", "sense"],
    [
      "Содержание слова или сообщения, не намерение говорящего.",
      "What a word or message means, not the speaker's intention.",
    ],
    [
      "У мысли 意 есть вкус 味: вместе они дают смысл сказанного.",
      "An idea 意 has a flavor 味; together they give a message its meaning.",
    ],
    [
      "На карточке смысла всего две метки: い・み, без долгих гласных.",
      "A meaning card has just two marks, い・み, with no long vowels.",
    ],
    [
      "このことばの意味を教えてください。",
      "このことばのいみをおしえてください。",
      "Объясните, пожалуйста, значение этого слова.",
      "Please explain the meaning of this word.",
    ],
  ],
  [
    "医者",
    "いしゃ",
    "1159980",
    ["врач", "доктор"],
    ["doctor", "physician"],
    [
      "Человек, который лечит, не учёная степень доктора.",
      "A medical practitioner, not a doctoral degree.",
    ],
    [
      "Лечением 医 занимается человек 者: у кабинета стоит врач.",
      "The person 者 who practices medicine 医 is waiting at the clinic door.",
    ],
    [
      "Бейдж врача: い・しゃ. Маленькое ゃ соединяется с し.",
      "The doctor's badge reads い・しゃ; small ゃ joins し.",
    ],
    [
      "医者にみてもらいました。",
      "いしゃにみてもらいました。",
      "Меня осмотрел врач.",
      "I was examined by a doctor.",
    ],
  ],
  [
    "会社員",
    "かいしゃいん",
    "1198560",
    ["сотрудник компании", "служащий компании"],
    ["company employee", "office worker"],
    [
      "Работник компании; не любое лицо, которое работает.",
      "An employee of a company, not any working person.",
    ],
    [
      "В знакомой 会社 появляется человек с бейджем 員: сотрудник компании.",
      "A person wearing an 員 badge joins the familiar 会社: a company employee.",
    ],
    [
      "Прочитайте знакомое かいしゃ, затем бейдж いん: かいしゃ・いん.",
      "Read familiar かいしゃ, then the badge いん: かいしゃ・いん.",
    ],
    [
      "姉は会社員です。",
      "あねはかいしゃいんです。",
      "Моя старшая сестра — сотрудница компании.",
      "My older sister is a company employee.",
    ],
  ],
  [
    "病院",
    "びょういん",
    "1490220",
    ["больница", "госпиталь"],
    ["hospital"],
    [
      "Медицинское учреждение, не болезнь и не парикмахерская.",
      "A medical institution, not an illness or a beauty salon.",
    ],
    [
      "Больных 病 принимают в учреждении 院: представьте больничный вход.",
      "An institution 院 receives the sick 病; picture its hospital entrance.",
    ],
    [
      "На длинном коридоре написано びょう, на двери — いん: びょう・いん. Не びよういん.",
      "A long corridor reads びょう and its door いん: びょう・いん, not びよういん.",
    ],
    [
      "母は病院で働いています。",
      "はははびょういんではたらいています。",
      "Моя мама работает в больнице.",
      "My mother works at a hospital.",
    ],
  ],
  [
    "英語",
    "えいご",
    "1174420",
    ["английский язык", "английский"],
    ["English", "English language"],
    ["Название языка, не человек из Англии.", "The language, not a person from England."],
    [
      "Метка Англии 英 стоит на языковом 語 словаре: это английский язык.",
      "The English 英 label sits on a language 語 dictionary: English.",
    ],
    [
      "Обложка словаря えい и закладка ご складываются в えいご; у ご есть дакутэн.",
      "A dictionary cover えい and bookmark ご form えいご; ご is voiced.",
    ],
    [
      "英語の本を読んでいます。",
      "えいごのほんをよんでいます。",
      "Я читаю книгу на английском языке.",
      "I am reading a book in English.",
    ],
  ],
  [
    "公園",
    "こうえん",
    "1273270",
    ["парк", "общественный парк"],
    ["park", "public park"],
    [
      "Общедоступное место для прогулок, не частный сад.",
      "A public place for walks, not a private garden.",
    ],
    [
      "Общий 公 сад 園 открывает ворота всем гуляющим.",
      "A public 公 garden 園 opens its gates to everyone.",
    ],
    [
      "Длинная дорожка こう ведёт к ограде えん: こう・えん.",
      "A long path こう leads to the garden gate えん: こう・えん.",
    ],
    [
      "公園で友人に会いました。",
      "こうえんでゆうじんにあいました。",
      "Я встретился с другом в парке.",
      "I met a friend in the park.",
    ],
  ],
  [
    "遠足",
    "えんそく",
    "1178260",
    ["экскурсия", "поход", "школьная экскурсия"],
    ["excursion", "outing", "school outing"],
    [
      "Совместная прогулка или экскурсия, часто школьная; не любой дальний путь.",
      "An organized outing, often with a school, not every long journey.",
    ],
    [
      "Ноги 足 идут далеко 遠 всей школьной группой: начинается экскурсия.",
      "The whole class's feet 足 go far 遠 on an outing.",
    ],
    [
      "Первый шаг えん, второй そく: えん・そく. Не чтение ноги あし.",
      "Take one step for えん and one for そく: えん・そく, not standalone あし.",
    ],
    [
      "あしたは学校の遠足です。",
      "あしたはがっこうのえんそくです。",
      "Завтра школьная экскурсия.",
      "Tomorrow is the school outing.",
    ],
  ],
  [
    "屋外",
    "おくがい",
    "1182680",
    ["вне помещения", "на открытом воздухе", "снаружи здания"],
    ["outdoors", "outside a building"],
    [
      "За пределами здания, в противоположность помещению.",
      "Outside a building, as opposed to indoors.",
    ],
    [
      "Выйдите за наружную 外 стену здания 屋: теперь вы на открытом воздухе.",
      "Step beyond the outer 外 wall of a building 屋: you are outdoors.",
    ],
    [
      "У двери надпись おく, за дверью がい: おく・がい, со звонким が.",
      "The door reads おく and the space beyond it がい: おく・がい with voiced が.",
    ],
    [
      "この花は屋外でそだてます。",
      "このはなはおくがいでそだてます。",
      "Эти цветы выращивают на открытом воздухе.",
      "These flowers are grown outdoors.",
    ],
  ],
  [
    "温度",
    "おんど",
    "1183510",
    ["температура"],
    ["temperature"],
    [
      "Измеряемая температура, не только тепло или жар.",
      "A measurable temperature, not warmth or heat alone.",
    ],
    [
      "Тепло 温 измеряют по делениям 度 термометра.",
      "Measure warmth 温 against the degrees 度 on a thermometer.",
    ],
    [
      "Термометр отмечает おん, затем звонкое ど: おん・ど.",
      "The thermometer marks おん followed by voiced ど: おん・ど.",
    ],
    [
      "水の温度をはかります。",
      "みずのおんどをはかります。",
      "Я измерю температуру воды.",
      "I will measure the water temperature.",
    ],
  ],
  [
    "荷重",
    "かじゅう",
    "1195320",
    ["нагрузка", "вес груза"],
    ["load", "weight of a load"],
    [
      "Вес, действующий на опору; не просто багаж.",
      "Weight placed on a support, not merely luggage.",
    ],
    [
      "Груз 荷 давит тяжестью 重 на полку: считайте нагрузку.",
      "Cargo 荷 presses its weight 重 onto a shelf: measure the load.",
    ],
    [
      "Короткий ящик か стоит на длинной платформе じゅう: か・じゅう.",
      "A short crate か rests on a long platform じゅう: か・じゅう.",
    ],
    [
      "この台の荷重をしらべます。",
      "このだいのかじゅうをしらべます。",
      "Я проверю нагрузку на эту платформу.",
      "I will check the load on this platform.",
    ],
  ],
  [
    "音楽",
    "おんがく",
    "1183720",
    ["музыка"],
    ["music"],
    [
      "Музыка как искусство или звучание, не любой шум.",
      "Music as an art or sound, not any noise.",
    ],
    [
      "Приятные 楽 звуки 音 складываются в музыку оркестра.",
      "Enjoyable 楽 sounds 音 become an orchestra's music.",
    ],
    [
      "Звук おん встречает музыкальное がく: おん・がく. Здесь がく, не らく.",
      "Sound おん meets musical がく: おん・がく, with がく rather than らく.",
    ],
    [
      "この音楽がすきです。",
      "このおんがくがすきです。",
      "Мне нравится эта музыка.",
      "I like this music.",
    ],
  ],
  [
    "生活",
    "せいかつ",
    "1378860",
    ["повседневная жизнь", "жизнь", "быт"],
    ["daily life", "everyday life", "life"],
    [
      "То, как человек живёт изо дня в день, не биологическая жизнь сама по себе.",
      "How someone lives day to day, not biological life itself.",
    ],
    [
      "Жизнь 生 наполняется активными 活 делами: еда, учёба, отдых.",
      "Life 生 fills with active 活 routines: meals, study and rest.",
    ],
    [
      "Дневник жизни разделён на せい・かつ; в конце полное つ, не маленькое っ.",
      "The daily-life diary has sections せい・かつ; end with full つ, not small っ.",
    ],
    [
      "日本での生活になれました。",
      "にほんでのせいかつになれました。",
      "Я привык к жизни в Японии.",
      "I have become used to life in Japan.",
    ],
  ],
  [
    "図書館",
    "としょかん",
    "1370420",
    ["библиотека"],
    ["library"],
    [
      "Место, где берут и читают книги, не книжный магазин.",
      "A place to borrow and read books, not a bookstore.",
    ],
    [
      "Рисунки 図 и книги 書 стоят в общественном здании 館: в библиотеке.",
      "Pictures 図 and books 書 fill a public building 館: a library.",
    ],
    [
      "Три полки подписаны と・しょ・かん; 図 здесь と, а не ず.",
      "Three shelves read と・しょ・かん; 図 is と here, not ず.",
    ],
    [
      "図書館で本をかりました。",
      "としょかんでほんをかりました。",
      "Я взял книгу в библиотеке.",
      "I borrowed a book from the library.",
    ],
  ],
  [
    "感動",
    "かんどう",
    "1212570",
    ["растроганность", "душевное волнение", "сильное впечатление"],
    ["being deeply moved", "strong impression", "emotional impact"],
    [
      "Сильное чувство, когда что-то трогает; не обычное физическое движение.",
      "An emotion caused by something moving you deeply, not physical movement.",
    ],
    [
      "Чувство 感 приводит сердце в движение 動 после прекрасной музыки.",
      "Feeling 感 sets the heart in motion 動 after beautiful music.",
    ],
    [
      "Сердце отбивает かん, затем тянет どう: かん・どう.",
      "The heart beats かん, then holds どう: かん・どう.",
    ],
    [
      "その話に感動しました。",
      "そのはなしにかんどうしました。",
      "Этот рассказ меня тронул.",
      "I was deeply moved by that story.",
    ],
  ],
  [
    "急行",
    "きゅうこう",
    "1228690",
    ["экспресс", "скорый поезд"],
    ["express", "express train"],
    [
      "Скорый поезд или экспресс-сообщение; не универсальное обозначение любой спешки.",
      "An express train or service, not every instance of hurrying.",
    ],
    [
      "Поезд спешно 急 идёт 行 мимо части станций: это экспресс.",
      "A train goes 行 swiftly 急 past some stations: an express.",
    ],
    [
      "Две длинные части поезда: きゅう・こう. Сохраните оба удлиняющих う.",
      "The train has two long sections, きゅう・こう; keep both lengthening う.",
    ],
    [
      "急行はこの駅にとまりますか。",
      "きゅうこうはこのえきにとまりますか。",
      "Экспресс останавливается на этой станции?",
      "Does the express stop at this station?",
    ],
  ],
  [
    "強力",
    "きょうりょく",
    "1236600",
    ["мощный", "сильный", "мощь"],
    ["powerful", "strong", "great strength"],
    [
      "Большая сила; с な описывает мощный инструмент или действие.",
      "Great strength; with な it describes a powerful tool or action.",
    ],
    [
      "Сильная 強 сила 力 поднимает тяжёлый груз одним движением.",
      "Strong 強 power 力 lifts a heavy load in one motion.",
    ],
    [
      "Длинная ручка きょう и короткий рычаг りょく: きょう・りょく. Вторая часть без う.",
      "A long handle きょう meets a short lever りょく: きょう・りょく, with no う in the second part.",
    ],
    [
      "これは強力な道具です。",
      "これはきょうりょくなどうぐです。",
      "Это мощный инструмент.",
      "This is a powerful tool.",
    ],
  ],
  [
    "銀行",
    "ぎんこう",
    "1243490",
    ["банк"],
    ["bank"],
    [
      "Финансовое учреждение, не берег реки и не стеклянная банка.",
      "A financial institution, not a riverbank or a container.",
    ],
    [
      "Серебро 銀 идёт 行 в хранилище банка: представьте кассу.",
      "Silver 銀 goes 行 into the bank's vault; picture the counter.",
    ],
    [
      "У кассы два окна ぎん・こう; начните со звонкого ぎ и закончите долгим こう.",
      "The counter has windows ぎん・こう; begin with voiced ぎ and end with long こう.",
    ],
    [
      "銀行でお金をおろしました。",
      "ぎんこうでおかねをおろしました。",
      "Я снял деньги в банке.",
      "I withdrew money at the bank.",
    ],
  ],
  [
    "道具",
    "どうぐ",
    "1454180",
    ["инструмент", "инструменты", "приспособление"],
    ["tool", "tools", "equipment"],
    [
      "Предметы для выполнения работы; не музыкальные инструменты в специальном смысле.",
      "Objects used to do a job, not specifically musical instruments.",
    ],
    [
      "На рабочем пути 道 разложены приспособления 具: выберите нужный инструмент.",
      "Equipment 具 lies along your work path 道; choose the right tool.",
    ],
    [
      "Длинная рукоять どう заканчивается звонким ぐ: どう・ぐ.",
      "A long handle どう ends in voiced ぐ: どう・ぐ.",
    ],
    [
      "この道具を使ってください。",
      "このどうぐをつかってください。",
      "Пожалуйста, используйте этот инструмент.",
      "Please use this tool.",
    ],
  ],
  [
    "時計",
    "とけい",
    "1316140",
    ["часы", "наручные часы"],
    ["clock", "watch"],
    [
      "Прибор для измерения времени; не час как длительность.",
      "A device for telling time, not an hour as a duration.",
    ],
    [
      "Время 時 измеряет 計 прибор со стрелками: часы.",
      "A device with hands measures 計 time 時: a clock.",
    ],
    [
      "На циферблате метки と・けい. 時 в этом слове と, не じ.",
      "The clock face has marks と・けい; 時 is と in this word, not じ.",
    ],
    [
      "この時計は五分すすんでいます。",
      "このとけいはごふんすすんでいます。",
      "Эти часы спешат на пять минут.",
      "This clock is five minutes fast.",
    ],
  ],
  [
    "元気",
    "げんき",
    "1260720",
    ["бодрость", "энергия", "хорошее самочувствие", "бодрый", "здоровый"],
    ["energy", "vigor", "good health", "energetic", "lively", "healthy", "well"],
    [
      "Бодрость и хорошее самочувствие; с な — бодрый, здоровый.",
      "Energy and good health; with な it describes someone lively or well.",
    ],
    [
      "В исходную 元 жизненную силу 気 вернулась энергия после отдыха.",
      "Energy returns to the original 元 vital spirit 気 after rest.",
    ],
    [
      "Бодрый человек отбивает げん・き; у げ есть дакутэн, у き нет.",
      "An energetic person taps げん・き; げ is voiced, き is not.",
    ],
    [
      "父は今日も元気です。",
      "ちちはきょうもげんきです。",
      "Мой отец и сегодня бодр и здоров.",
      "My father is well and energetic today too.",
    ],
  ],
  [
    "中古",
    "ちゅうこ",
    "1424150",
    ["подержанный товар", "подержанные вещи", "бывший в употреблении", "подержанный"],
    ["secondhand goods", "used goods", "secondhand", "used"],
    [
      "Вещь уже использовалась, но не обязательно старая по возрасту.",
      "An item has been used before; it need not be old in age.",
    ],
    [
      "Между новым и древним 古 стоит вещь в середине 中 своей службы: подержанная.",
      "Between new and ancient 古 stands an item midway 中 through its useful life: secondhand.",
    ],
    [
      "Длинная ценовая этикетка ちゅう и короткая こ: ちゅう・こ. Для подержанных вещей словарь допускает и ちゅうぶる.",
      "A long price tag ちゅう meets a short こ tag: ちゅう・こ. The dictionary also permits ちゅうぶる for used goods.",
    ],
    [
      "中古の車をかいました。",
      "ちゅうこのくるまをかいました。",
      "Я купил подержанную машину.",
      "I bought a used car.",
    ],
  ],
  [
    "戸外",
    "こがい",
    "1266980",
    ["на открытом воздухе", "вне дома", "снаружи"],
    ["outdoors", "outside the house", "outside"],
    [
      "Пространство за дверью дома, близко к 屋外.",
      "The space beyond the house door, close in meaning to 屋外.",
    ],
    [
      "Выйдя за дверь 戸 наружу 外, вы оказываетесь на открытом воздухе.",
      "Step through the door 戸 to the outside 外 and you are outdoors.",
    ],
    [
      "На двери короткое こ, снаружи がい: こ・がい. Не おくがい, это другое слово.",
      "The door has short こ and outside has がい: こ・がい, not the other word おくがい.",
    ],
    [
      "子どもたちは戸外であそんでいます。",
      "こどもたちはこがいであそんでいます。",
      "Дети играют на открытом воздухе.",
      "The children are playing outdoors.",
    ],
  ],
  [
    "車庫",
    "しゃこ",
    "1323120",
    ["гараж", "автомобильный гараж"],
    ["garage", "car garage"],
    [
      "Помещение для машины, не станция и не автостоянка вообще.",
      "A building for a vehicle, not a station or any parking area.",
    ],
    [
      "Автомобиль 車 помещается на склад 庫: получается гараж.",
      "A car 車 enters its storage building 庫: a garage.",
    ],
    [
      "Маленькое ゃ в しゃ, затем короткое こ: しゃ・こ; без долгих гласных.",
      "Use small ゃ in しゃ, then short こ: しゃ・こ, without long vowels.",
    ],
    [
      "車を車庫に入れました。",
      "くるまをしゃこにいれました。",
      "Я поставил машину в гараж.",
      "I put the car in the garage.",
    ],
  ],
  [
    "湖水",
    "こすい",
    "1267310",
    ["озёрная вода", "вода озера", "озеро"],
    ["lake water", "water of a lake", "lake"],
    [
      "Вода озера; слово также может обозначать само озеро.",
      "The water of a lake; the word can also refer to the lake itself.",
    ],
    [
      "Из озера 湖 зачерпните воду 水: на пробе написано «озёрная вода».",
      "Scoop water 水 from a lake 湖 and label the sample lake water.",
    ],
    [
      "Проба озера こ соединяется с водой すい: こ・すい, не みず.",
      "The lake sample こ joins water すい: こ・すい, not standalone みず.",
    ],
    [
      "この湖水はきれいです。",
      "このこすいはきれいです。",
      "Вода этого озера чистая.",
      "This lake water is clean.",
    ],
  ],
  [
    "光線",
    "こうせん",
    "1273030",
    ["луч света", "световой луч", "луч"],
    ["ray of light", "light ray", "ray"],
    ["Направленный луч, не свет вообще.", "A directed ray, not light in general."],
    [
      "Свет 光 рисует тонкую линию 線 через щель: один луч.",
      "Light 光 draws a thin line 線 through a slit: one ray.",
    ],
    [
      "Луч тянется на こう, а его конец помечен せん: こう・せん.",
      "A ray stretches through こう and ends at a せん marker: こう・せん.",
    ],
    [
      "光線が水の中に入ります。",
      "こうせんがみずのなかにはいります。",
      "Луч света входит в воду.",
      "A ray of light enters the water.",
    ],
  ],
  [
    "工場",
    "こうじょう",
    "1578700",
    ["завод", "фабрика"],
    ["factory", "plant"],
    [
      "Место промышленного производства, не растение при ответе plant.",
      "An industrial production site; plant here does not mean a living plant.",
    ],
    [
      "Работа 工 занимает целую площадку 場 с машинами: завод.",
      "Industrial work 工 fills a site 場 with machines: a factory.",
    ],
    [
      "Два длинных цеха こう・じょう; оба заканчиваются на う. Словарное чтение こうば тоже допустимо.",
      "Two long workshops read こう・じょう; both end in う. The dictionary reading こうば is also accepted.",
    ],
    [
      "兄は工場で働いています。",
      "あにはこうじょうではたらいています。",
      "Мой старший брат работает на заводе.",
      "My older brother works at a factory.",
    ],
  ],
  [
    "合計",
    "ごうけい",
    "1284740",
    ["итог", "сумма", "общая сумма"],
    ["total", "sum", "total amount"],
    [
      "Результат сложения нескольких величин, не отдельная цена.",
      "The result of adding several amounts, not an individual price.",
    ],
    [
      "Соедините 合 результаты подсчёта 計 в нижней строке чека: это итог.",
      "Combine 合 the counted 計 amounts on the bottom line of a receipt: the total.",
    ],
    [
      "Чек начинается со звонкого ごう и заканчивается けい: ごう・けい.",
      "The receipt starts with voiced ごう and ends in けい: ごう・けい.",
    ],
    [
      "合計は千円です。",
      "ごうけいはせんえんです。",
      "Общая сумма — тысяча иен.",
      "The total is one thousand yen.",
    ],
  ],
  [
    "細工",
    "さいく",
    "1295610",
    ["тонкая работа", "ремесленная работа", "ручная работа"],
    ["craftwork", "handiwork", "fine workmanship"],
    [
      "Здесь тонкая ремесленная работа; не всякое производство и не подвох.",
      "This card teaches fine craftwork, not all manufacturing or a trick.",
    ],
    [
      "Тонкие 細 детали требуют аккуратной работы 工 рук мастера.",
      "Fine 細 details require careful work 工 by a craftsperson.",
    ],
    [
      "Тонкая деталь помечена さい, инструмент く: さい・く.",
      "A fine detail is marked さい and its tool く: さい・く.",
    ],
    [
      "この細工はとてもきれいです。",
      "このさいくはとてもきれいです。",
      "Эта тонкая работа очень красива.",
      "This craftwork is very beautiful.",
    ],
  ],
  [
    "用紙",
    "ようし",
    "1546290",
    ["бумага", "лист бумаги", "бланк"],
    ["paper", "sheet of paper", "form"],
    [
      "Бумага для определённого использования: печати, письма или заполнения.",
      "Paper for a particular use, such as printing, writing or filling in a form.",
    ],
    [
      "Бумага 紙 приготовлена к использованию 用 рядом с принтером.",
      "Paper 紙 is ready for use 用 beside a printer.",
    ],
    [
      "Длинный лист よう и короткая метка し: よう・し.",
      "A long sheet よう has a short label し: よう・し.",
    ],
    [
      "この用紙に名前を書いてください。",
      "このようしになまえをかいてください。",
      "Напишите, пожалуйста, имя на этом бланке.",
      "Please write your name on this form.",
    ],
  ],
  [
    "市場",
    "しじょう",
    "1308305",
    ["рынок"],
    ["market", "marketplace"],
    [
      "Рынок в экономическом смысле; физический торговый рынок часто читается いちば.",
      "A market in the economic sense; a physical trading market is often read いちば.",
    ],
    [
      "Торговля 市 занимает пространство 場 экономики: рынок товаров.",
      "Trade 市 occupies a space 場 in the economy: the goods market.",
    ],
    [
      "Для экономического рынка выберите し・じょう. Чтение いちば учится отдельно.",
      "For the economic market choose し・じょう; learn いちば separately.",
    ],
    [
      "日本の市場をしらべています。",
      "にほんのしじょうをしらべています。",
      "Я изучаю японский рынок.",
      "I am researching the Japanese market.",
    ],
  ],
  [
    "寺院",
    "じいん",
    "1315250",
    ["буддийский храм", "храм"],
    ["Buddhist temple", "temple"],
    ["Буддийский храм, не синтоистское святилище.", "A Buddhist temple, not a Shinto shrine."],
    [
      "Храм 寺 становится религиозным учреждением 院: представьте буддийский комплекс.",
      "A temple 寺 forms a religious institution 院: picture a Buddhist complex.",
    ],
    [
      "У ворот じ, внутри いん: じ・いん. Сохраните обе い в записи じいん.",
      "The gate reads じ and the inside いん: じ・いん. Keep both written い.",
    ],
    [
      "この寺院は古いです。",
      "このじいんはふるいです。",
      "Этот буддийский храм старый.",
      "This Buddhist temple is old.",
    ],
  ],
  [
    "自分",
    "じぶん",
    "1318610",
    ["себя", "сам", "самого себя"],
    ["oneself", "self", "myself", "yourself", "himself", "herself"],
    [
      "Сам человек, о котором идёт речь; перевод местоимением зависит от контекста.",
      "The person concerned; the appropriate reflexive pronoun depends on context.",
    ],
    [
      "Свою 自 часть 分 работы сделайте сами: выделите себя среди других.",
      "Do your own 自 share 分 of the work: single yourself out.",
    ],
    [
      "Свою долю подпишите じ・ぶん; 分 здесь звонкое ぶん, не ふん.",
      "Label your own share じ・ぶん; 分 is voiced ぶん here, not ふん.",
    ],
    [
      "自分の名前を書きます。",
      "じぶんのなまえをかきます。",
      "Я напишу своё имя.",
      "I will write my own name.",
    ],
  ],
  [
    "品質",
    "ひんしつ",
    "1490580",
    ["качество", "качество товара"],
    ["quality", "product quality"],
    [
      "Качество вещи, не её количество и не цена.",
      "How good a product is, not its quantity or price.",
    ],
    [
      "У товара 品 проверяют свойства 質: выдержит ли вещь испытание качества?",
      "Test the properties 質 of a product 品: will it pass the quality check?",
    ],
    [
      "Коробка ひん проходит проверку しつ: ひん・しつ; последнее つ полное.",
      "A box marked ひん passes a しつ check: ひん・しつ, with full final つ.",
    ],
    [
      "この商品の品質はいいです。",
      "このしょうひんのひんしつはいいです。",
      "У этого товара хорошее качество.",
      "This product is of good quality.",
    ],
  ],
  [
    "写真",
    "しゃしん",
    "1321900",
    ["фотография", "фото", "снимок"],
    ["photograph", "photo", "picture"],
    [
      "Фотографическое изображение, не рисунок от руки.",
      "An image taken with a camera, not a hand-drawn picture.",
    ],
    [
      "Копия 写 реального 真 вида остаётся на фотографии.",
      "A copied 写 view of the real 真 scene remains in a photograph.",
    ],
    [
      "Камера делает しゃ, отпечаток получает しん: しゃ・しん. Не длинное しゃあ.",
      "The camera says しゃ and the print receives しん: しゃ・しん, not long しゃあ.",
    ],
    [
      "この写真は父がとりました。",
      "このしゃしんはちちがとりました。",
      "Эту фотографию сделал мой отец.",
      "My father took this photograph.",
    ],
  ],
  [
    "主人",
    "しゅじん",
    "1579780",
    ["хозяин", "владелец", "муж"],
    ["master", "owner", "husband"],
    [
      "Хозяин или владелец; также традиционное обозначение собственного мужа, зависящее от контекста.",
      "A master or owner; also a traditional, context-sensitive term for one's own husband.",
    ],
    [
      "Главный 主 человек 人 встречает гостей как хозяин дома.",
      "The main 主 person 人 welcomes visitors as the house's owner.",
    ],
    [
      "У хозяина короткий ключ しゅ и бейдж じん: しゅ・じん, не しゅうじん.",
      "The owner has a short key しゅ and badge じん: しゅ・じん, not しゅうじん.",
    ],
    [
      "このいえの主人に会いました。",
      "このいえのしゅじんにあいました。",
      "Я встретился с хозяином этого дома.",
      "I met the owner of this house.",
    ],
  ],
  [
    "集合",
    "しゅうごう",
    "1333680",
    ["сбор", "собрание", "сбор вместе"],
    ["gathering", "assembly", "coming together"],
    [
      "Люди или предметы собираются вместе; здесь не математическое множество.",
      "People or things coming together; this card does not teach the mathematical set sense.",
    ],
    [
      "Собранные 集 люди соединяются 合 в одну группу перед отправлением.",
      "Gathered 集 people join 合 into one group before departure.",
    ],
    [
      "Две длинные линии группы: しゅう・ごう. У ご есть дакутэн.",
      "The group forms two long lines, しゅう・ごう; ご is voiced.",
    ],
    [
      "集合は九時です。",
      "しゅうごうはくじです。",
      "Сбор в девять часов.",
      "We gather at nine o'clock.",
    ],
  ],
  [
    "春分",
    "しゅんぶん",
    "1341160",
    ["весеннее равноденствие"],
    ["spring equinox", "vernal equinox"],
    [
      "Астрономическое весеннее равноденствие, не вся весна.",
      "The astronomical spring equinox, not the whole spring season.",
    ],
    [
      "Весной 春 день и ночь делятся 分 на равные части: равноденствие.",
      "In spring 春, day and night divide 分 into equal portions: the equinox.",
    ],
    [
      "Две половины しゅん・ぶん: обе заканчиваются на ん, в первой нет долгого う.",
      "The two halves are しゅん・ぶん; both end in ん and the first has no long う.",
    ],
    [
      "春分は三月です。",
      "しゅんぶんはさんがつです。",
      "Весеннее равноденствие бывает в марте.",
      "The spring equinox is in March.",
    ],
  ],
  [
    "暑中",
    "しょちゅう",
    "1343510",
    ["летняя жара", "жаркое время года", "разгар летней жары"],
    ["summer heat", "hot summer season", "height of summer"],
    [
      "Период летней жары, а не температура в любой момент.",
      "The hot part of summer, not a temperature at any time.",
    ],
    [
      "Вы стоите посреди 中 летней жары 暑 и ищете прохладу.",
      "You stand in the middle 中 of summer heat 暑 and look for shade.",
    ],
    [
      "Короткий выдох しょ сменяется длинным ちゅう: しょ・ちゅう.",
      "A short hot breath しょ is followed by long ちゅう: しょ・ちゅう.",
    ],
    [
      "暑中は水をよく飲みます。",
      "しょちゅうはみずをよくのみます。",
      "Во время летней жары я часто пью воду.",
      "I drink water often during the summer heat.",
    ],
  ],
  [
    "助手",
    "じょしゅ",
    "1344650",
    ["помощник", "ассистент"],
    ["assistant", "helper"],
    [
      "Человек, который помогает в работе, не сама помощь.",
      "A person who helps with work, not the assistance itself.",
    ],
    [
      "Помогающая 助 рука 手 принадлежит ассистенту у рабочего стола.",
      "The helping 助 hand 手 belongs to an assistant at the workbench.",
    ],
    [
      "Помощник получает две короткие метки じょ・しゅ; не удлиняйте ни одну.",
      "The helper gets two short labels, じょ・しゅ; lengthen neither.",
    ],
    [
      "助手が道具をもってきました。",
      "じょしゅがどうぐをもってきました。",
      "Ассистент принёс инструменты.",
      "The assistant brought the tools.",
    ],
  ],
  [
    "消火",
    "しょうか",
    "1350160",
    ["тушение пожара", "тушение огня", "пожаротушение"],
    ["fire extinguishing", "extinguishing a fire", "firefighting"],
    [
      "Действие по тушению огня, не исчезновение любого предмета.",
      "Putting out a fire, not the disappearance of any object.",
    ],
    [
      "Огонь 火 исчезает 消 под струёй воды: пожар тушат.",
      "Fire 火 disappears 消 beneath a stream of water as it is extinguished.",
    ],
    [
      "Длинная струя しょう добирается до короткого пламени か: しょう・か.",
      "A long stream しょう reaches a short flame か: しょう・か.",
    ],
    [
      "消火に水を使いました。",
      "しょうかにみずをつかいました。",
      "Для тушения пожара использовали воду.",
      "Water was used to extinguish the fire.",
    ],
  ],
  [
    "商品",
    "しょうひん",
    "1347310",
    ["товар", "товары", "продукция"],
    ["product", "goods", "merchandise"],
    [
      "Вещь, предназначенная для продажи, не качество или цена вещи.",
      "An item offered for sale, not its quality or price.",
    ],
    [
      "Торговое 商 изделие 品 выставлено на продажу: это товар.",
      "A commercial 商 item 品 is displayed for sale: a product.",
    ],
    [
      "Витрина しょう и коробка ひん: しょう・ひん. Конец ん, не длинное う.",
      "A display しょう holds a box ひん: しょう・ひん, ending in ん rather than long う.",
    ],
    [
      "この商品はよくうれます。",
      "このしょうひんはよくうれます。",
      "Этот товар хорошо продаётся.",
      "This product sells well.",
    ],
  ],
  [
    "文章",
    "ぶんしょう",
    "1505470",
    ["текст", "письменный текст", "сочинение"],
    ["text", "written text", "composition"],
    [
      "Связный письменный текст, а не обязательно одно предложение.",
      "A connected piece of writing, not necessarily one sentence.",
    ],
    [
      "Письменные 文 знаки складываются в главы 章: получается текст.",
      "Written 文 signs join into sections 章 to form a text.",
    ],
    [
      "Текст начинается с ぶん и разворачивается в длинное しょう: ぶん・しょう.",
      "A text starts with ぶん and unfolds into long しょう: ぶん・しょう.",
    ],
    [
      "短い文章を読みます。",
      "みじかいぶんしょうをよみます。",
      "Я прочитаю короткий текст.",
      "I will read a short text.",
    ],
  ],
  [
    "乗車",
    "じょうしゃ",
    "1355270",
    ["посадка в транспорт", "посадка в поезд", "поездка в транспорте"],
    ["boarding", "getting on a vehicle", "riding in a vehicle"],
    [
      "Посадка или нахождение в транспорте, не выход из него.",
      "Getting on or riding in a vehicle, not getting off.",
    ],
    [
      "Человек садится 乗 в транспорт 車: началась посадка.",
      "A person boards 乗 a vehicle 車: boarding begins.",
    ],
    [
      "Длинная ступенька じょう ведёт в вагон しゃ: じょう・しゃ.",
      "A long step じょう leads into carriage しゃ: じょう・しゃ.",
    ],
    [
      "乗車の前にきっぷをかいます。",
      "じょうしゃのまえにきっぷをかいます。",
      "Перед посадкой я куплю билет.",
      "I will buy a ticket before boarding.",
    ],
  ],
  [
    "信用",
    "しんよう",
    "1359620",
    ["доверие", "кредит доверия", "кредитоспособность"],
    ["trust", "confidence", "credit", "creditworthiness"],
    [
      "Уверенность в надёжности человека; в финансах также кредитоспособность.",
      "Belief in someone's reliability; in finance also creditworthiness.",
    ],
    [
      "Доверенное 信 обещание можно использовать 用, потому что человеку верят.",
      "A trusted 信 promise can be used 用 because its maker is reliable.",
    ],
    [
      "Печать доверия しん на длинном документе よう: しん・よう, не しにょう.",
      "A trust seal しん sits on a long document よう: しん・よう, not しにょう.",
    ],
    [
      "信用をなくしたくありません。",
      "しんようをなくしたくありません。",
      "Я не хочу потерять доверие.",
      "I do not want to lose people's trust.",
    ],
  ],
  [
    "進歩",
    "しんぽ",
    "1366190",
    ["прогресс", "успехи", "продвижение вперёд"],
    ["progress", "improvement", "advance"],
    [
      "Развитие к лучшему, не любой процесс.",
      "Development toward something better, not any process.",
    ],
    [
      "Шаг 歩 вперёд 進 каждый день даёт заметный прогресс.",
      "A step 歩 forward 進 each day creates noticeable progress.",
    ],
    [
      "Впереди しん, у шага меняется ほ на ぽ: しん・ぽ.",
      "Ahead is しん; the step changes from ほ to ぽ: しん・ぽ.",
    ],
    [
      "道具はすこしずつ進歩しています。",
      "どうぐはすこしずつしんぽしています。",
      "Инструменты постепенно совершенствуются.",
      "Tools are gradually improving.",
    ],
  ],
  [
    "音声",
    "おんせい",
    "1183880",
    ["голос", "речь", "звуковая речь"],
    ["voice", "speech", "vocal sound"],
    [
      "Голос и звучащая речь; слово используют и для голосовой дорожки.",
      "The voice and spoken sound; also used for a voice audio track.",
    ],
    [
      "Звук 音 голоса 声 приходит из записи: слушайте речь.",
      "The sound 音 of a voice 声 comes from a recording: listen to speech.",
    ],
    [
      "Микрофон おん передаёт сигнал せい: おん・せい.",
      "A microphone おん sends a signal せい: おん・せい.",
    ],
    [
      "音声をもう一度聞きます。",
      "おんせいをもういちどききます。",
      "Я послушаю голосовую запись ещё раз.",
      "I will listen to the voice recording once more.",
    ],
  ],
  [
    "西洋",
    "せいよう",
    "1381100",
    ["Запад", "западный мир"],
    ["the West", "Western world", "Occident"],
    [
      "Западный культурный мир, а не просто западное направление.",
      "The Western cultural world, not just the westward direction.",
    ],
    [
      "На запад 西 через океан 洋 ведёт путь к западному миру.",
      "Travel west 西 across the ocean 洋 toward the Western world.",
    ],
    [
      "Карта отмечает せい, океан тянется на よう: せい・よう.",
      "The map marks せい and the ocean stretches through よう: せい・よう.",
    ],
    [
      "西洋の音楽を聞いています。",
      "せいようのおんがくをきいています。",
      "Я слушаю западную музыку.",
      "I am listening to Western music.",
    ],
  ],
  [
    "説明",
    "せつめい",
    "1386460",
    ["объяснение", "разъяснение"],
    ["explanation", "clarification"],
    [
      "Разъяснение содержания, не обещание и не доказательство само по себе.",
      "Making something understandable, not a promise or proof by itself.",
    ],
    [
      "Слова 説 делают неясное светлым 明: объяснение помогает понять.",
      "Words 説 make the unclear bright 明: an explanation helps you understand.",
    ],
    [
      "Полное せつ освещается меткой めい: せつ・めい; не превращайте つ в っ.",
      "Full せつ is lit by a めい label: せつ・めい; do not turn つ into っ.",
    ],
    [
      "先生の説明はよく分かりました。",
      "せんせいのせつめいはよくわかりました。",
      "Я хорошо понял объяснение учителя.",
      "I understood the teacher's explanation well.",
    ],
  ],
  [
    "船長",
    "せんちょう",
    "1392060",
    ["капитан судна", "капитан корабля", "капитан"],
    ["ship's captain", "captain", "skipper"],
    [
      "Руководитель судна, не капитан любой спортивной команды.",
      "The person commanding a ship, not the captain of any sports team.",
    ],
    [
      "Главный 長 на судне 船 стоит у штурвала: капитан корабля.",
      "The chief 長 aboard a ship 船 stands at the wheel: the ship's captain.",
    ],
    [
      "Билет судна せん ведёт к длинной капитанской фуражке ちょう: せん・ちょう. Для капитана также допустимо словарное ふなおさ.",
      "The ship's ticket せん leads to a long captain's hat ちょう: せん・ちょう. The dictionary also permits ふなおさ for a captain.",
    ],
    [
      "船長の話を聞きました。",
      "せんちょうのはなしをききました。",
      "Я послушал рассказ капитана судна.",
      "I listened to the ship captain's story.",
    ],
  ],
  [
    "走行",
    "そうこう",
    "1402550",
    ["движение транспорта", "езда"],
    ["vehicle movement", "travel by vehicle", "running of a vehicle"],
    [
      "Движение автомобиля или другого транспорта по пути.",
      "The running or movement of a vehicle along its route.",
    ],
    [
      "Машина бежит 走 и идёт 行 по дороге: она движется.",
      "A vehicle runs 走 and goes 行 along its route: it is in motion.",
    ],
    [
      "Два длинных участка дороги そう・こう; в обоих пишется う.",
      "Two long stretches of road read そう・こう; write う in both.",
    ],
    [
      "走行中は立たないでください。",
      "そうこうちゅうはたたないでください。",
      "Не вставайте во время движения.",
      "Please do not stand while the vehicle is moving.",
    ],
  ],
  [
    "送信",
    "そうしん",
    "1402820",
    ["отправка сообщения", "передача сигнала", "отправка"],
    ["transmission", "sending", "sending a message"],
    [
      "Передача сообщения или сигнала, не физическая доставка посылки.",
      "Sending a message or signal, not physically delivering a parcel.",
    ],
    [
      "Сообщение 信 отправляется 送 по сети: значок письма покидает экран.",
      "A message 信 is sent 送 across a network as its icon leaves the screen.",
    ],
    [
      "Длинная стрелка そう несёт сообщение しん: そう・しん, не そうじん.",
      "A long arrow そう carries message しん: そう・しん, not そうじん.",
    ],
    [
      "送信の前に名前をたしかめます。",
      "そうしんのまえになまえをたしかめます。",
      "Перед отправкой я проверю имя.",
      "I will check the name before sending.",
    ],
  ],
  [
    "時代",
    "じだい",
    "1316300",
    ["эпоха", "период", "время"],
    ["era", "period", "age"],
    [
      "Период истории или жизни, не показание часов.",
      "A period of history or life, not the time on a clock.",
    ],
    [
      "Время 時 сменяет поколения 代: на шкале появляется новая эпоха.",
      "Time 時 replaces generations 代 as a new era appears on a timeline.",
    ],
    ["Один миг じ открывает эпоху だい: じ・だい.", "A moment じ opens an era だい: じ・だい."],
    [
      "学生時代はよく本を読みました。",
      "がくせいじだいはよくほんをよみました。",
      "В студенческие годы я много читал.",
      "I read a lot during my student years.",
    ],
  ],
  [
    "第一",
    "だいいち",
    "1415270",
    ["первый", "прежде всего", "первое место"],
    ["first", "foremost", "number one"],
    [
      "Порядковое первое место или приоритет, не просто число один.",
      "The first ordinal position or a priority, not merely the number one.",
    ],
    [
      "Порядковый знак 第 поставлен перед 一: первое место в списке.",
      "The ordinal marker 第 precedes 一: first place on a list.",
    ],
    [
      "Табличка だい встречает いち: だい・いち. Обе соседние い остаются в записи.",
      "Marker だい meets いち: だい・いち. Keep both adjacent written い.",
    ],
    [
      "安全が第一です。",
      "あんぜんがだいいちです。",
      "Безопасность прежде всего.",
      "Safety comes first.",
    ],
  ],
  [
    "短時間",
    "たんじかん",
    "1418720",
    ["короткое время", "небольшой промежуток времени"],
    ["short time", "short period of time"],
    [
      "Небольшая длительность, не небольшая длина предмета.",
      "A brief duration, not the shortness of a physical object.",
    ],
    [
      "Короткая 短 полоска времени 時間 едва занимает место на шкале.",
      "A short 短 strip of time 時間 barely occupies the timeline.",
    ],
    [
      "Короткая метка たん перед знакомым じかん: たん・じ・かん.",
      "Short marker たん precedes familiar じかん: たん・じ・かん.",
    ],
    [
      "短時間で読みおわりました。",
      "たんじかんでよみおわりました。",
      "Я закончил читать за короткое время.",
      "I finished reading in a short time.",
    ],
  ],
  [
    "注文",
    "ちゅうもん",
    "1426650",
    ["заказ", "заказ товара"],
    ["order", "purchase order"],
    [
      "Запрос товара или еды, не приказ начальника.",
      "A request for goods or food, not a command from a superior.",
    ],
    [
      "Записанная 文 просьба направляет внимание 注 официанта на ваш заказ.",
      "A written 文 request directs 注 the server's attention to your order.",
    ],
    [
      "Заказ идёт по длинной трубке ちゅう к окну もん: ちゅう・もん.",
      "An order travels through a long tube ちゅう to a window もん: ちゅう・もん.",
    ],
    [
      "注文をおねがいします。",
      "ちゅうもんをおねがいします。",
      "Можно сделать заказ?",
      "May I place an order, please?",
    ],
  ],
  [
    "都市",
    "とし",
    "1444990",
    ["город", "крупный город"],
    ["city", "urban area"],
    ["Город как населённый пункт и городская территория.", "A city as a settlement or urban area."],
    [
      "Большой город 都 с рынком 市 разрастается на карте.",
      "A metropolis 都 with a market 市 grows across the map.",
    ],
    [
      "Две короткие отметки на карте と・し: не とうし.",
      "Two short map markers read と・し, not とうし.",
    ],
    [
      "この都市には人が多いです。",
      "このとしにはひとがおおいです。",
      "В этом городе много людей.",
      "There are many people in this city.",
    ],
  ],
  [
    "特別",
    "とくべつ",
    "1455280",
    ["особый", "специальный", "особенный"],
    ["special", "particular", "exceptional"],
    [
      "Отличающийся от обычного; перед существительным часто используется な.",
      "Different from the ordinary; often followed by な before a noun.",
    ],
    [
      "Особое 特 выделено отдельно 別 от обычных вещей: это специальный случай.",
      "Something special 特 is separated 別 from the ordinary: a special case.",
    ],
    [
      "Метка とく отделена от べつ: とく・べつ. Сохраните полные く и つ.",
      "Marker とく is separate from べつ: とく・べつ. Keep full く and つ.",
    ],
    [
      "今日は特別な日です。",
      "きょうはとくべつなひです。",
      "Сегодня особенный день.",
      "Today is a special day.",
    ],
  ],
  [
    "自転車",
    "じてんしゃ",
    "1318290",
    ["велосипед"],
    ["bicycle", "bike"],
    [
      "Двухколёсный транспорт с педалями, не мотоцикл.",
      "A pedal-powered two-wheeled vehicle, not a motorcycle.",
    ],
    [
      "Сам 自 вращаешь 転 колёса транспорта 車 педалями: едешь на велосипеде.",
      "You yourself 自 turn 転 the vehicle's 車 wheels with pedals: a bicycle.",
    ],
    [
      "Три детали велосипеда じ・てん・しゃ; не заменяйте てん на でん.",
      "The bicycle's three parts read じ・てん・しゃ; do not replace てん with でん.",
    ],
    [
      "自転車で学校に行きます。",
      "じてんしゃでがっこうにいきます。",
      "Я езжу в школу на велосипеде.",
      "I go to school by bicycle.",
    ],
  ],
  [
    "同時",
    "どうじ",
    "1452500",
    ["одновременно", "одновременность", "одно и то же время"],
    ["simultaneously", "same time", "simultaneous occurrence"],
    [
      "Два события происходят в одно время; обычно употребляется 同時に.",
      "Two events happen at the same time; commonly used as 同時に.",
    ],
    [
      "Одинаковое 同 время 時 на двух часах: события одновременны.",
      "Two clocks show the same 同 time 時: the events are simultaneous.",
    ],
    [
      "Длинная стрелка どう совпадает с короткой じ: どう・じ.",
      "A long hand どう aligns with short じ: どう・じ.",
    ],
    [
      "二人は同時に立ちました。",
      "ふたりはどうじにたちました。",
      "Двое встали одновременно.",
      "The two people stood up at the same time.",
    ],
  ],
  [
    "新聞",
    "しんぶん",
    "1362360",
    ["газета"],
    ["newspaper", "paper"],
    [
      "Печатное или цифровое газетное издание, не новости вообще.",
      "A printed or digital newspaper, not news in general.",
    ],
    [
      "Новое 新 услышанное 聞 напечатано на полосе газеты.",
      "New 新 things heard 聞 are printed on a newspaper page.",
    ],
    [
      "Первая полоса しん, вторая ぶん: しん・ぶん. Здесь 聞 звучит ぶん, не もん.",
      "Page one reads しん, page two ぶん: しん・ぶん; 聞 is ぶん here, not もん.",
    ],
    [
      "毎あさ、新聞を読みます。",
      "まいあさ、しんぶんをよみます。",
      "Каждое утро я читаю газету.",
      "I read the newspaper every morning.",
    ],
  ],
  [
    "親切",
    "しんせつ",
    "1365250",
    ["доброта", "любезность", "заботливость", "добрый", "любезный", "заботливый"],
    ["kindness", "helpfulness", "consideration", "kind", "helpful", "considerate"],
    [
      "Доброжелательное отношение; 親切な описывает доброго, внимательного человека.",
      "Helpful consideration; 親切な describes a kind, considerate person.",
    ],
    [
      "Представьте близкого 親 человека, который отрезает 切 кусок хлеба для гостя: это образ доброты, не буквальный перевод.",
      "Picture someone close 親 cutting 切 bread for a guest: a memory image for kindness, not a literal translation.",
    ],
    [
      "Добрая записка состоит из しん・せつ. Полное つ в конце, не маленькое っ.",
      "A kind note reads しん・せつ; end in full つ, not small っ.",
    ],
    [
      "親切にしてくれて、ありがとう。",
      "しんせつにしてくれて、ありがとう。",
      "Спасибо за доброту ко мне.",
      "Thank you for being kind to me.",
    ],
  ],
  [
    "反対",
    "はんたい",
    "1480670",
    ["противоположность", "возражение", "против", "противодействие"],
    ["opposite", "opposition", "objection", "against"],
    [
      "Противоположная сторона или несогласие; смысл определяется контекстом.",
      "An opposite side or disagreement, depending on context.",
    ],
    [
      "Повернитесь обратно 反 и встаньте напротив 対: вы на противоположной стороне.",
      "Turn back 反 and face 対 the other way: you are on the opposite side.",
    ],
    [
      "Один конец стрелки はん, другой たい: はん・たい; ни один не удлиняется через う.",
      "One end of an arrow reads はん, the other たい: はん・たい, with no lengthening う.",
    ],
    [
      "わたしはそのかんがえに反対です。",
      "わたしはそのかんがえにはんたいです。",
      "Я против этой идеи.",
      "I am against that idea.",
    ],
  ],
  [
    "坂道",
    "さかみち",
    "1297120",
    ["дорога на склоне", "наклонная дорога", "дорога в гору"],
    ["sloping road", "hill road", "slope"],
    [
      "Дорога на уклоне: по ней можно и подниматься, и спускаться.",
      "A road on an incline that can be traveled uphill or downhill.",
    ],
    [
      "Дорога 道 легла на склон 坂: одна сторона выше другой.",
      "A road 道 lies on a slope 坂, with one end higher than the other.",
    ],
    [
      "Склон さか соединяется с дорогой みち: さか・みち, два кунных чтения.",
      "Slope さか joins road みち: さか・みち, two kun readings.",
    ],
    [
      "この坂道をゆっくり歩きます。",
      "このさかみちをゆっくりあるきます。",
      "Я медленно иду по этой наклонной дороге.",
      "I walk slowly along this sloping road.",
    ],
  ],
  [
    "洋服",
    "ようふく",
    "1546020",
    ["одежда европейского типа", "западная одежда", "европейская одежда"],
    ["Western clothes", "Western-style clothing", "Western clothing"],
    [
      "Одежда западного типа, в отличие от традиционной японской одежды.",
      "Western-style clothes, as opposed to traditional Japanese clothing.",
    ],
    [
      "Из-за океана 洋 пришла одежда 服 европейского типа.",
      "Clothes 服 of Western style arrive from across the ocean 洋.",
    ],
    [
      "Длинный рукав よう и две складки ふく: よう・ふく.",
      "A long sleeve よう meets folds ふく: よう・ふく.",
    ],
    [
      "新しい洋服をかいました。",
      "あたらしいようふくをかいました。",
      "Я купил новую одежду европейского типа.",
      "I bought new Western-style clothes.",
    ],
  ],
  [
    "動物",
    "どうぶつ",
    "1451470",
    ["животное", "животные"],
    ["animal", "animals"],
    [
      "Живое существо животного мира, не растение и не предмет.",
      "A member of the animal kingdom, not a plant or an object.",
    ],
    [
      "Двигающееся 動 существо 物 оставляет следы на земле: животное.",
      "A moving 動 creature 物 leaves tracks on the ground: an animal.",
    ],
    [
      "Длинный след どう заканчивается ぶつ: どう・ぶつ, со звонким ぶ и полным つ.",
      "A long track どう ends in ぶつ: どう・ぶつ, with voiced ぶ and full つ.",
    ],
    [
      "どんな動物がすきですか。",
      "どんなどうぶつがすきですか。",
      "Какие животные вам нравятся?",
      "What animals do you like?",
    ],
  ],
  [
    "勉強",
    "べんきょう",
    "1512670",
    ["учёба", "изучение", "занятия"],
    ["study", "studying", "learning"],
    [
      "Учебные занятия; 勉強する — учиться или изучать.",
      "Academic study; 勉強する means to study or learn.",
    ],
    [
      "Прилагая усилие 勉, вы делаете знания сильнее 強: так идёт учёба.",
      "With effort 勉 you make knowledge stronger 強: that is study.",
    ],
    [
      "Книга べん лежит на длинной парте きょう: べん・きょう.",
      "A book べん rests on a long desk きょう: べん・きょう.",
    ],
    [
      "毎日、日本語の勉強をします。",
      "まいにち、にほんごのべんきょうをします。",
      "Я каждый день занимаюсь японским языком.",
      "I study Japanese every day.",
    ],
  ],
  [
    "歩行",
    "ほこう",
    "1514370",
    ["ходьба", "передвижение пешком", "пешее движение"],
    ["walking", "traveling on foot"],
    [
      "Передвижение пешком, а не бег и не движение машины.",
      "Moving on foot, not running or vehicle movement.",
    ],
    [
      "Идти 行 шагами 歩 по тротуару — передвигаться пешком.",
      "Going 行 by steps 歩 along a pavement means walking.",
    ],
    [
      "Короткий шаг ほ ведёт на длинную дорожку こう: ほ・こう.",
      "A short step ほ leads to a long path こう: ほ・こう.",
    ],
    [
      "歩行中は足もとに気をつけます。",
      "ほこうちゅうはあしもとにきをつけます。",
      "Во время ходьбы я смотрю под ноги.",
      "I watch my step while walking.",
    ],
  ],
  [
    "放送",
    "ほうそう",
    "1516750",
    ["вещание", "трансляция", "передача"],
    ["broadcast", "broadcasting", "broadcast transmission"],
    [
      "Передача звука или изображения многим слушателям или зрителям.",
      "Transmitting sound or pictures to many listeners or viewers.",
    ],
    [
      "Выпущенный 放 сигнал отправляют 送 многим приёмникам: идёт вещание.",
      "A released 放 signal is sent 送 to many receivers: a broadcast.",
    ],
    [
      "Антенна передаёт две длинные части ほう・そう; сохраните оба う.",
      "An antenna sends two long parts, ほう・そう; keep both う.",
    ],
    [
      "学校の放送を聞いてください。",
      "がっこうのほうそうをきいてください。",
      "Послушайте, пожалуйста, школьное объявление по громкой связи.",
      "Please listen to the school broadcast.",
    ],
  ],
  [
    "夜間",
    "やかん",
    "1536530",
    ["ночное время", "ночь"],
    ["nighttime", "night", "night time"],
    [
      "Ночной промежуток времени, не вечер вообще.",
      "The nighttime period, not the evening in general.",
    ],
    [
      "Ночь 夜 занимает промежуток 間 между закатом и утром.",
      "Night 夜 occupies the interval 間 between sunset and morning.",
    ],
    [
      "Одна звезда や над воротами かん: や・かん. Здесь 間 читается かん.",
      "One star や shines above gate かん: や・かん. 間 is かん here.",
    ],
    [
      "夜間はここに入れません。",
      "やかんはここにはいれません。",
      "Ночью сюда нельзя входить.",
      "You cannot enter here at night.",
    ],
  ],
  [
    "有名",
    "ゆうめい",
    "1541620",
    ["известный", "знаменитый"],
    ["famous", "well-known", "renowned"],
    [
      "Широко известный; перед существительным обычно 有名な.",
      "Widely known; normally 有名な before a noun.",
    ],
    [
      "Есть 有 имя 名, которое все знают: человек знаменит.",
      "There is 有 a name 名 that everyone knows: its bearer is famous.",
    ],
    [
      "Длинная вывеска ゆう несёт имя めい: ゆう・めい, не ゆめい.",
      "A long sign ゆう bears the name めい: ゆう・めい, not ゆめい.",
    ],
    [
      "この人は有名なさっかです。",
      "このひとはゆうめいなさっかです。",
      "Этот человек — известный писатель.",
      "This person is a famous writer.",
    ],
  ],
  [
    "用事",
    "ようじ",
    "1546300",
    ["дело", "дела", "поручение"],
    ["business", "errand", "something to do"],
    [
      "Дело, которым нужно заняться; не бизнес-компания.",
      "Something you need to attend to, not a business company.",
    ],
    [
      "Используйте 用 свободное время, чтобы закончить дело 事 из списка.",
      "Use 用 your free time to attend to a matter 事 on your list.",
    ],
    [
      "Длинный список よう содержит короткую запись じ: よう・じ.",
      "A long list よう holds a short entry じ: よう・じ.",
    ],
    [
      "午後は用事があります。",
      "ごごはようじがあります。",
      "После обеда у меня есть дела.",
      "I have something to do this afternoon.",
    ],
  ],
  [
    "曜日",
    "ようび",
    "1545770",
    ["день недели"],
    ["day of the week"],
    [
      "Любой день семидневной недели, включая выходные; не только рабочий день.",
      "Any day in the seven-day week, including weekends, not only a workday.",
    ],
    [
      "Метка недели 曜 стоит у каждого дня 日 календаря.",
      "A day-of-the-week label 曜 stands beside each day 日 on the calendar.",
    ],
    [
      "Длинная календарная полоска よう заканчивается звонким び: よう・び, не ようにち.",
      "A long calendar strip よう ends in voiced び: よう・び, not ようにち.",
    ],
    [
      "今日は何曜日ですか。",
      "きょうはなんようびですか。",
      "Какой сегодня день недели?",
      "What day of the week is it today?",
    ],
  ],
  [
    "旅行",
    "りょこう",
    "1553170",
    ["путешествие", "поездка"],
    ["travel", "trip", "journey"],
    [
      "Поездка с переменой места, не ежедневная ходьба.",
      "A journey away from your usual place, not everyday walking.",
    ],
    [
      "Путешественник 旅 отправляется 行 в путь с сумкой.",
      "A traveler 旅 sets out 行 on a journey with a bag.",
    ],
    [
      "Короткий билет りょ ведёт на длинный путь こう: りょ・こう, не りょうこう.",
      "A short ticket りょ leads to a long route こう: りょ・こう, not りょうこう.",
    ],
    [
      "らいげつ、旅行に行きます。",
      "らいげつ、りょこうにいきます。",
      "В следующем месяце я отправлюсь в путешествие.",
      "I will go on a trip next month.",
    ],
  ],
  [
    "料金",
    "りょうきん",
    "1554280",
    ["плата", "стоимость услуги", "тариф"],
    ["fee", "charge", "fare"],
    [
      "Плата за услугу или проезд, не зарплата.",
      "A charge for a service or transport, not a salary.",
    ],
    [
      "За услугу 料 отдают деньги 金 у кассы: это плата.",
      "Money 金 is paid for a service 料 at the counter: a fee.",
    ],
    [
      "Длинный чек りょう помечен きん: りょう・きん. Не короткое りょ.",
      "A long receipt りょう is marked きん: りょう・きん, not short りょ.",
    ],
    [
      "料金はあとではらいます。",
      "りょうきんはあとではらいます。",
      "Я заплачу за услугу позже.",
      "I will pay the fee later.",
    ],
  ],
  [
    "今回",
    "こんかい",
    "1289070",
    ["этот раз", "на этот раз", "в этот раз"],
    ["this time", "on this occasion"],
    [
      "Нынешний случай, не следующий и не прошлый раз.",
      "The current occasion, not the next or previous time.",
    ],
    [
      "Текущий 今 круг 回 отмечен на схеме: именно этот раз.",
      "The current 今 round 回 is highlighted on a chart: this time.",
    ],
    [
      "Текущий круг начинается こん и завершается かい: こん・かい.",
      "The current round begins with こん and ends with かい: こん・かい.",
    ],
    [
      "今回は一人で行きます。",
      "こんかいはひとりでいきます。",
      "На этот раз я пойду один.",
      "I will go alone this time.",
    ],
  ],
  [
    "海外",
    "かいがい",
    "1201260",
    ["за границей", "зарубежье", "заграница"],
    ["overseas", "abroad", "foreign countries"],
    [
      "За пределами своей страны; не просто другая сторона моря.",
      "Outside one's country, not merely the other side of a sea.",
    ],
    [
      "Снаружи 外 за морем 海 лежит зарубежье.",
      "Beyond the sea 海, on the outside 外, lie foreign countries.",
    ],
    [
      "Два берега かい・がい: второй начинается со звонкого が.",
      "Two shores read かい・がい; the second begins with voiced が.",
    ],
    [
      "兄は海外で働いています。",
      "あにはかいがいではたらいています。",
      "Мой старший брат работает за границей.",
      "My older brother works abroad.",
    ],
  ],
  [
    "開始",
    "かいし",
    "1202760",
    ["начало", "начало действия", "старт"],
    ["start", "beginning", "commencement"],
    [
      "Начало действия или мероприятия, не его завершение.",
      "The start of an activity or event, not its completion.",
    ],
    [
      "Ворота открыты 開, действие начинается 始: дан старт.",
      "The gates open 開 and action begins 始: the start is given.",
    ],
    [
      "Открытый стартовый проход かい и короткий сигнал し: かい・し.",
      "An open starting gate かい meets a short signal し: かい・し.",
    ],
    [
      "開始は十時です。",
      "かいしはじゅうじです。",
      "Начало в десять часов.",
      "The start is at ten o'clock.",
    ],
  ],
  [
    "安全",
    "あんぜん",
    "1153930",
    ["безопасность", "сохранность", "безопасный"],
    ["safety", "security", "safe"],
    [
      "Отсутствие опасности; 安全な описывает безопасное место или действие.",
      "Freedom from danger; 安全な describes a safe place or activity.",
    ],
    [
      "Спокойствие 安 сохранено целиком 全: ничто не угрожает безопасности.",
      "Peace 安 is kept whole 全: nothing threatens safety.",
    ],
    [
      "Две защитные двери あん・ぜん; обе заканчиваются носовым ん.",
      "Two protective doors read あん・ぜん; both end in nasal ん.",
    ],
    [
      "安全をたしかめてからわたります。",
      "あんぜんをたしかめてからわたります。",
      "Я перейду, убедившись в безопасности.",
      "I will cross after checking that it is safe.",
    ],
  ],
  [
    "会話",
    "かいわ",
    "1198880",
    ["разговор", "беседа"],
    ["conversation", "talk", "chat"],
    [
      "Обмен репликами между людьми, не монолог или отдельное слово.",
      "An exchange between people, not a monologue or an individual word.",
    ],
    [
      "Встретившись 会, люди говорят 話 друг с другом: завязалась беседа.",
      "People meet 会 and speak 話 to each other: a conversation begins.",
    ],
    [
      "Встреча かい заканчивается коротким わ: かい・わ, не はなし целиком.",
      "A meeting かい ends in short わ: かい・わ, not the whole reading はなし.",
    ],
    [
      "友人との会話をたのしみます。",
      "ゆうじんとのかいわをたのしみます。",
      "Мне нравится беседовать с друзьями.",
      "I enjoy conversations with friends.",
    ],
  ],
];

const localize = ([ru, en]: Pair): MainCourseLocalizedText => ({ ru, en });
// Exact, sense-compatible dictionary alternatives, not inferred kanji readings.
const ALTERNATIVE_READINGS: Readonly<Record<string, readonly string[]>> = {
  工場: ["こうば"],
  中古: ["ちゅうぶる"],
  船長: ["ふなおさ"],
};

type Blocks = NonNullable<MainCourseAcceptedMeanings["blocked"]>;
const ANSWER_DISTINCTIONS: Readonly<Record<string, { ru?: Blocks; en?: Blocks }>> = {
  中古: {
    ru: ["поддержанный", "поддержанный товар", "поддержанные вещи"].map((text) => ({
      text,
      reason: "Поддержанный означает получивший поддержку, а подержанный — бывший в употреблении.",
    })),
  },
  会話: {
    en: [
      { text: "conservation", reason: "Conservation means preservation, not a conversation." },
      { text: "conversion", reason: "Conversion is a change, not an exchange of speech." },
    ],
  },
  写真: {
    en: [{ text: "phonograph", reason: "A phonograph plays sound; a photograph is an image." }],
  },
  説明: {
    en: [
      {
        text: "classification",
        reason:
          "Classification sorts things into classes; an explanation makes something understandable.",
      },
    ],
  },
  急行: {
    ru: [
      {
        text: "старый поезд",
        reason: "Старый описывает возраст поезда; здесь скорый поезд, экспресс.",
      },
    ],
  },
  今回: {
    ru: [{ text: "в тот раз", reason: "В тот раз отсылает к другому случаю, а здесь в этот раз." }],
  },
};

export function buildCompletionWordBatches(
  kanjiBatches: readonly MainCourseContentBatch[],
): readonly MainCourseWordBatch[] {
  const kanjiLevels = new Map(
    kanjiBatches.flatMap((batch) =>
      batch.kanji.map((item) => [item.character, item.levelNumber] as const),
    ),
  );
  const positioned = WORDS.map((row, index) => {
    const required = [
      ...new Set([...row[0], ...row[8][0]].filter((c) => /\p{Script=Han}/u.test(c))),
    ];
    const missing = required.filter((c) => !kanjiLevels.has(c));
    if (missing.length) throw new Error(`${row[0]} needs prepared kanji: ${missing.join(", ")}`);
    return { row, index, earliestLevel: 1 + Math.max(...required.map((c) => kanjiLevels.get(c)!)) };
  }).sort((a, b) => a.earliestLevel - b.earliestLevel || a.index - b.index);

  return Array.from({ length: WORDS.length / 20 }, (_, batchIndex) => {
    const rows = positioned.slice(batchIndex * 20, (batchIndex + 1) * 20);
    // Fixed internal storage chunks, not separate pilot courses or completion milestones.
    const levelNumber = Math.max(...rows.map((item) => item.earliestLevel));
    const sortOrderStart = batchIndex * 20 + 1;
    return {
      id: `full-course-vocabulary-completion-${String(batchIndex + 1).padStart(2, "0")}`,
      version: "1",
      authoredAt: "2026-10-31",
      reviewedAt: "2026-10-31",
      reviewNotes:
        "Eighty original RU/EN reinforcement words, contexts, memory aids and JP/kana/RU/EN examples independently read by AI reviewers Hegel (meaning/context) and Tesla (reading/dependency) on 2026-10-31. Parent applied semantic false-positive blocks, contextual scope, natural examples and source-supported reading alternatives. All 80 exact primary IDs and 3 sense-compatible alternatives verified against pinned local JMdict 2026-10-29; all expression/example kanji prerequisites earlier. AI editorial acceptance, not human certification, live source/license preflight or publication evidence. Four internal storage chunks, not new pilot courses.",
      sourceFile: "packages/db/src/completion-word-content.ts",
      courseSlug: "japanese-ru-n2",
      levelNumber,
      sortOrderStart,
      words: rows.map(({ row }, index) => {
        const [expression, reading, sequence, ru, en, scope, memory, readingMemory, example] = row;
        const [japaneseText, readingText, translationRu, translationEn] = example;
        return {
          expression,
          reading,
          jmdictEntryId: `jmdict:${sequence}`,
          sortOrder: sortOrderStart + index,
          ...(ALTERNATIVE_READINGS[expression]
            ? { acceptedReadings: ALTERNATIVE_READINGS[expression] }
            : {}),
          meanings: {
            ru: {
              primary: ru[0]!,
              accepted: ru,
              ...(ANSWER_DISTINCTIONS[expression]?.ru
                ? { blocked: ANSWER_DISTINCTIONS[expression]!.ru }
                : {}),
            },
            en: {
              primary: en[0]!,
              accepted: en,
              ...(ANSWER_DISTINCTIONS[expression]?.en
                ? { blocked: ANSWER_DISTINCTIONS[expression]!.en }
                : {}),
            },
          },
          meaningMnemonic: localize(memory),
          meaningHint: localize(scope),
          readingMnemonic: localize(readingMemory),
          readingHint: { ru: `Всё слово: ${reading}.`, en: `The whole word: ${reading}.` },
          example: { japaneseText, readingText, translationRu, translationEn },
        };
      }),
    };
  });
}
