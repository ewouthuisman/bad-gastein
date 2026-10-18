// Builds public/data/ski-graph.json and public/data/places.json from the committed OSM snapshot.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildGraph, buildPlaces, type OverpassJson } from './lib/build-graph';

const osm = JSON.parse(readFileSync('data/osm-snapshot.json', 'utf8')) as OverpassJson;
const graph = buildGraph(osm);
const places = buildPlaces(osm, graph);

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/ski-graph.json', JSON.stringify(graph));
writeFileSync('public/data/places.json', JSON.stringify(places, null, 1));

const count = (k: string) => graph.edges.filter((e) => e.kind === k).length;
const lifts = graph.edges.filter((e) => e.kind === 'lift');
console.log(`nodes ${graph.nodes.length}, piste edges ${count('piste')}, lifts ${lifts.length}, links ${count('link')}`);
console.log(`unnamed lifts: ${lifts.filter((l) => !l.name).length}`);
const byKind = places.reduce<Record<string, number>>((acc, p) => ((acc[p.kind] = (acc[p.kind] ?? 0) + 1), acc), {});
console.log('places', byKind);
console.log('house', places.filter((p) => p.kind === 'house').map((p) => `${p.name} ${p.lat},${p.lng}`));
console.log('apres', places.filter((p) => p.kind === 'apres').map((p) => p.name).join(', '));
console.log('places without piste node', places.filter((p) => p.kind === 'restaurant' && !p.nodeId).length);
