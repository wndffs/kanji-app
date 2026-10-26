import { type InterfacePreferences, type TranslationDisplayMode } from "@kanji-srs/shared";
import { Monitor, Moon, Sun } from "lucide-react";
import { JapaneseText } from "./JapaneseText";

export function AppearancePreview({ mode, preferences }: {
  readonly mode: TranslationDisplayMode;
  readonly preferences: Pick<InterfacePreferences, "interfaceTheme" | "interfaceDensity">;
}) {
  const Icon = preferences.interfaceTheme === "dark" ? Moon : preferences.interfaceTheme === "light" ? Sun : Monitor;
  const theme = { system: "Системная", light: "Светлая", dark: "Тёмная" }[preferences.interfaceTheme];
  return (
    <figure className="appearance-preview" data-item-type="kanji" data-settings-group="appearance" data-preview-theme={preferences.interfaceTheme} data-preview-density={preferences.interfaceDensity}>
      <figcaption>
        <span><Icon size={15} aria-hidden="true" />{theme}</span>
        <span>{preferences.interfaceDensity === "compact" ? "Компактная" : "Обычная"}</span>
      </figcaption>
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
