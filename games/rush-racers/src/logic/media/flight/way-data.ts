/**
 * Flight's navigation and rival pilot shapes, extending the opaque bases in `media/types.ts` with
 * `kind: 'flight'`, and their accessors. Scaffold baseline: the nav is one uniform-cost distance to
 * the finish over 8 neighbours; the pilot remembers the point on the way it flies toward and whether
 * it held Up last tick, so every flap is a real press.
 */
import type { GridSize, Vec } from '../../types.ts';
import type { MediumNav, PilotMemory } from '../types.ts';
import { wrongKind } from './data.ts';

/** Flight's navigation: the distance to the finish from each tile, indexed `y * width + x`, in tiles. */
export interface FlightNav extends MediumNav, GridSize {
  readonly kind: 'flight';
  /** Infinity where the finish can't be reached or the tile is closed. */
  distance: Float32Array;
}

/** A flight rival's memory between ticks. */
export interface FlightPilot extends PilotMemory {
  readonly kind: 'flight';
  /** Up was pressed last tick, so the next flap has to let go of it first. */
  upHeld: boolean;
  /** The point (world px) on the way it is flying toward, with its wobble; set when it replans. */
  target: Vec;
  /** Unit aim from the flyer toward `target`, as of the last tick. */
  aim: Vec;
  /** Ticks until it reads the way again (`reactionTicks` apart); 0 replans this tick. */
  replanIn: number;
  /** Ticks left of a stuck recovery; 0 when not recovering. */
  recoverTicks: number;
  /** The way it backs off during a recovery. */
  recoverDir: -1 | 1;
}

/**
 * The world's nav as flight's.
 *
 * @throws {Error} When the nav was built by another medium.
 */
export function flightNav(nav: MediumNav): FlightNav {
  if (nav.kind !== 'flight') throw wrongKind('nav', nav.kind);
  return nav as FlightNav;
}

/**
 * A rival's pilot memory as flight's.
 *
 * @throws {Error} When the memory was created by another medium.
 */
export function flightPilot(memory: PilotMemory): FlightPilot {
  if (memory.kind !== 'flight') throw wrongKind('pilot memory', memory.kind);
  return memory as FlightPilot;
}
