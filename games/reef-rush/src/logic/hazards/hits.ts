/**
 * Applying a hit to a racer: the one path for urchins, jellies, bubbles, puffers,
 * flashes and squids, so shields, invulnerability, knockback, stuns and loose power-ups
 * behave the same whatever caused it.
 */

import { ignoresHazard } from '../abilities.ts';
import { statusTicks } from '../difficulty-level.ts';
import { length } from '../num.ts';
import { spawnLoose } from '../pickups/loose.ts';
import { popForHit } from '../powerups/stack.ts';
import { BUBBLE, FLASH } from '../powerups/tuning.ts';
import { centreOf } from '../racers.ts';
import type { HitCause, Racer, RacerId, Vec, World } from '../types.ts';
import { HIT } from './tuning.ts';

/**
 * Hits `racer`. An invulnerable racer, or one whose ability ignores this cause (`ignoresHazard`),
 * ignores it entirely (returns false, nothing emitted). Otherwise emits `racer.hit {id, cause, by}`, then:
 * - a held Bubble Shield absorbs any cause: `popForHit` removes it (`shield.popped`);
 * - flash: stunned FLASH.stunTicks (`racer.stunned`), stack kept;
 * - bubble: trapped BUBBLE.trapTicks (`racer.trapped {id, by}`), stack kept;
 * - urchin, jelly, puffer, squid: `popForHit` knocks off the newest power-up, which `spawnLoose` floats at the
 *   racer's centre; with an empty stack the racer is stunned HIT.stunTicks (`racer.stunned`).
 * Stun and trap lengths are scaled by `statusTicks` (the racer's `statusDurationMul`, and the difficulty level's for the player), rounded to whole ticks.
 * Every landed hit ends any dash (`status.dashing = 0`, inflated cannonball dashes included), sets
 * `status.invulnerable = HIT.invulnerableTicks` and sets the racer's velocity to HIT.knockbackSpeed
 * directly away from `from` (along facing when `from` is its centre). A trapped racer's float
 * replaces that velocity on its next move, so a bubble hit doesn't knock it back.
 *
 * @param by The racer whose burst caused it, or null for urchins and jellies.
 * @param from Where the hit came from, in world px (urchin tile centre, jelly centre, bubble, puffer or flasher centre, squid).
 * @returns true when the hit landed.
 * @throws {Error} For a bubble hit with no owner, whether or not it would land: bubbles only come
 * from bursts, so `by` is always set.
 */
export function applyHit(world: World, racer: Racer, cause: HitCause, by: RacerId | null, from: Vec): boolean {
  const blow = blowOf(racer, cause, by);
  if (racer.status.invulnerable > 0 || ignoresHazard(racer, cause)) return false;
  world.events.emit({ type: 'racer.hit', id: racer.id, cause, by });
  sufferHit(world, racer, blow);
  racer.status.dashing = 0;
  racer.status.invulnerable = HIT.invulnerableTicks;
  knockBack(racer, from);
  return true;
}

/** A hit's cause with who caused it; a bubble always has an owner. */
type Blow = { cause: 'bubble'; by: RacerId } | { cause: Exclude<HitCause, 'bubble'>; by: RacerId | null };

function blowOf(racer: Racer, cause: HitCause, by: RacerId | null): Blow {
  if (cause !== 'bubble') return { cause, by };
  if (by === null) {
    throw new Error(`Bubble hit on '${racer.id}' has no owner; pass the racer whose burst fired the bubble as 'by'`);
  }
  return { cause, by };
}

/** What the hit takes or does: a shield, a stun, a trap, or the newest power-up. */
function sufferHit(world: World, racer: Racer, blow: Blow): void {
  if (racer.stack.includes('bubbleShield')) {
    popForHit(world, racer);
  } else if (blow.cause === 'flash') {
    stun(world, racer, FLASH.stunTicks);
  } else if (blow.cause === 'bubble') {
    racer.status.trapped = statusTicks(world, racer, BUBBLE.trapTicks, 'trapped');
    world.events.emit({ type: 'racer.trapped', id: racer.id, by: blow.by });
  } else if (racer.stack.length === 0) {
    stun(world, racer, HIT.stunTicks);
  } else {
    const lost = popForHit(world, racer);
    if (lost) spawnLoose(world, lost, centreOf(racer));
  }
}

function stun(world: World, racer: Racer, ticks: number): void {
  racer.status.stunned = statusTicks(world, racer, ticks, 'stunned');
  world.events.emit({ type: 'racer.stunned', id: racer.id });
}

/** Sets the racer moving at HIT.knockbackSpeed straight away from `from`, or along its facing from its own centre. */
function knockBack(racer: Racer, from: Vec): void {
  const centre = centreOf(racer);
  const dx = centre.x - from.x;
  const dy = centre.y - from.y;
  const distance = length(dx, dy);
  const away = distance === 0 ? { x: racer.facing, y: 0 } : { x: dx / distance, y: dy / distance };
  racer.body.vx = away.x * HIT.knockbackSpeed;
  racer.body.vy = away.y * HIT.knockbackSpeed;
}
