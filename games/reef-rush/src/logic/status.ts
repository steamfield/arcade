/**
 * What a racer's timed statuses do to its control and how they run out. Stunned
 * and trapped racers lose their input, trapped racers drift straight up or down as
 * the medium says, and every counter (plus the item use cooldown) loses one tick at
 * the end of each tick.
 */
import { mediumOf } from './media/index.ts';
import { noItems } from './racers.ts';
import type { Intent, Racer, RacerStatus, World } from './types.ts';

const STATUS_KEYS = Object.keys(noItems(0).status) as (keyof RacerStatus)[];

/**
 * The intent a racer actually acts on. While stunned or trapped it can't move, kick or use an item,
 * but it can still cycle its selection, so the intent keeps only `cycle`.
 */
export function controlledIntent(racer: Racer, intent: Intent): Intent {
  if (racer.status.stunned === 0 && racer.status.trapped === 0) return intent;
  return { move: { x: 0, y: 0 }, kick: false, use: false, cycle: intent.cycle };
}

/**
 * True when hits do nothing to the racer: it was hit recently (`status.invulnerable`) or is
 * cannonballing (`status.cannonball`). Only the first makes the racer flicker.
 */
export function isInvulnerable(racer: Racer): boolean {
  return racer.status.invulnerable > 0 || racer.status.cannonball > 0;
}

/**
 * Sets a trapped racer's velocity to the medium's straight drift (`effects.trappedDrift`; water floats
 * it up); call after the medium moves it and before moving the body.
 *
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function floatTrapped(world: World, racer: Racer): void {
  if (racer.status.trapped === 0) return;
  racer.body.vx = 0;
  racer.body.vy = mediumOf(world).effects.trappedDrift;
}

/**
 * Takes one tick off every status counter and the item use cooldown, stopping at 0. Runs once per
 * tick for each racer in play, after every other phase 3 system, so a counter set to N during a
 * tick reads N - 1 after that tick and 0 after N ticks.
 */
export function tickStatuses(racer: Racer): void {
  for (const key of STATUS_KEYS) {
    if (racer.status[key] > 0) racer.status[key] -= 1;
  }
  if (racer.useCooldown > 0) racer.useCooldown -= 1;
}
