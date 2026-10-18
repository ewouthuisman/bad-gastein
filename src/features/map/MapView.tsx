import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GEdge, SkiGraph } from '../nav/types';
import type { AppPlace } from './places';
import { HOUSE_CENTER, peopleGeoJson, pisteGeoJson, placesGeoJson, routeGeoJson, type MapPerson } from './layers';

export type MapFilter = 'people' | 'restaurant' | 'apres' | 'lifts';

export interface MapViewProps {
  graph: SkiGraph | null;
  places: AppPlace[];
  people: MapPerson[];
  route?: GEdge[];
  filters?: Set<MapFilter>;
  onSelectPlace?: (id: string) => void;
  onSelectPerson?: (id: string) => void;
}

maplibregl.setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const ALL: Set<MapFilter> = new Set(['people', 'restaurant', 'apres', 'lifts']);

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return typeof WebGLRenderingContext !== 'undefined' && !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function MapView({ graph, places, people, route, filters = ALL, onSelectPlace, onSelectPerson }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [supported] = useState(webglAvailable);
  const handlers = useRef({ onSelectPlace, onSelectPerson });
  handlers.current = { onSelectPlace, onSelectPerson };

  useEffect(() => {
    if (!supported || !el.current) return;
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: HOUSE_CENTER, zoom: 12, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'bottom-right');
    m.on('load', () => {
      const empty = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
      for (const id of ['pistes', 'lifts', 'route', 'places', 'people']) m.addSource(id, { type: 'geojson', data: empty });
      m.addLayer({
        id: 'pistes', type: 'line', source: 'pistes',
        paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 15, 4], 'line-opacity': 0.85 },
      });
      m.addLayer({
        id: 'lifts', type: 'line', source: 'lifts',
        paint: { 'line-color': '#111', 'line-width': 2, 'line-dasharray': [2, 1] },
      });
      m.addLayer({
        id: 'route', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffb547', 'line-width': 7, 'line-opacity': 0.9 },
      });
      m.addLayer({
        id: 'places', type: 'circle', source: 'places',
        paint: { 'circle-radius': 7, 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
      });
      m.addLayer({
        id: 'place-labels', type: 'symbol', source: 'places', minzoom: 13,
        layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'] },
        paint: { 'text-color': '#111', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      });
      m.addLayer({
        id: 'people', type: 'circle', source: 'people',
        paint: {
          'circle-radius': 14, 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'],
          'circle-stroke-width': 3, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': ['get', 'opacity'],
        },
      });
      m.addLayer({
        id: 'people-labels', type: 'symbol', source: 'people',
        layout: { 'text-field': ['get', 'initials'], 'text-size': 12, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true },
        paint: { 'text-color': '#111' },
      });
      m.on('click', 'places', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) handlers.current.onSelectPlace?.(id);
      });
      m.on('click', 'people', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) handlers.current.onSelectPerson?.(id);
      });
      for (const layer of ['places', 'people']) {
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
      }
      setReady(true);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, [supported]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !graph) return;
    const { pistes, lifts } = pisteGeoJson(graph);
    (m.getSource('pistes') as GeoJSONSource).setData(pistes);
    (m.getSource('lifts') as GeoJSONSource).setData(filters.has('lifts') ? lifts : { type: 'FeatureCollection', features: [] });
  }, [ready, graph, filters]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource('places') as GeoJSONSource).setData(placesGeoJson(places, filters));
  }, [ready, places, filters]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource('people') as GeoJSONSource).setData(filters.has('people') ? peopleGeoJson(people, new Date()) : { type: 'FeatureCollection', features: [] });
  }, [ready, people, filters]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const data = routeGeoJson(route ?? []);
    (m.getSource('route') as GeoJSONSource).setData(data);
    if (route?.length) {
      const b = new maplibregl.LngLatBounds();
      for (const e of route) for (const [lat, lng] of e.geometry) b.extend([lng, lat]);
      m.fitBounds(b, { padding: 60, maxZoom: 15 });
    }
  }, [ready, route]);

  if (!supported) {
    return <div className="map-fallback muted">De kaart heeft WebGL nodig en werkt niet in deze browser.</div>;
  }
  return <div ref={el} className="map" />;
}
