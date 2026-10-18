const MIN = 60_000;
const HOUR = 60 * MIN;

export const STALE_AFTER_MS = 2 * HOUR;
export const HIDE_AFTER_MS = 12 * HOUR;

export function locationFreshness(updatedAt: Date, now: Date): 'fresh' | 'stale' | 'hidden' {
  const age = now.getTime() - updatedAt.getTime();
  if (age >= HIDE_AFTER_MS) return 'hidden';
  if (age >= STALE_AFTER_MS) return 'stale';
  return 'fresh';
}

export function formatAgo(updatedAt: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - updatedAt.getTime()) / MIN);
  if (minutes < 1) return 'net';
  if (minutes < 60) return `${minutes} min geleden`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} u ${m} min geleden` : `${h} u geleden`;
}
