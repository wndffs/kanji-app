import { KanaClient } from "./KanaClient";
import { parseKanaRouteSelection, parseKanaLessonDestination } from "../../lib/kana-route";

type KanaPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function KanaPage({ searchParams }: KanaPageProps) {
  const params = await searchParams;
  const selection = parseKanaRouteSelection(params);
  const destination = parseKanaLessonDestination(params);

  return (
    <KanaClient
      initialMode={selection.mode}
      initialPracticeScript={selection.practiceScript}
      initialScript={selection.lessonScript}
      initialUnitId={destination.unitId}
      initialCharacter={destination.character}
    />
  );
}
