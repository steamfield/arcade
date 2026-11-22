/**
 * Loose power-ups: what a hit knocks off a racer. They drift up, can't be grabbed
 * at first, and go to the first eligible racer that touches them. A pickup whose
 * ttl runs out on a tick is removed before anyone can grab it that tick. Drift
 * ignores tiles: a pickup may rise into rock and fade there.
 */
import { gainPowerUp } from '../powerups/stack.ts';
import { LOOSE } from '../powerups/tuning.ts';
import type { LoosePowerUp, PowerUpKind, Racer, Vec, World } from '../types.ts';
import { touchesSquare } from './touch.ts';

/**
 * Adds a loose `kind` centred at `at` (world px) with `grabDelay = LOOSE.grabDelayTicks` and
 * `ttl = LOOSE.ttlTicks`, and emits `loose.spawned`. `applyHit` calls it with the hit racer's centre.
 */
export function spawnLoose(world: World, kind: PowerUpKind, at: Vec): void {
  world.loose.push({ kind, x: at.x, y: at.y, grabDelay: LOOSE.grabDelayTicks, ttl: LOOSE.ttlTicks });
  world.events.emit({ type: 'loose.spawned', kind });
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
  world.loose = world.loose.filter((loose) => !driftAndGrab(world, loose, racers, dt));
}

/** One loose pickup's tick. Returns true when it is gone: expired or grabbed. */
function driftAndGrab(world: World, loose: LoosePowerUp, racers: readonly Racer[], dt: number): boolean {
  loose.y -= LOOSE.riseSpeed * dt;
  loose.ttl -= 1;
  if (loose.ttl <= 0) return true;
  if (loose.grabDelay > 0) {
    loose.grabDelay -= 1;
    return false;
  }
  const grabber = racers.find((racer) => !racer.stack.includes(loose.kind) && touchesSquare(racer, loose, LOOSE.size));
  if (!grabber) return false;
  world.events.emit({ type: 'loose.grabbed', id: grabber.id, kind: loose.kind });
  gainPowerUp(world, grabber, loose.kind);
  return true;
}
