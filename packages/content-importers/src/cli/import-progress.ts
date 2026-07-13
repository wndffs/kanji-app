import { type ContentImportProgress, type ContentImportProgressCallback } from "../progress";

export function formatImportProgress(progress: ContentImportProgress): string {
  return `[import:${progress.source}] ${progress.completed}/${progress.total} (${progress.percent.toFixed(1)}%)`;
}

export const writeImportProgress: ContentImportProgressCallback = (progress) => {
  process.stderr.write(`${formatImportProgress(progress)}\n`);
};
