import { ConfusablePracticeClient } from "./ConfusablePracticeClient";

export default async function ConfusablePracticePage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly pairId?: string | readonly string[];
    readonly itemId?: string | readonly string[];
  }>;
}) {
  const params = await searchParams;

  return (
    <ConfusablePracticeClient
      initialItemId={firstParam(params.itemId)}
      initialPairId={firstParam(params.pairId)}
    />
  );
}

function firstParam(value: string | readonly string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();

  return normalized === undefined || normalized === "" ? undefined : normalized;
}
