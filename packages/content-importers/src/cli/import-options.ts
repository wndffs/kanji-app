export type CliImportMetadata = {
  readonly sourceVersion: string | null;
  readonly sourceDownloadedAt: Date | null;
  readonly checksumSha256: string | undefined;
};

export function readImportMetadata(args: readonly string[]): CliImportMetadata {
  const downloadedAtValue = readFlagValue(args, "--source-downloaded-at");
  const sourceDownloadedAt = downloadedAtValue === null ? null : new Date(downloadedAtValue);

  if (sourceDownloadedAt !== null && Number.isNaN(sourceDownloadedAt.getTime())) {
    throw new Error("--source-downloaded-at must be a valid ISO-8601 date or timestamp.");
  }

  return {
    sourceVersion: readFlagValue(args, "--source-version"),
    sourceDownloadedAt,
    checksumSha256: readFlagValue(args, "--checksum-sha256") ?? undefined,
  };
}

export function readFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);

  if (index === -1) {
    return null;
  }

  const value = args[index + 1];

  return value === undefined || value.startsWith("--") ? null : value;
}
