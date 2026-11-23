/**
 * Ring lines: the next boost ring a flight rival flies through. Flying across at cruise while
 * climbing or dropping costs no forward speed, so a ring counts when the racer hasn't passed it yet,
 * it lies ahead within RING_LOOK_TILES columns, getting there is progress on the field the rival
 * follows (the field drops by about the columns crossed, so the ring isn't off to the side of the
 * way), its height is reachable in those columns, and it is in clear sight. Whether the rival takes a
 * ring is a skill roll against `1 - wobble`, judged once per ring, so a loose flyer skips more.
 */
import { hasClearSweep } from '../../ai/steer.ts';
import { centreOf } from '../../racers.ts';
import { type Racer, TILE, type Vec, type World } from '../../types.ts';
import { flightRouteDistanceAt } from './way.ts';
import type { FlightPilot } from './way-data.ts';

/** Most columns ahead a ring may lie. */
const RING_LOOK_TILES = 8;
/** Tiles of field progress a ring may fall short of the columns crossed to reach it. */
const RING_DETOUR_TILES = 1;
/** Rows a flyer climbs per column it crosses at cruise, flapping: a little under one. */
const CLIMB_ROWS_PER_COLUMN = 0.8;
/** Rows it can drop per column it crosses at cruise, diving. */
const DROP_ROWS_PER_COLUMN = 2;
/** Px past a ring's centre the flyer aims, so it flies through at speed rather than easing to a stop in it. */
const RING_THROUGH_PX = TILE;

/**
 * The index in `level.rings` of the ring `racer` flies through next from `tile`, or null when none
 * counts or the skill roll turns it down. `roll` is a fresh draw in [0, 1); the verdict on a ring
 * is kept in `memory.ringRoll`.
 *
 * @throws {Error} When the world's nav isn't flight's.
 */
export function ringToFly(world: World, racer: Racer, memory: FlightPilot, tile: Vec, roll: number): number | null {
  const here = flightRouteDistanceAt(world, tile, memory.route);
  const passed = world.ringsPassed[racer.id];
  let next: number | null = null;
  let nextColumns = Number.POSITIVE_INFINITY;
  for (const [index, ring] of world.level.rings.entries()) {
    const columns = Math.abs(ring.x - tile.x);
    if (passed.includes(index) || columns >= nextColumns || !reachable(tile, ring)) continue;
    const progress = here - flightRouteDistanceAt(world, ring, memory.route);
    if (!(progress > 0 && progress >= columns - RING_DETOUR_TILES)) continue;
    if (!hasClearSweep(world.level, world.broken, racer.body, ringCentre(ring))) continue;
    next = index;
    nextColumns = columns;
  }
  return next !== null && takesRing(racer, memory, next, roll) ? next : null;
}

/**
 * The point (world px) to fly at for ring `index`: its centre, pushed RING_THROUGH_PX on along the
 * way the flyer crosses it.
 *
 * @throws {Error} When the level has no ring `index`.
 */
export function ringAimPoint(world: World, racer: Racer, index: number): Vec {
  const ring = world.level.rings[index];
  if (!ring) throw new Error(`Level has ${world.level.rings.length} rings, so it has no ring ${index}`);
  const centre = ringCentre(ring);
  const travel = Math.sign(centre.x - centreOf(racer).x) || racer.facing;
  return { x: centre.x + travel * RING_THROUGH_PX, y: centre.y };
}

/** Whether a flyer at `tile` can reach `ring`'s row in the columns between them, and it is within RING_LOOK_TILES of them. */
function reachable(tile: Vec, ring: Vec): boolean {
  const columns = Math.abs(ring.x - tile.x);
  if (columns === 0 || columns > RING_LOOK_TILES) return false;
  const rise = tile.y - ring.y;
  return rise > 0 ? rise <= columns * CLIMB_ROWS_PER_COLUMN : -rise <= columns * DROP_ROWS_PER_COLUMN;
}

/** The skill verdict on ring `ring`: rolled once against `1 - wobble`, then remembered until another ring comes up. */
function takesRing(racer: Racer, memory: FlightPilot, ring: number, roll: number): boolean {
  if (memory.ringRoll?.ring !== ring) memory.ringRoll = { ring, takes: roll < 1 - racer.profile.wobble };
  return memory.ringRoll.takes;
}

/** A ring tile's centre in world px. */
function ringCentre(ring: Vec): Vec {
  return { x: (ring.x + 0.5) * TILE, y: (ring.y + 0.5) * TILE };
}
