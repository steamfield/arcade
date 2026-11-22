/**
 * Applying a hit to a racer: the one path for urchins, jellies, bubbles, puffers
 * and flashes, so shields, invulnerability, knockback, stuns and loose power-ups
 * behave the same whatever caused it.
 */
import { spawnLoose } from '../pickups/loose.ts';
import { popForHit } from '../powerups/stack.ts';
import { BUBBLE, FLASH } from '../powerups/tuning.ts';
import { centreOf } from '../racers.ts';
import type { HitCause, Racer, RacerId, Vec, World } from '../types.ts';
import { HIT } from './tuning.ts';

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
 * @throws {Error} For a bubble hit with no owner: bubbles only come from bursts, so `by` is always set.
 */
export function applyHit(world: World, racer: Racer, cause: HitCause, by: RacerId | null, from: Vec): boolean {
  if (racer.status.invulnerable > 0) return false;
  if (cause === 'bubble' && by === null) {
    throw new Error(`Bubble hit on '${racer.id}' has no owner; pass the racer whose burst fired the bubble as 'by'`);
  }
  world.events.emit({ type: 'racer.hit', id: racer.id, cause, by });
  sufferHit(world, racer, cause, by);
  racer.status.invulnerable = HIT.invulnerableTicks;
  knockBack(racer, from);
  return true;
}

/** What the hit takes or does: a shield, a stun, a trap, or the newest power-up. */
function sufferHit(world: World, racer: Racer, cause: HitCause, by: RacerId | null): void {
  if (racer.stack.includes('bubbleShield')) {
    popForHit(world, racer);
  } else if (cause === 'flash') {
    stun(world, racer, FLASH.stunTicks);
  } else if (cause === 'bubble' && by !== null) {
    racer.status.trapped = BUBBLE.trapTicks;
    world.events.emit({ type: 'racer.trapped', id: racer.id, by });
  } else if (racer.stack.length === 0) {
    stun(world, racer, HIT.stunTicks);
  } else {
    const lost = popForHit(world, racer);
    if (lost) spawnLoose(world, lost, centreOf(racer));
  }
}

function stun(world: World, racer: Racer, ticks: number): void {
  racer.status.stunned = ticks;
  world.events.emit({ type: 'racer.stunned', id: racer.id });
}

/** Sets the racer moving at HIT.knockbackSpeed straight away from `from`, or along its facing from its own centre. */
function knockBack(racer: Racer, from: Vec): void {
  const centre = centreOf(racer);
  const dx = centre.x - from.x;
  const dy = centre.y - from.y;
  const length = Math.hypot(dx, dy);
  const away = length === 0 ? { x: racer.facing, y: 0 } : { x: dx / length, y: dy / length };
  racer.body.vx = away.x * HIT.knockbackSpeed;
  racer.body.vy = away.y * HIT.knockbackSpeed;
}
