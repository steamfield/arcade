/**
 * Drift's shapes of its navigation and rival pilot memory, each extending the opaque base in
 * `media/types.ts` with `kind: 'drift'`, and the accessors drift reads them through. An accessor
 * throws on another medium's data. Motion and environment shapes live in `data.ts`.
 */
import type { GridSize, Vec } from '../../types.ts';
import type { MediumNav, PilotMemory } from '../types.ts';
import { wrongKind } from './data.ts';

/**
 * Drift's navigation: three distance fields to the finish, indexed `y * width + x`, in tiles. They
 * differ only in what unbroken ice costs.
 */
export interface DriftNav extends MediumNav, GridSize {
  readonly kind: 'drift';
  /** Tile indices of all mouths that can catch a racer. */
  wormholeEntries: ReadonlySet<number>;
  /** The way for a racer that steers round ice. */
  steer: Float32Array;
  /** The way for a racer able to break ice now (a Shock Bubble or Comet ready): through it at a price. */
  smash: Float32Array;
  /** The way for a racer that rams through ice as it flies: through it cheaply. */
  ram: Float32Array;
}

/** A drift rival's memory. */
export interface DriftPilot extends PilotMemory {
  readonly kind: 'drift';
  /** Unit aim along the way from the last replan. */
  aim: Vec;
  /** Ticks until it reads the way again. */
  replanIn: number;
  /** The angle, in radians, its bounded random walk puts on the aim. */
  wobble: number;
  /** Racing ticks in a row it has moved slower than the stuck speed. */
  stuckTicks: number;
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
