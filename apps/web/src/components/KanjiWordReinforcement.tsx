import Link from "next/link";
import { type ItemDetails, type TranslationDisplayMode } from "@kanji-srs/shared";

import { JapaneseText } from "./JapaneseText";
import { selectReinforcementWords } from "../lib/item-reinforcement";

export function KanjiWordReinforcement({
  item,
  contextHref,
  displayMode,
  hideReadings,
}: {
  readonly item: ItemDetails;
  readonly contextHref: string;
  readonly displayMode: TranslationDisplayMode;
  readonly hideReadings: boolean;
}) {
  const words = selectReinforcementWords(item);
  const query = new URL(contextHref, "https://kanji.invalid").search;
  if (words.length === 0) return null;
  return (
    <div className="content-block">
      <h3>Закрепление в словах</h3>
      <ul className="reading-chip-list">
        {words.map((word) => (
          <li key={word.id}>
            <Link href={`/items/${word.id}${query}`} className="inline-link">
              <JapaneseText>{word.japanese}</JapaneseText>
              {word.reading && !hideReadings ? (
                <>
                  {" "}
                  · <JapaneseText>{word.reading}</JapaneseText>
                </>
              ) : null}
              {displayMode !== "en" && word.translations.primaryRu
                ? ` · ${word.translations.primaryRu}`
                : ""}
              {displayMode !== "ru" && word.translations.primaryEn
                ? ` · ${word.translations.primaryEn}`
                : ""}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
