import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { computeSnapshot, type SoipenRows, type SoipenSnapshot } from './soipenCompute.ts';
import { viennaDate } from './time.ts';

export type { SoipenSnapshot };

/** Loads the last 48 hours of drinks and bar visits plus today's votes, and computes the scores. */
export async function soipenSnapshot(db: SupabaseClient, now: Date): Promise<SoipenSnapshot> {
  return computeSnapshot(await loadSoipenRows(db, now), now);
}

export async function loadSoipenRows(db: SupabaseClient, now: Date): Promise<SoipenRows> {
  const since = new Date(now.getTime() - 48 * 3_600_000).toISOString();
  const [{ data: profiles }, { data: drinks }, { data: visits }, { data: polls }] = await Promise.all([
    db.from('profiles').select('id, display_name'),
    db.from('drinks').select('user_id, kind, created_at').gte('created_at', since),
    db.from('bar_visits').select('user_id, started_at, ended_at, places(name)').gte('started_at', since),
    db.from('polls').select('id, kind').eq('day', viennaDate(now)).in('kind', ['apres_or_spa', 'early_ski']),
  ]);
  const pollIds = (polls ?? []).map((p) => p.id);
  const [{ data: votes }, { data: options }] = pollIds.length
    ? await Promise.all([
        db.from('votes').select('poll_id, option_id').in('poll_id', pollIds),
        db.from('poll_options').select('id, value').in('poll_id', pollIds),
      ])
    : [{ data: [] }, { data: [] }];
  return {
    profiles: profiles ?? [],
    drinks: drinks ?? [],
    visits: (visits ?? []) as SoipenRows['visits'],
    polls: polls ?? [],
    votes: votes ?? [],
    options: options ?? [],
  };
}
