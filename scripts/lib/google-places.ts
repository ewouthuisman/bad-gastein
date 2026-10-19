import { haversineM } from '../../src/lib/geo';
import type { GoogleInfo } from '../../src/features/nav/googleTypes';

/** A Google hit farther than this from the OSM point is a different place. */
export const MATCH_RADIUS_M = 200;

export const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.location', 'places.rating', 'places.userRatingCount',
  'places.priceLevel', 'places.googleMapsUri', 'places.editorialSummary', 'places.internationalPhoneNumber',
  'places.regularOpeningHours.weekdayDescriptions', 'places.businessStatus',
  'places.outdoorSeating', 'places.liveMusic', 'places.servesBeer', 'places.servesCocktails', 'places.servesVegetarianFood',
  'places.reservable', 'places.goodForGroups', 'places.menuForChildren', 'places.allowsDogs',
].join(',');

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  googleMapsUri?: string;
  editorialSummary?: { text: string };
  internationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  businessStatus?: string;
  outdoorSeating?: boolean;
  liveMusic?: boolean;
  servesBeer?: boolean;
  servesCocktails?: boolean;
  servesVegetarianFood?: boolean;
  reservable?: boolean;
  goodForGroups?: boolean;
  menuForChildren?: boolean;
  allowsDogs?: boolean;
}

const PRICE: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const TAGS: [keyof GooglePlace, string][] = [
  ['outdoorSeating', 'Terras'],
  ['liveMusic', 'Livemuziek'],
  ['servesCocktails', 'Cocktails'],
  ['servesBeer', 'Bier'],
  ['servesVegetarianFood', 'Vegetarisch'],
  ['goodForGroups', 'Goed voor groepen'],
  ['reservable', 'Reserveren kan'],
  ['menuForChildren', 'Kindermenu'],
  ['allowsDogs', 'Honden welkom'],
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** True when the two names share a word of 4+ letters (so "Alm" or "Bar" alone never match). */
export function namesOverlap(a: string, b: string): boolean {
  const words = (s: string) => new Set(norm(s).split(' ').filter((w) => w.length >= 4));
  const wb = words(b);
  return [...words(a)].some((w) => wb.has(w));
}

/** The closest hit within MATCH_RADIUS_M. Prefers a name match; accepts a very near hit (<60 m) without one. */
export function pickMatch(osm: { name: string; lat: number; lng: number }, hits: GooglePlace[]): GooglePlace | null {
  const near = hits
    .filter((h) => h.location && h.businessStatus !== 'CLOSED_TEMPORARILY')
    .map((h) => ({ h, d: haversineM({ lat: osm.lat, lng: osm.lng }, { lat: h.location!.latitude, lng: h.location!.longitude }) }))
    .filter((x) => x.d <= MATCH_RADIUS_M)
    .sort((x, y) => x.d - y.d);
  const named = near.find((x) => namesOverlap(osm.name, x.h.displayName?.text ?? ''));
  return named?.h ?? near.find((x) => x.d < 60)?.h ?? null;
}

export function toGoogleInfo(p: GooglePlace, now = new Date()): GoogleInfo {
  return {
    placeId: p.id,
    rating: p.rating,
    ratingCount: p.userRatingCount,
    priceLevel: p.priceLevel ? PRICE[p.priceLevel] : undefined,
    mapsUri: p.googleMapsUri,
    summary: p.editorialSummary?.text,
    phone: p.internationalPhoneNumber,
    hours: p.regularOpeningHours?.weekdayDescriptions,
    permanentlyClosed: p.businessStatus === 'CLOSED_PERMANENTLY' || undefined,
    tags: TAGS.filter(([k]) => p[k] === true).map(([, label]) => label),
    fetchedAt: now.toISOString(),
  };
}
