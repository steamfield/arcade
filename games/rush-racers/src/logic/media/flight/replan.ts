/**
 * How a flight rival reads the way again: which field to follow, the waypoint a few tiles along it,
 * and the point to fly at, which is a set piece's when one pays (a bounce pad when the way climbs,
 * `bounce-plan.ts`, or the next ring of a ring line, `ring-line.ts`) and the waypoint's centre
 * otherwise. The profile's `wobble` jitters that point's height and reach, and short of a storm zone
 * it can't cross before the strike the point is pulled back to the wait spot (`storm.ts`). The next
 * read comes `reactionTicks` later.
 */
import { tileCentre, tileOf } from '../../ai/steer.ts';
import { centreOf } from '../../racers.ts';
import { type Racer, TILE, type Vec, type World } from '../../types.ts';
import type { AiDraws } from '../types.ts';
import { planBounce } from './bounce-plan.ts';
import { choosesRam } from './dashes.ts';
import { ringAimPoint, ringToFly } from './ring-line.ts';
import type { FlightPilotNumbers } from './stick.ts';
import { stormWait } from './storm.ts';
import { flightCornerAhead, flightRouteDistanceAt } from './way.ts';
import type { FlightPilot, FlightRoute } from './way-data.ts';

/** Most tiles along the way the pilot flies toward (it stops at a turn). */
const LOOKAHEAD_TILES = 3;
/** Largest jitter, in tiles, a wobble of 1 puts on the target's height and reach. */
const WOBBLE_TILES = 1.5;
/** Share of the height jitter put on the target's reach. */
const WOBBLE_REACH_SHARE = 0.5;

/**
 * Reads the way again: picks a field and the waypoint `LOOKAHEAD_TILES` along it (or keeps the old
 * one unless `lost`), then sets `memory.target` to the point to fly at, jittered by the profile's
 * wobble, and stops it short of a storm zone it can't cross yet. Mutates only `memory`.
 *
 * @throws {Error} When the world's nav isn't flight's, or it names a medium that is neither shipped nor registered.
 */
export function replan(
  world: World,
  racer: Racer,
  memory: FlightPilot,
  numbers: FlightPilotNumbers,
  draws: AiDraws,
  lost: boolean,
): void {
  const tile = tileOf(centreOf(racer));
  const route = choosesRam(world, racer, memory, tile, draws.kick) ? 'ram' : 'steer';
  const ahead = flightCornerAhead(world, tile, LOOKAHEAD_TILES, route);
  const kept = lost || route !== memory.route ? null : furtherAlong(world, route, memory.waypoint, ahead);
  memory.route = route;
  memory.waypoint = kept ?? ahead;
  const point = setPiecePoint(world, racer, memory, numbers, tile, draws.side) ?? tileCentre(memory.waypoint);
  const jitter = (draws.wobble * 2 - 1) * racer.profile.wobble * WOBBLE_TILES * TILE;
  memory.target = { x: point.x + jitter * WOBBLE_REACH_SHARE, y: point.y + jitter };
  memory.stormHold = stormWait(world, racer, route, tile, numbers);
  if (memory.stormHold) memory.target.x = memory.stormHold.x;
  memory.replanIn = Math.max(0, racer.profile.reactionTicks - 1);
}

/**
 * The point a set piece wants it to fly at from `tile` on its route: a bounce pad's centre when it
 * plans a bounce, else the next ring of a ring line; null when neither. `roll` is the skill draw,
 * spent on one set piece per replan.
 */
function setPiecePoint(
  world: World,
  racer: Racer,
  memory: FlightPilot,
  numbers: FlightPilotNumbers,
  tile: Vec,
  roll: number,
): Vec | null {
  memory.ring = null;
  const restBefore = memory.bounceRestTicks;
  const pad = planBounce(world, racer, memory, tile, numbers, roll);
  if (pad) {
    // Up let go, so it falls onto the pad rather than gliding down to it.
    memory.upHeld = false;
    return tileCentre(pad);
  }
  // A pad turned down spent this replan's roll; the next replan judges the ring with a fresh draw.
  if (memory.bounceRestTicks > restBefore) return null;
  memory.ring = ringToFly(world, racer, memory, tile, roll);
  return memory.ring === null ? null : ringAimPoint(world, racer, memory.ring);
}

/**
 * The old waypoint when it is further along `route` than the new one, else null. A flyer that bobs
 * back up a shaft it was leaving reads a waypoint behind the one it already had; keeping the old
 * one stops it turning back to the corner over and over.
 */
function furtherAlong(world: World, route: FlightRoute, old: Vec | null, ahead: Vec): Vec | null {
  if (!old) return null;
  const oldDistance = flightRouteDistanceAt(world, old, route);
  return oldDistance < flightRouteDistanceAt(world, ahead, route) ? old : null;
}
