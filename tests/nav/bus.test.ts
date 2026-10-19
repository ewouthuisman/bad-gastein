import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { departures, expectedWaitMin, hhmm, tripRuns, withBus, type BusData } from '../../src/features/nav/bus';
import { findRoute } from '../../src/features/nav/route';
import { describeRoute } from '../../src/features/nav/describe';
import type { GEdge, SkiGraph } from '../../src/features/nav/types';

const e = (id: string, from: string, to: string, extra: Partial<GEdge>): GEdge => ({
  id, from, to, kind: 'link', lengthM: 100, geometry: [[0, 0], [0, 0]], ...extra,
});

// Two lift stations 6 km apart; the bus stops sit right beside each.
const graph: SkiGraph = {
  version: 't',
  nodes: [
    { id: 'house', lat: 47.1, lng: 13.1 },
    { id: 'A', lat: 47.1, lng: 13.1005, label: 'Aalbahn (dal)', area: 'graukogel' },
    { id: 'B', lat: 47.15, lng: 13.1, label: 'Beebahn (dal)', area: 'stubnerkogel' },
  ],
  edges: [
    e('lift-a', 'A', 'A2', { kind: 'lift', name: 'Aalbahn' }),
    e('lift-b', 'B', 'B2', { kind: 'lift', name: 'Beebahn' }),
  ],
};

const trip = (min: number, extra = {}) => ({ line: '550', we: false, t: { 0: min, 1: min + 10 }, ...extra });
const bus: BusData = {
  version: 't',
  source: 'Testlijn',
  stops: [
    { id: 'noord', name: 'Noord', lat: 47.1, lng: 13.1004 },
    { id: 'zuid', name: 'Zuid', lat: 47.15, lng: 13.1004 },
  ],
  directions: [{ id: 'up', stops: ['noord', 'zuid'], ride: [10], trips: [trip(600), trip(630), trip(660)] }],
};

const wednesday = (h: number, m = 0) => new Date(2027, 1, 17, h, m);
const open = { maxDifficulty: 'intermediate' as const, closedStatusIds: new Set<string>() };

describe('bus timetable', () => {
  it('runs weekday trips on weekdays and weekend trips at the weekend', () => {
    expect(tripRuns(trip(600), wednesday(9))).toBe(true);
    expect(tripRuns(trip(600), new Date(2027, 1, 20))).toBe(false);
    expect(tripRuns({ ...trip(600), we: true }, new Date(2027, 1, 20))).toBe(true);
  });

  it('honours Saturday-only, Sunday-only and end-of-season trips', () => {
    const sat = new Date(2027, 1, 20);
    const sun = new Date(2027, 1, 21);
    expect(tripRuns({ ...trip(600), we: true, days: 'sa' }, sun)).toBe(false);
    expect(tripRuns({ ...trip(600), we: true, days: 'su' }, sun)).toBe(true);
    expect(tripRuns({ ...trip(600), we: true, days: 'su' }, sat)).toBe(false);
    expect(tripRuns({ ...trip(600), until: '2026-09-20' }, wednesday(9))).toBe(false);
    expect(tripRuns({ ...trip(600), until: '2027-02-17' }, wednesday(9))).toBe(true);
  });

  it('lists departures once per minute and skips the last stop of a trip', () => {
    const dir = { ...bus.directions[0], trips: [trip(600), trip(600, { line: '553' }), trip(630)] };
    expect(departures(dir, 0, wednesday(9)).map((d) => d.min)).toEqual([600, 630]);
    expect(departures(dir, 1, wednesday(9))).toEqual([]);
  });

  it('waits for the next bus, or half the gap when one is about to leave', () => {
    expect(expectedWaitMin([{ min: 600, line: '550' }, { min: 630, line: '550' }], 599)).toBe(15);
    expect(expectedWaitMin([{ min: 700, line: '550' }, { min: 730, line: '550' }], 600)).toBe(100);
    expect(expectedWaitMin([{ min: 700, line: '550' }], 699)).toBe(15);
  });

  it('formats minutes after midnight', () => {
    expect(hhmm(605)).toBe('10:05');
    expect(hhmm(1500)).toBe('01:00');
  });
});

describe('withBus', () => {
  it('adds the stops that are within walking reach of a lift station, and leaves the original alone', () => {
    const g = withBus(graph, bus, wednesday(9));
    expect(g.nodes.filter((n) => n.stop).map((n) => n.id)).toEqual(['bus:noord', 'bus:zuid']);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
  });

  it('routes between the stations by bus and describes it', () => {
    const g = withBus(graph, bus, wednesday(9));
    const r = findRoute(g, 'A', 'B', open);
    if (!r.ok) throw new Error('no route');
    const steps = describeRoute(r.edges, { graph: g, startWalkM: r.startWalkM, endWalkM: r.endWalkM });
    expect(steps).toEqual(['Neem bus 550 van halte Noord naar halte Zuid (± 10 min, vertrekt o.a. 10:00, 10:30)']);
  });

  it('does not route without the bus, or after the last one has gone', () => {
    expect(findRoute(graph, 'A', 'B', open)).toEqual({ ok: false, reason: 'no-route' });
    expect(findRoute(withBus(graph, bus, wednesday(11, 5)), 'A', 'B', open)).toEqual({ ok: false, reason: 'no-route' });
  });

  it('does not let you walk from one lift to another through a stop', () => {
    const near: SkiGraph = { ...graph, nodes: [...graph.nodes, { id: 'C', lat: 47.1, lng: 13.1008, label: 'Ceebahn (dal)', area: 'stubnerkogel' }] };
    expect(findRoute(withBus(near, bus, wednesday(9)), 'A', 'C', open)).toEqual({ ok: false, reason: 'no-route' });
  });

  it('lets you start or end at a stop', () => {
    const g = withBus(graph, bus, wednesday(9));
    const r = findRoute(g, [{ nodeId: 'bus:noord', walkM: 0 }, { nodeId: 'off:noord', walkM: 0 }], 'bus:zuid', open);
    expect(r.ok && r.edges.some((x) => x.kind === 'bus')).toBe(true);
  });
});

describe('shipped timetable', () => {
  const data = JSON.parse(readFileSync('public/data/bus.json', 'utf8')) as BusData;

  it('has coordinates for every stop and sane trips in both directions', () => {
    const ids = new Set(data.stops.map((s) => s.id));
    expect(data.directions.map((d) => d.id).sort()).toEqual(['down', 'up']);
    for (const d of data.directions) {
      expect(d.ride).toHaveLength(d.stops.length - 1);
      for (const s of d.stops) expect(ids.has(s)).toBe(true);
      for (const t of d.trips) {
        const times = Object.entries(t.t).sort(([a], [b]) => +a - +b).map(([, m]) => m);
        expect(times.length).toBeGreaterThan(1);
        expect(times).toEqual([...times].sort((a, b) => a - b));
      }
      expect(d.trips.some((t) => t.we)).toBe(true);
      expect(d.trips.some((t) => !t.we)).toBe(true);
    }
    for (const s of data.stops) expect(s.lat).toBeGreaterThan(47);
  });

  it('runs up the valley from Bad Gastein to Sportgastein', () => {
    const up = data.directions.find((d) => d.id === 'up')!;
    const from = up.stops.indexOf('bad-gastein-bahnhof');
    expect(up.stops.at(-1)).toBe('sportgastein-goldbergbahn');
    expect(departures(up, from, wednesday(10)).length).toBeGreaterThan(5);
  });
});
