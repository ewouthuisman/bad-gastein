import { useEffect, useState } from 'react';
import { useOnResume } from '../../lib/useOnResume';
import { supabase, uniqueChannel } from '../../lib/supabase';
import type { MapPerson } from '../map/layers';

interface Row {
  id: string;
  display_name: string;
  color: string;
  locations: { lat: number; lng: number; updated_at: string } | null;
}

/** Everyone in the group with their last known location, kept live via Realtime. */
export function usePeople(): MapPerson[] {
  const [people, setPeople] = useState<MapPerson[]>([]);
  // Re-run (reload + resubscribe) when the app comes back to the foreground.
  const [resume, setResume] = useState(0);
  useOnResume(() => setResume((n) => n + 1));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from('profiles').select('id, display_name, color, locations(lat, lng, updated_at)').order('display_name');
      if (cancelled || !data) return;
      setPeople(
        (data as unknown as Row[]).map((r) => ({
          id: r.id,
          name: r.display_name,
          color: r.color,
          lat: r.locations?.lat ?? null,
          lng: r.locations?.lng ?? null,
          updatedAt: r.locations ? new Date(r.locations.updated_at) : null,
        })),
      );
    }
    void load();
    const ch = uniqueChannel('people')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void load())
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [resume]);
  return people;
}
