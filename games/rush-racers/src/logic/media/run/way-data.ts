/**
 * Run's navigation and rival pilot shapes, extending the opaque bases in `media/types.ts` with
 * `kind: 'run'`, and their accessors. Phase 2's simple way and pilot fill them; the jump-link nav
 * replaces their insides later without changing generic code.
 */

import type { GridSize } from '../../types.ts';
import type { MediumNav, PilotMemory } from '../types.ts';
import { wrongKind } from './data.ts';

/** Run's navigation: a distance to the finish per tile, indexed `y * width + x`, in tiles. */
export interface RunNav extends MediumNav, GridSize {
  readonly kind: 'run';
  distance: Float32Array;
}

/** A run rival's memory between ticks. */
export interface RunPilot extends PilotMemory {
  readonly kind: 'run';
  /** Ticks left to keep holding Up for the jump in progress; 0 when not jumping. */
  holdUpTicks: number;
  /** Ticks left of a stuck recovery; 0 when not recovering. */
  recoverTicks: number;
  /** Which way a recovery runs: -1 left, 1 right. */
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
