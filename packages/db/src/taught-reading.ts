import { type Prisma } from "@prisma/client";

export type PrimaryTaughtReadingCard = {
  readonly answerType: string;
  readonly promptType: string;
  readonly answers?: readonly {
    readonly text: string;
    readonly locale: string;
    readonly answerKind: string;
    readonly isPrimary: boolean;
  }[];
};

export const primaryTaughtReadingCards = {
  where: { answerType: "READING", promptType: { not: "LISTENING" } },
  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  select: {
    answerType: true,
    promptType: true,
    answers: {
      where: { answerKind: "READING", locale: { in: ["ru-RU", "en-US"] }, isPrimary: true },
      orderBy: { text: "asc" },
      select: { text: true, locale: true, answerKind: true, isPrimary: true },
    },
  },
} as const satisfies Prisma.LearningCardFindManyArgs;

export function resolvePrimaryTaughtReading(
  cards: readonly PrimaryTaughtReadingCard[] | undefined,
  dictionaryReading: string | null,
): string | null {
  for (const card of cards ?? []) {
    if (card.answerType !== "READING" || card.promptType === "LISTENING") continue;
    for (const answer of card.answers ?? []) {
      if (
        answer.isPrimary &&
        answer.answerKind === "READING" &&
        (answer.locale === "ru-RU" || answer.locale === "en-US") &&
        answer.text.trim() !== ""
      )
        return answer.text.trim();
    }
  }
  return dictionaryReading;
}
