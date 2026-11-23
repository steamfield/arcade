/**
 * Applying a hit to a racer: the one path for urchins, jellies, bubbles, puffers,
 * flashes and squids, so shields, invulnerability, knockback, stuns and loose power-ups
 * behave the same whatever caused it.
 */

import { ignoresHazard } from '../abilities.ts';
import { invulnerableTicks, mayAttack, statusTicks } from '../difficulty-level.ts';
import { mediumOf } from '../media/index.ts';
import { length } from '../num.ts';
import { spawnLoose } from '../pickups/loose.ts';
import { dropPearls } from '../pickups/pearls.ts';
import { heldItems, knockSelected, popShield } from '../powerups/inventory.ts';
import { BUBBLE, FLASH } from '../powerups/tuning.ts';
import { centreOf } from '../racers.ts';
import { isInvulnerable } from '../status.ts';
import type { HitCause, Racer, RacerId, Vec, World } from '../types.ts';
import { HIT } from './tuning.ts';

/**
 * What a landed hit did: a Bubble Shield took it (`absorbed`), it stunned or trapped the racer with
 * its items kept, or it knocked the selected item loose.
 */
export type HitOutcome = 'absorbed' | 'stunned' | 'trapped' | 'knocked';

/**
 * Hits `racer`. An invulnerable racer (`isInvulnerable`: hit recently or cannonballing), or one whose
 * ability ignores this cause (`ignoresHazard`), ignores it entirely (returns null, nothing emitted).
 * Otherwise emits `racer.hit {id, cause, by}`, then:
 * - a Bubble Shield in any slot absorbs any cause: `popShield` empties its slot (`shield.popped`), 'absorbed';
 * - flash: stunned FLASH.stunTicks (`racer.stunned`), items kept, 'stunned';
 * - bubble: trapped BUBBLE.trapTicks (`racer.trapped {id, by}`), items kept, 'trapped';
 * - urchin, jelly, puffer, squid: `knockSelected` knocks off the selected item, which `spawnLoose` floats at
 *   the racer's centre with all its charges, 'knocked'; with nothing held the racer is stunned
 *   HIT.stunTicks (`racer.stunned`), 'stunned'.
 * A hit the shield didn't absorb then knocks some pearls loose (`dropPearls`, `pearls.dropped`).
 * Stun and trap lengths are scaled by `statusTicks` (the racer's `statusDurationMul`, and the difficulty level's for the player), rounded to whole ticks.
 * Every landed hit ends any dash and its enemy bonk window (`status.dashing = 0`, `status.bonking = 0`, so a
 * racer knocked into an enemy is hurt, not bonking; a Cannonball is invulnerable, so none lands on it), sets
 * `status.invulnerable = HIT.invulnerableTicks` and sets the racer's velocity to HIT.knockbackSpeed
 * directly away from `from` (along facing when `from` is its centre), on the axes the medium holds
 * (`effects.dashAxes`: horizontal only keeps the vertical speed gravity gave it). A trapped racer's float
 * replaces that velocity on its next move, so a bubble hit doesn't knock it back.
 *
 * @param by The racer whose item caused it, or null for urchins and jellies.
 * @param from Where the hit came from, in world px (urchin tile centre, jelly centre, bubble, puffer or flasher centre, squid).
 * @returns What the landed hit did, or null when it didn't land.
 * @throws {Error} For a bubble hit with no owner, whether or not it would land: bubbles only come
 * from items, so `by` is always set.
 */
export function applyHit(
  world: World,
  racer: Racer,
  cause: HitCause,
  by: RacerId | null,
  from: Vec,
): HitOutcome | null {
  const blow = blowOf(racer, cause, by);
  if (by !== null && !mayAttack(world, by, racer.id)) return null;
  if (isInvulnerable(racer) || ignoresHazard(racer, cause)) return null;
  world.events.emit({ type: 'racer.hit', id: racer.id, cause, by });
  const outcome = sufferHit(world, racer, blow);
  if (outcome !== 'absorbed') dropPearls(world, racer);
  racer.status.dashing = 0;
  racer.status.bonking = 0;
  racer.status.invulnerable = invulnerableTicks(world, racer, HIT.invulnerableTicks);
  knockBack(world, racer, from);
  return outcome;
}

/** A hit's cause with who caused it; a bubble always has an owner. */
type Blow = { cause: 'bubble'; by: RacerId } | { cause: Exclude<HitCause, 'bubble'>; by: RacerId | null };

function blowOf(racer: Racer, cause: HitCause, by: RacerId | null): Blow {
  if (cause !== 'bubble') return { cause, by };
  if (by === null) {
    throw new Error(
      `Bubble hit on '${racer.id}' has no owner; pass the racer whose Bubble Shield fired the bubble as 'by'`,
    );
  }
  return { cause, by };
}

/** What the hit takes or does: a shield, a stun, a trap, or the selected item. */
function sufferHit(world: World, racer: Racer, blow: Blow): HitOutcome {
  if (popShield(world, racer)) return 'absorbed';
  if (blow.cause === 'flash') {
    stun(world, racer, FLASH.stunTicks);
    return 'stunned';
  }
  if (blow.cause === 'bubble') {
    racer.status.trapped = statusTicks(world, racer, BUBBLE.trapTicks, 'trapped');
    world.events.emit({ type: 'racer.trapped', id: racer.id, by: blow.by });
    return 'trapped';
  }
  if (heldItems(racer).length === 0) {
    stun(world, racer, HIT.stunTicks);
    return 'stunned';
  }
  const knocked = knockSelected(world, racer);
  if (knocked) spawnLoose(world, knocked.kind, knocked.charges, centreOf(racer));
  return 'knocked';
}

function stun(world: World, racer: Racer, ticks: number): void {
  racer.status.stunned = statusTicks(world, racer, ticks, 'stunned');
  world.events.emit({ type: 'racer.stunned', id: racer.id });
}

/**
 * Sets the racer moving at HIT.knockbackSpeed straight away from `from`, or along its facing from its
 * own centre; only horizontally where the medium holds one axis.
 */
function knockBack(world: World, racer: Racer, from: Vec): void {
  const centre = centreOf(racer);
  const dx = centre.x - from.x;
  const dy = centre.y - from.y;
  const distance = length(dx, dy);
  const away = distance === 0 ? { x: racer.facing, y: 0 } : { x: dx / distance, y: dy / distance };
  racer.body.vx = away.x * HIT.knockbackSpeed;
  if (mediumOf(world).effects.dashAxes === 'both') racer.body.vy = away.y * HIT.knockbackSpeed;
}
