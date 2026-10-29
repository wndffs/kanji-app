import { type MainCourseWordContent } from "./main-course-word-content";
const example = (japaneseText: string, readingText: string, translationRu: string, translationEn: string): MainCourseWordContent["example"] => ({ japaneseText, readingText, translationRu, translationEn });

// Project-authored context, not copied dictionary or competitor examples.
export const WAVE09_EXAMPLES: Readonly<Record<string, MainCourseWordContent["example"]>> = {
  話す: example("友人と日本語で話します。", "ゆうじんとにほんごではなします。", "Я разговариваю с другом по-японски.", "I speak Japanese with a friend."),
  休む: example("今日は休みます。", "きょうはやすみます。", "Сегодня я отдыхаю.", "I am taking a break today."),
  立つ: example("先生は門の前に立っています。", "せんせいはもんのまえにたっています。", "Учитель стоит перед воротами.", "The teacher is standing in front of the gate."),
  分かる: example("この話はよく分かります。", "このはなしはよくわかります。", "Я хорошо понимаю этот рассказ.", "I understand this story well."),
  知る: example("その人の名前を知っています。", "そのひとのなまえをしっています。", "Я знаю имя этого человека.", "I know that person's name."),
  使う: example("この車を毎日使います。", "このくるまをまいにちつかいます。", "Я пользуюсь этой машиной каждый день.", "I use this car every day."),
  作る: example("今日は小さいいすを作ります。", "きょうはちいさいいすをつくります。", "Сегодня я делаю маленький стул.", "I am making a small chair today."),
  帰る: example("午後六時に帰ります。", "ごごろくじにかえります。", "Я возвращаюсь в шесть вечера.", "I return at six p.m."),
  白い: example("白い花が二つあります。", "しろいはながふたつあります。", "Здесь два белых цветка.", "There are two white flowers."),
  赤い: example("赤い車が学校の前にあります。", "あかいくるまががっこうのまえにあります。", "Перед школой стоит красная машина.", "There is a red car in front of the school."),
  多い: example("この学校は学生が多いです。", "このがっこうはがくせいがおおいです。", "В этой школе много учащихся.", "This school has many students."),
  読書: example("休日は読書をします。", "きゅうじつはどくしょをします。", "В выходные я читаю книги.", "I read books on my days off."),
  今月: example("今月は本を三つ読みます。", "こんげつはほんをみっつよみます。", "В этом месяце я прочитаю три книги.", "I will read three books this month."),
  今後: example("今後も日本語を学びます。", "こんごもにほんごをまなびます。", "Я и дальше буду изучать японский.", "I will continue studying Japanese from now on."),
  何時: example("今、何時ですか。", "いま、なんじですか。", "Который сейчас час?", "What time is it now?"),
  毎日: example("毎日、学校で日本語を話します。", "まいにち、がっこうでにほんごをはなします。", "Я каждый день говорю по-японски в школе.", "I speak Japanese at school every day."),
  毎月: example("毎月、友人に会います。", "まいつき、ゆうじんにあいます。", "Я встречаюсь с другом каждый месяц.", "I meet a friend every month."),
  毎年: example("毎年、山に行きます。", "まいとし、やまにいきます。", "Каждый год я езжу в горы.", "I go to the mountains every year."),
  時間: example("読書の時間がありません。", "どくしょのじかんがありません。", "У меня нет времени на чтение.", "I have no time for reading."),
  語学: example("語学の本を読みます。", "ごがくのほんをよみます。", "Я читаю книги для изучения языков.", "I read books for language learning."),
};
