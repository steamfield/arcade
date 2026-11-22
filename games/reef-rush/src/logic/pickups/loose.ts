/**
 * Loose power-ups: what a hit knocks off a racer. They drift up, can't be grabbed
 * at first, and go to the first eligible racer that touches them. Lane 3/a
 * implements it; the scaffold ships the signatures.
 */
import type { PowerUpKind, Racer, Vec, World } from '../types.ts';

/**
 * Adds a loose `kind` centred at `at` (world px) with `grabDelay = LOOSE.grabDelayTicks` and
 * `ttl = LOOSE.ttlTicks`, and emits `loose.spawned`. `applyHit` calls it with the hit racer's centre.
 */
export function spawnLoose(world: World, kind: PowerUpKind, at: Vec): void {
  void world;
  void kind;
  void at;
  throw new Error('not implemented');
}

/**
 * The pickups slot for loose power-ups. Each call, every loose pickup rises LOOSE.riseSpeed * dt and
 * loses one `ttl` tick (removed at 0). One with `grabDelay > 0` counts it down instead of being
 * grabbed; otherwise the first racer in `racers` whose hitbox overlaps its LOOSE.size box and who
 * doesn't hold that kind grabs it: removed, `loose.grabbed {id, kind}`, then `gainPowerUp`.
 *
 * @param dt Tick length in seconds.
 */
export function updateLoose(world: World, racers: readonly Racer[], dt: number): void {
  void racers;
  void dt;
  if (world.loose.length > 0) throw new Error('not implemented');
}
