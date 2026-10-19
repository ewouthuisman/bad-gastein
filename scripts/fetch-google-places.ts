// Fetches Google Maps rating, review count, price level, opening hours and more for every restaurant,
// après-ski bar and dinner place, and writes public/data/place-ratings.json (keyed by place id).
// Needs GOOGLE_PLACES_API_KEY (Places API (New) enabled). Run once a month before the trip, e.g.:
//   GOOGLE_PLACES_API_KEY=… npx tsx scripts/fetch-google-places.ts
// Only places without a match keep no entry; existing entries are kept unless --refresh is passed.
// Google's terms only allow caching this data for 30 days, so re-run it shortly before departure.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Place } from '../src/features/nav/types';
import type { GoogleInfo } from '../src/features/nav/googleTypes';
import { FIELD_MASK, MATCH_RADIUS_M, pickMatch, toGoogleInfo, type GooglePlace } from './lib/google-places';

const key = process.env.GOOGLE_PLACES_API_KEY;
if (!key) {
  console.error('Set GOOGLE_PLACES_API_KEY (Google Cloud → APIs & Services → Places API (New)).');
  process.exit(1);
}
const refresh = process.argv.includes('--refresh');
const OUT = 'public/data/place-ratings.json';

const places = (JSON.parse(readFileSync('public/data/places.json', 'utf8')) as Place[]).filter((p) => p.kind !== 'house');
const ratings: Record<string, GoogleInfo> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};

let ok = 0, missed = 0, skipped = 0;
for (const p of places) {
  if (ratings[p.id] && !refresh) {
    skipped++;
    continue;
  }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
    body: JSON.stringify({
      textQuery: `${p.name} Bad Gastein`,
      languageCode: 'nl',
      maxResultCount: 5,
      locationBias: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: MATCH_RADIUS_M } },
    }),
  });
  if (!res.ok) {
    console.error(`${p.name}: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const hit = pickMatch(p, ((await res.json()) as { places?: GooglePlace[] }).places ?? []);
  if (hit) {
    ratings[p.id] = toGoogleInfo(hit);
    ok++;
    console.log(`✓ ${p.name} → ${hit.displayName?.text} ${hit.rating ?? '-'} (${hit.userRatingCount ?? 0})`);
  } else {
    delete ratings[p.id];
    missed++;
    console.log(`✗ ${p.name}: geen match op Google`);
  }
  await new Promise((r) => setTimeout(r, 120));
}
writeFileSync(OUT, JSON.stringify(ratings, null, 1));
console.log(`\n${ok} nieuw, ${skipped} overgeslagen, ${missed} zonder match → ${OUT}`);
