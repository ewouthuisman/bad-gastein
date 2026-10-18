import { useCallback, useEffect, useState } from 'react';
import { useOnResume } from '../../lib/useOnResume';
import { supabase, uniqueChannel } from '../../lib/supabase';
import { viennaDate } from '../../lib/time';
import { computeSnapshot, type SoipenRows, type SoipenSnapshot } from '../../../supabase/functions/_shared/soipenCompute.ts';

export interface SoipenState {
  snapshot: SoipenSnapshot | null;
  comments: Map<string, { text: string; score: number }>; // 'group' or user id → line + score it was written for
}

async function loadRows(now: Date): Promise<SoipenRows> {
  const since = new Date(now.getTime() - 48 * 3_600_000).toISOString();
  const [{ data: profiles }, { data: drinks }, { data: visits }, { data: polls }] = await Promise.all([
    supabase.from('profiles').select('id, display_name'),
    supabase.from('drinks').select('user_id, kind, created_at').gte('created_at', since),
    supabase.from('bar_visits').select('user_id, started_at, ended_at, places(name)').gte('started_at', since),
    supabase.from('polls').select('id, kind').eq('day', viennaDate(now)).in('kind', ['apres_or_spa', 'early_ski']),
  ]);
  const ids = (polls ?? []).map((p) => p.id);
  const none = ['00000000-0000-0000-0000-000000000000'];
  const [{ data: votes }, { data: options }] = await Promise.all([
    supabase.from('votes').select('poll_id, option_id').in('poll_id', ids.length ? ids : none),
    supabase.from('poll_options').select('id, value').in('poll_id', ids.length ? ids : none),
  ]);
  return {
    profiles: profiles ?? [],
    drinks: drinks ?? [],
    visits: (visits ?? []) as unknown as SoipenRows['visits'],
    polls: polls ?? [],
    votes: votes ?? [],
    options: options ?? [],
  };
}

export function useSoipen(): SoipenState {
  const [state, setState] = useState<SoipenState>({ snapshot: null, comments: new Map() });

  const load = useCallback(async () => {
    const now = new Date();
    const [rows, { data: comments }] = await Promise.all([loadRows(now), supabase.from('soipen_comments').select('scope, text, score')]);
    setState({
      snapshot: computeSnapshot(rows, now),
      comments: new Map((comments ?? []).map((c) => [c.scope, { text: c.text, score: c.score }])),
    });
  }, []);

  // Re-run (reload + resubscribe) when the app comes back to the foreground.
  const [resume, setResume] = useState(0);
  useOnResume(() => setResume((n) => n + 1));

  useEffect(() => {
    void load();
    // Ask for fresh commentary; the function itself limits this to once per 10 minutes.
    void supabase.functions.invoke('soipen-comment', { body: {} });
    const timer = setInterval(() => void load(), 60_000);
    const ch = uniqueChannel('soipen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drinks' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'soipen_comments' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => void load())
      .subscribe();
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(ch);
    };
  }, [load, resume]);

  return state;
}
