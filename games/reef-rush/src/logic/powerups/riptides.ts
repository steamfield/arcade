/**
 * Riptide lanes: strong currents laid by a Riptide burst (or by a surfline at the end of the dash).
 * A lane is an axis-aligned box along the aim's dominant axis, `RIPTIDE.widthTiles` wide, clipped at
 * the first solid tile on its centre line. `stepWorld` calls `advanceRiptides` after projectiles and
 * asks `feltCurrent` while each racer swims, so anyone inside a lane rides it: a racer right behind
 * the one who laid it drafts it.
 */
import { mayAttack } from '../difficulty-level.ts';
import { isSolid } from '../level/query.ts';
import { centreOf } from '../racers.ts';
import { type Body, type Racer, type RacerId, type Riptide, TILE, type Vec, type World } from '../types.ts';
import { RIPTIDE } from './tuning.ts';

/** How long and how strong a lane is: the plain Riptide's or the surfline's (`RIPTIDE.surfline`). */
export interface LaneSize {
  lengthTiles: number;
  /** Times a plain current's push. */
  strength: number;
}

/** The plain Riptide burst's lane. */
export const PLAIN_LANE: LaneSize = { lengthTiles: RIPTIDE.lengthTiles, strength: RIPTIDE.currentForceMul };

/** The surfline combo's lane: longer and stronger. */
export const SURFLINE_LANE: LaneSize = {
  lengthTiles: RIPTIDE.surfline.lengthTiles,
  strength: RIPTIDE.surfline.currentForceMul,
};

/**
 * Lays a lane from `racer`'s centre along `aim` (snapped to its dominant axis, horizontal on a tie),
 * `RIPTIDE.widthTiles` wide and up to `lane.lengthTiles` long, cut short at the first solid tile on
 * its centre line, lasting RIPTIDE.ttlTicks. Emits `riptide.spawned`. Does nothing, emitting
 * nothing, when a solid tile is right at the racer's centre.
 *
 * @param aim Unit direction.
 */
export function layRiptide(world: World, racer: Racer, aim: Vec, lane: LaneSize): void {
  const dir: Vec =
    Math.abs(aim.x) >= Math.abs(aim.y) ? { x: Math.sign(aim.x) || 1, y: 0 } : { x: 0, y: Math.sign(aim.y) };
  const origin = centreOf(racer);
  const length = clearLength(world, origin, dir, lane.lengthTiles * TILE);
  if (length <= 0) return;
  const width = RIPTIDE.widthTiles * TILE;
  const along = dir.x !== 0;
  world.riptides.push({
    x: along ? (dir.x > 0 ? origin.x : origin.x - length) : origin.x - width / 2,
    y: along ? origin.y - width / 2 : dir.y > 0 ? origin.y : origin.y - length,
    w: along ? length : width,
    h: along ? width : length,
    dir,
    ttl: RIPTIDE.ttlTicks,
    owner: racer.id,
    strength: lane.strength,
  });
  world.events.emit({ type: 'riptide.spawned', owner: racer.id });
}

/** Pixels from `origin` along the unit axis `dir` before the first solid tile, at most `max`. */
function clearLength(world: World, origin: Vec, dir: Vec, max: number): number {
  const { level, broken } = world;
  const step = TILE / 2;
  for (let travelled = 0; travelled <= max; travelled += step) {
    const x = origin.x + dir.x * travelled;
    const y = origin.y + dir.y * travelled;
    if (isSolid(level, broken, Math.floor(x / TILE), Math.floor(y / TILE))) return Math.max(0, travelled - step);
  }
  return max;
}

/** The riptides slot of `stepWorld`: takes a tick off every lane and removes those that ran out. */
export function advanceRiptides(world: World): void {
  for (const lane of world.riptides) lane.ttl -= 1;
  world.riptides = world.riptides.filter((lane) => lane.ttl > 0);
}

function contains(lane: Riptide, point: Vec): boolean {
  return point.x >= lane.x && point.x < lane.x + lane.w && point.y >= lane.y && point.y < lane.y + lane.h;
}

/**
 * The current of the first riptide lane a body's centre is inside, or null outside every lane: the
 * lane's unit direction scaled by its strength (in plain-current pushes), so a lane's pull is
 * swim's `currentForce` (`SWIM_TUNING.extra`) times the vector's length. A lane's strength is `lane.strength`, or
 * `RIPTIDE.currentForceMul` when it has none. With `felt` (the racer riding it), a lane the level doesn't
 * let its owner turn on that racer (`mayAttack`) is skipped.
 */
export function riptideCurrentAt(world: World, body: Body, felt?: RacerId): Vec | null {
  const centre = { x: body.x + body.w / 2, y: body.y + body.h / 2 };
  const lane = world.riptides.find(
    (candidate) => contains(candidate, centre) && (felt === undefined || mayAttack(world, candidate.owner, felt)),
  );
  if (!lane) return null;
  const strength = lane.strength ?? RIPTIDE.currentForceMul;
  return { x: lane.dir.x * strength, y: lane.dir.y * strength };
}

/**
 * The current a racer swims in this tick: a riptide lane over its centre replaces the tile's own
 * current (`tileCurrent`), and a racer holding a Riptide feels either RIPTIDE.currentMul harder.
 * Null when there is none.
 */
export function feltCurrent(world: World, racer: Racer, tileCurrent: Vec | null): Vec | null {
  const current = riptideCurrentAt(world, racer.body, racer.id) ?? tileCurrent;
  if (!current || !racer.stack.includes('riptide')) return current;
  return { x: current.x * RIPTIDE.currentMul, y: current.y * RIPTIDE.currentMul };
}
