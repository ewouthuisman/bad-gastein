import type { Difficulty } from '../../lib/types';
import type { AreaKey } from './areas';

export type { Difficulty };

export interface GNode {
  id: string;
  lat: number;
  lng: number;
  ele?: number;
  label?: string;
  area?: AreaKey; // ski area (lift network) this point belongs to
}

export interface GEdge {
  id: string;
  from: string;
  to: string;
  kind: 'piste' | 'lift' | 'link';
  ref?: string;
  name?: string;
  difficulty?: Difficulty;
  liftType?: string;
  lengthM: number;
  geometry: [number, number][]; // [lat, lng]
  osmId?: string;
  statusId?: string;
}

export interface SkiGraph {
  version: string;
  nodes: GNode[];
  edges: GEdge[];
}

export type PlaceKind = 'restaurant' | 'apres' | 'dinner' | 'house' | 'other';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  nodeId: string | null; // null when not within reach of the piste network
  nodeIds?: string[]; // every piste point within reach, nearest first
  area?: AreaKey; // ski area this place can be reached in via the pistes
  osmId?: string;
  website?: string;
  menuUrl?: string;
}
