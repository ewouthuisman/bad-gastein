import type { LiftStatusRow } from '../berg/LiftStatus';

const STALE_MS = 60 * 60_000;

/**
 * Closed lifts/pistes for routing. Status older than an hour (after lift hours, or the feed broke)
 * is ignored rather than blocking every route; `stale` lets the UI say so.
 */
export function closedStatus(rows: LiftStatusRow[], now: Date): { closed: Set<string>; stale: boolean } {
  if (!rows.length) return { closed: new Set(), stale: false };
  const newest = Math.max(...rows.map((r) => new Date(r.updated_at).getTime()));
  if (now.getTime() - newest > STALE_MS) return { closed: new Set(), stale: true };
  return { closed: new Set(rows.filter((r) => !r.is_open).map((r) => r.id.replace(/^(lift|piste):/, ''))), stale: false };
}
