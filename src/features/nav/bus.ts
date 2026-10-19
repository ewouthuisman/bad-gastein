import { haversineM } from '../../lib/geo';
import type { GEdge, GNode, SkiGraph } from './types';

export interface BusStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Position estimated, not surveyed. */
  approx?: boolean;
}

export interface BusTrip {
  line: string;
  /** Saturday/Sunday timetable instead of Monday to Friday. */
  we: boolean;
  /** Last day of service (ISO date) for trips that only run in part of the season. */
  until?: string;
  days?: 'sa' | 'su';
  /** Minutes after midnight by index into the direction's stops. */
  t: Record<number, number>;
}

export interface BusDirection {
  id: string;
  stops: string[];
  /** Ride minutes from stops[i] to stops[i + 1]. */
  ride: number[];
  trips: BusTrip[];
}

export interface BusData {
  version: string;
  source: string;
  stops: BusStop[];
  directions: BusDirection[];
}

/** Farthest walk between a bus stop and a lift station or the end of a piste. */
export const STOP_WALK_M = 600;
/** Straight-line distance understates the way along roads. */
const DETOUR = 1.25;
const ALIGHT_S = 30;
/** Expected gap when no later bus tells us the frequency. */
const DEFAULT_GAP_MIN = 30;

export const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Does this trip run on that date? (School days and public holidays are not modelled.) */
export function tripRuns(trip: BusTrip, date: Date): boolean {
  const dow = date.getDay();
  const weekend = dow === 0 || dow === 6;
  if (trip.we !== weekend) return false;
  if (trip.days === 'sa' && dow !== 6) return false;
  if (trip.days === 'su' && dow !== 0) return false;
  return !trip.until || isoDay(date) <= trip.until;
}

export interface Departure {
  min: number;
  line: string;
}

/** Departures from a stop on a date, earliest first; trips with the same minute count once. */
export function departures(dir: BusDirection, stopIdx: number, date: Date): Departure[] {
  const seen = new Set<number>();
  const out: Departure[] = [];
  for (const trip of dir.trips) {
    const min = trip.t[stopIdx];
    // A trip that ends at this stop has nobody to pick up: it needs a later stop.
    if (min === undefined || !tripRuns(trip, date) || !Object.keys(trip.t).some((i) => +i > stopIdx)) continue;
    if (seen.has(min)) continue;
    seen.add(min);
    out.push({ min, line: trip.line });
  }
  return out.sort((a, b) => a.min - b.min);
}

/** Minutes to wait at a stop: the next bus, but never less than half the gap to the one after it. */
export function expectedWaitMin(next: Departure[], nowMin: number): number {
  const gap = next.length > 1 ? next[1].min - next[0].min : DEFAULT_GAP_MIN;
  return Math.max(next[0].min - nowMin, gap / 2);
}

// A stop is two nodes so nobody "walks through" it: on foot you arrive at `bus:` (where you can only board)
// and after getting off you leave from `off:` (where you can only walk away).
export const stopNode = (stopId: string) => `bus:${stopId}`;
const offNode = (stopId: string) => `off:${stopId}`;

/** A copy of the graph with the bus network added: stops, walks to and from them, and rides. */
export function withBus(graph: SkiGraph, bus: BusData, now: Date): SkiGraph {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const stopById = new Map(bus.stops.map((s) => [s.id, s]));
  // Lift stations, and piste ends that lead nowhere further (the run down into a village).
  const hasOnward = new Set(graph.edges.filter((e) => e.kind !== 'link').map((e) => e.from));
  const exits = graph.nodes.filter((n) => n.label || !hasOnward.has(n.id));

  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const linked = new Set<string>();
  for (const s of bus.stops) {
    nodes.push({ id: stopNode(s.id), lat: s.lat, lng: s.lng, label: `Halte ${s.name}`, stop: true });
    const here: [number, number] = [s.lat, s.lng];
    edges.push({ id: `off:${s.id}`, from: offNode(s.id), to: stopNode(s.id), kind: 'bus', busRole: 'alight', name: s.name, seconds: 0, lengthM: 0, geometry: [here, here] });
    for (const n of exits) {
      const d = haversineM(s, n);
      if (d > STOP_WALK_M) continue;
      linked.add(s.id);
      const lengthM = d * DETOUR;
      edges.push({ id: `W:${n.id}:${s.id}`, from: n.id, to: stopNode(s.id), kind: 'link', lengthM, geometry: [[n.lat, n.lng], here] });
      edges.push({ id: `W:${s.id}:${n.id}`, from: offNode(s.id), to: n.id, kind: 'link', lengthM, geometry: [here, [n.lat, n.lng]] });
    }
  }

  for (const dir of bus.directions) {
    const onBus = (i: number) => `B:${dir.id}:${dir.stops[i]}`;
    dir.stops.forEach((id, i) => {
      const s = stopById.get(id)!;
      const point: [number, number] = [s.lat, s.lng];
      const base = { kind: 'bus' as const, name: s.name, lengthM: 0, geometry: [point, point] };
      const next = departures(dir, i, now).filter((d) => d.min >= nowMin);
      if (next.length && i < dir.stops.length - 1) {
        const lines = [...new Set(next.slice(0, 4).map((d) => d.line))].sort().join('/');
        edges.push({ ...base, id: `board:${dir.id}:${id}`, from: stopNode(id), to: onBus(i), busRole: 'board', ref: lines, seconds: expectedWaitMin(next, nowMin) * 60, departures: next.slice(0, 3).map((d) => d.min) });
      }
      if (i > 0) edges.push({ ...base, id: `alight:${dir.id}:${id}`, from: onBus(i), to: offNode(id), busRole: 'alight', seconds: ALIGHT_S });
      if (i < dir.stops.length - 1) {
        const t = stopById.get(dir.stops[i + 1])!;
        edges.push({
          kind: 'bus', id: `ride:${dir.id}:${id}`, from: onBus(i), to: onBus(i + 1), busRole: 'ride', name: t.name,
          lengthM: haversineM(s, t), seconds: dir.ride[i] * 60, geometry: [point, [t.lat, t.lng]],
        });
      }
    });
  }
  return {
    ...graph,
    nodes: [...graph.nodes, ...nodes.filter((n) => linked.has(n.id.slice(4)))],
    edges: [...graph.edges, ...edges],
  };
}
