import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupScore, personalScore, soipenMode, type DrinkKind } from '../../src/features/soipen/score';

const now = new Date('2027-03-02T23:00:00Z');
const hoursAgo = (h: number, from = now) => new Date(from.getTime() - h * 3_600_000);
const drinks = (kind: DrinkKind, n: number, at: Date) => Array.from({ length: n }, () => ({ kind, at }));

describe('personalScore', () => {
  it('is zero without drinks or bars', () => {
    expect(personalScore({ drinks: [], barMinutes: [] }, now)).toBe(0);
  });

  it('scores one half-litre beer right now at 22', () => {
    expect(personalScore({ drinks: drinks('beer_05', 1, now), barMinutes: [] }, now)).toBe(22);
  });

  it('halves the effect of a drink every 6 hours', () => {
    expect(personalScore({ drinks: drinks('beer_05', 1, hoursAgo(6)), barMinutes: [] }, now)).toBe(12);
  });

  it('starts the morning lower than the night before, but not at zero', () => {
    const night = { drinks: [...drinks('beer_05', 5, now), ...drinks('jager', 2, now)], barMinutes: [] };
    const evening = personalScore(night, now);
    const morning = personalScore(night, new Date(now.getTime() + 9 * 3_600_000));
    expect(evening).toBe(81);
    expect(morning).toBeGreaterThan(0);
    expect(morning).toBeLessThan(evening);
  });

  it('never exceeds 100', () => {
    expect(personalScore({ drinks: drinks('shot', 40, now), barMinutes: [] }, now)).toBe(100);
  });

  it('counts an hour in an après bar like a large beer', () => {
    expect(personalScore({ drinks: [], barMinutes: [{ start: hoursAgo(1), end: now }] }, now)).toBe(22);
  });

  it('caps an unfinished bar visit at 4 hours', () => {
    const open = personalScore({ drinks: [], barMinutes: [{ start: hoursAgo(10), end: null }] }, now);
    const capped = personalScore({ drinks: [], barMinutes: [{ start: hoursAgo(10), end: hoursAgo(6) }] }, now);
    expect(open).toBe(capped);
  });
});

describe('groupScore', () => {
  it('adds a bonus when the group votes for après', () => {
    expect(groupScore([60, 70], { apresShare: 1, earlyShare: null })).toBe(75);
  });
  it('subtracts when people want to ski early', () => {
    expect(groupScore([60, 70], { apresShare: null, earlyShare: 1 })).toBe(60);
  });
  it('is zero for an empty group', () => {
    expect(groupScore([], { apresShare: null, earlyShare: null })).toBe(0);
  });
});

describe('soipenMode', () => {
  it.each([
    [24, 'Skimodus'],
    [25, 'Lunchpauze-met-risico'],
    [49, 'Lunchpauze-met-risico'],
    [50, 'Après-ski modus'],
    [79, 'Après-ski modus'],
    [80, 'Totale overgave'],
  ])('%i → %s', (score, label) => expect(soipenMode(score).label).toBe(label));
});

describe('shared score module', () => {
  it('is identical for the app and the edge functions', () => {
    expect(readFileSync('supabase/functions/_shared/score.ts', 'utf8')).toBe(readFileSync('src/features/soipen/score.ts', 'utf8'));
  });
});
