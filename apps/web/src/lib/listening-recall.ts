import { validateAnswer } from "@kanji-srs/japanese";
import { type ItemDetails } from "@kanji-srs/shared";

export function gradeListeningRecall(item: ItemDetails, answer: string) {
  const card=item.cards.find(candidate=>candidate.promptType === "reading" && candidate.answerType === "reading");
  if(!card || !item.pronunciationAudio) throw new Error("Verified word reading/recording is unavailable.");
  const personal=item.userOverrides.filter(override=>override.learningCardId === card.id);
  return validateAnswer({answerKind:"reading",answer,
    acceptedAnswers:card.acceptedAnswers.map(expected=>expected.text),
    blockedAnswers:[...card.blockedAnswers.map(block=>block.text),...personal.filter(override=>override.kind === "blocked-answer").map(override=>override.text)],
    userAcceptedAnswers:personal.filter(override=>override.kind === "accepted-answer").map(override=>override.text),
  });
}
