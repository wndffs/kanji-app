import { type MainCourseLocalizedText } from "./main-course-content";
const note = (ru:string,en:string):MainCourseLocalizedText => ({ru,en});

export const WAVE08_READINGS:Readonly<Record<string,MainCourseLocalizedText>> = {
  食べる:note("た・べ・る: в этом слове 食 читается た; べる — окуригана, кана после кандзи. Здесь не чтение しょく из сложных слов.","た・べ・る: 食 supplies た in this word; べる is okurigana, the kana written after the kanji. Do not use the compound reading しょく here."),
  飲む:note("の・む: сохраните む. Онное いん нужно для других слов, не этого глагола.","の・む: retain む. The on reading いん belongs to other words, not this verb."),
  行く:note("Здесь учим いく. Вариант ゆく действительно существует, но эта карточка проверяет только выбранное いく.","Learn いく here. ゆく is a real variant, but this card tests only the selected いく."),
  会う:note("あ・う: оба знака сохраняются; не подставляйте かい из 会社.","あ・う: keep both kana; do not substitute かい from 会社."),
  入る:note("は・い・る: здесь はいる, а не にゅう из 入学. Выучите слово целиком.","は・い・る: here use はいる, not にゅう from 入学. Learn the entire word."),
  出る:note("で・る: здесь でる, а не しゅつ из 出国. Окончание る — часть слова.","で・る: use でる, not しゅつ from 出国. The ending る is part of the word."),
  見る:note("み・る: здесь みる. Не переносите онное けん в это слово.","み・る: use みる here. Do not transfer the on reading けん into this word."),
  聞く:note("き・く: здесь きく. Значение «спрашивать» также бывает у этого слова, но здесь выбран звуковой смысл.","き・く: use きく. Asking is another real sense of this word; this card selects the sound-related sense."),
  読む:note("よ・む: здесь よむ, не どく из 読書. Следите за конечным む.","よ・む: use よむ, not どく from 読書. Keep the final む."),
  書く:note("か・く: здесь かく, не しょ из 読書. Следите за конечным く.","か・く: use かく, not しょ from 読書. Keep the final く."),
  大きい:note("お・お・き・い: два お и конечное い. Здесь おお, не おう.","お・お・き・い: two お and a final い. Here write おお, not おう."),
  小さい:note("ち・い・さ・い: не теряйте первое い и не заменяйте ち на し.","ち・い・さ・い: do not drop the first い or replace ち with し."),
  早い:note("は・や・い: や обычного размера. В этой карточке выбран временной смысл «рано».","は・や・い: use full-sized や. This card selects the time-related meaning early."),
  長い:note("な・が・い: здесь ながい, а не ちょう. Сохраните звонкое が.","な・が・い: use ながい, not ちょう. Keep the voiced が."),
  正しい:note("た・だ・し・い: пишите всё ただしい, включая конечное い.","た・だ・し・い: write all of ただしい, including the final い."),
  午前:note("ご・ぜ・ん: здесь 前 даёт выбранное онное ぜん. Последний знак — ん, не う.","ご・ぜ・ん: 前 supplies the selected on reading ぜん. The last kana is ん, not う."),
  午後:note("ご・ご: две одинаковые моры, без долгого гласного между ними.","ご・ご: two identical morae, with no long vowel between them."),
  名前:note("な・ま・え: здесь 前 читается まえ, не ぜん из 午前. Чтение подтверждается для целого слова.","な・ま・え: here 前 is まえ, not ぜん from 午前. Verify and learn the whole-word reading."),
  日本語:note("に・ほ・ん・ご: здесь отрабатываем にほんご. Словарный вариант этого же слова にっぽんご тоже существует, но эта карточка его не проверяет.","に・ほ・ん・ご: this card selects にほんご. にっぽんご is also a dictionary variant of this same word, but is not tested by this card."),
  外国語:note("が・い・こ・く・ご: сохраните こく в середине. Звонкое ご относится к последнему 語.","が・い・こ・く・ご: keep こく in the middle. Voiced ご belongs to the final 語."),
};
