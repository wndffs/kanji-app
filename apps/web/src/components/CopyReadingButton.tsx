"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyReadingButton({ reading }: { readonly reading: string }) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  async function copy() {
    setStatus("copying");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(reading);
      setStatus("copied");
    } catch { setStatus("error"); }
  }
  return <span className="reading-copy">
    <button className="icon-button" type="button" title="Копировать чтение" aria-label="Копировать чтение" disabled={status === "copying"} onClick={() => void copy()}>
      {status === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    </button>
    <span role="status" aria-label="Копирование чтения">{status === "copied" ? "Скопировано" : status === "error" ? "Не удалось скопировать" : ""}</span>
  </span>;
}
