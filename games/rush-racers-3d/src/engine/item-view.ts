/**
 * Items in the 3D scene: crates on the trail, shots in flight, Mud Pie splats, and item effects on
 * racers (boots flame, burr spikes, sap, stun, a held shield). Reads world state; never changes it.
 */
import * as THREE from 'three';
import type { Course, World } from '../logic/types.ts';
import type { TrackFrames } from './track-geometry.ts';

export interface ItemView {
  /** Add this to the scene once. */
  root: THREE.Group;
  /** Moves and shows everything for `world`'s current tick. */
  sync(world: World): void;
}

/** Builds the item meshes for `course`. Phase 3 lane b draws them; until then it draws nothing. */
export function createItemView(course: Course, track: TrackFrames): ItemView {
  void course;
  void track;
  return { root: new THREE.Group(), sync: () => {} };
}
