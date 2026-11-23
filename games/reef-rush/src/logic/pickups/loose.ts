/**
 * Loose power-ups: what a hit knocks off a racer. They drift as the medium says (up in water), can't be grabbed
 * at first, and go to the first eligible racer that touches them. A pickup whose
 * ttl runs out on a tick is removed before anyone can grab it that tick. Drift
 * ignores tiles: a pickup may rise into rock and fade there.
 */
import { mediumOf } from '../media/index.ts';
import { gainItem, holds, inventoryFull } from '../powerups/inventory.ts';
import { LOOSE } from '../powerups/tuning.ts';
import { hitbox } from '../racers.ts';
import type { Box, LoosePowerUp, PowerUpKind, Racer, Vec, World } from '../types.ts';

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
 * The pickups slot for loose power-ups. Each call, every loose pickup moves the medium's
 * `effects.looseDrift * dt` vertically (water: up at LOOSE.riseSpeed) and loses one `ttl` tick (removed at 0). One with `grabDelay > 0` counts it down instead of being
 * grabbed; otherwise the first racer in `racers` whose hitbox overlaps its LOOSE.size box, who has
 * an empty slot and who doesn't hold that kind grabs it: removed, `loose.grabbed {id, kind, charges}`,
 * then `gainItem` with its charges. A pickup nobody can take stays loose.
 *
 * @param dt Tick length in seconds.
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function updateLoose(world: World, racers: readonly Racer[], dt: number): void {
  const remaining: LoosePowerUp[] = [];
  const drift = mediumOf(world).effects.looseDrift;
  for (const loose of world.loose) {
    if (!driftAndGrab(world, loose, racers, drift * dt)) remaining.push(loose);
  }
  world.loose = remaining;
}

/** One loose pickup's tick, moving `driftPx` down (negative is up). Returns true when it is gone: expired or grabbed. */
function driftAndGrab(world: World, loose: LoosePowerUp, racers: readonly Racer[], driftPx: number): boolean {
  loose.y += driftPx;
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
