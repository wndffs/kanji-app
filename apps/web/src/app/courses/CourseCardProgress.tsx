import { type CourseProgressCardDto } from "@kanji-srs/shared";

const LABELS: Readonly<Record<string, string>> = {
  meaning: "Значение",
  reading: "Чтение",
  listening: "Аудирование",
  recall: "Воспроизведение",
  cloze: "Пропуск",
  recognition: "Узнавание",
};
export function CourseCardProgress({
  cards,
  japanese,
}: {
  readonly cards: readonly CourseProgressCardDto[];
  readonly japanese: string;
}) {
  if (cards.length === 0) return null;
  return (
    <details className="course-card-progress">
      <summary aria-label={`Карточки ${japanese}`}>Прогресс: {cards.filter((card) => card.started).length}/{cards.length}</summary>
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            <strong>{LABELS[card.promptType] ?? "Карточка"}</strong>
            <span>
              {card.burned
                ? "Выучена"
                : !card.started
                  ? "Не начата"
                  : card.stageIndex !== null
                    ? `Ступень SRS: ${card.stageIndex}`
                    : "В работе"}
            </span>
            {!card.burned && card.started && card.availableAt ? (
              <time dateTime={card.availableAt}>
                {new Date(card.availableAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
