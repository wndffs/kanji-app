"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  type BilingualTextDto,
  type ItemDetails,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { getItemDetails } from "../lib/api-client";
import { ownsSession } from "../lib/use-stored-session";
import { JapaneseText } from "./JapaneseText";
import { SectionDisclosure } from "./SectionDisclosure";

type BreakdownState =
  | { readonly status: "idle" | "loading" | "error" }
  | { readonly status: "ready"; readonly item: ItemDetails };

export function ReviewItemBreakdown({
  itemId,
  token,
  displayMode,
}: {
  readonly itemId: string;
  readonly token: string;
  readonly displayMode: TranslationDisplayMode;
}) {
  const [state, setState] = useState<BreakdownState>({ status: "idle" });
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  async function load() {
    if (pending.current !== null || state.status === "ready" || !ownsSession(token)) return;
    const controller = new AbortController();
    pending.current = controller;
    setState({ status: "loading" });
    try {
      const item = await getItemDetails(itemId, token, { signal: controller.signal });
      if (controller.signal.aborted || !ownsSession(token)) return;
      if (item.id !== itemId) throw new Error("Unexpected review item.");
      setState({ status: "ready", item });
    } catch {
      if (!controller.signal.aborted && ownsSession(token)) setState({ status: "error" });
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }

  return (
    <SectionDisclosure
      title="Разбор карточки"
      onOpen={() => {
        if (state.status === "idle") void load();
      }}
    >
      {state.status === "loading" ? (
        <p className="muted" role="status">
          Загружаю разбор…
        </p>
      ) : null}
      {state.status === "error" ? (
        <div>
          <p role="status">Не удалось загрузить разбор.</p>
          <button className="secondary-action" type="button" onClick={() => void load()}>
            Загрузить снова
          </button>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <>
          <BreakdownTexts
            title="Мнемоника"
            texts={state.item.mnemonics}
            displayMode={displayMode}
          />
          <BreakdownTexts title="Подсказки" texts={state.item.hints} displayMode={displayMode} />
          <BreakdownExample item={state.item} displayMode={displayMode} />
        </>
      ) : null}
      <Link href={`/items/${encodeURIComponent(itemId)}`} prefetch={false}>
        Открыть карточку
      </Link>
    </SectionDisclosure>
  );
}

function BreakdownTexts({
  title,
  texts,
  displayMode,
}: {
  readonly title: string;
  readonly texts: BilingualTextDto;
  readonly displayMode: TranslationDisplayMode;
}) {
  const visible = [
    ...(displayMode === "en" ? [] : texts.ru),
    ...(displayMode === "ru" ? [] : texts.en),
  ];
  if (!visible.length) return null;
  return (
    <div>
      <h3>{title}</h3>
      {[...new Map(visible.map((entry) => [`${entry.locale}:${entry.text}`, entry])).values()].map(
        (entry) => (
          <p key={`${entry.locale}:${entry.text}`} lang={entry.locale}>
            {entry.text}
          </p>
        ),
      )}
    </div>
  );
}

function BreakdownExample({
  item,
  displayMode,
}: {
  readonly item: ItemDetails;
  readonly displayMode: TranslationDisplayMode;
}) {
  const example = item.exampleSentences[0];
  if (!example) return null;
  return (
    <div>
      <h3>Пример</h3>
      <JapaneseText as="p" variant="sentence">
        {example.japaneseText}
      </JapaneseText>
      {example.readingText ? <JapaneseText as="p">{example.readingText}</JapaneseText> : null}
      {displayMode !== "en" && example.translationRu ? (
        <p lang="ru">{example.translationRu}</p>
      ) : null}
      {displayMode !== "ru" && example.translationEn ? (
        <p lang="en">{example.translationEn}</p>
      ) : null}
      {example.attribution ? (
        <p className="muted">
          {example.attribution.attributionText} · {example.attribution.licenseName}
        </p>
      ) : null}
    </div>
  );
}
