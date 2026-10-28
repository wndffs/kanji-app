export type TimingResponse = {
  setHeader(name: string, value: string): void;
};

export async function timedQueueRead<T>(
  phase: "lessons" | "reviews",
  read: () => Promise<T>,
  response?: TimingResponse,
  authDurationMs = 0,
): Promise<T> {
  const startedAt = performance.now();
  const result = await read();
  const duration = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0).toFixed(1);
  response?.setHeader(
    "Server-Timing",
    `auth;dur=${duration(authDurationMs)}, ${phase};dur=${duration(performance.now() - startedAt)}`,
  );
  return result;
}
