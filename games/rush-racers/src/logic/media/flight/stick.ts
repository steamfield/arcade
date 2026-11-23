/**
 * The stick a flight rival holds toward its target, and the physics numbers it flies by. Vertically
 * it flaps with real presses (Up let go between flaps, pressed only once the flap is ready) while
 * the target is above, holds Up after a flap to glide down to it while it is a little below, and
 * dives when it is further below; horizontally it eases toward the target's column. The numbers come
 * from flight's physics (`flightExtra`, `dashReachPx`), so they follow its current values and Easy's
 * multipliers.
 */
import { type MoveModifiers, type Racer, TILE } from '../../types.ts';
import type { MediumTuning } from '../types.ts';
import { flightMotion } from './data.ts';
import { dashReachPx, flapReadyNextTick, flightExtra } from './physics.ts';
import type { FlightPilot } from './way-data.ts';

/** Px the target may sit above the flyer's centre before it flaps. */
const CLIMB_MARGIN = 4;
/** It flaps again only once a flap's rise has slowed to this, as a share of the flap's lift. */
const FLAP_AGAIN_RISE = 0.4;
/** Target this far below, in tiles, and it dives. */
const DIVE_BELOW_TILES = 2;
/** Px/s of horizontal speed wanted per px of distance to the target, so it slows as it lines up. */
const APPROACH_GAIN = 6;
/** Px/s either side of the wanted horizontal speed where it lets go of the stick. */
const SPEED_SLACK = 10;

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
 * The pilot's numbers, read from flight's `tuning` and the racer's `mods`.
 *
 * @throws {Error} When `tuning` lacks one of flight's extras, which means the tuning isn't flight's.
 */
export function flightPilotNumbers(tuning: MediumTuning, mods: MoveModifiers): FlightPilotNumbers {
  const { flapLift, cruise, dashTicks } = flightExtra(tuning);
  return {
    flapLift,
    cruise,
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
 * Left (-1), right (1) or nothing (0) toward a target `dx` px right of the flyer's centre, easing off
 * as it lines up so momentum doesn't carry it past. Over cruise toward a far target (after a dash or
 * a dive) it keeps holding on, since air drag bleeds the surplus and pushing back would throw the
 * speed away.
 */
export function horizontalStick(racer: Racer, { cruise }: FlightPilotNumbers, dx: number): number {
  const wanted = Math.max(-cruise, Math.min(cruise, dx * APPROACH_GAIN));
  const vx = racer.body.vx;
  if (Math.abs(wanted) === cruise && vx * wanted > cruise * cruise) return Math.sign(wanted);
  if (vx < wanted - SPEED_SLACK) return 1;
  if (vx > wanted + SPEED_SLACK) return -1;
  return 0;
}
