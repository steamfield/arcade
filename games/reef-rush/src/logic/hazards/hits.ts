/**
 * Applying a hit to a racer: the one path for urchins, jellies, bubbles, puffers
 * and flashes, so shields, invulnerability, knockback, stuns and loose power-ups
 * behave the same whatever caused it. Lane 3/b implements it; the scaffold ships
 * the signature.
 */
import type { HitCause, Racer, RacerId, Vec, World } from '../types.ts';

/**
 * Hits `racer`. An invulnerable racer ignores it entirely (returns false, nothing emitted).
 * Otherwise emits `racer.hit {id, cause, by}`, then:
 * - a held Bubble Shield absorbs any cause: `popForHit` removes it (`shield.popped`);
 * - flash: stunned FLASH.stunTicks (`racer.stunned`), stack kept;
 * - bubble: trapped BUBBLE.trapTicks (`racer.trapped {id, by}`), stack kept;
 * - urchin, jelly, puffer: `popForHit` knocks off the newest power-up, which `spawnLoose` floats at the
 *   racer's centre; with an empty stack the racer is stunned HIT.stunTicks (`racer.stunned`).
 * Every landed hit sets `status.invulnerable = HIT.invulnerableTicks` and the racer's velocity to
 * HIT.knockbackSpeed directly away from `from` (along facing when `from` is its centre).
 *
 * @param by The racer whose burst caused it, or null for urchins and jellies.
 * @param from Where the hit came from, in world px (urchin tile centre, jelly centre, bubble, puffer or flasher centre).
 * @returns true when the hit landed.
 */
export function applyHit(world: World, racer: Racer, cause: HitCause, by: RacerId | null, from: Vec): boolean {
  void world;
  void racer;
  void cause;
  void by;
  void from;
  throw new Error('not implemented');
}
