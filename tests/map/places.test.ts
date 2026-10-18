import { describe, expect, it } from 'vitest';
import { mergePlaces, type DbPlace } from '../../src/features/map/places';
import type { Place } from '../../src/features/nav/types';

const osm: Place[] = [
  { id: 'osm:node/1', name: 'Jungerstube', kind: 'restaurant', lat: 47.1, lng: 13.1, nodeId: 'n1', osmId: 'node/1' },
  { id: 'osm:node/2', name: 'Silver Bullet', kind: 'apres', lat: 47.11, lng: 13.13, nodeId: null, osmId: 'node/2' },
];
const db: DbPlace[] = [
  { id: 'uuid-1', name: 'Jungerstube', kind: 'restaurant', lat: null, lng: null, osm_id: 'node/1', menu_url: 'https://m.at/menu.pdf', menu_text: 'Gulaschsuppe 9,50', website: null },
  { id: 'uuid-2', name: 'Pizzeria Nieuw', kind: 'dinner', lat: 47.115, lng: 13.135, osm_id: null, menu_url: null, menu_text: null, website: 'https://pizza.at' },
  { id: 'uuid-3', name: 'Ergens', kind: 'restaurant', lat: null, lng: null, osm_id: null, menu_url: null, menu_text: null, website: null },
];

describe('mergePlaces', () => {
  const merged = mergePlaces(osm, db);

  it('adds menu details from the database to OSM places', () => {
    expect(merged.find((p) => p.id === 'osm:node/1')).toMatchObject({ menuUrl: 'https://m.at/menu.pdf', menuText: 'Gulaschsuppe 9,50', dbId: 'uuid-1' });
  });

  it('adds user-created places with coordinates', () => {
    expect(merged.find((p) => p.id === 'uuid-2')).toMatchObject({ name: 'Pizzeria Nieuw', kind: 'dinner', nodeId: null, website: 'https://pizza.at' });
  });

  it('keeps places without coordinates out of the map list', () => {
    expect(merged.some((p) => p.id === 'uuid-3')).toBe(false);
    expect(merged).toHaveLength(3);
  });
});
