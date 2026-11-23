/**
 * Flight's navigation and rival pilot shapes, extending the opaque bases in `media/types.ts` with
 * `kind: 'flight'`, and their accessors. The nav is two distance fields to the finish over 8
 * neighbours (one with puff clouds closed, one with them open at a price); the pilot remembers the
 * point on the way it flies toward, which field it follows, and whether it held Up last tick, so
 * every flap is a real press.
 */
import type { GridSize, Vec } from '../../types.ts';
import type { MediumNav, PilotMemory } from '../types.ts';
import { wrongKind } from './data.ts';

/**
 * Flight's navigation: distances to the finish from each tile, indexed `y * width + x`, in tiles.
 * Both fields are Infinity where the finish can't be reached or the tile is closed.
 */
export interface FlightNav extends MediumNav, GridSize {
  readonly kind: 'flight';
  /** The way every flyer follows: rock and unbroken puff clouds closed. */
  steer: Float32Array;
  /** The way for a flyer with a dash ready: unbroken puff clouds open at a price, since a dash pops them. */
  ram: Float32Array;
}

/** Which of the nav's fields a rival follows: `steer`, or `ram` while it means to dash through a puff cloud. */
export type FlightRoute = 'steer' | 'ram';

/** A flight rival's memory between ticks. */
export interface FlightPilot extends PilotMemory {
  readonly kind: 'flight';
  /** Up was pressed last tick, so the next flap has to let go of it first. */
  upHeld: boolean;
  /** The tile on the way it is flying toward, without wobble; null until it first plans. */
  waypoint: Vec | null;
  /** The point (world px) it is flying toward: `waypoint`'s centre with its wobble; set when it replans. */
  target: Vec;
  /** Unit aim from the flyer toward `target`, as of the last tick. */
  aim: Vec;
  /** Ticks until it reads the way again (`reactionTicks` apart); 0 replans this tick. */
  replanIn: number;
  /** Ticks left of a stuck recovery; 0 when not recovering. */
  recoverTicks: number;
  /** The way it backs off during a recovery. */
  recoverDir: -1 | 1;
  /** The field it follows, chosen when it replans. */
  route: FlightRoute;
  /** Ticks before it may choose the ram field again, so a dash that didn't pop a cloud isn't retried at once. */
  ramRestTicks: number;
  /** The puff cloud it dashed at and the ticks left of that dash's window; null when not dashing at one. */
  puffDash: { tile: Vec; ticksLeft: number } | null;
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
