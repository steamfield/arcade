/**
 * Run's navigation and rival pilot shapes, extending the opaque bases in `media/types.ts` with
 * `kind: 'run'`, and their accessors. Phase 2's simple way and pilot fill them; the jump-link nav
 * replaces their insides later without changing generic code.
 */

import type { GridSize } from '../../types.ts';
import type { MediumNav, PilotMemory } from '../types.ts';
import { wrongKind } from './data.ts';

/** Run's navigation: a distance to the finish per tile, and how long to hold Up for each jump height. */
export interface RunNav extends MediumNav, GridSize {
  readonly kind: 'run';
  /** Distance to the finish in tiles, indexed `y * width + x`. */
  distance: Float32Array;
  /**
   * Ticks Up must be held for a jump that lifts the feet onto ground `index` tiles higher, worked out
   * from the world's tuning. The last index is the highest ground a full jump reaches.
   */
  jumpHoldTicks: readonly number[];
}

/** A run rival's memory between ticks. */
export interface RunPilot extends PilotMemory {
  readonly kind: 'run';
  /** Ticks left to keep holding Up for the jump in progress; 0 when not jumping. */
  holdUpTicks: number;
  /** Up was pressed last tick, so a new jump has to let go of it first. */
  upHeld: boolean;
  /** Ticks left of a stuck recovery; 0 when not recovering. */
  recoverTicks: number;
  /** Which way the finish lay when the recovery started: it backs off the other way, then jumps this way. */
  recoverDir: -1 | 1;
}

/**
 * The world's nav as run's.
 *
 * @throws {Error} When the nav was built by another medium.
 */
export function runNav(nav: MediumNav): RunNav {
  if (nav.kind !== 'run') throw wrongKind('nav', nav.kind);
  return nav as RunNav;
}

/**
 * A rival's pilot memory as run's.
 *
 * @throws {Error} When the memory was created by another medium.
 */
export function runPilot(memory: PilotMemory): RunPilot {
  if (memory.kind !== 'run') throw wrongKind('pilot memory', memory.kind);
  return memory as RunPilot;
}
