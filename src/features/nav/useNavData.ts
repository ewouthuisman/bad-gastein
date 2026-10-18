import { useEffect, useMemo, useState } from 'react';
import { useOnResume } from '../../lib/useOnResume';
import { supabase, uniqueChannel } from '../../lib/supabase';
import { loadGraph } from '../../lib/staticData';
import { applyOverrides, overrideNotes, type NavOverride } from './overrides';
import type { SkiGraph } from './types';
import type { LiftStatusRow } from '../berg/LiftStatus';

const OVERRIDES_CACHE = 'nav-overrides';

function cachedOverrides(): NavOverride[] {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_CACHE) ?? '[]') as NavOverride[];
  } catch {
    return [];
  }
}

/** Ski graph with admin corrections applied, plus live lift status. Works offline from caches. */
export function useNavData() {
  const [base, setBase] = useState<SkiGraph | null>(null);
  const [overrides, setOverrides] = useState<NavOverride[]>(cachedOverrides);
  const [status, setStatus] = useState<LiftStatusRow[]>([]);

  // Re-run (reload + resubscribe) when the app comes back to the foreground.
  const [resume, setResume] = useState(0);
  useOnResume(() => setResume((n) => n + 1));

  useEffect(() => {
    void loadGraph().then(setBase);
    async function load() {
      const [{ data: o }, { data: s }] = await Promise.all([
        supabase.from('nav_overrides').select('op, payload').order('created_at'),
        supabase.from('lift_status').select('id, name, kind, is_open, updated_at'),
      ]);
      if (o) {
        const list = o.map((r) => ({ op: r.op, ...(r.payload as object) }) as NavOverride);
        setOverrides(list);
        try {
          localStorage.setItem(OVERRIDES_CACHE, JSON.stringify(list));
        } catch {
          /* offline cache unavailable */
        }
      }
      if (s) setStatus(s as LiftStatusRow[]);
    }
    void load();
    const ch = uniqueChannel('nav')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lift_status' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nav_overrides' }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [resume]);

  const graph = useMemo(() => (base ? applyOverrides(base, overrides) : null), [base, overrides]);
  const notes = useMemo(() => overrideNotes(overrides), [overrides]);
  return { graph, base, overrides, notes, status };
}
