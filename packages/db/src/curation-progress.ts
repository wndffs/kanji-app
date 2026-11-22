export type CurationCheckpoint = {
  readonly phase: "kanji-items-committed" | "word-manifests-published";
  readonly batchId: string;
  readonly completed: number;
  readonly total: number;
};

export type CurationProgressListener = (checkpoint: CurationCheckpoint) => void;

export function logCurationCheckpoint({ phase, batchId, completed, total }: CurationCheckpoint) {
  // Keep stdout as the final machine-readable report; checkpoints are aggregate only.
  process.stderr.write(`Curation ${phase}: ${batchId} ${completed}/${total}\n`);
}
