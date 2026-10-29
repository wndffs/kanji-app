import { type MainCourseLocalizedText } from "./main-course-content";
const note = (ru: string, en: string): MainCourseLocalizedText => ({ ru, en });
export const WAVE09_READINGS: Readonly<Record<string, MainCourseLocalizedText>> = {
  話す: note(
    "は・な・す: 話 здесь はな, а す — окуригана. Не подставляйте わ из сложных слов.",
    "は・な・す: 話 supplies はな; す is okurigana. Do not substitute compound reading わ.",
  ),
  休む: note(
    "や・す・む: 休 здесь やす; конечное む — часть слова. Онное きゅう нужно для других слов.",
    "や・す・む: 休 supplies やす; final む is part of the word. On reading きゅう belongs to other words.",
  ),
  立つ: note(
    "た・つ: 立 здесь た. Сохраните つ; это не онное りつ.",
    "た・つ: 立 supplies た. Keep つ; this is not on reading りつ.",
  ),
  分かる: note(
    "わ・か・る: 分 здесь わ, а かる написано каной. ぶん относится к другим словам.",
    "わ・か・る: 分 supplies わ; かる is written in kana. ぶん belongs to other words.",
  ),
  知る: note(
    "し・る: здесь кунное し, не онное ち. В 知っています форма меняется, но ответ карточки — словарное しる.",
    "し・る: kun reading し, not on reading ち. 知っています is inflected; the card expects dictionary form しる.",
  ),
  使う: note(
    "つ・か・う: 使 здесь つか. Не теряйте конечное う и не путайте с つくる.",
    "つ・か・う: 使 supplies つか. Keep final う and distinguish つかう from つくる.",
  ),
  作る: note(
    "つ・く・る: 作 здесь つく, а る — окуригана. Это не さくる и не つかう.",
    "つ・く・る: 作 supplies つく and る is okurigana. Not さくる or つかう.",
  ),
  帰る: note(
    "か・え・る: 帰 здесь かえ. Сохраните え; одноимённые по звучанию слова могут иметь другие значения и написания.",
    "か・え・る: 帰 supplies かえ. Keep え; homophones can have other meanings and spellings.",
  ),
  白い: note(
    "し・ろ・い: 白 здесь しろ. Конечное い — часть прилагательного, а はく используется в других словах.",
    "し・ろ・い: 白 supplies しろ. Final い belongs to the adjective; はく is used in other words.",
  ),
  赤い: note(
    "あ・か・い: 赤 здесь あか. Окончание い обязательно; せき — не чтение этого слова.",
    "あ・か・い: 赤 supplies あか. Keep final い; せき is not this word's reading.",
  ),
  多い: note(
    "お・お・い: два お, затем い; не おうい. 多 здесь おお.",
    "お・お・い: two お followed by い, not おうい. 多 supplies おお.",
  ),
  読書: note(
    "ど・く・しょ: 読 = どく, 書 = しょ. Маленькая ょ образует しょ, не しよ.",
    "ど・く・しょ: 読 = どく and 書 = しょ. Small ょ forms しょ, not しよ.",
  ),
  今月: note(
    "こ・ん・げ・つ: 今 = こん, 月 = げつ. Здесь не いまつき.",
    "こ・ん・げ・つ: 今 = こん and 月 = げつ. Not いまつき.",
  ),
  今後: note(
    "こ・ん・ご: 今 = こん, 後 = ご. Не подставляйте うしろ из другого слова.",
    "こ・ん・ご: 今 = こん and 後 = ご. Do not substitute うしろ from another word.",
  ),
  何時: note(
    "な・ん・じ: 何 = なん, 時 = じ. いつ — настоящее другое чтение того же написания, но не выбранная здесь пара.",
    "な・ん・じ: 何 = なん and 時 = じ. いつ is a real different reading of the same spelling, not this selected pair.",
  ),
  毎日: note(
    "ま・い・に・ち: 毎 = まい, 日 = にち. Это не まいひ.",
    "ま・い・に・ち: 毎 = まい and 日 = にち. Not まいひ.",
  ),
  毎月: note(
    "ま・い・つ・き: здесь 月 = つき. まいげつ тоже существует; эта точная словарная пара проверяет まいつき.",
    "ま・い・つ・き: 月 supplies つき here. まいげつ also exists; this exact dictionary pair tests まいつき.",
  ),
  毎年: note(
    "ま・い・と・し: здесь 年 = とし. まいねん — настоящий вариант; карточка проверяет выбранное まいとし.",
    "ま・い・と・し: 年 supplies とし here. まいねん is a real variant; the card tests selected まいとし.",
  ),
  時間: note(
    "じ・か・ん: 時 = じ, 間 = かん. Не превращайте か в が и не теряйте ん.",
    "じ・か・ん: 時 = じ and 間 = かん. Keep か unvoiced and retain ん.",
  ),
  語学: note(
    "ご・が・く: 語 = ご, 学 = がく. Оба начальных согласных звонкие; не こかく.",
    "ご・が・く: 語 = ご and 学 = がく. Both initial consonants are voiced, not こかく.",
  ),
};
