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
  stop?: boolean; // a bus stop, added at runtime when the bus is switched on
}

export interface GEdge {
  id: string;
  from: string;
  to: string;
  kind: 'piste' | 'lift' | 'link' | 'bus';
  ref?: string;
  name?: string;
  difficulty?: Difficulty;
  liftType?: string;
  lengthM: number;
  geometry: [number, number][]; // [lat, lng]
  osmId?: string;
  statusId?: string;
  /** Fixed duration, for bus edges (the wait when boarding, the ride, getting off). */
  seconds?: number;
  busRole?: 'board' | 'ride' | 'alight';
  /** Extra cost in seconds when choosing a route (not shown as travel time): a way we would rather avoid. */
  penaltyS?: number;
  /** Next departures (minutes after midnight) on a boarding edge. */
  departures?: number[];
}

export interface SkiGraph {
  version: string;
  nodes: GNode[];
  edges: GEdge[];
}

import type { GoogleInfo } from './googleTypes';

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
  google?: GoogleInfo;
}
