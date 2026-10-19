import type { GoogleInfo } from '../features/nav/googleTypes';
import type { Place, SkiGraph } from '../features/nav/types';

// Shipped with the app and precached by the service worker, so these work offline.
let graphPromise: Promise<SkiGraph> | null = null;
let placesPromise: Promise<Place[]> | null = null;

export function loadGraph(): Promise<SkiGraph> {
  graphPromise ??= fetch('./data/ski-graph.json').then((r) => r.json() as Promise<SkiGraph>);
  return graphPromise;
}

export function loadPlaces(): Promise<Place[]> {
  placesPromise ??= fetch('./data/places.json').then((r) => r.json() as Promise<Place[]>);
  return placesPromise;
}

let ratingsPromise: Promise<Record<string, GoogleInfo>> | null = null;

/** Google ratings keyed by place id; empty when the file is missing (script not run yet). */
export function loadRatings(): Promise<Record<string, GoogleInfo>> {
  ratingsPromise ??= fetch('./data/place-ratings.json')
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, GoogleInfo>>) : {}))
    .catch(() => ({}));
  return ratingsPromise;
}
