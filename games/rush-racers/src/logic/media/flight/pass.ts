/**
 * Passing a racer ahead in the air. An attempt to get past a racer lasts until the flyer is past it
 * or it is far ahead; each tick the flyer goes over or under it (keeping the side it chose while that
 * stays open, else the side its target lies on first) where the sky is open, the detour short and it
 * needn't cross the racer's own height to get there. An attempt that runs out of time or stops
 * gaining (two flyers at one speed) is given up, and the flyer follows that racer for a while before
 * trying again.
 */
import { hasClearSweep } from '../../ai/steer.ts';
import { centreOf } from '../../racers.ts';
import { type Racer, TILE, type World } from '../../types.ts';
import { CLIMB_MARGIN, type FlightPilotNumbers, flapRise } from './stick.ts';
import type { FlightPilot, Pass } from './way-data.ts';

/** Centre-to-centre px ahead within which a racer at the flyer's height is in its way. */
export const LOOK_AHEAD_PX = 3 * TILE;
/** Px of air kept between the two racers' boxes: vertically while passing, horizontally while following. */
export const GAP_PX = 4;
/** Px the passing altitude may lie from the height the flyer's target wants; further and the pass would leave the way. */
const PASS_DETOUR_PX = 2 * TILE;
/** Extra detour px allowed on the side it is already passing on, so a leader bobbing a little doesn't flip it to the other side. */
const KEEP_SIDE_SLACK_PX = TILE / 2;
/** Ticks an attempt to pass may take before the flyer gives it up (the racer ahead may be stuck, not slow). */
const PASS_TICKS = 180;
/** Ticks an attempt may go without gaining STALL_GAIN_PX on the racer before the flyer gives it up. */
const STALL_TICKS = 60;
/** Px it must gain on the racer for the attempt to count as getting anywhere; less is jitter between flyers at one speed. */
const STALL_GAIN_PX = 1;
/** Ticks a flyer that gave up an attempt follows that racer before it tries again. */
const PASS_REST_TICKS = 180;

/** How to fly a pass. */
export interface PassLine {
  /** The centre height (world px) to fly at. */
  altitude: number;
  /**
   * Passing under: the centre height the flyer must be below before it flaps, since a flap from
   * higher would lift it into the racer above. Null passing over.
   */
  flapBelow: number | null;
}

/**
 * The racer the flyer is still trying to pass (`memory.pass`), counting the attempt down; null, and
 * the attempt ended, once it is past that racer, the racer is far ahead or out of the race, or the
 * attempt ran out of ticks or stopped gaining, which also rests attempts on that racer.
 */
export function passingNow(world: World, racer: Racer, memory: FlightPilot, travel: -1 | 1): Racer | null {
  const attempt = memory.pass;
  if (!attempt) return null;
  const leader = world.racers.find((other) => other.id === attempt.id);
  const along = leader ? alongTo(racer, leader, travel) : 0;
  if (!leader || !racing(leader) || along < -(racer.body.w + GAP_PX) || along > LOOK_AHEAD_PX) {
    memory.pass = null;
    return null;
  }
  if (!gaining(attempt, along)) {
    memory.pass = null;
    memory.passRest = { id: leader.id, until: world.tick + PASS_REST_TICKS };
    return null;
  }
  return leader;
}

/**
 * The line to pass `leader` on this tick, starting an attempt on it if there is none; null when no
 * side is open (it follows instead, the attempt still counting down) or it gave up passing this
 * racer a short while ago. Records the side in the attempt.
 */
export function passLine(
  world: World,
  racer: Racer,
  memory: FlightPilot,
  numbers: FlightPilotNumbers,
  leader: Racer,
  travel: -1 | 1,
  wantedY: number,
): PassLine | null {
  if (memory.passRest?.id === leader.id && world.tick < memory.passRest.until) return null;
  const along = alongTo(racer, leader, travel);
  const attempt = memory.pass ?? { id: leader.id, side: null, ticksLeft: PASS_TICKS, closest: along, stalledTicks: 0 };
  memory.pass = attempt;
  const kept = attempt.side;
  const sides: readonly (-1 | 1)[] =
    kept !== null ? [kept, -kept as -1 | 1] : wantedY > centreOf(leader).y ? [1, -1] : [-1, 1];
  attempt.side = sides.find((side) => sideOpen(world, racer, leader, travel, side, wantedY, side === kept)) ?? null;
  return attempt.side === null ? null : lineOn(racer, leader, attempt.side, numbers);
}

