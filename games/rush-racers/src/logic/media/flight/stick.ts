/**
 * The stick a flight rival holds toward its target, and the physics numbers it flies by. Vertically
 * it flaps with real presses (Up let go between flaps, pressed only once the flap is ready) while
 * the target is above, holds Up after a flap to glide down to it while it is a little below, and
 * dives when it is further below; horizontally it eases toward the target's column or holds a wanted
 * speed (following a racer it can't pass). The numbers come from flight's physics (`flightExtra`,
 * `dashReachPx`, `cruiseSpeed`, `windDrift`), so they follow its current values, Easy's multipliers,
 * the racer's own `forceMul` (catch-up, a ring's boost) and the air it is in.
 */
import { type MoveModifiers, type Racer, TILE } from '../../types.ts';
import type { MediumTuning } from '../types.ts';
import { cruiseSpeed, windDrift } from './cruise.ts';
import { type FlightEnv, flightMotion } from './data.ts';
import { dashReachPx, flapReadyNextTick, flightExtra } from './physics.ts';
import type { FlightPilot } from './way-data.ts';

/** Px the target may sit above the flyer's centre before it flaps. */
export const CLIMB_MARGIN = 4;
/** It flaps again only once a flap's rise has slowed to this, as a share of the flap's lift. */
const FLAP_AGAIN_RISE = 0.4;
/** Target this far below, in tiles, and it dives. */
const DIVE_BELOW_TILES = 2;
/** Px/s of horizontal speed wanted per px of distance to the target, so it slows as it lines up. */
const APPROACH_GAIN = 6;
/** Px/s either side of the wanted horizontal speed where it lets go of the stick. */
const SPEED_SLACK = 10;
/** Px/s² it plans to brake at when stopping at a point: under flight's `force`, so the stick can always do it. */
const STOP_DECEL = 220;

/** The physics numbers a flight rival flies by, from the world's effective tuning and the racer's modifiers. */
export interface FlightPilotNumbers {
  /** Upward speed a flap leaves, px/s. */
  flapLift: number;
  /** Downward pull with no stick, px/s². */
  gravity: number;
  /** Px/s holding a direction settles at in still air: its own cruise, from its forceMul and any fog. */
  cruise: number;
  /** Px/s the gust it is in adds along x (signed); 0 out of the wind. */
  drift: number;
  /** Ticks after a dash in which it still pops puff clouds. */
  dashTicks: number;
  /** Tiles a dash carries it while the dash still pops puff clouds; at least 1. */
  dashReachTiles: number;
}

/**
 * The pilot's numbers, read from flight's `tuning`, the racer's `mods` and the `air` it is in.
 *
 * @throws {Error} When `tuning` lacks one of flight's extras, which means the tuning isn't flight's.
 */
export function flightPilotNumbers(tuning: MediumTuning, mods: MoveModifiers, air: FlightEnv): FlightPilotNumbers {
  const extra = flightExtra(tuning);
  const { flapLift, gravity, dashTicks } = extra;
  return {
    flapLift,
    gravity,
    cruise: cruiseSpeed(extra, mods, air),
    drift: windDrift(extra, air),
    dashTicks,
    dashReachTiles: Math.max(1, Math.floor(dashReachPx(tuning, mods) / TILE)),
  };
}

/**
 * Up (-1), nothing (0) or Down (1) toward a target `dy` px below the flyer's centre: flap with a
 * real press while the target is above, keep holding Up after a flap to glide down to it while it
 * is up to DIVE_BELOW_TILES below, dive when it is further. Records whether Up is held in `memory`.
 *
 * @throws {Error} When the racer's motion isn't flight's.
 */
export function verticalStick(racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers, dy: number): number {
  if (dy < -CLIMB_MARGIN) return climbPress(racer, memory, numbers, dy) ? -1 : 0;
  if (dy > DIVE_BELOW_TILES * TILE) {
    memory.upHeld = false;
    return 1;
  }
  // A held Up after a flap glides; never a new press, which would flap.
  return memory.upHeld ? -1 : 0;
}

/**
 * Up (-1) only while Up is already held, else nothing: it glides on a flap it has made but never
 * presses afresh, so it never flaps.
 */
export function glideStick(memory: FlightPilot): number {
  return memory.upHeld ? -1 : 0;
}

/**
 * Whether to hold Up this tick to climb toward a target `dy` px below the flyer's centre: press once
 * the flap is ready and the last flap's rise has slowed, let go the tick before so the press is
 * fresh, and keep gliding while waiting. Records the answer in `memory.upHeld`.
 *
 * @throws {Error} When the racer's motion isn't flight's.
 */
export function climbPress(racer: Racer, memory: FlightPilot, { flapLift }: FlightPilotNumbers, dy: number): boolean {
  const wantsFlap = dy < -CLIMB_MARGIN && racer.body.vy > -flapLift * FLAP_AGAIN_RISE;
  const ready = flapReadyNextTick(flightMotion(racer.motion));
  const up = wantsFlap && ready ? !memory.upHeld : memory.upHeld && !ready;
  memory.upHeld = up;
  return up;
}

/**
 * The upward speed, px/s, that flapping as `climbPress` does averages: each flap's rise slows evenly
 * from `flapLift` to FLAP_AGAIN_RISE of it before the next.
 */
export function flapClimbSpeed({ flapLift }: FlightPilotNumbers): number {
  return (flapLift * (1 + FLAP_AGAIN_RISE)) / 2;
}

/** Px one flap lifts the flyer from where it was pressed to the top of its rise. */
export function flapRise({ flapLift, gravity }: FlightPilotNumbers): number {
  return (flapLift * flapLift) / (2 * gravity);
}

/** The upward speed, px/s, at or below which `climbPress` flaps again. */
export function flapAgainSpeed({ flapLift }: FlightPilotNumbers): number {
  return flapLift * FLAP_AGAIN_RISE;
}

/**
 * Left (-1), right (1) or nothing (0) toward a target `dx` px right of the flyer's centre, easing off
 * as it lines up so momentum doesn't carry it past. Toward a far target it holds on flat out: at its
 * own cruise plus any gust's drift, and over that (after a dash, a dive or a ring's boost) too,
 * since air drag bleeds the surplus and pushing back would throw the speed away.
 */
export function horizontalStick(racer: Racer, { cruise, drift }: FlightPilotNumbers, dx: number): number {
  const eased = dx * APPROACH_GAIN;
  if (Math.abs(eased) >= cruise) return Math.sign(dx);
  return speedStick(racer, Math.max(drift - cruise, Math.min(drift + cruise, eased)));
}

/**
 * Left (-1), right (1) or nothing (0) to stop with its centre `dx` px right of where it is: no faster
 * than cruise, and slow enough to brake to a stop there at STOP_DECEL, pushing back against any speed
 * a dash or dive left it with.
 */
export function stopStick(racer: Racer, { cruise }: FlightPilotNumbers, dx: number): number {
  const braking = Math.sqrt(2 * STOP_DECEL * Math.abs(dx));
  return speedStick(racer, Math.sign(dx) * Math.min(cruise, braking, Math.abs(dx) * APPROACH_GAIN));
}

/** Left (-1), right (1) or nothing (0) to bring the flyer's horizontal speed to `wanted` px/s. */
export function speedStick(racer: Racer, wanted: number): number {
  const vx = racer.body.vx;
  if (vx < wanted - SPEED_SLACK) return 1;
  if (vx > wanted + SPEED_SLACK) return -1;
  return 0;
}
