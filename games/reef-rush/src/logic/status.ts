/**
 * What a racer's timed statuses do to its control and how they run out. Stunned
 * and trapped racers lose their input, trapped racers float straight up, and every
 * counter (plus the burst cooldown) loses one tick at the end of each tick.
 */
import { TRAPPED_RISE_SPEED } from './hazards/tuning.ts';
import { noItems } from './racers.ts';
import type { Intent, Racer, RacerStatus } from './types.ts';

const IDLE: Intent = { move: { x: 0, y: 0 }, kick: false, burst: false };

const STATUS_KEYS = Object.keys(noItems().status) as (keyof RacerStatus)[];

/** The intent a racer actually acts on: idle (no move, kick or burst) while stunned or trapped. */
export function controlledIntent(racer: Racer, intent: Intent): Intent {
  return racer.status.stunned > 0 || racer.status.trapped > 0 ? IDLE : intent;
}

/** Sets a trapped racer's velocity to a straight rise; call after swimming and before moving the body. */
export function floatTrapped(racer: Racer): void {
  if (racer.status.trapped === 0) return;
  racer.body.vx = 0;
  racer.body.vy = -TRAPPED_RISE_SPEED;
}

/**
 * Takes one tick off every status counter and the burst cooldown, stopping at 0. Runs once per
 * tick for each racer in play, after every other phase 3 system, so a counter set to N during a
 * tick reads N - 1 after that tick and 0 after N ticks.
 */
export function tickStatuses(racer: Racer): void {
  for (const key of STATUS_KEYS) {
    if (racer.status[key] > 0) racer.status[key] -= 1;
  }
  if (racer.burstCooldown > 0) racer.burstCooldown -= 1;
}
