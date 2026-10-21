/** Allow a sleeping Neon compute to start, without changing explicit operator settings. */
export function withNeonConnectionDefaults(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname.endsWith(".neon.tech")
  ) {
    return value;
  }
  if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "15");
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "15");
  return url.toString();
}
