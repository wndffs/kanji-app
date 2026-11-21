export function beforeCourseBatch<T extends { readonly id: string }>(
  batches: readonly T[],
  firstExcludedId: string,
): readonly T[] {
  const index = batches.findIndex(({ id }) => id === firstExcludedId);
  if (index < 0) throw new Error(`Missing course registry boundary ${firstExcludedId}`);
  return batches.slice(0, index);
}
