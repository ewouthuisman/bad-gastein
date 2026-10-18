import { describe, expect, it } from 'vitest';
import { closedStatus } from '../../src/features/nav/closedStatus';

const row = (id: string, isOpen: boolean, updated: string) => ({ id, name: id, kind: 'lift' as const, is_open: isOpen, updated_at: updated });
const now = new Date('2027-03-02T09:30:00Z');

describe('closedStatus', () => {
  it('uses fresh status and strips the lift/piste prefix', () => {
    const r = closedStatus([row('lift:graukogel i', false, '2027-03-02T09:15:00Z'), row('piste:27', false, '2027-03-02T09:15:00Z'), row('lift:x', true, '2027-03-02T09:15:00Z')], now);
    expect([...r.closed].sort()).toEqual(['27', 'graukogel i']);
    expect(r.stale).toBe(false);
  });

  it('ignores status older than an hour (e.g. last evening\'s "all closed")', () => {
    const r = closedStatus([row('lift:graukogel i', false, '2027-03-01T16:30:00Z')], now);
    expect(r.closed.size).toBe(0);
    expect(r.stale).toBe(true);
  });

  it('is not stale when there is no data at all', () => {
    expect(closedStatus([], now)).toEqual({ closed: new Set(), stale: false });
  });
});
