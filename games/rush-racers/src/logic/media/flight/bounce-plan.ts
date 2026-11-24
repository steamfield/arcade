/**
 * Bounce clouds: when the way ahead climbs and a bounce pad lies a little ahead and below in clear
 * sight, a flight rival drops onto it and springs up instead of flapping the whole climb, if that
 * reaches the top of the climb at least MIN_SAVING_SECONDS sooner (`bounce-timing.ts`). Whether it
 * takes one is a skill roll against `1 - wobble`; turning one down, and every bounce, rests the plan
 * for BOUNCE_REST_TICKS, so it judges a pad once and never bounces again in place.
 */

import { hasClearSweep } from '../../ai/steer.ts';
import { tileCentre } from '../../level/query.ts';
import { centreOf } from '../../racers.ts';
import type { Racer, Vec, World } from '../../types.ts';
import { mediumOf } from '../index.ts';
import { type ClimbSpeeds, secondsByBounce, secondsByFlapping } from './bounce-timing.ts';
import { type FlightPilotNumbers, flapAgainSpeed, flapClimbSpeed } from './stick.ts';
import { flightBouncePads, flightRouteDistanceAt, flightWayAhead } from './way.ts';
import type { FlightPilot, FlightRoute } from './way-data.ts';

/** Tiles of the way ahead read for a climb. */
const CLIMB_LOOK_TILES = 12;
/** Rows the way ahead must rise before a bounce is worth judging. */
const MIN_CLIMB_ROWS = 4;
/** Tiles to either side a pad may lie from the flyer. */
const PAD_REACH_TILES = 8;
/** Seconds a bounce must save over flapping to the top of the climb. */
const MIN_SAVING_SECONDS = 0.1;
/** Tiles further from the finish than the flyer the tile above a pad may be. */
const DETOUR_TILES = 2;
/** Ticks a bounce plan lasts before the flyer gives up on the pad. */
const BOUNCE_PLAN_TICKS = 90;
/** Ticks after a bounce, or a pad turned down, before it plans another. */
const BOUNCE_REST_TICKS = 120;
/** Share of the bounce speed that, rising, means the flyer has sprung off its pad. */
const SPRUNG_SHARE = 0.9;

/**
 * Plans a bounce from `tile` when one pays: sets `memory.bounce` to the pad that saves the most time
 * and returns it, after `roll` (a fresh draw in [0, 1)) passes against `1 - wobble`. A failed roll
 * rests the plan instead. Null when the medium has no bounce clouds, the plan is resting, the way
 * doesn't climb, or no pad pays.
 *
 * @throws {Error} When the world's nav isn't flight's, or it names a medium that is neither shipped nor registered.
 */
export function planBounce(
  world: World,
  racer: Racer,
  memory: FlightPilot,
  tile: Vec,
  numbers: FlightPilotNumbers,
  roll: number,
): Vec | null {
  const { bounceSpeed } = mediumOf(world).effects;
  if (bounceSpeed === null || memory.bounceRestTicks > 0) return null;
  const top = climbTop(world, tile, memory.route);
  if (!top) return null;
  const speeds: ClimbSpeeds = {
    cruise: numbers.cruise,
    climb: flapClimbSpeed(numbers),
    flapAgain: flapAgainSpeed(numbers),
    gravity: numbers.gravity,
    bounce: bounceSpeed,
  };
  const pad = bestPad(world, racer, memory.route, tile, top, speeds);
  if (!pad) return null;
  if (roll >= 1 - racer.profile.wobble) {
    memory.bounceRestTicks = BOUNCE_REST_TICKS;
    return null;
  }
  memory.bounce = { pad, ticksLeft: BOUNCE_PLAN_TICKS };
  return pad;
}

/**
 * Whether the bounce in `memory.bounce` is still on: it has ticks left and the flyer hasn't sprung
 * yet. Once it ends the flyer forgets it, rests the plan and replans at once.
 *
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function bounceStillPlanned(world: World, racer: Racer, memory: FlightPilot): boolean {
  const plan = memory.bounce;
  if (!plan) return false;
  plan.ticksLeft--;
  const { bounceSpeed } = mediumOf(world).effects;
  const sprung = bounceSpeed !== null && racer.body.vy <= -bounceSpeed * SPRUNG_SHARE;
  if (plan.ticksLeft > 0 && !sprung) return true;
  memory.bounce = null;
  memory.bounceRestTicks = BOUNCE_REST_TICKS;
  memory.replanIn = 0;
  return false;
}

/** The highest tile of the way ahead of `tile` on `route` when it rises at least MIN_CLIMB_ROWS; else null. */
function climbTop(world: World, tile: Vec, route: FlightRoute): Vec | null {
  let top: Vec | null = null;
  for (const step of flightWayAhead(world, tile, CLIMB_LOOK_TILES, route)) {
    if (!top || step.y < top.y) top = step;
  }
  return top && top.y <= tile.y - MIN_CLIMB_ROWS ? top : null;
}

/**
 * The pad, of those that are within reach, at or below the flyer, in clear sight and little detour,
 * that reaches `top` soonest, when it saves MIN_SAVING_SECONDS over flapping there; else null.
 */
function bestPad(world: World, racer: Racer, route: FlightRoute, tile: Vec, top: Vec, speeds: ClimbSpeeds): Vec | null {
  const from = centreOf(racer);
  const topCentre = tileCentre(top);
  let best: Vec | null = null;
  let bestSeconds = secondsByFlapping(from, topCentre, speeds) - MIN_SAVING_SECONDS;
  for (const pad of flightBouncePads(world)) {
    const landing = { x: pad.x, y: pad.y - 1 };
    if (!padInReach(world, racer, route, tile, landing)) continue;
    const seconds = secondsByBounce(from, tileCentre(landing), topCentre, speeds);
    if (seconds >= bestSeconds) continue;
    best = pad;
    bestSeconds = seconds;
  }
  return best;
}

/**
 * Whether the flyer at `tile` can drop onto a pad whose open tile above is `landing`: within
 * PAD_REACH_TILES across, at or below it, no more than DETOUR_TILES further from the finish on
 * `route`, and in clear sight.
 */
function padInReach(world: World, racer: Racer, route: FlightRoute, tile: Vec, landing: Vec): boolean {
  if (Math.abs(landing.x - tile.x) > PAD_REACH_TILES || landing.y < tile.y) return false;
  const detour = flightRouteDistanceAt(world, landing, route) - flightRouteDistanceAt(world, tile, route);
  if (!(detour <= DETOUR_TILES)) return false;
  return hasClearSweep(world.level, world.broken, racer.body, tileCentre(landing));
}
