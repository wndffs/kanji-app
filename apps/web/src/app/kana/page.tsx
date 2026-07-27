import { KanaClient } from "./KanaClient";
import { parseKanaRouteSelection } from "../../lib/kana-route";

type KanaPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function KanaPage({ searchParams }: KanaPageProps) {
  const selection = parseKanaRouteSelection(await searchParams);

  return (
    <KanaClient
      initialMode={selection.mode}
      initialPracticeScript={selection.practiceScript}
      initialScript={selection.lessonScript}
    />
  );
}
