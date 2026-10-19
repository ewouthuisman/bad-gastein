import type { Difficulty, GEdge, SkiGraph } from './types';

export const DIFFICULTY_RANK: Record<Difficulty, number> = {
  novice: 0,
  easy: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
  freeride: 5,
};

// Pistes without a difficulty tag are treated as red so beginners are never sent down them blind.
export const edgeRank = (e: GEdge) => (e.kind === 'piste' ? DIFFICULTY_RANK[e.difficulty ?? 'intermediate'] : 0);

const PISTE_MPS = 25 / 3.6;
const LIFT_MPS = 5;
const LIFT_BOARDING_S = 120;
export const WALK_MPS = 4 / 3.6;

export function edgeSeconds(e: GEdge): number {
  if (e.seconds !== undefined) return e.seconds;
  if (e.kind === 'lift') return e.lengthM / LIFT_MPS + LIFT_BOARDING_S;
  if (e.kind === 'link') return e.lengthM / WALK_MPS;
  return e.lengthM / PISTE_MPS;
}

export function outgoing(g: SkiGraph): Map<string, GEdge[]> {
  const out = new Map<string, GEdge[]>();
  for (const e of g.edges) {
    const list = out.get(e.from);
    if (list) list.push(e);
    else out.set(e.from, [e]);
  }
  return out;
}
