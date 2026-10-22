export function parseDeploymentRevision(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{40}$/iu.test(value) ? value.toLowerCase() : null;
}
