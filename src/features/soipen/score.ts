// Soipen-meter formula. Satire, not a blood-alcohol estimate.
// Shared byte-for-byte with supabase/functions/_shared/score.ts (a test checks this).

export type DrinkKind = 'beer_03' | 'beer_05' | 'jager' | 'wine' | 'shot' | 'gluhwein';

export const DRINK_POINTS: Record<DrinkKind, number> = { beer_03: 6, beer_05: 10, jager: 8, wine: 7, shot: 8, gluhwein: 7 };

const HALF_LIFE_H = 6;
const SATURATION = 40;
const BAR_MINUTES_PER_POINT = 6;
const MAX_VISIT_MS = 4 * 3_600_000;

export interface SoipenInput {
  drinks: { kind: DrinkKind; at: Date }[];
  barMinutes: { start: Date; end: Date | null }[];
}

const decay = (at: Date, now: Date) => 0.5 ** (Math.max(0, now.getTime() - at.getTime()) / 3_600_000 / HALF_LIFE_H);

export function personalScore(input: SoipenInput, now: Date): number {
  let raw = 0;
  for (const d of input.drinks) raw += DRINK_POINTS[d.kind] * decay(d.at, now);
  for (const v of input.barMinutes) {
    const capEnd = v.start.getTime() + MAX_VISIT_MS;
    const endMs = Math.min(v.end ? v.end.getTime() : now.getTime(), capEnd, now.getTime());
    const minutes = Math.max(0, endMs - v.start.getTime()) / 60_000;
    raw += (minutes / BAR_MINUTES_PER_POINT) * decay(new Date(endMs), now);
  }
  return Math.round(100 * (1 - Math.exp(-raw / SATURATION)));
}

export function groupScore(personal: number[], votes: { apresShare: number | null; earlyShare: number | null }): number {
  if (!personal.length) return 0;
  const mean = personal.reduce((a, b) => a + b, 0) / personal.length;
  const apres = votes.apresShare == null ? 0 : (votes.apresShare - 0.5) * 20;
  const early = votes.earlyShare == null ? 0 : (votes.earlyShare - 0.5) * 10;
  return Math.round(Math.min(100, Math.max(0, mean + apres - early)));
}

export type SoipenModeKey = 'ski' | 'lunch' | 'apres' | 'overgave';

export function soipenMode(score: number): { key: SoipenModeKey; label: string } {
  if (score < 25) return { key: 'ski', label: 'Skimodus' };
  if (score < 50) return { key: 'lunch', label: 'Lunchpauze-met-risico' };
  if (score < 80) return { key: 'apres', label: 'Après-ski modus' };
  return { key: 'overgave', label: 'Totale overgave' };
}
