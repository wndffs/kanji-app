import { type MainCourseWordBatch } from "./main-course-word-content";

const BATCH: MainCourseWordBatch = {
  id: "task-127-course-words-07",
  version: "1",
  authoredAt: "2026-10-23",
  reviewedAt: "2026-10-29",
  reviewNotes:
    "Original AI-authored RU/EN meanings, accepted answers and JP/kana/RU/EN examples. Independently reviewed by separate AI reviewer A; reading explanations also reviewed by reviewer B, with corrections integrated by the parent on 2026-10-29. All20 exact bilingual JMdict identities verified locally and in successful licensed Neon imports. Corrected family/address/register scope, translations and semantic near-answer blocks. No inferred alternate accepted readings. Not human approval or publication proof; complete curator, prerequisite and quality preflight remains mandatory.",
  sourceFile: "packages/db/src/main-course-word-content-07.ts",
  courseSlug: "japanese-ru-n2",
  levelNumber: 10,
  sortOrderStart: 1,
  words: [
    {
      expression: "学校",
      reading: "がっこう",
      jmdictEntryId: "jmdict:1206730",
      meanings: {
        ru: {
          primary: "школа",
          accepted: ["школа"],
        },
        en: {
          primary: "school",
          accepted: ["school"],
        },
      },
      meaningMnemonic: {
        ru: "Учёба 学 и школа 校 помогают запомнить слово «школа».",
        en: "Study 学 and school 校 help you remember the word 'school'.",
      },
      readingMnemonic: {
        ru: "が・っ・こ・う — четыре моры. Маленькая っ обозначает удвоение согласного к: задержите смычку на одну мору. Не произносите отдельное «цу».",
        en: "が・っ・こ・う: four morae. Small っ marks a doubled /k/: hold its closure for one mora. Do not pronounce a separate tsu.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «школа».",
        en: "This card teaches the meaning 'school'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: がっこう.",
        en: "Write the entire word in kana: がっこう.",
      },
      example: {
        japaneseText: "学校は山の下にあります。",
        readingText: "がっこうはやまのしたにあります。",
        translationRu: "Школа находится у подножия горы.",
        translationEn: "The school is at the foot of the mountain.",
      },
      sortOrder: 1,
    },
    {
      expression: "校長",
      reading: "こうちょう",
      jmdictEntryId: "jmdict:1279590",
      meanings: {
        ru: {
          primary: "директор школы",
          accepted: ["директор школы", "школьный директор"],
        },
        en: {
          primary: "school principal",
          accepted: ["school principal", "principal", "head teacher", "headteacher"],
        },
      },
      meaningMnemonic: {
        ru: "Главный 長 в школе 校 — директор школы, не директор компании.",
        en: "The head 長 of a school 校 is its principal, not a company director.",
      },
      readingMnemonic: {
        ru: "こう・ちょう: сохраните обе долготы и маленькую ょ.",
        en: "こう・ちょう: keep both long vowels and small ょ.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «директор школы».",
        en: "This card teaches the meaning 'school principal'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: こうちょう.",
        en: "Write the entire word in kana: こうちょう.",
      },
      example: {
        japaneseText: "校長は先生と話します。",
        readingText: "こうちょうはせんせいとはなします。",
        translationRu: "Директор школы разговаривает с учителем.",
        translationEn: "The principal talks with a teacher.",
      },
      sortOrder: 2,
    },
    {
      expression: "小学校",
      reading: "しょうがっこう",
      jmdictEntryId: "jmdict:1347870",
      meanings: {
        ru: {
          primary: "начальная школа",
          accepted: ["начальная школа"],
        },
        en: {
          primary: "elementary school",
          accepted: ["elementary school", "primary school"],
        },
      },
      meaningMnemonic: {
        ru: "Маленькая 小 школа 学校 напоминает начало школьного пути.",
        en: "A small 小 school 学校 suggests the beginning of school life.",
      },
      readingMnemonic: {
        ru: "しょう + がっこう: маленькая ょ в начале и っ в середине.",
        en: "しょう + がっこう: small ょ at the start and っ in the middle.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «начальная школа».",
        en: "This card teaches the meaning 'elementary school'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: しょうがっこう.",
        en: "Write the entire word in kana: しょうがっこう.",
      },
      example: {
        japaneseText: "わたしは小学校で本を読みます。",
        readingText: "わたしはしょうがっこうでほんをよみます。",
        translationRu: "Я читаю книгу в начальной школе.",
        translationEn: "I read a book at elementary school.",
      },
      sortOrder: 3,
    },
    {
      expression: "中学校",
      reading: "ちゅうがっこう",
      jmdictEntryId: "jmdict:1423650",
      meanings: {
        ru: {
          primary: "средняя школа первой ступени",
          accepted: ["средняя школа первой ступени", "младшая средняя школа"],
        },
        en: {
          primary: "junior high school",
          accepted: ["junior high school", "middle school", "lower secondary school"],
        },
      },
      meaningMnemonic: {
        ru: "Средняя 中 школа 学校 — ступень после начальной, а не старшая школа.",
        en: "Middle 中 school 学校 comes after elementary school, not senior high school.",
      },
      readingMnemonic: {
        ru: "В ちゅう сочетание ちゅ занимает одну мору, а う удлиняет гласный. В がっこう знак っ обозначает удвоение к.",
        en: "In ちゅう, ちゅ is one mora and う lengthens its vowel. In がっこう, っ marks a doubled /k/.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «средняя школа первой ступени».",
        en: "This card teaches the meaning 'junior high school'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: ちゅうがっこう.",
        en: "Write the entire word in kana: ちゅうがっこう.",
      },
      example: {
        japaneseText: "中学校は川の右にあります。",
        readingText: "ちゅうがっこうはかわのみぎにあります。",
        translationRu: "Младшая средняя школа находится справа от реки.",
        translationEn: "The junior high school is to the right of the river.",
      },
      sortOrder: 4,
    },
    {
      expression: "友人",
      reading: "ゆうじん",
      jmdictEntryId: "jmdict:1540150",
      meanings: {
        ru: {
          primary: "друг",
          accepted: ["друг", "подруга"],
        },
        en: {
          primary: "friend",
          accepted: ["friend"],
        },
      },
      meaningMnemonic: {
        ru: "友人 означает друга или подругу. Это более формальное слово, чем разговорное 友だち (ともだち).",
        en: "友人 means a friend and is more formal than the everyday 友だち (ともだち).",
      },
      readingMnemonic: {
        ru: "ゆう・じん: 人 здесь じん, а не にん.",
        en: "ゆう・じん: 人 is じん here, not にん.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «друг».",
        en: "This card teaches the meaning 'friend'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: ゆうじん.",
        en: "Write the entire word in kana: ゆうじん.",
      },
      example: {
        japaneseText: "友人と山に行きます。",
        readingText: "ゆうじんとやまにいきます。",
        translationRu: "Я иду в горы с другом.",
        translationEn: "I am going to the mountains with a friend.",
      },
      sortOrder: 5,
    },
    {
      expression: "友",
      reading: "とも",
      jmdictEntryId: "jmdict:1539980",
      meanings: {
        ru: {
          primary: "друг",
          accepted: ["друг", "подруга"],
        },
        en: {
          primary: "friend",
          accepted: ["friend"],
        },
      },
      meaningMnemonic: {
        ru: "友 означает друга или подругу и часто встречается в книжной или литературной речи. В повседневном разговоре чаще говорят 友だち (ともだち).",
        en: "友 means a friend and often has a literary tone. In everyday conversation, 友だち (ともだち) is more usual.",
      },
      readingMnemonic: {
        ru: "Отдельное слово 友 здесь とも; не отвечайте онным ゆう.",
        en: "The separate word 友 here is とも; do not answer with on reading ゆう.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «друг».",
        en: "This card teaches the meaning 'friend'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: とも.",
        en: "Write the entire word in kana: とも.",
      },
      example: {
        japaneseText: "友と本を読みます。",
        readingText: "ともとほんをよみます。",
        translationRu: "Я читаю книгу с другом.",
        translationEn: "I read a book with a friend.",
      },
      sortOrder: 6,
    },
    {
      expression: "父",
      reading: "ちち",
      jmdictEntryId: "jmdict:1497610",
      meanings: {
        ru: {
          primary: "отец",
          accepted: ["отец", "папа"],
        },
        en: {
          primary: "father",
          accepted: ["father", "dad"],
        },
      },
      meaningMnemonic: {
        ru: "Представьте своего отца: так обычно называют его в разговоре с людьми вне семьи, а не при обращении к нему.",
        en: "Picture your own father: this is the usual plain term when speaking about him to people outside your family, rather than addressing him.",
      },
      readingMnemonic: {
        ru: "ち・ち: две одинаковые моры. Не ふ и не おとうさん.",
        en: "ち・ち: two identical morae. Not ふ or おとうさん.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «отец».",
        en: "This card teaches the meaning 'father'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: ちち.",
        en: "Write the entire word in kana: ちち.",
      },
      example: {
        japaneseText: "父は車で学校に行きます。",
        readingText: "ちちはくるまでがっこうにいきます。",
        translationRu: "Мой отец едет в школу на машине.",
        translationEn: "My father goes to school by car.",
      },
      sortOrder: 7,
    },
    {
      expression: "母",
      reading: "はは",
      jmdictEntryId: "jmdict:1514990",
      meanings: {
        ru: {
          primary: "мать",
          accepted: ["мать", "мама"],
        },
        en: {
          primary: "mother",
          accepted: ["mother", "mom", "mum"],
        },
      },
      meaningMnemonic: {
        ru: "Так обычно говорят о своей матери собеседнику вне семьи, а не обращаются к ней.",
        en: "Use 母 when speaking about your own mother to someone outside your family, rather than addressing her.",
      },
      readingMnemonic: {
        ru: "は・は: два одинаковых знака хираганы. Здесь は не частица и не читается わ.",
        en: "は・は: both kana are pronounced は; this is not the particle は pronounced わ.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «мать».",
        en: "This card teaches the meaning 'mother'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: はは.",
        en: "Write the entire word in kana: はは.",
      },
      example: {
        japaneseText: "母は本を読みます。",
        readingText: "はははほんをよみます。",
        translationRu: "Моя мать читает книгу.",
        translationEn: "My mother reads a book.",
      },
      sortOrder: 8,
    },
    {
      expression: "父母",
      reading: "ふぼ",
      jmdictEntryId: "jmdict:1497690",
      meanings: {
        ru: {
          primary: "отец и мать",
          accepted: ["отец и мать", "родители"],
          blocked: [
            {
              text: "отец и брат",
              reason: "Отец и мать, не отец и брат.",
            },
          ],
        },
        en: {
          primary: "father and mother",
          accepted: ["father and mother", "parents"],
          blocked: [
            {
              text: "father and brother",
              reason: "Father and mother, not father and brother.",
            },
          ],
        },
      },
      meaningMnemonic: {
        ru: "Отец 父 и мать 母 вместе: оба родителя. 父母 не служит обращением к ним и не является вежливой формой 父 или 母.",
        en: "Father 父 and mother 母 together: both parents. 父母 is not a form of address or a polite form of 父 or 母.",
      },
      readingMnemonic: {
        ru: "Здесь учим онное чтение ふぼ. Чтение ちちはは тоже существует, но эта карточка его не проверяет.",
        en: "This card teaches the on reading ふぼ. ちちはは also exists, but is not tested here.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «отец и мать».",
        en: "This card teaches the meaning 'father and mother'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: ふぼ.",
        en: "Write the entire word in kana: ふぼ.",
      },
      example: {
        japaneseText: "父母はいえではなく学校にいます。",
        readingText: "ふぼはいえではなくがっこうにいます。",
        translationRu: "Родители не дома, а в школе.",
        translationEn: "The parents are at school, not at home.",
      },
      sortOrder: 9,
    },
    {
      expression: "兄",
      reading: "あに",
      jmdictEntryId: "jmdict:1249900",
      meanings: {
        ru: {
          primary: "старший брат",
          accepted: ["старший брат"],
          blocked: [
            {
              text: "старый брат",
              reason: "Нужен старший брат: не пожилой, не младший и не просто брат.",
            },
            {
              text: "младший брат",
              reason: "Нужен старший брат: не пожилой, не младший и не просто брат.",
            },
            {
              text: "брат",
              reason: "Нужен старший брат: не пожилой, не младший и не просто брат.",
            },
          ],
        },
        en: {
          primary: "older brother",
          accepted: ["older brother", "elder brother"],
          blocked: [
            {
              text: "other brother",
              reason: "Older brother, not another or younger brother; keep the age distinction.",
            },
            {
              text: "younger brother",
              reason: "Older brother, not another or younger brother; keep the age distinction.",
            },
            {
              text: "brother",
              reason: "Older brother, not another or younger brother; keep the age distinction.",
            },
          ],
        },
      },
      meaningMnemonic: {
        ru: "Представьте собственного старшего брата; возрастное отношение важно.",
        en: "Picture your own older brother; the age relationship matters.",
      },
      readingMnemonic: {
        ru: "あ・に: слово целиком, не онное けい.",
        en: "あ・に: the whole word, not on reading けい.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «старший брат».",
        en: "This card teaches the meaning 'older brother'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: あに.",
        en: "Write the entire word in kana: あに.",
      },
      example: {
        japaneseText: "兄は大学生です。",
        readingText: "あにはだいがくせいです。",
        translationRu: "Мой старший брат — студент университета.",
        translationEn: "My older brother is a university student.",
      },
      sortOrder: 10,
    },
    {
      expression: "姉",
      reading: "あね",
      jmdictEntryId: "jmdict:1307630",
      meanings: {
        ru: {
          primary: "старшая сестра",
          accepted: ["старшая сестра"],
          blocked: [
            {
              text: "старая сестра",
              reason: "Нужна старшая сестра: не пожилая, не младшая и не просто сестра.",
            },
            {
              text: "младшая сестра",
              reason: "Нужна старшая сестра: не пожилая, не младшая и не просто сестра.",
            },
            {
              text: "сестра",
              reason: "Нужна старшая сестра: не пожилая, не младшая и не просто сестра.",
            },
          ],
        },
        en: {
          primary: "older sister",
          accepted: ["older sister", "elder sister"],
          blocked: [
            {
              text: "other sister",
              reason: "Older sister, not another or younger sister; keep the age distinction.",
            },
            {
              text: "younger sister",
              reason: "Older sister, not another or younger sister; keep the age distinction.",
            },
            {
              text: "sister",
              reason: "Older sister, not another or younger sister; keep the age distinction.",
            },
          ],
        },
      },
      meaningMnemonic: {
        ru: "Вспомните старшую сестру; не заменяйте значение младшей сестрой.",
        en: "Think of an older sister; do not replace the meaning with younger sister.",
      },
      readingMnemonic: {
        ru: "あ・ね: последнее ね отличает слово от あに.",
        en: "あ・ね: final ね distinguishes the word from あに.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «старшая сестра».",
        en: "This card teaches the meaning 'older sister'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: あね.",
        en: "Write the entire word in kana: あね.",
      },
      example: {
        japaneseText: "姉は先生です。",
        readingText: "あねはせんせいです。",
        translationRu: "Моя старшая сестра — учитель.",
        translationEn: "My older sister is a teacher.",
      },
      sortOrder: 11,
    },
    {
      expression: "弟",
      reading: "おとうと",
      jmdictEntryId: "jmdict:1581930",
      meanings: {
        ru: {
          primary: "младший брат",
          accepted: ["младший брат"],
          blocked: [
            {
              text: "старший брат",
              reason: "Нужен младший брат, а не старший или просто брат.",
            },
            {
              text: "брат",
              reason: "Нужен младший брат, а не старший или просто брат.",
            },
          ],
        },
        en: {
          primary: "younger brother",
          accepted: ["younger brother"],
          blocked: [
            {
              text: "older brother",
              reason: "Younger brother, not an older brother; keep the age distinction.",
            },
            {
              text: "elder brother",
              reason: "Younger brother, not an older brother; keep the age distinction.",
            },
            {
              text: "brother",
              reason: "Younger brother, not an older brother; keep the age distinction.",
            },
          ],
        },
      },
      meaningMnemonic: {
        ru: "Представьте брата младше вас, а не просто любого брата.",
        en: "Picture a brother younger than you, not just any brother.",
      },
      readingMnemonic: {
        ru: "お・とう・と: после первого と есть う, а после последнего нет.",
        en: "お・とう・と: the first と is followed by う, but the final one is not.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «младший брат».",
        en: "This card teaches the meaning 'younger brother'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: おとうと.",
        en: "Write the entire word in kana: おとうと.",
      },
      example: {
        japaneseText: "弟は小学生です。",
        readingText: "おとうとはしょうがくせいです。",
        translationRu: "Мой младший брат — ученик начальной школы.",
        translationEn: "My younger brother is an elementary school student.",
      },
      sortOrder: 12,
    },
    {
      expression: "妹",
      reading: "いもうと",
      jmdictEntryId: "jmdict:1524590",
      meanings: {
        ru: {
          primary: "младшая сестра",
          accepted: ["младшая сестра"],
          blocked: [
            {
              text: "старшая сестра",
              reason: "Нужна младшая сестра, а не старшая или просто сестра.",
            },
            {
              text: "сестра",
              reason: "Нужна младшая сестра, а не старшая или просто сестра.",
            },
          ],
        },
        en: {
          primary: "younger sister",
          accepted: ["younger sister"],
          blocked: [
            {
              text: "older sister",
              reason: "Younger sister, not an older sister; keep the age distinction.",
            },
            {
              text: "elder sister",
              reason: "Younger sister, not an older sister; keep the age distinction.",
            },
            {
              text: "sister",
              reason: "Younger sister, not an older sister; keep the age distinction.",
            },
          ],
        },
      },
      meaningMnemonic: {
        ru: "Представьте сестру младше вас; знак 未 напоминает младший возраст.",
        en: "Picture a sister younger than you; 未 can remind you of younger age.",
      },
      readingMnemonic: {
        ru: "い・もう・と: начните с い, сохраните う после も.",
        en: "い・もう・と: start with い and keep う after も.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «младшая сестра».",
        en: "This card teaches the meaning 'younger sister'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: いもうと.",
        en: "Write the entire word in kana: いもうと.",
      },
      example: {
        japaneseText: "妹と学校に行きます。",
        readingText: "いもうととがっこうにいきます。",
        translationRu: "Я иду в школу с младшей сестрой.",
        translationEn: "I go to school with my younger sister.",
      },
      sortOrder: 13,
    },
    {
      expression: "兄弟",
      reading: "きょうだい",
      jmdictEntryId: "jmdict:1249960",
      meanings: {
        ru: {
          primary: "братья и сёстры",
          accepted: ["братья и сёстры", "братья"],
        },
        en: {
          primary: "siblings",
          accepted: ["siblings", "brothers", "brothers and sisters"],
        },
      },
      meaningMnemonic: {
        ru: "Старший 兄 и младший 弟 вместе могут обозначать братьев и сестёр; слово не ограничено парой братьев.",
        en: "Older 兄 and younger 弟 together can refer to siblings, not only a pair of brothers.",
      },
      readingMnemonic: {
        ru: "きょう (兄) + だい (弟): здесь используются другие онные чтения. Чтение けいてい тоже существует, но эта карточка учит きょうだい.",
        en: "きょう (兄) + だい (弟): this word uses different on readings. けいてい also exists, but this card teaches きょうだい.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «братья и сёстры».",
        en: "This card teaches the meaning 'siblings'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: きょうだい.",
        en: "Write the entire word in kana: きょうだい.",
      },
      example: {
        japaneseText: "わたしたちは三人兄弟です。",
        readingText: "わたしたちはさんにんきょうだいです。",
        translationRu: "Нас в семье трое детей.",
        translationEn: "I am one of three siblings.",
      },
      sortOrder: 14,
    },
    {
      expression: "姉妹",
      reading: "しまい",
      jmdictEntryId: "jmdict:1579490",
      meanings: {
        ru: {
          primary: "сёстры",
          accepted: ["сёстры"],
        },
        en: {
          primary: "sisters",
          accepted: ["sisters"],
        },
      },
      meaningMnemonic: {
        ru: "Старшая 姉 и младшая 妹 вместе — сёстры.",
        en: "Older sister 姉 and younger sister 妹 together are sisters.",
      },
      readingMnemonic: {
        ru: "し・まい: в отличие от あね и いもうと, здесь онные чтения.",
        en: "し・まい: unlike あね and いもうと, this word uses on readings.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «сёстры».",
        en: "This card teaches the meaning 'sisters'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: しまい.",
        en: "Write the entire word in kana: しまい.",
      },
      example: {
        japaneseText: "姉妹はおなじ学校に行きます。",
        readingText: "しまいはおなじがっこうにいきます。",
        translationRu: "Сёстры ходят в одну школу.",
        translationEn: "The sisters go to the same school.",
      },
      sortOrder: 15,
    },
    {
      expression: "今",
      reading: "いま",
      jmdictEntryId: "jmdict:1288850",
      meanings: {
        ru: {
          primary: "сейчас",
          accepted: ["сейчас", "теперь", "в данный момент"],
        },
        en: {
          primary: "now",
          accepted: ["now", "at present", "at the moment"],
        },
      },
      meaningMnemonic: {
        ru: "Представьте текущий момент: не вчера и не завтра.",
        en: "Picture the present moment: not yesterday or tomorrow.",
      },
      readingMnemonic: {
        ru: "い・ま: слово 今 не читается こん на этой карточке.",
        en: "い・ま: the word 今 is not read こん on this card.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «сейчас».",
        en: "This card teaches the meaning 'now'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: いま.",
        en: "Write the entire word in kana: いま.",
      },
      example: {
        japaneseText: "今、雨がふっています。",
        readingText: "いま、あめがふっています。",
        translationRu: "Сейчас идёт дождь.",
        translationEn: "It is raining now.",
      },
      sortOrder: 16,
    },
    {
      expression: "今日",
      reading: "きょう",
      jmdictEntryId: "jmdict:1579110",
      meanings: {
        ru: {
          primary: "сегодня",
          accepted: ["сегодня", "сегодняшний день"],
        },
        en: {
          primary: "today",
          accepted: ["today"],
        },
      },
      meaningMnemonic: {
        ru: "Сейчас 今 плюс день 日 — сегодняшний день.",
        en: "Now 今 plus day 日 suggests today.",
      },
      readingMnemonic: {
        ru: "Здесь учим чтение всего слова きょう. Сочетание きょ занимает одну мору, а う удлиняет гласный. Чтение こんじつ тоже существует, но здесь не проверяется.",
        en: "This card teaches the whole-word reading きょう. きょ is one mora, and う lengthens its vowel. こんじつ also exists, but is not tested here.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «сегодня».",
        en: "This card teaches the meaning 'today'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: きょう.",
        en: "Write the entire word in kana: きょう.",
      },
      example: {
        japaneseText: "今日は学校が休みです。",
        readingText: "きょうはがっこうがやすみです。",
        translationRu: "Сегодня в школе нет занятий.",
        translationEn: "There is no school today.",
      },
      sortOrder: 17,
    },
    {
      expression: "今年",
      reading: "ことし",
      jmdictEntryId: "jmdict:1579130",
      meanings: {
        ru: {
          primary: "этот год",
          accepted: ["этот год", "текущий год", "в этом году"],
        },
        en: {
          primary: "this year",
          accepted: ["this year", "the current year"],
        },
      },
      meaningMnemonic: {
        ru: "Сейчас 今 плюс год 年 — текущий год.",
        en: "Now 今 plus year 年 suggests the current year.",
      },
      readingMnemonic: {
        ru: "Здесь учим чтение всего слова ことし. Чтение こんねん тоже существует, но эта карточка его не проверяет.",
        en: "This card teaches the whole-word reading ことし. こんねん also exists, but is not tested here.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «этот год».",
        en: "This card teaches the meaning 'this year'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: ことし.",
        en: "Write the entire word in kana: ことし.",
      },
      example: {
        japaneseText: "今年は大学に入学します。",
        readingText: "ことしはだいがくににゅうがくします。",
        translationRu: "В этом году я поступаю в университет.",
        translationEn: "I am entering university this year.",
      },
      sortOrder: 18,
    },
    {
      expression: "何",
      reading: "なに",
      jmdictEntryId: "jmdict:1577100",
      meanings: {
        ru: {
          primary: "что",
          accepted: ["что"],
        },
        en: {
          primary: "what",
          accepted: ["what"],
        },
      },
      meaningMnemonic: {
        ru: "Вопрос 何 помогает узнать название неизвестного предмета.",
        en: "The question 何 helps identify an unknown object.",
      },
      readingMnemonic: {
        ru: "Здесь なに. Перед некоторыми словами встречается なん, но это не ответ этой карточки.",
        en: "Here use なに. Before some words it becomes なん, but that is not this card's answer.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «что».",
        en: "This card teaches the meaning 'what'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: なに.",
        en: "Write the entire word in kana: なに.",
      },
      example: {
        japaneseText: "何を読みますか。",
        readingText: "なにをよみますか。",
        translationRu: "Что вы читаете?",
        translationEn: "What are you reading?",
      },
      sortOrder: 19,
    },
    {
      expression: "何人",
      reading: "なんにん",
      jmdictEntryId: "jmdict:1189100",
      meanings: {
        ru: {
          primary: "сколько человек",
          accepted: ["сколько человек"],
        },
        en: {
          primary: "how many people",
          accepted: ["how many people"],
        },
      },
      meaningMnemonic: {
        ru: "Вопрос 何 перед счётчиком людей 人 спрашивает количество, не национальность.",
        en: "Question 何 before the counter 人 asks a number of people, not nationality.",
      },
      readingMnemonic: {
        ru: "なん・にん: две ん. Чтение なにじん имеет другое значение и здесь не принимается.",
        en: "なん・にん: keep both ん. なにじん has a different meaning and is not accepted here.",
      },
      meaningHint: {
        ru: "Здесь изучаем значение «сколько человек».",
        en: "This card teaches the meaning 'how many people'.",
      },
      readingHint: {
        ru: "Напишите всё слово каной: なんにん.",
        en: "Write the entire word in kana: なんにん.",
      },
      example: {
        japaneseText: "学生は何人いますか。",
        readingText: "がくせいはなんにんいますか。",
        translationRu: "Сколько студентов?",
        translationEn: "How many students are there?",
      },
      sortOrder: 20,
    },
  ],
};

export function buildMainCourseWordBatch07(): MainCourseWordBatch {
  return BATCH;
}
