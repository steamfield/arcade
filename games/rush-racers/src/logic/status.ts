/**
 * What a racer's timed statuses do to its control and how they run out. Stunned
 * and trapped racers lose their input, fallen racers lose all of it, trapped racers
 * drift straight up or down as the medium says (never up through a surface into air),
 * downed racers (`isDowned`) pass through other racers, and every counter but `fallen`
 * (plus the item use cooldown) loses one tick at the end of each tick. The medium counts
 * `fallen` down itself.
 */
import { TICK_DT } from '@arcade/core';
import { isAirAt } from './level/query.ts';
import { mediumOf } from './media/index.ts';
import { centreOf, noItems } from './racers.ts';
import type { Intent, Racer, RacerStatus, World } from './types.ts';

/** The counters `tickStatuses` runs down: every status but `fallen`, which the medium owns. */
const TICKED_KEYS = (Object.keys(noItems(0).status) as (keyof RacerStatus)[]).filter((key) => key !== 'fallen');

/**
 * The intent a racer actually acts on. While fallen it does nothing at all. While stunned or trapped
 * it can't move, kick or use an item, but it can still cycle its selection, so the intent keeps only
 * `cycle`.
 */
export function controlledIntent(racer: Racer, intent: Intent): Intent {
  if (racer.status.fallen > 0) return { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0 };
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
 * True while the racer is down: stunned, trapped, latched or fallen. Downed racers don't collide with
 * other racers, so the field swims through them instead of piling up behind.
 */
export function isDowned(racer: Racer): boolean {
  const { stunned, trapped, latched, fallen } = racer.status;
  return stunned > 0 || trapped > 0 || latched > 0 || fallen > 0;
}

/**
 * Sets a trapped racer's velocity to the medium's straight drift (`effects.trappedDrift`; water floats
 * it up); call after the medium moves it and before moving the body. The drift stops at a surface:
 * when this tick's drift would carry the racer's centre into air it holds still instead. A racer
 * trapped while already in the air keeps the vertical speed the medium gave it, so it falls back.
 *
 * @throws {Error} When the world names a medium that is neither shipped nor registered.
 */
export function floatTrapped(world: World, racer: Racer): void {
  if (racer.status.trapped === 0) return;
  racer.body.vx = 0;
  const centre = centreOf(racer);
  if (isAirAt(world.level, centre.x, centre.y)) return;
  const drift = mediumOf(world).effects.trappedDrift;
  racer.body.vy = isAirAt(world.level, centre.x, centre.y + drift * TICK_DT) ? 0 : drift;
}

/**
 * Takes one tick off every status counter but `fallen` and the item use cooldown, stopping at 0.
 * Runs once per tick for each racer in play, after every other phase 3 system, so a counter set to
 * N during a tick reads N - 1 after that tick and 0 after N ticks.
 */
export function tickStatuses(racer: Racer): void {
  for (const key of TICKED_KEYS) {
    if (racer.status[key] > 0) racer.status[key] -= 1;
  }
  if (racer.useCooldown > 0) racer.useCooldown -= 1;
}
