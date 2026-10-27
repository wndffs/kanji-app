"use client";
import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { normalizeCharacterSearch } from "../lib/character-hub";

export function CharacterCatalogueSearch({
  value,
  onSearch,
}: {
  readonly value: string;
  readonly onSearch: (query: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const composing = useRef(false);
  return (
    <form
      className="character-catalogue-search"
      role="search"
      aria-label="Поиск кандзи"
      onSubmit={(event) => {
        event.preventDefault();
        if (!composing.current) onSearch(normalizeCharacterSearch(draft));
      }}
    >
      <label htmlFor="character-catalogue-query">Поиск кандзи</label>
      <div>
        <input
          id="character-catalogue-query"
          type="search"
          maxLength={80}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (composing.current ||
                event.nativeEvent.isComposing ||
                event.nativeEvent.keyCode === 229)
            )
              event.preventDefault();
          }}
        />
        <button
          className="icon-button"
          type="submit"
          aria-label="Найти кандзи"
          title="Найти кандзи"
        >
          <Search size={18} aria-hidden="true" />
        </button>
        {draft || value ? (
          <button
            className="icon-button"
            type="button"
            aria-label="Очистить поиск кандзи"
            title="Очистить поиск"
            onClick={() => {
              setDraft("");
              onSearch("");
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </form>
  );
}
