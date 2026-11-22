export function reviewedRefreshManifests(
  version: string,
  jmdictArchiveSha256: string,
): Readonly<Record<string, { manifestSha256: string; pairs: readonly string[] }>> | null;

export function selectReviewedSourcePin(values: unknown): Readonly<{
  version: string;
  jmdict: string;
  kanjidic2: string;
  kanjivg: string;
}>;
