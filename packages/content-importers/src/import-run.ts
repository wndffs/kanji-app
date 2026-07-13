export type ImportRunUpdater = {
  update(args: {
    readonly where: { readonly id: string };
    readonly data: Record<string, unknown>;
  }): Promise<unknown>;
};

export type ImportRunLookup = {
  findUnique(args: {
    readonly where: {
      readonly dataSourceId_checksumSha256: {
        readonly dataSourceId: string;
        readonly checksumSha256: string;
      };
    };
    readonly select: { readonly id: true; readonly status: true };
  }): Promise<{
    readonly id: string;
    readonly status: "PENDING" | "SUCCESS" | "FAILED";
  } | null>;
};

export async function findSuccessfulImportRun(
  importRun: ImportRunLookup,
  dataSourceId: string,
  checksumSha256: string,
): Promise<{ readonly id: string } | null> {
  const existing = await importRun.findUnique({
    where: {
      dataSourceId_checksumSha256: {
        dataSourceId,
        checksumSha256,
      },
    },
    select: { id: true, status: true },
  });

  return existing?.status === "SUCCESS" ? { id: existing.id } : null;
}

export async function executeTrackedImport(
  importRun: ImportRunUpdater,
  importRunId: string,
  statsJson: Record<string, unknown>,
  operation: () => Promise<void>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    await importRun.update({
      where: { id: importRunId },
      data: {
        finishedAt: new Date(),
        status: "FAILED",
        errorText: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }

  await importRun.update({
    where: { id: importRunId },
    data: {
      finishedAt: new Date(),
      status: "SUCCESS",
      statsJson,
      errorText: null,
    },
  });
}
