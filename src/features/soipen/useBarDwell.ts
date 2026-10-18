import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { haversineM } from '../../lib/geo';
import type { AppPlace } from '../map/places';
import type { MyPosition } from '../location/useLocationSharing';

const RADIUS_M = 60;
const LEAVE_AFTER_MS = 5 * 60_000;
const STORAGE_KEY = 'active-bar-visit';

interface ActiveVisit {
  id: string;
  placeKey: string;
  lastNearAt: number;
  firstAwayAt: number | null;
}

function restore(): ActiveVisit | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActiveVisit) : null;
  } catch {
    return null;
  }
}

function persist(v: ActiveVisit | null) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: a reload just starts a new visit */
  }
}

async function ensurePlaceId(place: AppPlace, userId: string): Promise<string | null> {
  if (place.dbId) return place.dbId;
  const { data, error } = await supabase
    .from('places')
    .insert({ name: place.name, kind: place.kind, lat: place.lat, lng: place.lng, osm_id: place.osmId ?? place.id.replace(/^osm:/, ''), created_by: userId })
    .select('id')
    .single();
  if (!error && data) return data.id as string;
  const { data: existing } = await supabase.from('places').select('id').eq('osm_id', place.osmId ?? place.id.replace(/^osm:/, '')).maybeSingle();
  return (existing?.id as string) ?? null;
}

/**
 * Tracks time spent at après-ski bars while the app sees your position. A visit ends once you
 * have been away for 5 minutes; since the phone may have been in a pocket, the end time is taken
 * halfway between the last fix at the bar and the first fix elsewhere.
 */
export function useBarDwell(position: MyPosition | null, places: AppPlace[], userId: string | undefined) {
  const active = useRef<ActiveVisit | null>(restore());
  const starting = useRef(false);

  useEffect(() => {
    if (!position || !userId) return;
    const now = position.at.getTime();
    const bar = places.find((p) => p.kind === 'apres' && haversineM(position, p) <= RADIUS_M);
    const v = active.current;

    if (bar) {
      const key = bar.dbId ?? bar.id;
      if (v && v.placeKey === key) {
        v.lastNearAt = now;
        v.firstAwayAt = null;
        persist(v);
        return;
      }
      if (v) void end(v);
      if (starting.current) return;
      starting.current = true;
      void (async () => {
        const placeId = await ensurePlaceId(bar, userId);
        if (placeId) {
          const { data } = await supabase
            .from('bar_visits')
            .insert({ user_id: userId, place_id: placeId, started_at: new Date(now).toISOString() })
            .select('id')
            .single();
          if (data) {
            active.current = { id: data.id as string, placeKey: key, lastNearAt: now, firstAwayAt: null };
            persist(active.current);
          }
        }
        starting.current = false;
      })();
      return;
    }

    if (v) {
      v.firstAwayAt ??= now;
      persist(v);
      if (now - v.firstAwayAt >= LEAVE_AFTER_MS) void end(v);
    }

    async function end(visit: ActiveVisit) {
      active.current = null;
      persist(null);
      const endedAt = visit.firstAwayAt ? (visit.lastNearAt + visit.firstAwayAt) / 2 : visit.lastNearAt;
      await supabase.from('bar_visits').update({ ended_at: new Date(endedAt).toISOString() }).eq('id', visit.id);
    }
  }, [position, places, userId]);
}
