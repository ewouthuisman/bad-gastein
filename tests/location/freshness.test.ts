import { describe, expect, it } from 'vitest';
import { formatAgo, locationFreshness } from '../../src/features/location/freshness';

const now = new Date('2027-03-02T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const H = 60 * MIN;

describe('locationFreshness', () => {
  it.each([
    [2 * H - 1000, 'fresh'],
    [2 * H, 'stale'],
    [12 * H - MIN, 'stale'],
    [12 * H, 'hidden'],
  ])('%i ms old is %s', (ms, expected) => {
    expect(locationFreshness(ago(ms), now)).toBe(expected);
  });
});

describe('formatAgo', () => {
  it.each([
    [20_000, 'net'],
    [4 * MIN, '4 min geleden'],
    [80 * MIN, '1 u 20 min geleden'],
    [3 * H, '3 u geleden'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatAgo(ago(ms), now)).toBe(expected);
  });
});
