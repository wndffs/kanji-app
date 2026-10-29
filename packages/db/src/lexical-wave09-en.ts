import { type Wave09LocalizedTeaching } from "./lexical-wave09-ru";

const row = (
  accepted: readonly string[],
  mnemonic: string,
  scope: string,
  blocked: readonly string[] = [],
): Wave09LocalizedTeaching => ({
  meanings: {
    primary: accepted[0]!,
    accepted,
    ...(blocked.length
      ? {
          blocked: blocked.map((text) => ({
            text,
            reason:
              "This is not the selected sense of this card. Other real dictionary senses are not being declared invalid Japanese.",
          })),
        }
      : {}),
  },
  mnemonic,
  scope,
});
export const WAVE09_EN: Readonly<Record<string, Wave09LocalizedTeaching>> = {
  話す: row(
    ["to speak", "speak", "to talk", "talk", "to tell", "tell"],
    "The mouth and tongue shapes in 話 suggest speaking. In 話す, 話 supplies はな and す is written as okurigana.",
    "Spoken communication: speaking, talking or telling. Not homophone 離す, to release.",
    ["release", "to release", "listen", "to listen"],
  ),
  休む: row(
    ["to rest", "rest", "to take a break", "take a break"],
    "A person by a tree 休 takes a break; む completes the action word.",
    "This card selects resting, not every absence or missed-work sense.",
    ["work", "to work"],
  ),
  立つ: row(
    ["to stand", "stand", "to stand up", "stand up", "to get up", "get up"],
    "Imagine the 立 figure standing on its bottom line; keep つ at the end of the word.",
    "Standing or rising to one's feet. Figurative senses are separate.",
    ["sit", "to sit"],
  ),
  分かる: row(
    ["to understand", "understand", "to be clear", "be clear", "to become clear", "become clear"],
    "Imagine a tangled idea separating into clear parts 分: now it makes sense.",
    "Understanding or becoming clear. Not dividing something, 分ける.",
    ["divide", "to divide", "separate", "to separate"],
  ),
  知る: row(
    ["to know", "know", "to find out", "find out", "to learn a fact", "learn a fact"],
    "An arrow 矢 points at a mouth 口: imagine learning the answer and being able to say it.",
    "Knowing or acquiring a fact, not studying a subject. 知っている expresses already knowing; not identical to understanding 分かる.",
    ["forget", "to forget"],
  ),
  使う: row(
    ["to use", "use", "to make use of", "make use of"],
    "A person 亻 beside the 吏 shape uses an object: an invented visual cue.",
    "Using an object or means, not making it: 作る.",
    ["make", "to make", "create", "to create"],
  ),
  作る: row(
    [
      "to make",
      "make",
      "to create",
      "create",
      "to produce",
      "produce",
      "to cook",
      "cook",
      "to prepare food",
      "prepare food",
    ],
    "A person 亻 makes steps from 乍: a new object appears.",
    "Making or producing something, including preparing a dish; not just using a finished object.",
    ["use", "to use"],
  ),
  帰る: row(
    ["to return", "return", "to go home", "go home", "to come home", "come home"],
    "Imagine the broom shape on the right of 帰 left at home: time to return to it.",
    "Returning oneself home or to an original place. Not changing something or returning an object.",
    ["change", "to change", "give back", "to give back"],
  ),
  白い: row(
    ["white"],
    "Familiar white 白 gains い: now describe a white object.",
    "The colour white, expressed as an adjective ending in い.",
    ["red", "black"],
  ),
  赤い: row(
    ["red"],
    "Imagine 赤 on a red car; い connects the colour with the object.",
    "The colour red, not a different colour.",
    ["white"],
  ),
  多い: row(
    ["many", "much", "numerous", "a lot", "a lot of"],
    "The repeated shapes in 多 suggest abundance; keep the final い.",
    "A large quantity; not 多分, probably, or an adjective meaning physically big.",
    ["few", "little", "big"],
  ),
  読書: row(
    ["reading", "reading books", "book reading"],
    "Reading 読 and writing/book 書 join into the activity of reading books.",
    "Reading books as an activity, not writing a text.",
    ["writing"],
  ),
  今月: row(
    ["this month", "the current month", "current month"],
    "Now 今 applies to month 月: highlight the current calendar month.",
    "The current calendar month, not last month or every month.",
    ["last month", "every month"],
  ),
  今後: row(
    ["from now on", "in future", "in the future", "hereafter", "henceforth"],
    "After 後 the present moment 今 stretches the time ahead: what happens from now on.",
    "The period following now, not the past.",
    ["before", "until now"],
  ),
  何時: row(
    ["what time", "at what time"],
    "Question 何 joins hour 時: ask for the time on a clock.",
    "A clock-time question, なんじ. The spelling has other readings; this is not the general 'when' reading いつ.",
    ["how many hours", "how many times"],
  ),
  毎日: row(
    ["every day", "daily", "each day"],
    "Put an 毎 mark on every 日 day, not only today.",
    "Every day, not only today.",
    ["today", "every month"],
  ),
  毎月: row(
    ["every month", "monthly", "each month"],
    "Move the 毎 mark across all 月 months on a calendar.",
    "Every month. This pair selects まいつき; まいげつ is a real variant.",
    ["this month", "every day"],
  ),
  毎年: row(
    ["every year", "yearly", "annually", "each year"],
    "Mark a repeating event in every 毎 year 年.",
    "Every year. Learn selected まいとし; まいねん is a real variant.",
    ["this year", "every month"],
  ),
  時間: row(
    ["time", "hour", "hours", "duration", "period of time"],
    "Hour 時 and interval 間 suggest the time an activity occupies.",
    "Time or an interval; when counted, hours of duration rather than a clock-time question.",
    ["what time"],
  ),
  語学: row(
    [
      "language study",
      "study of languages",
      "study of foreign languages",
      "language learning",
      "knowledge of foreign languages",
    ],
    "Language 語 meets study 学: imagine a foreign-language lesson.",
    "This card selects studying or knowing foreign languages. Linguistics is another dictionary sense, not this card's target.",
  ),
};
