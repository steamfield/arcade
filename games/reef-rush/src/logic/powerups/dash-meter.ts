/**
 * The dash meter: a kick (shown to players as a dash) spends a charge, and charges come back one
 * at a time. Every racer has one, rivals included, so a dash is something saved for the right moment.
 *
 * `racer.kickCharges` is the charges held (0..DASH_METER.charges) and `racer.kickRecharge` the ticks
 * counted toward the next one. The count keeps running across a spend, so a charge returns
 * DASH_METER.rechargeTicks after the meter first dropped below full, then every rechargeTicks after.
 */
import type { Racer, World } from '../types.ts';

/** How many dashes the meter holds, and the ticks one charge takes to come back. */
export const DASH_METER = { charges: 2, rechargeTicks: 90 } as const;

/** Whether `racer` has a dash charge to spend on a kick this tick. */
export function canDash(racer: Racer): boolean {
  return racer.kickCharges > 0;
}

/** Spends one charge for a kick `racer` just made (`racer.kicked`). Never goes below 0. */
export function spendDash(_world: World, racer: Racer): void {
  racer.kickCharges = Math.max(0, racer.kickCharges - 1);
}

/** Counts `racer` toward its next charge, once per tick in play, emitting `racer.dashRecharged` when one returns. */
export function rechargeDash(world: World, racer: Racer): void {
  if (racer.kickCharges >= DASH_METER.charges) {
    racer.kickRecharge = 0;
    return;
  }
  racer.kickRecharge += 1;
  if (racer.kickRecharge < DASH_METER.rechargeTicks) return;
  racer.kickRecharge = 0;
  racer.kickCharges += 1;
  world.events.emit({ type: 'racer.dashRecharged', id: racer.id, charges: racer.kickCharges });
}
