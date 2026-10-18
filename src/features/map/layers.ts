import { locationFreshness } from '../location/freshness';
import type { GEdge, PlaceKind, SkiGraph } from '../nav/types';
import type { AppPlace } from './places';
import type { MapFilter } from './MapView';

export const HOUSE_CENTER: [number, number] = [13.1388841, 47.1159159]; // [lng, lat]

export interface MapPerson {
  id: string;
  name: string;
  color: string;
  lat: number | null;
  lng: number | null;
  updatedAt: Date | null;
}

const PISTE_COLOR: Record<string, string> = {
  novice: '#2f7cf6',
  easy: '#2f7cf6',
  intermediate: '#e5484d',
  advanced: '#111111',
  expert: '#ff8c00',
  freeride: '#ff8c00',
};

export const PLACE_COLOR: Record<PlaceKind, string> = {
  restaurant: '#2e9d5b',
  apres: '#d6336c',
  dinner: '#f08c00',
  house: '#ffb547',
  other: '#868e96',
};

type FC = GeoJSON.FeatureCollection;
const line = (coords: [number, number][], props: Record<string, unknown>): GeoJSON.Feature => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'LineString', coordinates: coords.map(([lat, lng]) => [lng, lat]) },
});

export function pisteGeoJson(g: SkiGraph): { pistes: FC; lifts: FC } {
  const pistes: GeoJSON.Feature[] = [];
  const lifts: GeoJSON.Feature[] = [];
  const seen = new Set<string>();
  for (const e of g.edges) {
    // Two-way pistes appear twice; draw them once.
    const k = e.id.replace(/r$/, '');
    if (seen.has(k)) continue;
    seen.add(k);
    if (e.kind === 'piste') pistes.push(line(e.geometry, { color: PISTE_COLOR[e.difficulty ?? 'intermediate'], ref: e.ref ?? '' }));
    else if (e.kind === 'lift') lifts.push(line(e.geometry, { name: e.name ?? '' }));
  }
  return { pistes: { type: 'FeatureCollection', features: pistes }, lifts: { type: 'FeatureCollection', features: lifts } };
}

export function placesGeoJson(places: AppPlace[], filters: Set<MapFilter>): FC {
  return {
    type: 'FeatureCollection',
    features: places
      .filter((p) => p.kind === 'house' || p.kind === 'other' || (p.kind === 'dinner' ? filters.has('restaurant') : filters.has(p.kind as MapFilter)))
      .map((p) => ({
        type: 'Feature',
        properties: { id: p.id, name: p.name, color: PLACE_COLOR[p.kind] },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
  };
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

export function peopleGeoJson(people: MapPerson[], now: Date): FC {
  return {
    type: 'FeatureCollection',
    features: people.flatMap((p) => {
      if (p.lat == null || p.lng == null || !p.updatedAt) return [];
      const f = locationFreshness(p.updatedAt, now);
      if (f === 'hidden') return [];
      return [{
        type: 'Feature' as const,
        properties: { id: p.id, initials: initials(p.name), color: p.color, opacity: f === 'stale' ? 0.4 : 1 },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      }];
    }),
  };
}

export function routeGeoJson(edges: GEdge[]): FC {
  return { type: 'FeatureCollection', features: edges.map((e) => line(e.geometry, { kind: e.kind })) };
}
