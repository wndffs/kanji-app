export async function forEachConcurrent<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Import concurrency must be a positive integer.");
  }

  let nextIndex = 0;
  let failed = false;
  let firstError: unknown;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (!failed && nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;

        if (item !== undefined) {
          try {
            await worker(item);
          } catch (error) {
            failed = true;
            firstError = error;
          }
        }
      }
    }),
  );

  if (failed) {
    throw firstError;
  }
}
