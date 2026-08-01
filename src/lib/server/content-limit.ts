export function normalizeContentLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return 20;
  return Math.min(1000, Math.max(1, Math.trunc(limit)));
}