/** Px `leader`'s centre is ahead of `racer`'s along `travel`; negative once it is behind. */
export function alongTo(racer: Racer, leader: Racer, travel: -1 | 1): number {
  return (centreOf(leader).x - centreOf(racer).x) * travel;
}

/** Still in the race: not finished and not fallen out of the sky. */
export function racing(racer: Racer): boolean {
  return racer.finished === null && racer.status.fallen === 0;
}

/** Counts a tick of `attempt` with the leader `along` px ahead; false once it is out of ticks or has stopped gaining. */
function gaining(attempt: Pass, along: number): boolean {
  attempt.ticksLeft--;
  if (along < attempt.closest - STALL_GAIN_PX) {
    attempt.closest = along;
    attempt.stalledTicks = 0;
  } else attempt.stalledTicks++;
  return attempt.ticksLeft > 0 && attempt.stalledTicks < STALL_TICKS;
}

/**
 * Whether the flyer can pass `leader` on `side` (-1 over, 1 under): it is on that side of the
 * leader's height already or far enough back to change height without touching it, the altitude
 * lies within PASS_DETOUR_PX of `wantedY` (plus KEEP_SIDE_SLACK_PX on the side it `keeps`), and the
 * lane is open (`laneOpen`).
 */
function sideOpen(
  world: World,
  racer: Racer,
  leader: Racer,
  travel: -1 | 1,
  side: -1 | 1,
  wantedY: number,
  keeps: boolean,
): boolean {
  const onSide = side * (centreOf(racer).y - centreOf(leader).y) >= 0;
  const clearBehind = alongTo(racer, leader, travel) > (racer.body.w + leader.body.w) / 2 + GAP_PX;
  if (!onSide && !clearBehind) return false;
  const altitude = passAltitude(racer, leader, side);
  const detour = PASS_DETOUR_PX + (keeps ? KEEP_SIDE_SLACK_PX : 0);
  return Math.abs(altitude - wantedY) <= detour && laneOpen(world, racer, leader, travel, altitude);
}

/**
 * The centre height to pass `leader` at on `side` (-1 over, 1 under): clear of its box by GAP_PX plus
 * the CLIMB_MARGIN the flyer sinks below a target before it flaps.
 */
function passAltitude(racer: Racer, leader: Racer, side: -1 | 1): number {
  return centreOf(leader).y + side * ((racer.body.h + leader.body.h) / 2 + GAP_PX + CLIMB_MARGIN);
}

/** The pass line on `side`; passing under, flaps wait until a whole flap's rise stays GAP_PX clear of `leader`. */
function lineOn(racer: Racer, leader: Racer, side: -1 | 1, numbers: FlightPilotNumbers): PassLine {
  const altitude = passAltitude(racer, leader, side);
  if (side < 0) return { altitude, flapBelow: null };
  const clear = (racer.body.h + leader.body.h) / 2 + GAP_PX + flapRise(numbers);
  return { altitude, flapBelow: centreOf(leader).y + clear };
}

/**
 * True when `racer` can move straight up or down to `altitude` and fly level there to LOOK_AHEAD_PX
 * past `leader` without touching a solid tile.
 */
function laneOpen(world: World, racer: Racer, leader: Racer, travel: -1 | 1, altitude: number): boolean {
  const { level, broken } = world;
  const centre = centreOf(racer);
  if (!hasClearSweep(level, broken, racer.body, { x: centre.x, y: altitude })) return false;
  const shifted = { ...racer.body, y: altitude - racer.body.h / 2 };
  return hasClearSweep(level, broken, shifted, { x: centreOf(leader).x + travel * LOOK_AHEAD_PX, y: altitude });
}
