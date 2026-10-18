import { describe, expect, it } from 'vitest';
import type { GEdge, Place, SkiGraph } from '../../src/features/nav/types';
import { describeRoute } from '../../src/features/nav/describe';

const e = (id: string, from: string, to: string, geometry: [number, number][], extra: Partial<GEdge>): GEdge => ({
  id, from, to, kind: 'piste', lengthM: 500, geometry, ...extra,
});

// A → B → C on piste 27, short walk C → C2, lift C2 → D, piste 5 D → X (destination) → F.
const p27a = e('p27a', 'A', 'B', [[47.04, 13.0], [47.035, 13.0]], { ref: '27', difficulty: 'easy' });
const p27b = e('p27b', 'B', 'C', [[47.035, 13.0], [47.03, 13.0]], { ref: '27', difficulty: 'easy' });
const walk = e('walk', 'C', 'C2', [[47.03, 13.0], [47.0302, 13.0]], { kind: 'link', lengthM: 22 });
const lift = e('lift', 'C2', 'D', [[47.0302, 13.0], [47.02, 13.0]], { kind: 'lift', name: 'Stubnerkogelbahn I', lengthM: 1100 });
const p5a = e('p5a', 'D', 'X', [[47.02, 13.0], [47.015, 13.0]], { ref: '5', difficulty: 'intermediate', lengthM: 556 });
const p5b = e('p5b', 'X', 'F', [[47.015, 13.0], [47.01, 13.0]], { ref: '5', difficulty: 'intermediate', lengthM: 556 });
const graph: SkiGraph = { version: 't', nodes: [], edges: [p27a, p27b, walk, lift, p5a, p5b] };
const hut: Place = { id: 'h', name: 'Jungerstube', kind: 'restaurant', lat: 47.015, lng: 13.0005, nodeId: 'X' };

describe('describeRoute', () => {
  it('merges same-numbered pistes and names lifts and the destination', () => {
    expect(describeRoute([p27a, p27b, walk, lift, p5a], { graph, destination: hut })).toEqual([
      'Neem piste 27 (blauw)',
      'Neem lift Stubnerkogelbahn I',
      'Neem piste 5 (rood)',
      'Jungerstube ligt halverwege piste 5, links',
    ]);
  });

  it('uses the piste name when there is no number', () => {
    const named = { ...p27a, ref: undefined, name: 'Talabfahrt' };
    expect(describeRoute([named], { graph })[0]).toBe('Neem de Talabfahrt (blauw)');
  });

  it('falls back to the next lift when a piste has neither number nor name', () => {
    const anon = { ...p27a, ref: undefined, id: 'anon' };
    const anonLift = { ...lift, from: 'B' };
    expect(describeRoute([anon, anonLift], { graph })[0]).toBe('Volg de piste (blauw) richting Stubnerkogelbahn I');
  });

  it('mentions long walks but not short station links', () => {
    const longWalk = { ...walk, lengthM: 180 };
    expect(describeRoute([p27a, longWalk, lift], { graph })).toEqual([
      'Neem piste 27 (blauw)',
      'Loop ongeveer 180 m naar Stubnerkogelbahn I',
      'Neem lift Stubnerkogelbahn I',
    ]);
  });

  it('says onderaan when the destination is at the end of the piste', () => {
    const atEnd = { ...hut, nodeId: 'F', lat: 47.01, lng: 12.9995 };
    expect(describeRoute([p5a, p5b], { graph, destination: atEnd }).at(-1)).toBe('Jungerstube ligt onderaan piste 5, rechts');
  });

  it('appends admin notes to the matching step', () => {
    const notes = new Map([['p27b', 'hier stuk schaatsen']]);
    expect(describeRoute([p27a, p27b], { graph, notes })[0]).toBe('Neem piste 27 (blauw) — let op: hier stuk schaatsen');
  });
});

describe('describeRoute on overlapping pistes', () => {
  const seg = (id: string, ref: string | undefined, lengthM: number, difficulty: GEdge['difficulty'] = 'easy') =>
    e(id, id + 'a', id + 'b', [[47.0, 13.0], [46.99, 13.0]], { ref, lengthM, difficulty });

  it('absorbs short hops onto parallel pistes into the main piste', () => {
    const route = [seg('a', 'H3', 500), seg('b', 'H3a', 80, 'intermediate'), seg('c', 'H3', 400), seg('d', 'H4', 60, 'intermediate'), seg('e', 'H3', 300)];
    expect(describeRoute(route, {})).toEqual(['Neem piste H3 (blauw, kort stuk rood)']);
  });

  it('keeps a long switch to another piste', () => {
    const route = [seg('a', 'H3', 500), seg('b', 'H4', 600, 'intermediate')];
    expect(describeRoute(route, {})).toEqual(['Neem piste H3 (blauw)', 'Neem piste H4 (rood)']);
  });

  it('mentions the hardest colour when a short hop is harder', () => {
    const route = [seg('a', 'H3', 500), seg('b', 'H3a', 80, 'advanced'), seg('c', 'H3', 400)];
    expect(describeRoute(route, {})).toEqual(['Neem piste H3 (blauw, kort stuk zwart)']);
  });
});
