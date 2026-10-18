import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn((_row: Record<string, unknown>) => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'visit-1' }, error: null }) }) }));
const update = vi.fn((_row: Record<string, unknown>) => ({ eq: () => Promise.resolve({ error: null }) }));
vi.mock('../../src/lib/supabase', () => ({ supabase: { from: () => ({ insert, update }) } }));

import { useBarDwell } from '../../src/features/soipen/useBarDwell';
import type { AppPlace } from '../../src/features/map/places';

const bar: AppPlace = { id: 'osm:node/1', dbId: 'db-bar', name: 'Silver Bullet', kind: 'apres', lat: 47.1, lng: 13.1, nodeId: null };
const t0 = new Date('2027-03-02T16:00:00Z').getTime();
const pos = (near: boolean, minutes: number) => ({ lat: near ? 47.1002 : 47.11, lng: 13.1, accuracy: 10, at: new Date(t0 + minutes * 60_000) });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('useBarDwell', () => {
  beforeEach(() => {
    insert.mockClear();
    update.mockClear();
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => vi.useRealTimers());

  it('starts a visit when within 60 m of an après bar', async () => {
    renderHook(({ p }) => useBarDwell(p, [bar], 'u1'), { initialProps: { p: pos(true, 0) } });
    await flush();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ place_id: 'db-bar', user_id: 'u1' }));
  });

  it('keeps the visit open while less than 5 minutes away', async () => {
    const { rerender } = renderHook(({ p }) => useBarDwell(p, [bar], 'u1'), { initialProps: { p: pos(true, 0) } });
    await flush();
    rerender({ p: pos(false, 1) });
    rerender({ p: pos(false, 5) });
    await flush();
    expect(update).not.toHaveBeenCalled();
  });

  it('ends the visit after 5 minutes away, halfway between last seen and first away', async () => {
    const { rerender } = renderHook(({ p }) => useBarDwell(p, [bar], 'u1'), { initialProps: { p: pos(true, 0) } });
    await flush();
    rerender({ p: pos(false, 1) });
    rerender({ p: pos(false, 6) });
    await flush();
    expect(update).toHaveBeenCalledWith({ ended_at: new Date(t0 + 30_000).toISOString() });
  });

  it('ignores bars that are not known in the database yet', async () => {
    renderHook(({ p }) => useBarDwell(p, [{ ...bar, dbId: undefined }], 'u1'), { initialProps: { p: pos(true, 0) } });
    await flush();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ osm_id: 'node/1' }));
  });
});
