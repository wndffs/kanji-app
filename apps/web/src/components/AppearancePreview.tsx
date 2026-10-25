import { type TranslationDisplayMode } from "@kanji-srs/shared";
import { JapaneseText } from "./JapaneseText";

export function AppearancePreview({ mode }: { readonly mode: TranslationDisplayMode }) {
  return (
    <figure className="appearance-preview" data-item-type="kanji" data-settings-group="appearance">
      <figcaption>Предпросмотр</figcaption>
      <span className="eyebrow">Кандзи</span>
      <JapaneseText className="appearance-preview-glyph" variant="display">
        日
      </JapaneseText>
      <JapaneseText className="appearance-preview-reading">にち</JapaneseText>
      <div>
        {mode !== "en" ? <span lang="ru">день</span> : null}
        {mode !== "ru" ? <span lang="en">day</span> : null}
      </div>
    </figure>
  );
}
