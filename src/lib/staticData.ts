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
