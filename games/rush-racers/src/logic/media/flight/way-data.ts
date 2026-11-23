/**
 * Flight's navigation and rival pilot shapes, extending the opaque bases in `media/types.ts` with
 * `kind: 'flight'`, and their accessors. The nav is two distance fields to the finish over 8
 * neighbours (one with puff clouds closed, one with them open at a price); the pilot remembers the
 * point on the way it flies toward, which field it follows, and whether it held Up last tick, so
 * every flap is a real press. The pilot reads the physics numbers it flies by from the effective
 * tuning by key (`flightPilotNumbers`).
 */
import { TICK_DT } from '@arcade/core';
import { type GridSize, type MoveModifiers, TILE, type Vec } from '../../types.ts';
import type { MediumNav, MediumTuning, PilotMemory } from '../types.ts';
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

/** The physics numbers a flight rival flies by, from the world's effective tuning and the racer's modifiers. */
export interface FlightPilotNumbers {
  /** Upward speed a flap leaves, px/s. */
  flapLift: number;
  /** Top horizontal speed it steers toward, px/s. */
  cruise: number;
  /** Ticks after a dash in which it still pops puff clouds. */
  dashTicks: number;
  /** Tiles a dash carries it while the dash still pops puff clouds; at least 1. */
  dashReachTiles: number;
}

/**
 * The pilot's numbers, read from `tuning` by key so they follow the physics' current values and
 * Easy's multipliers.
 *
 * @throws {Error} When `tuning.extra` lacks `flapLift`, `cruise` or `dashTicks`, which means the tuning isn't flight's.
 */
export function flightPilotNumbers(tuning: MediumTuning, mods: MoveModifiers): FlightPilotNumbers {
  const dashTicks = extraOf(tuning, 'dashTicks');
  const dashReachPx = tuning.kick * mods.kickMul * dashTicks * TICK_DT;
  return {
    flapLift: extraOf(tuning, 'flapLift'),
    cruise: extraOf(tuning, 'cruise'),
    dashTicks,
    dashReachTiles: Math.max(1, Math.floor(dashReachPx / TILE)),
  };
}

/**
 * One of flight's extras by key.
 *
 * @throws {Error} When `tuning.extra` has no `key`.
 */
function extraOf(tuning: MediumTuning, key: string): number {
  const value = tuning.extra[key];
  if (value === undefined) throw new Error(`Flight pilot needs tuning extra '${key}'; pass flight's effectiveTuning`);
  return value;
}
