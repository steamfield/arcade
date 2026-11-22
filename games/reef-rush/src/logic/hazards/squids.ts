/**
 * Homing Squids in flight. Scaffold: a no-op until lane 7/a gives it the lock-on, steering, dodge,
 * latch and loss rules from the phase 7 plan. `stepWorld` already calls it after projectiles and
 * before contacts, so the rules arrive without touching the tick order.
 */
import type { Racer, World } from '../types.ts';

/**
 * The squids slot of `stepWorld`: moves, steers and resolves every squid in `world.squids`.
 * Currently does nothing.
 *
 * @param racers The active racers.
 * @param dt Tick length in seconds.
 */
export function advanceSquids(_world: World, _racers: readonly Racer[], _dt: number): void {}
