import { type MainCourseWordContent } from "./main-course-word-content";
type Example=MainCourseWordContent["example"];
const example=(japaneseText:string,readingText:string,translationRu:string,translationEn:string):Example=>({japaneseText,readingText,translationRu,translationEn});
export const WAVE08_EXAMPLES:Readonly<Record<string,Example>> = {
  食べる:example("わたしは学校でごはんを食べる。","わたしはがっこうでごはんをたべる。","Я ем в школе.","I eat a meal at school."),
  飲む:example("父は水を飲む。","ちちはみずをのむ。","Отец пьёт воду.","My father drinks water."),
  行く:example("わたしは友人と学校に行く。","わたしはゆうじんとがっこうにいく。","Я иду в школу с другом.","I go to school with a friend."),
  会う:example("わたしは学校で先生に会う。","わたしはがっこうでせんせいにあう。","Я встречаюсь с учителем в школе.","I meet a teacher at school."),
  入る:example("子どもがへやに入る。","こどもがへやにはいる。","Ребёнок входит в комнату.","A child enters the room."),
  出る:example("子どもがへやから出る。","こどもがへやからでる。","Ребёнок выходит из комнаты.","A child goes out of the room."),
  見る:example("わたしは山を見る。","わたしはやまをみる。","Я смотрю на гору.","I look at the mountain."),
  聞く:example("わたしは鳥のこえを聞く。","わたしはとりのこえをきく。","Я слушаю голос птицы.","I listen to a bird's call."),
  読む:example("わたしは学校で本を読む。","わたしはがっこうでほんをよむ。","Я читаю книгу в школе.","I read a book at school."),
  書く:example("わたしは名前を書く。","わたしはなまえをかく。","Я записываю имя.","I write a name."),
  大きい:example("この犬は大きい。","このいぬはおおきい。","Эта собака большая.","This dog is big."),
  小さい:example("この花は小さい。","このはなはちいさい。","Этот цветок маленький.","This flower is small."),
  早い:example("まだ学校に行くには早い。","まだがっこうにいくにははやい。","Ещё рано идти в школу.","It is still too early to go to school."),
  長い:example("この川は長い。","このかわはながい。","Эта река длинная.","This river is long."),
  正しい:example("このこたえは正しい。","このこたえはただしい。","Этот ответ правильный.","This answer is correct."),
  午前:example("わたしは午前九時に学校に行く。","わたしはごぜんくじにがっこうにいく。","Я иду в школу в девять утра.","I go to school at nine a.m."),
  午後:example("わたしは午後三時に本を読む。","わたしはごごさんじにほんをよむ。","Я читаю книгу в три часа дня.","I read a book at three p.m."),
  名前:example("わたしは犬の名前を書く。","わたしはいぬのなまえをかく。","Я записываю кличку собаки.","I write the dog's name."),
  日本語:example("わたしは学校で日本語をまなぶ。","わたしはがっこうでにほんごをまなぶ。","Я изучаю японский язык в школе.","I learn Japanese at school."),
  外国語:example("わたしは学校で外国語をまなぶ。","わたしはがっこうでがいこくごをまなぶ。","Я изучаю иностранный язык в школе.","I learn a foreign language at school."),
};
