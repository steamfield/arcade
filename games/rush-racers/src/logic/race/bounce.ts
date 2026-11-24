/**
 * Bounce cells (`B`, a bounce cloud in the sky, a spring mushroom in the forest): a racer coming
 * down onto one leaves upward at the medium's `effects.bounceSpeed`. To the tiles a bounce cell is
 * rock (`isRockLike`), so meeting one from the side or below just blocks; only a floor contact
 * springs. A medium may take the launch further on its next tick: run raises it while Up is held
 * (`media/run/spring.ts`).
 */
import { bodyTiles, cellAt } from '../level/query.ts';
import { mediumOf } from '../media/index.ts';
import { type Body, type Level, type MoveContacts, type Racer, TILE, type World } from '../types.ts';

/**
 * Springs `racer` up off a bounce cloud it came down onto this tick: with a floor contact and a
 * bounce tile under either bottom corner after the move, it leaves with `vy = -bounceSpeed` and
 * `racer.bounced {id}` is emitted. Does nothing when the world's medium has no bounce clouds
 * (`effects.bounceSpeed` null), or the racer is fallen or trapped: a trapped racer drifts at the
 * medium's `trappedDrift` every tick, so one resting on a cloud would otherwise spring off it each
 * tick until the trap ends. `stepRace` calls it for each unfinished racer right after the medium's
 * `afterMove`, with the contacts of that racer's move.
 *
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function bounceOffClouds(world: World, racer: Racer, contacts: MoveContacts): void {
  const { bounceSpeed } = mediumOf(world).effects;
  const { fallen, trapped } = racer.status;
  if (bounceSpeed === null || fallen > 0 || trapped > 0 || !contacts.floor) return;
  if (!standsOnBounceCloud(world.level, racer.body)) return;
  racer.body.vy = -bounceSpeed;
  world.events.emit({ type: 'racer.bounced', id: racer.id });
}

/** True when the tile just under either bottom corner of `body` is a bounce cloud. */
function standsOnBounceCloud(level: Level, body: Body): boolean {
  const { left, right } = bodyTiles(body);
  const rowBelow = Math.floor((body.y + body.h) / TILE);
  return cellAt(level, left, rowBelow) === 'bounce' || cellAt(level, right, rowBelow) === 'bounce';
}
