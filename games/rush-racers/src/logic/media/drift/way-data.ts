/**
 * Drift's shapes of its navigation and rival pilot memory, each extending the opaque base in
 * `media/types.ts` with `kind: 'drift'`, and the accessors drift reads them through. An accessor
 * throws on another medium's data. Motion and environment shapes live in `data.ts`.
 */
import type { GridSize, Vec } from '../../types.ts';
import type { MediumNav, PilotMemory } from '../types.ts';
import { wrongKind } from './data.ts';

/** Drift's navigation: distances to the finish, indexed `y * width + x`, in tiles. */
export interface DriftNav extends MediumNav, GridSize {
  readonly kind: 'drift';
  /** The way for a racer that steers round ice. */
  steer: Float32Array;
}

/** A drift rival's memory. */
export interface DriftPilot extends PilotMemory {
  readonly kind: 'drift';
  /** Unit aim along the way from the last replan. */
  aim: Vec;
  /** Ticks left of the sideways push; 0 when not recovering. */
  recoverTicks: number;
  recoverDir: Vec;
}

/**
 * The world's nav as drift's.
 *
 * @throws {Error} When the nav was built by another medium.
 */
export function driftNav(nav: MediumNav): DriftNav {
  if (nav.kind !== 'drift') throw wrongKind('nav', nav.kind);
  return nav as DriftNav;
}

/**
 * A rival's pilot memory as drift's.
 *
 * @throws {Error} When the memory was created by another medium.
 */
export function driftPilot(memory: PilotMemory): DriftPilot {
  if (memory.kind !== 'drift') throw wrongKind('pilot memory', memory.kind);
  return memory as DriftPilot;
}
