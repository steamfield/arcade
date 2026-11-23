/**
 * The dash meter: a kick (shown to players as a dash) spends a charge, and charges come back one
 * at a time. Every racer has one, rivals included, so a dash is something saved for the right moment.
 *
 * Phase 2 scaffold: the signatures are final; lane a fills in the rules.
 */
import type { Racer, World } from '../types.ts';

/** How many dashes the meter holds, and the ticks one charge takes to come back. */
export const DASH_METER = { charges: 2, rechargeTicks: 90 } as const;

/** Whether `racer` has a dash charge to spend on a kick this tick. */
export function canDash(_racer: Racer): boolean {
  return true;
}

/** Spends one charge for a kick `racer` just made (`racer.kicked`). */
export function spendDash(_world: World, _racer: Racer): void {}

/** Counts `racer` toward its next charge, once per tick in play, emitting `racer.dashRecharged` when one returns. */
export function rechargeDash(_world: World, _racer: Racer): void {}
