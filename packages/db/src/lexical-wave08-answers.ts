import { type MainCourseAcceptedMeanings } from "./main-course-content";

const ru = (
  accepted: readonly string[],
  blocked: readonly string[] = [],
): MainCourseAcceptedMeanings => ({
  primary: accepted[0]!,
  accepted,
  ...(blocked.length
    ? {
        blocked: blocked.map((text) => ({
          text,
          reason:
            "В этой карточке выбран другой смысл или направление действия; это не утверждение обо всех значениях слова.",
        })),
      }
    : {}),
});
export const WAVE08_RU: Readonly<Record<string, MainCourseAcceptedMeanings>> = {
  食べる: ru(["есть", "кушать"], ["быть", "пить"]),
  飲む: ru(["пить", "выпить"], ["есть"]),
  行く: ru(["идти", "ехать", "отправляться"], ["приходить"]),
  会う: ru(["встречаться", "встретиться"], ["покупать"]),
  入る: ru(["входить", "войти", "заходить", "зайти"], ["выходить", "класть внутрь"]),
  出る: ru(["выходить", "выйти"], ["входить", "вынимать"]),
  見る: ru(["смотреть", "видеть"], ["слушать", "сидеть"]),
  聞く: ru(["слушать", "слышать"], ["смотреть", "спрашивать"]),
  読む: ru(["читать", "прочитать"], ["писать"]),
  書く: ru(["писать", "написать"], ["читать"]),
  大きい: ru(["большой", "крупный"], ["маленький"]),
  小さい: ru(["маленький", "небольшой"], ["большой"]),
  早い: ru(["ранний", "рано"], ["быстрый", "поздний"]),
  長い: ru(["длинный", "долгий", "длительный"], ["высокий", "короткий"]),
  正しい: ru(["правильный", "верный", "корректный"], ["справа", "направо"]),
  午前: ru(["до полудня", "первая половина дня", "утро"], ["после полудня"]),
  午後: ru(["после полудня", "вторая половина дня"], ["до полудня"]),
  名前: ru(["имя", "название", "кличка"]),
  日本語: ru(["японский язык", "японский"], ["японец"]),
  外国語: ru(["иностранный язык"]),
};

const en = (
  accepted: readonly string[],
  blocked: readonly string[] = [],
): MainCourseAcceptedMeanings => ({
  primary: accepted[0]!,
  accepted,
  ...(blocked.length
    ? {
        blocked: blocked.map((text) => ({
          text,
          reason:
            "This card selects another sense or action direction; other dictionary senses are not being declared invalid Japanese.",
        })),
      }
    : {}),
});
export const WAVE08_EN: Readonly<Record<string, MainCourseAcceptedMeanings>> = {
  食べる: en(["to eat", "eat"], ["to drink", "drink"]),
  飲む: en(["to drink", "drink"], ["to eat", "eat"]),
  行く: en(["to go", "go"], ["to come", "come"]),
  会う: en(["to meet", "meet"]),
  入る: en(
    ["to enter", "enter", "to go in", "go in"],
    ["to go out", "go out", "to put in", "put in"],
  ),
  出る: en(
    ["to go out", "go out", "to leave", "leave"],
    ["to enter", "enter", "to take out", "take out"],
  ),
  見る: en(
    ["to see", "see", "to look", "look", "to look at", "look at", "to watch", "watch"],
    ["to hear", "hear"],
  ),
  聞く: en(
    ["to listen", "listen", "to listen to", "listen to", "to hear", "hear"],
    ["to ask", "ask", "to wear", "wear"],
  ),
  読む: en(["to read", "read"], ["to write", "write"]),
  書く: en(["to write", "write"], ["to read", "read"]),
  大きい: en(["big", "large"], ["small"]),
  小さい: en(["small", "little"], ["big", "smell"]),
  早い: en(["early"], ["fast", "late", "nearly"]),
  長い: en(["long", "lengthy"], ["tall", "short"]),
  正しい: en(["correct", "right", "accurate"], ["right side", "rightward", "night"]),
  午前: en(["before noon", "a.m.", "morning"], ["after noon", "p.m."]),
  午後: en(["after noon", "afternoon", "p.m."], ["before noon", "a.m."]),
  名前: en(["name"]),
  日本語: en(["Japanese language", "Japanese"], ["Japanese person"]),
  外国語: en(["foreign language"]),
};
