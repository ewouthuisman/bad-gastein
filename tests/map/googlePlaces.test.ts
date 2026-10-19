import { describe, expect, it } from 'vitest';
import { namesOverlap, pickMatch, toGoogleInfo, type GooglePlace } from '../../scripts/lib/google-places';
import { mergePlaces } from '../../src/features/map/places';
import type { Place } from '../../src/features/nav/types';

const osm = { name: 'Bergstadl', lat: 47.1097, lng: 13.1105 };
const hit = (id: string, name: string, dLat: number): GooglePlace => ({ id, displayName: { text: name }, location: { latitude: osm.lat + dLat, longitude: osm.lng } });

describe('pickMatch', () => {
  it('prefers a named hit within 200 m', () => {
    const m = pickMatch(osm, [hit('a', 'Andere Hütte', 0.0003), hit('b', 'Bergstadl Bad Gastein', 0.001)]);
    expect(m?.id).toBe('b');
  });
  it('accepts a very near hit without a name match, but not a far one', () => {
    expect(pickMatch(osm, [hit('a', 'Hütte X', 0.0003)])?.id).toBe('a');
    expect(pickMatch(osm, [hit('a', 'Hütte X', 0.001)])).toBeNull();
  });
  it('ignores hits beyond 200 m even when the name matches', () => {
    expect(pickMatch(osm, [hit('a', 'Bergstadl', 0.01)])).toBeNull();
  });
});

describe('namesOverlap', () => {
  it('needs a shared word of 4+ letters, ignoring accents', () => {
    expect(namesOverlap('Gipfelrestaurant Stubnerkogel', 'Stubnerkogel Gipfel')).toBe(true);
    expect(namesOverlap('Alm Bar', 'Bar Alm')).toBe(false);
    expect(namesOverlap('Hütte', 'Hutte')).toBe(true);
  });
});

describe('toGoogleInfo', () => {
  it('maps rating, price and tags', () => {
    const info = toGoogleInfo({ id: 'x', rating: 4.5, userRatingCount: 312, priceLevel: 'PRICE_LEVEL_MODERATE', outdoorSeating: true, liveMusic: false });
    expect(info).toMatchObject({ placeId: 'x', rating: 4.5, ratingCount: 312, priceLevel: 2, tags: ['Terras'] });
  });
});

describe('mergePlaces with ratings', () => {
  it('attaches Google info by place id', () => {
    const places: Place[] = [{ id: 'osm:node/1', name: 'A', kind: 'restaurant', lat: 1, lng: 1, nodeId: null, osmId: 'node/1' }];
    const google = { placeId: 'x', rating: 4.2, tags: [], fetchedAt: '2027-02-01T00:00:00Z' };
    expect(mergePlaces(places, [], { 'osm:node/1': google })[0].google).toEqual(google);
    expect(mergePlaces(places, [])[0].google).toBeUndefined();
  });
});
