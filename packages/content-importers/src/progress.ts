export type ContentImportSource = "KANJIDIC2" | "JMdict" | "KanjiVG" | "Tatoeba";

export type ContentImportProgress = {
  readonly source: ContentImportSource;
  readonly completed: number;
  readonly total: number;
  readonly percent: number;
};

export type ContentImportProgressCallback = (progress: ContentImportProgress) => void;

export type ContentImportProgressTracker = {
  advance(): void;
};

export function createContentImportProgressTracker(
  source: ContentImportSource,
  total: number,
  onProgress: ContentImportProgressCallback | undefined,
): ContentImportProgressTracker {
  if (!Number.isInteger(total) || total < 0) {
    throw new Error("Import progress total must be a non-negative integer.");
  }

  let completed = 0;
  const reportEvery = Math.max(1, Math.ceil(total / 100));

  emitProgress(onProgress, source, completed, total);

  return {
    advance(): void {
      if (completed >= total) {
        throw new Error(`Import progress for ${source} advanced beyond ${total} items.`);
      }

      completed += 1;

      if (completed === total || completed % reportEvery === 0) {
        emitProgress(onProgress, source, completed, total);
      }
    },
  };
}

function emitProgress(
  onProgress: ContentImportProgressCallback | undefined,
  source: ContentImportSource,
  completed: number,
  total: number,
): void {
  onProgress?.({
    source,
    completed,
    total,
    percent: total === 0 ? 100 : Math.round((completed / total) * 1_000) / 10,
  });
}
