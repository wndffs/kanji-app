"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { DeckDetailsDto, ItemSummary } from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import { SectionDisclosure } from "../../components/SectionDisclosure";
import { addDeckItems, searchItems } from "../../lib/api-client";
import { ownsSession } from "../../lib/use-stored-session";

export function DeckDictionaryPicker({ token, deck, onUpdated }: {
  readonly token: string;
  readonly deck: DeckDetailsDto;
  readonly onUpdated: (deck: DeckDetailsDto) => void;
}) {
  const [query,setQuery] = useState("");
  const [items,setItems] = useState<readonly ItemSummary[]>([]);
  const [selected,setSelected] = useState<readonly string[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const request = useRef<AbortController|null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => {mounted.current = false;request.current?.abort();}; }, []);

  async function search() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(null); setSelected([]);
    try {
      const result = await searchItems(query.trim(),token,{limit:20,signal:controller.signal});
      if (!mounted.current || controller.signal.aborted || !ownsSession(token)) return;
      setItems(result.items);
    } catch (cause) {
      if (mounted.current && !controller.signal.aborted && ownsSession(token)) setError(cause instanceof Error ? cause.message : "Поиск недоступен.");
    } finally { if (mounted.current && !controller.signal.aborted && ownsSession(token)) setBusy(false); }
  }

  async function add() {
    if (busy || selected.length === 0) return;
    setBusy(true); setError(null);
    try {
      const updated = await addDeckItems(token,deck.id,selected);
      if (!mounted.current || !ownsSession(token)) return;
      setSelected([]); onUpdated(updated);
    } catch (cause) {
      if (mounted.current && ownsSession(token)) setError(cause instanceof Error ? cause.message : "Не удалось добавить материалы.");
    } finally { if (mounted.current && ownsSession(token)) setBusy(false); }
  }

  return <SectionDisclosure title="Добавить из словаря">
    <form className="page-stack" onSubmit={(event) => {event.preventDefault(); if (!busy) void search();}}>
      <label><span>Поиск материалов</span><input value={query} maxLength={100} disabled={busy} onChange={(event)=>setQuery(event.currentTarget.value)} /></label>
      <div className="action-row"><button className="secondary-action" disabled={busy || query.trim().length === 0} type="submit"><Search size={18}/>Найти</button>
        <button className="primary-action" type="button" disabled={busy || selected.length === 0} onClick={()=>void add()}><Plus size={18}/>Добавить: {selected.length}</button></div>
      {error === null ? null : <p role="alert" className="form-error">{error}</p>}
      <ul className="saved-deck-list">{items.map((item)=> {
        const existing = deck.items.some((entry)=>entry.item.id === item.id);
        return <li key={item.id}><label className="action-row"><input type="checkbox" disabled={busy || existing} checked={existing || selected.includes(item.id)} onChange={(event)=>{ const checked = event.currentTarget.checked; setSelected((ids)=>checked ? [...ids,item.id] : ids.filter((id)=>id!==item.id)); }}/><JapaneseText>{item.japanese}</JapaneseText><span>{item.reading} · {item.title}{existing ? " · уже в колоде" : ""}</span></label></li>;
      })}</ul>
    </form>
  </SectionDisclosure>;
}
