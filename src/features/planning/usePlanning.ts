import { useCallback, useEffect, useState } from 'react';
import { supabase, uniqueChannel } from '../../lib/supabase';
import type { Poll, PollOption, Proposal } from './PollCard';
import type { TallyVote } from './tally';
import type { PlaceKind } from '../nav/types';

export interface PlanningData {
  polls: Poll[];
  options: PollOption[];
  votes: (TallyVote & { poll_id: string })[];
  names: Map<string, string>;
}

const PLACE_KIND: Record<string, PlaceKind> = { lunch_place: 'restaurant', apres_place: 'apres', dinner_place: 'dinner' };

export function usePlanning(day: string) {
  const [data, setData] = useState<PlanningData>({ polls: [], options: [], votes: [], names: new Map() });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: polls } = await supabase.from('polls').select('id, day, kind, decided_option_id').eq('day', day);
    const ids = (polls ?? []).map((p) => p.id);
    const none = ['00000000-0000-0000-0000-000000000000'];
    const [{ data: options }, { data: votes }, { data: profiles }] = await Promise.all([
      supabase.from('poll_options').select('id, poll_id, label, place_id, created_by').in('poll_id', ids.length ? ids : none).order('created_at'),
      supabase.from('votes').select('poll_id, user_id, option_id').in('poll_id', ids.length ? ids : none),
      supabase.from('profiles').select('id, display_name'),
    ]);
    setData({
      polls: (polls as Poll[]) ?? [],
      options: (options as (PollOption & { poll_id: string })[]) ?? [],
      votes: votes ?? [],
      names: new Map((profiles ?? []).map((p) => [p.id, p.display_name])),
    });
  }, [day]);

  useEffect(() => {
    void load();
    const ch = uniqueChannel(`planning-${day}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [day, load]);

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: err } = await p;
    setError(err ? 'Dat lukte niet. Is de stemming misschien al besloten?' : null);
    await load();
  };

  const vote = (userId: string, pollId: string, optionId: string) =>
    run(supabase.from('votes').upsert({ poll_id: pollId, user_id: userId, option_id: optionId, updated_at: new Date().toISOString() }, { onConflict: 'poll_id,user_id' }));
  const decide = (pollId: string, optionId: string) => run(supabase.rpc('decide_poll', { p_poll: pollId, p_option: optionId }));
  const undecide = (pollId: string) => run(supabase.rpc('undecide_poll', { p_poll: pollId }));

  async function propose(userId: string, poll: Poll, p: Proposal) {
    const kind = PLACE_KIND[poll.kind];
    let placeId: string | undefined;
    let label: string;
    if ('place' in p) {
      label = p.place.name;
      placeId = p.place.dbId;
      if (!placeId && p.place.osmId) {
        const { data: existing } = await supabase.from('places').select('id').eq('osm_id', p.place.osmId).maybeSingle();
        placeId = existing?.id;
      }
      if (!placeId) {
        const { data: created } = await supabase
          .from('places')
          .insert({ name: p.place.name, kind: p.place.kind, lat: p.place.lat, lng: p.place.lng, osm_id: p.place.osmId ?? null, website: p.place.website ?? null, created_by: userId })
          .select('id')
          .single();
        placeId = created?.id;
      }
    } else {
      label = p.newName;
      const { data: created } = await supabase
        .from('places')
        .insert({ name: p.newName, kind, website: p.link || null, created_by: userId })
        .select('id')
        .single();
      placeId = created?.id;
    }
    await run(supabase.from('poll_options').insert({ poll_id: poll.id, label, place_id: placeId ?? null, created_by: userId }));
  }

  return { ...data, error, vote, decide, undecide, propose };
}
