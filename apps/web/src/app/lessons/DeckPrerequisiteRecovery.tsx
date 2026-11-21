"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  type DeckPrerequisitePlanDto,
  type CreatePrerequisiteDeckResponse,
} from "@kanji-srs/shared";

import { JapaneseText } from "../../components/JapaneseText";
import { SectionDisclosure } from "../../components/SectionDisclosure";
import { createPrerequisiteDeck, getDeckPrerequisitePlan } from "../../lib/api-client";
import { lessonSourceHref } from "../../lib/lesson-browser";
import { ownsSession } from "../../lib/use-stored-session";

export function DeckPrerequisiteRecovery({
  token,
  deckId,
}: {
  readonly token: string;
  readonly deckId: string;
}) {
  const [plan, setPlan] = useState<DeckPrerequisitePlanDto | null>(null);
  const [followup, setFollowup] = useState<CreatePrerequisiteDeckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  async function load() {
    if (pending.current || !ownsSession(token)) return;
    const controller = new AbortController();
    request.current = controller;
    pending.current = true;
    setError(null);
    setBusy(true);
    try {
      const response = await getDeckPrerequisitePlan(token, deckId, controller.signal);
      if (!controller.signal.aborted && ownsSession(token)) setPlan(response);
    } catch {
      if (!controller.signal.aborted && ownsSession(token))
        setError("Не удалось проверить предпосылки.");
    } finally {
      pending.current = false;
      if (mounted.current && ownsSession(token)) setBusy(false);
    }
  }

  async function create() {
    if (pending.current || followup !== null || !ownsSession(token)) return;
    pending.current = true;
    setError(null);
    setBusy(true);
    try {
      const response = await createPrerequisiteDeck(token, deckId);
      if (mounted.current && ownsSession(token)) setFollowup(response);
    } catch (cause) {
      if (mounted.current && ownsSession(token)) {
        setPlan(null);
        setError(cause instanceof Error ? cause.message : "Не удалось создать колоду.");
      }
    } finally {
      pending.current = false;
      if (mounted.current && ownsSession(token)) setBusy(false);
    }
  }

  return (
    <SectionDisclosure
      title="Недостающие предпосылки"
      onOpen={() => {
        if (plan === null) void load();
      }}
    >
      {busy && plan === null ? <p className="muted">Проверяю предпосылки…</p> : null}
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {plan === null && !busy ? (
        <button className="secondary-action" onClick={() => void load()} type="button">
          Проверить предпосылки
        </button>
      ) : null}
      {plan === null ? null : (
        <>
          <p>Можно начать вне этой колоды: {plan.readyCount}.</p>
          {plan.preview.length === 0 ? null : (
            <p>
              {plan.preview.map((item, index) => (
                <span key={item.id}>
                  {index === 0 ? "" : " · "}
                  <JapaneseText>{item.japanese}</JapaneseText>
                </span>
              ))}
            </p>
          )}
          {plan.waitingReviewCount > 0 ? (
            <p>
              Требуют повторения: {plan.waitingReviewCount}.{" "}
              <Link className="inline-link" href="/reviews">
                К повторениям
              </Link>
            </p>
          ) : null}
          {plan.unavailableCount > 0 ? (
            <p className="muted">Недоступно в каталоге: {plan.unavailableCount}.</p>
          ) : null}
          {followup !== null ? (
            <Link className="primary-action" href={lessonSourceHref(followup.deckId)}>
              Уроки предпосылок ({followup.itemCount})
            </Link>
          ) : plan.readyCount > 0 ? (
            <button
              className="primary-action"
              disabled={busy}
              onClick={() => void create()}
              type="button"
            >
              {busy ? "Создаю колоду…" : "Создать колоду предпосылок"}
            </button>
          ) : null}
        </>
      )}
    </SectionDisclosure>
  );
}
