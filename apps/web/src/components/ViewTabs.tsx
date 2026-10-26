"use client";
import { nextTabIndex } from "../lib/tab-navigation";

export function ViewTabs({
  tabs,
  active,
  onChange,
  label,
  idPrefix,
  panelId,
}: {
  readonly tabs: readonly { readonly id: string; readonly label: string }[];
  readonly active: string;
  readonly onChange: (id: string) => void;
  readonly label: string;
  readonly idPrefix: string;
  readonly panelId: string;
}) {
  return (
    <div aria-label={label} className="view-tabs" role="tablist">
      {tabs.map((tab, index) => (
        <button
          aria-controls={panelId}
          aria-selected={active === tab.id}
          id={`${idPrefix}-${tab.id}`}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            const next = nextTabIndex(index, tabs.length, event.key);
            if (next === null) return;
            event.preventDefault();
            onChange(tabs[next]!.id);
            const buttons =
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                'button[role="tab"]',
              );
            buttons?.[next]?.focus();
          }}
          role="tab"
          tabIndex={active === tab.id ? 0 : -1}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
