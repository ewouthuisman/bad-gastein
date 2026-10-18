import { describe, expect, it } from 'vitest';
import { buildContext, MAX_CONTEXT_CHARS } from '../../supabase/functions/_shared/context.ts';

/** Minimal stand-in for a Supabase client: every query on a table resolves to its fixture rows. */
function stubDb(tables: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'neq']) q[m] = () => q;
      q.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null });
      q.single = () => Promise.resolve({ data: rows[0] ?? null });
      q.then = (resolve: (v: unknown) => void) => resolve({ data: rows });
      return q;
    },
  };
}

const base = {
  profiles: [{ id: 'u1', display_name: 'Anna' }, { id: 'u2', display_name: 'Bram' }],
  polls: [{ id: 'p1', day: '2027-03-03', kind: 'lunch_place', decided_option_id: 'o1' }],
  poll_options: [{ id: 'o1', poll_id: 'p1', label: 'Wengeralm', place_id: null, value: null }],
  votes: [{ poll_id: 'p1', user_id: 'u1', option_id: 'o1' }],
  house_info: [{ section: 'wellness', title: 'Zwembad & spa', markdown: 'Openingstijden zwembad: [PLACEHOLDER]', sort: 1 }],
  places: [],
  lift_status: [{ id: 'graukogel i', name: 'Graukogel I', kind: 'lift', is_open: false, updated_at: '2027-03-03T08:00:00Z' }],
  locations: [{ user_id: 'u2', lat: 47.1, lng: 13.1, updated_at: '2027-03-03T10:50:00Z' }],
  drinks: [],
  bar_visits: [],
};
const now = new Date('2027-03-03T11:00:00Z');

describe('buildContext', () => {
  it('includes decisions, house info and closed lifts', async () => {
    const ctx = await buildContext(stubDb(base) as never, now, { weather: 'Zon, -3 °C' });
    expect(ctx).toContain('Wengeralm');
    expect(ctx).toContain('Openingstijden zwembad: [PLACEHOLDER]');
    expect(ctx).toContain('Graukogel I');
    expect(ctx).toContain('Zon, -3 °C');
    expect(ctx).toContain('Bram');
  });

  it('stays under the size cap by trimming menus first', async () => {
    const places = Array.from({ length: 50 }, (_, i) => ({ id: `pl${i}`, name: `Hütte ${i}`, kind: 'restaurant', menu_text: 'Gulasch '.repeat(400), menu_url: null, lat: 47, lng: 13 }));
    const ctx = await buildContext(stubDb({ ...base, places }) as never, now, { weather: '' });
    expect(ctx.length).toBeLessThanOrEqual(MAX_CONTEXT_CHARS);
    expect(ctx).toContain('Hütte 49');
    expect(ctx).toContain('Wengeralm');
  });
});
