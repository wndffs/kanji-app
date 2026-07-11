export type ImportRunUpdater = {
  update(args: {
    readonly where: { readonly id: string };
    readonly data: Record<string, unknown>;
  }): Promise<unknown>;
};

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
