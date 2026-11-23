/**
 * Loose power-ups: what a hit knocks off a racer. They drift as the medium says (up in water, down
 * on land), can't be grabbed at first, and go to the first eligible racer that touches them. A
 * pickup whose ttl runs out on a tick is removed before anyone can grab it that tick. Drift stops
 * at a solid tile, as a loose pearl's does: one knocked off a runner settles on the ground under it
 * rather than sinking into the earth out of reach. Drift also stops at a surface: a pickup never
 * drifts from the water into air, and one knocked loose in the air falls back to the water.
 */
import { isAirAt, isLedge, isSolid, tileIndex } from '../level/query.ts';
import { mediumOf } from '../media/index.ts';
import { gainItem, holds, inventoryFull } from '../powerups/inventory.ts';
import { LOOSE } from '../powerups/tuning.ts';
import { moveRulesFor } from '../race/move.ts';
import { hitbox } from '../racers.ts';
import { type Box, type LoosePowerUp, type PowerUpKind, type Racer, TILE, type Vec, type World } from '../types.ts';

/** How fast a loose power-up in the air falls back toward the water, px/s. */
const AIR_FALL_SPEED = 120;

/**
 * Adds a loose `kind` carrying `charges` uses, centred at `at` (world px) with `grabDelay =
 * LOOSE.grabDelayTicks` and `ttl = LOOSE.ttlTicks`, and emits `loose.spawned {kind, charges}`.
 * `applyHit` calls it with the hit racer's centre and what the knocked item had left.
 */
export function spawnLoose(world: World, kind: PowerUpKind, charges: number, at: Vec): void {
  world.loose.push({ kind, charges, x: at.x, y: at.y, grabDelay: LOOSE.grabDelayTicks, ttl: LOOSE.ttlTicks });
  world.events.emit({ type: 'loose.spawned', kind, charges });
}

/**
 * The pickups slot for loose power-ups. Each call, every loose pickup moves vertically
 * (`verticalStep`; outside air, the medium's `effects.looseDrift`, up at LOOSE.riseSpeed in water),
 * unless that would put its centre in a tile that stops it (`stopsDrift`), and loses one `ttl` tick
 * (removed at 0). One with `grabDelay > 0` counts it down instead of being grabbed; otherwise the
 * first racer in `racers` whose hitbox overlaps its LOOSE.size box, who has an empty slot and who
 * doesn't hold that kind grabs it: removed, `loose.grabbed {id, kind, charges}`, then `gainItem`
 * with its charges. A pickup nobody can take stays loose.
 *
 * @param dt Tick length in seconds.
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function updateLoose(world: World, racers: readonly Racer[], dt: number): void {
  const remaining: LoosePowerUp[] = [];
  const driftPx = mediumOf(world).effects.looseDrift * dt;
  for (const loose of world.loose) {
    const nextY = loose.y + verticalStep(world, loose, driftPx, AIR_FALL_SPEED * dt);
    if (!stopsDrift(world, loose, nextY)) loose.y = nextY;
    if (!expireOrGrab(world, loose, racers)) remaining.push(loose);
  }
  world.loose = remaining;
}

/**
 * How far a loose pickup moves down this tick (negative is up): `fallPx` while it is in the air, so
 * it falls back to the water; otherwise `driftPx`, or nothing when that would carry it into air.
 */
function verticalStep(world: World, loose: LoosePowerUp, driftPx: number, fallPx: number): number {
  if (isAirAt(world.level, loose.x, loose.y)) return fallPx;
  return isAirAt(world.level, loose.x, loose.y + driftPx) ? 0 : driftPx;
}

/**
 * True when a pickup moving its centre to `nextY` would end in a tile that stops it: a solid tile
 * (`isSolid`), a tile solid only to bodies in this medium (a crate, `moveRulesFor`), or a ledge it
 * reaches from above, as a body lands on one.
 */
function stopsDrift(world: World, loose: LoosePowerUp, nextY: number): boolean {
  const tx = Math.floor(loose.x / TILE);
  const ty = Math.floor(nextY / TILE);
  if (isSolid(world.level, world.broken, tx, ty)) return true;
  if (moveRulesFor(world).solidTiles.has(tileIndex(world.level, tx, ty))) return true;
  return nextY > loose.y && ty > Math.floor(loose.y / TILE) && isLedge(world.level, tx, ty);
}

/** One loose pickup's ttl and grab for the tick. Returns true when it is gone: expired or grabbed. */
function expireOrGrab(world: World, loose: LoosePowerUp, racers: readonly Racer[]): boolean {
  loose.ttl -= 1;
  if (loose.ttl <= 0) return true;
  if (loose.grabDelay > 0) {
    loose.grabDelay -= 1;
    return false;
  }
  const box = { x: loose.x - LOOSE.size / 2, y: loose.y - LOOSE.size / 2, w: LOOSE.size, h: LOOSE.size };
  const grabber = racers.find(
    (racer) => !inventoryFull(racer) && !holds(racer, loose.kind) && boxesOverlap(hitbox(racer), box),
  );
  if (!grabber) return false;
  world.events.emit({ type: 'loose.grabbed', id: grabber.id, kind: loose.kind, charges: loose.charges });
  gainItem(world, grabber, loose.kind, loose.charges);
  return true;
}

/** True when two boxes share some positive area; edge-only contact doesn't count. */
function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
