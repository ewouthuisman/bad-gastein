import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/staticData', () => ({ loadPlaces: () => Promise.resolve([]), loadRatings: () => Promise.resolve({}) }));
vi.mock('../../src/lib/supabase', () => {
  const channel = { on: () => channel, subscribe: () => channel };
  // Offline: the request fails.
  return {
    uniqueChannel: () => channel,
    supabase: { from: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) }), removeChannel: () => Promise.resolve() },
  };
});

import { usePlaces } from '../../src/features/map/places';

describe('usePlaces offline', () => {
  it('falls back to the last copy of the database places, including menus', async () => {
    localStorage.setItem('places-db', JSON.stringify([
      { id: 'p1', name: 'Pizzeria', kind: 'dinner', lat: 47.1, lng: 13.1, osm_id: null, menu_url: null, menu_text: 'Margherita 11', website: null },
    ]));
    const { result } = renderHook(() => usePlaces());
    await waitFor(() => expect(result.current.find((p) => p.id === 'p1')?.menuText).toBe('Margherita 11'));
  });
});
