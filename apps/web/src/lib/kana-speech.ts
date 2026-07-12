import { type KanaLessonItemDto } from "@kanji-srs/shared";

export function buildKanaSpeechText(
  item: Pick<KanaLessonItemDto, "character" | "variant">,
): string {
  if (item.variant !== "sokuon") {
    return item.character;
  }

  const characters = Array.from(item.character);
  const followingKana = characters.slice(1).join("");

  return followingKana === "" ? item.character : `${followingKana}${item.character}`;
}
