import { PRACTICE_SOURCES, type PracticeSource } from "@kanji-srs/shared";

import { PracticeClient } from "./PracticeClient";

export default async function PracticePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly source?: string | readonly string[] }>;
}) {
  const source = parsePracticeSource((await searchParams).source);

  return <PracticeClient initialSource={source} />;
}

function parsePracticeSource(value: string | readonly string[] | undefined): PracticeSource {
  const candidate = Array.isArray(value) ? value[0] : value;

  return PRACTICE_SOURCES.find((source) => source === candidate) ?? "recent-mistakes";
}
