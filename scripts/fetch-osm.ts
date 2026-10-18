// Downloads the OSM snapshot for the Gastein valley (pistes, lifts, huts, bars, the house).
// Run once and commit data/osm-snapshot.json so graph builds are reproducible offline.
import { writeFileSync } from 'node:fs';

const BBOX = '47.02,12.95,47.26,13.25'; // Sportgastein … Dorfgastein
const query = `[out:json][timeout:180];
(
  way["piste:type"="downhill"](${BBOX});
  way["aerialway"](${BBOX});
);
out geom;
relation["route"="piste"](${BBOX});
out body;
(
  nwr["amenity"~"^(restaurant|bar|pub|cafe|fast_food|biergarten)$"](${BBOX});
  nwr["tourism"="alpine_hut"](${BBOX});
  nwr["name"~"Schiller",i](${BBOX});
);
out center tags;`;

const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

for (const url of endpoints) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'bad-gastein-trip-app/0.1' },
      body: new URLSearchParams({ data: query }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { elements: unknown[] };
    writeFileSync('data/osm-snapshot.json', JSON.stringify(json));
    console.log(`saved ${json.elements.length} elements from ${url}`);
    process.exit(0);
  } catch (e) {
    console.warn(`${url} failed: ${(e as Error).message}`);
  }
}
process.exit(1);
