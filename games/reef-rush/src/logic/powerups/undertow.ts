/**
 * Undertow: a one-use burst that drags every racer ahead of the user back down the course. The
 * pull comes from `status.undertow` (ticks left) and `Racer.undertowGapTiles` (how far ahead the
 * victim was when pulled), applied each tick in `stepWorld`'s swim step.
 */
import { mayAttack } from '../difficulty-level.ts';
import { mediumOf } from '../media/index.ts';
import { activeRacers } from '../racers.ts';
import type { Racer, World } from '../types.ts';
import { UNDERTOW } from './tuning.ts';

/** Tiles along the medium's way the pull looks, matching the racers' own lookahead. */
const LOOKAHEAD_TILES = 3;

/**
 * Pulls every racer in play that is ahead of `user` (lower progress) and that `mayAttack` lets it pull: `status.undertow` becomes
 * UNDERTOW.ticks and `undertowGapTiles` the tiles of lead it had. Emits `undertow.fired {id, pulled}`
 * with the pulled racers in RACER_IDS order, even when there are none. The user is not consumed
 * here; `fireBurst` removes the power-up.
 */
export function fireUndertow(world: World, user: Racer): void {
  const pulled = activeRacers(world).filter(
    (racer) => racer.id !== user.id && racer.progress < user.progress && mayAttack(world, user.id, racer.id),
  );
  for (const racer of pulled) {
    racer.status.undertow = UNDERTOW.ticks;
    racer.undertowGapTiles = user.progress - racer.progress;
  }
  world.events.emit({ type: 'undertow.fired', id: user.id, pulled: pulled.map((racer) => racer.id) });
}

/**
 * One tick of the pull on `racer`: its velocity gains, back along the medium's way to the finish
 * (`Medium.aimFrom`), `UNDERTOW.baseForce + perTile * gap` px/s² (at most baseForce * maxMul) times
 * `dt`. Where the medium lets a kick counter it (`kickRules.countersUndertow`), a racer that kicked
 * this tick (a `racer.kicked` event) isn't pulled and loses UNDERTOW.kickCutTicks off the pull.
 * Does nothing to a racer that isn't pulled.
 *
 * @param dt Tick length in seconds.
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function applyUndertow(world: World, racer: Racer, dt: number): void {
  if (racer.status.undertow === 0) return;
  const medium = mediumOf(world);
  if (medium.kickRules.countersUndertow && kickedThisTick(world, racer)) {
    racer.status.undertow = Math.max(0, racer.status.undertow - UNDERTOW.kickCutTicks);
    return;
  }
  const force = Math.min(
    UNDERTOW.baseForce + UNDERTOW.perTile * (racer.undertowGapTiles ?? 0),
    UNDERTOW.baseForce * UNDERTOW.maxMul,
  );
  const downhill = medium.aimFrom(world, racer.body, LOOKAHEAD_TILES);
  racer.body.vx -= downhill.x * force * dt;
  racer.body.vy -= downhill.y * force * dt;
}

function kickedThisTick(world: World, racer: Racer): boolean {
  return world.recentEvents.some((event) => event.type === 'racer.kicked' && event.id === racer.id);
}
