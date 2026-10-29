import { describe, expect, it } from "vitest";
import { getCardFeedbackMessage } from "../src/reviews/practice-answer-feedback";
describe("post-answer diagnostic precedence", () => {
  const card = {
    answerType: "reading" as const,
    acceptedAnswers: [
      {
        text: "がっこう",
        normalizedText: "がっこう",
        answerKind: "reading" as const,
        locale: "ru-RU" as const,
        isPrimary: true,
        sourceKind: "curated" as const,
      },
    ],
  };
  it("only explains rejected spelling; blocked/correct/alternative outcomes retain their meaning", () => {
    expect(getCardFeedbackMessage(card, "wrong", "がこう")).toContain("っ");
    expect(getCardFeedbackMessage(card, "blocked", "がこう")).toContain("специально отклонен");
    expect(getCardFeedbackMessage(card, "correct", "がこう")).toBe("Ответ принят.");
    expect(getCardFeedbackMessage(card, "wrong", "がこう", "other")).toContain(
      "существующее чтение",
    );
  });
});
