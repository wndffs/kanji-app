// Hosted App Router deployments can preserve percent encoding in dynamic params.
export function decodeItemRouteParameter(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
