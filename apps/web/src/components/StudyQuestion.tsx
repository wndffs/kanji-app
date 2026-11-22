import { Languages, Type, Volume2 } from "lucide-react";
import { type ReactNode } from "react";

type StudyQuestionKind = "meaning" | "reading" | "listening";

const QUESTION_KINDS = {
  meaning: { label: "Значение", icon: Type },
  reading: { label: "Чтение", icon: Languages },
  listening: { label: "Аудирование", icon: Volume2 },
} as const;

export function StudyQuestion({
  children,
  kind,
  subject,
  position,
}: {
  readonly children: ReactNode;
  readonly kind: StudyQuestionKind;
  readonly subject: string;
  readonly position?: string;
}) {
  const { label, icon: Icon } = QUESTION_KINDS[kind];
  return (
    <article className="study-question" data-question-kind={kind}>
      <header className="study-question-meta">
        <h2>
          <Icon aria-hidden="true" size={17} />
          {label}
        </h2>
        <span>{subject}</span>
      </header>
      <div className="review-prompt study-question-content">{children}</div>
      {position === undefined ? null : <p className="study-question-position">{position}</p>}
    </article>
  );
}
