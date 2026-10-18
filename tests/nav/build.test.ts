import { describe, expect, it } from 'vitest';
import osm from '../fixtures/mini-osm.json';
import { buildGraph, buildPlaces } from '../../scripts/lib/build-graph';

const g = buildGraph(osm as never);
const edge = (from: string, to: string) => g.edges.find((e) => e.from === from && e.to === to);

describe('buildGraph', () => {
  it('pistes run in way order and are one-way', () => {
    expect(edge('3', '4')?.kind).toBe('piste');
    expect(edge('4', '5')?.kind).toBe('piste');
    expect(edge('4', '3')).toBeUndefined();
  });

  it('lifts go from bottom to top and goods lifts are excluded', () => {
    expect(edge('1', '2')).toMatchObject({ kind: 'lift', name: 'Testbahn', liftType: 'chair_lift' });
    expect(edge('2', '1')).toBeUndefined();
    expect(g.edges.some((e) => e.osmId === 'way/300')).toBe(false);
  });

  it('joins nearby endpoints with walking links in both directions', () => {
    expect(edge('2', '3')?.kind).toBe('link');
    expect(edge('3', '2')?.kind).toBe('link');
    expect(edge('5', '1')?.kind).toBe('link');
    expect(edge('1', '5')?.kind).toBe('link');
  });

  it('takes the piste ref from the way or its route relation', () => {
    expect(edge('3', '4')?.ref).toBe('27');
    expect(edge('4', '6')).toMatchObject({ ref: '5', name: 'Talabfahrt', difficulty: 'intermediate' });
  });

  it('honours piste:oneway=no', () => {
    expect(edge('6', '7')).toBeDefined();
    expect(edge('7', '6')).toBeDefined();
  });

  it('keeps freeride pistes tagged as such', () => {
    expect(edge('2', '8')?.difficulty).toBe('freeride');
  });

  it('measures edge length in metres', () => {
    const lift = edge('1', '2')!;
    expect(lift.lengthM).toBeGreaterThan(1100);
    expect(lift.lengthM).toBeLessThan(1120);
  });
});

describe('buildPlaces', () => {
  const places = buildPlaces(osm as never, g);
  const byName = (n: string) => places.find((p) => p.name === n);

  it('snaps mountain restaurants to the nearest graph node', () => {
    expect(byName('Testhütte')).toMatchObject({ kind: 'restaurant', nodeId: '4', website: 'https://example.at' });
  });

  it('keeps town bars as apres without a piste node', () => {
    expect(byName('Silver Bullet')).toMatchObject({ kind: 'apres', nodeId: null });
  });

  it('recognises the house', () => {
    expect(byName('Das Schiller')?.kind).toBe('house');
  });
});
