"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function ItemPreviewList<T>({ items, total = items.length, limit = 6, label, className, renderItem }: {
  readonly items: readonly T[];
  readonly total?: number;
  readonly limit?: number;
  readonly label: string;
  readonly className: string;
  readonly renderItem: (item: T) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, limit);
  const count = Math.max(items.length, total);
  return <div className="item-preview">
    <ul className={className}>{visible.map(renderItem)}</ul>
    {count > visible.length ? <p className="relation-group-summary">Показано {visible.length} из {count}{total > items.length ? ` · загружено ${items.length}` : ""}.</p> : null}
    {items.length > limit ? <button className="link-button item-preview-toggle" type="button" aria-label={`${expanded ? "Свернуть" : "Показать ещё"}: ${label}`} onClick={() => setExpanded((value) => !value)}>
      {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}{expanded ? "Свернуть" : `Показать ещё (${items.length - limit})`}
    </button> : null}
  </div>;
}
