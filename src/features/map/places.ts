import { useEffect, useState } from 'react';
import { useOnResume } from '../../lib/useOnResume';
import { supabase, uniqueChannel } from '../../lib/supabase';
import { loadPlaces } from '../../lib/staticData';
import type { Place, PlaceKind } from '../nav/types';

export interface DbPlace {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number | null;
  lng: number | null;
  osm_id: string | null;
  menu_url: string | null;
  menu_text: string | null;
  website: string | null;
}

export interface AppPlace extends Place {
  dbId?: string;
  menuText?: string;
}

/** OSM places from the build, enriched with menus from the database, plus places people added. */
export function mergePlaces(osm: Place[], db: DbPlace[]): AppPlace[] {
  const byOsm = new Map(db.filter((d) => d.osm_id).map((d) => [d.osm_id!, d]));
  const merged: AppPlace[] = osm.map((p) => {
    const d = p.osmId ? byOsm.get(p.osmId) : undefined;
    if (!d) return p;
    return {
      ...p,
      dbId: d.id,
      menuUrl: d.menu_url ?? p.menuUrl,
      menuText: d.menu_text ?? undefined,
      website: d.website ?? p.website,
    };
  });
  for (const d of db) {
    if (d.osm_id || d.lat == null || d.lng == null) continue;
    merged.push({
      id: d.id,
      dbId: d.id,
      name: d.name,
      kind: d.kind,
      lat: d.lat,
      lng: d.lng,
      nodeId: null,
      website: d.website ?? undefined,
      menuUrl: d.menu_url ?? undefined,
      menuText: d.menu_text ?? undefined,
    });
  }
  return merged;
}

const CACHE_KEY = 'places-db';

export function usePlaces(): AppPlace[] {
  const [places, setPlaces] = useState<AppPlace[]>([]);
  // Re-run (reload + resubscribe) when the app comes back to the foreground.
  const [resume, setResume] = useState(0);
  useOnResume(() => setResume((n) => n + 1));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [osm, { data }] = await Promise.all([loadPlaces(), supabase.from('places').select('*')]);
      // Keep the last copy so menus and added places still show without signal on the mountain.
      let db = data as DbPlace[] | null;
      try {
        if (db) localStorage.setItem(CACHE_KEY, JSON.stringify(db));
        else db = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]') as DbPlace[];
      } catch {
        db ??= [];
      }
      if (!cancelled) setPlaces(mergePlaces(osm, db ?? []));
    }
    void load();
    const ch = uniqueChannel('places').on('postgres_changes', { event: '*', schema: 'public', table: 'places' }, () => void load()).subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [resume]);
  return places;
}
