import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mimics supabase-js: channel(name) returns the same channel for the same name,
// and adding listeners after subscribe() throws.
vi.mock('../../src/lib/supabase', () => {
  const channels = new Map<string, { subscribed: boolean; on: () => unknown; subscribe: () => unknown }>();
  const channel = (name: string) => {
    let ch = channels.get(name);
    if (!ch) {
      const c = {
        subscribed: false,
        on() {
          if (c.subscribed) throw new Error(`cannot add postgres_changes callbacks for ${name} after subscribe()`);
          return c;
        },
        subscribe() {
          c.subscribed = true;
          return c;
        },
      };
      ch = c;
      channels.set(name, ch);
    }
    return ch;
  };
  const query = { select: () => query, order: () => Promise.resolve({ data: [] }), then: (r: (v: unknown) => void) => r({ data: [] }) };
  return { uniqueChannel: (n: string) => channel(n + Math.random()), supabase: { channel, removeChannel: () => Promise.resolve(), from: () => query } };
});
vi.mock('../../src/lib/staticData', () => ({ loadPlaces: () => Promise.resolve([]), loadRatings: () => Promise.resolve({}), loadGraph: () => new Promise(() => {}) }));

import { usePlaces } from '../../src/features/map/places';
import { usePeople } from '../../src/features/location/usePeople';

function Twice() {
  usePlaces();
  usePlaces();
  usePeople();
  usePeople();
  return null;
}

describe('realtime subscriptions', () => {
  it('allow the same hook to be used by two components at once', () => {
    expect(() => render(<Twice />)).not.toThrow();
  });
});
