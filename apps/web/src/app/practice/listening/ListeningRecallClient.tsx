"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { RotateCcw } from "lucide-react";
import {
  PRONUNCIATION_RECORDINGS,
  type ItemDetails,
  type ListeningPlaybackEvidenceDto,
} from "@kanji-srs/shared";
import { ListeningAttribution, ListeningPrompt } from "../../../components/ListeningPrompt";
import { JapaneseText } from "../../../components/JapaneseText";
import { searchItems, getItemDetails } from "../../../lib/api-client";
import { useStoredSession } from "../../../lib/use-stored-session";
import { gradeListeningRecall } from "../../../lib/listening-recall";

export function ListeningRecallClient() {
  const session = useStoredSession();
  if (session === undefined)
    return (
      <section className="page-stack" aria-busy="true">
        <h1>Практика на слух</h1>
      </section>
    );
  return <ListeningRecall key={session?.token ?? "guest"} token={session?.token ?? null} />;
}
function ListeningRecall({ token }: { readonly token: string | null }) {
  const [item, setItem] = useState<ItemDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ReturnType<typeof gradeListeningRecall> | null>(null);
  const [evidence, setEvidence] = useState<ListeningPlaybackEvidenceDto>({
    completed: false,
    playCount: 0,
  });
  useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
      try {
        const expected = PRONUNCIATION_RECORDINGS[0];
        const found = await searchItems(expected.expression, token, {
          itemType: "word",
          limit: 5,
          signal: abort.signal,
        });
        const target = found.items.find(
          (candidate) =>
            candidate.japanese === expected.expression && candidate.reading === expected.reading,
        );
        if (!target) throw new Error("Проверенные записи пока недоступны.");
        const loaded = await getItemDetails(target.id, token, { signal: abort.signal });
        if (
          !loaded.pronunciationAudio ||
          !loaded.cards.some((card) => card.promptType === "reading")
        )
          throw new Error("Проверенные записи пока недоступны.");
        if (!abort.signal.aborted) setItem(loaded);
      } catch (error: unknown) {
        if (!abort.signal.aborted)
          setError(error instanceof Error ? error.message : "Не удалось открыть практику.");
      }
    };
    void load();
    return () => abort.abort();
  }, [token, attempt]);
  function check(event: FormEvent) {
    event.preventDefault();
    if (item && evidence.completed && !result && answer.trim())
      setResult(gradeListeningRecall(item, answer));
  }
  return (
    <section className="page-stack">
      <header className="page-heading">
        <div>
          <h1>Практика на слух</h1>
          <span className="muted">Без изменения SRS</span>
        </div>
        <Link className="inline-link" href="/practice">
          К практике
        </Link>
      </header>
      {error ? (
        <div className="notice-panel">
          <p>{error}</p>
          <button
            className="secondary-action"
            onClick={() => {
              setError(null);
              setItem(null);
              setAttempt((previous) => previous + 1);
            }}
            type="button"
          >
            <RotateCcw size={16} />
            Повторить
          </button>
        </div>
      ) : !item ? (
        <p>Загружаю запись.</p>
      ) : (
        <>
          <ListeningPrompt
            key={attempt}
            audio={item.pronunciationAudio}
            onEvidenceChange={setEvidence}
          />
          <form className="answer-form" onSubmit={check}>
            <label htmlFor="listening-recall-answer">Чтение каной</label>
            <input
              id="listening-recall-answer"
              autoComplete="off"
              value={answer}
              disabled={!evidence.completed || result !== null}
              onChange={(event) => setAnswer(event.target.value)}
            />
            <button
              className="primary-action"
              disabled={!evidence.completed || result !== null || !answer.trim()}
              type="submit"
            >
              Проверить
            </button>
          </form>
          {result ? (
            <section className="review-feedback">
              <h2>{result.accepted ? "Верно" : "Не совпало"}</h2>
              <JapaneseText as="p" variant="display">
                {item.japanese}
              </JapaneseText>
              <JapaneseText as="p">{item.reading}</JapaneseText>
              <p>
                {item.translations.displayMode !== "en" ? item.translations.primaryRu : null}
                {item.translations.displayMode === "ru-en" ? " · " : ""}
                {item.translations.displayMode !== "ru" ? item.translations.primaryEn : null}
              </p>
              <p>Расписание повторений не изменено.</p>
              <ListeningAttribution audio={item.pronunciationAudio!} />
              <Link className="inline-link" href={`/items/${item.id}`}>
                Открыть материал
              </Link>
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  setResult(null);
                  setAnswer("");
                  setEvidence({ completed: false, playCount: 0 });
                  setAttempt((previous) => previous + 1);
                }}
              >
                <RotateCcw size={16} />
                Ещё раз
              </button>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
