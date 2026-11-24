/**
 * Run's navigation and rival pilot shapes, extending the opaque bases in `media/types.ts` with
 * `kind: 'run'`, and their accessors. The nav is a graph of links between stand tiles (`links.ts`)
 * solved for the least ticks to the finish (`nav.ts`); the pilot's memory holds the jump it is
 * flying and the recovery it is in.
 */

import type { GridSize } from '../../types.ts';
import type { MediumNav, PilotMemory } from '../types.ts';
import { wrongKind } from './data.ts';

/** How a runner gets from one stand tile to another; a bounce is a spring mushroom's launch. */
export type LinkKind = 'walk' | 'drop' | 'jump' | 'bounce';

/** One way from a stand tile to another, with the time it takes. */
export interface RunLink {
  kind: LinkKind;
  /** Index (`y * width + x`) of the stand tile it ends on. */
  to: number;
  /** The way it heads, -1 left or 1 right, from the start of the link to its end. */
  dir: -1 | 1;
  /** Ticks from leaving the stand tile to standing on `to`. */
  ticks: number;
  /** Ticks Up is held from the press, counting it: a jump's hold, or a bounce's for the higher launch; 0 otherwise. */
  holdTicks: number;
  /** True for a jump over a gap or off an edge: the runner takes off from the far edge of the stand tile for the most reach. */
  takeOffAtEdge: boolean;
}

/**
 * Run's navigation. A stand tile is an open tile with something to stand on under it. Every open
 * tile has an `anchor`, the stand tile whose distance it reads, so progress and the guide keep
 * working in the air.
 */
export interface RunNav extends MediumNav, GridSize {
  readonly kind: 'run';
  /** Ticks to the finish from each tile, indexed `y * width + x`; Infinity where unreachable or closed. */
  distance: Float32Array;
  /**
   * The index of the stand tile each open tile reads its distance from, indexed like `distance`: a
   * stand tile is its own anchor, an open tile above one anchors to the one it falls to, and one over
   * a pit to the nearest stand tile on its row. -1 for a closed tile or one with no anchor.
   */
  anchor: Int32Array;
  /** The link to follow from each stand tile (null off stand tiles, at the finish and where unreachable). */
  best: readonly (RunLink | null)[];
  /** Ticks a hop over another racer (Up held `HOP_HOLD_TICKS`, `nav.ts`) spends in the air on flat ground. */
  hopAirTicks: number;
}

/** A run rival's memory between ticks. */
export interface RunPilot extends PilotMemory {
  readonly kind: 'run';
  /** Ticks left to keep holding Up for the jump in progress; 0 when not jumping. */
  holdUpTicks: number;
  /** Up was pressed last tick, so a new jump has to let go of it first. */
  upHeld: boolean;
  /** True from the tick a jump or drop starts until the runner stands again. */
  inFlight: boolean;
  /** Index of the stand tile whose link the runner is following; null until it stands on one after a landing. */
  planTile: number | null;
  /** The `to` of the link being followed: set each tick on the ground, kept through the flight, null when no link is being followed. */
  landingTile: number | null;
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
