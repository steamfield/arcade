/**
 * Being latched by a Homing Squid: the sideways drift that comes with it and the kicks that shake it
 * off. The slow (`SQUID.latchedForceMul`) is a passive in `powerups/passives.ts`; the status ticks
 * down with every other in `status.ts`.
 */
import { sin } from '../num.ts';
import { SQUID } from '../powerups/tuning.ts';
import type { Racer, World } from '../types.ts';

/**
 * Takes SQUID.ticksPerKick off each latched racer's `status.latched` for every `racer.kicked` event
 * emitted this tick. A latch that kicks bring to 0 ends early: emits `racer.shaken {id}`. A latch
 * that simply runs out emits nothing.
 *
 * @param racers The active racers.
 */
export function shakeOffLatches(world: World, racers: readonly Racer[]): void {
  for (const racer of racers) {
    if (racer.status.latched === 0) continue;
    const kicks = world.recentEvents.filter((event) => event.type === 'racer.kicked' && event.id === racer.id).length;
    if (kicks === 0) continue;
    racer.status.latched = Math.max(0, racer.status.latched - kicks * SQUID.ticksPerKick);
    if (racer.status.latched === 0) world.events.emit({ type: 'racer.shaken', id: racer.id });
  }
}

/**
 * Pushes a latched racer up and down: velocity gains `SQUID.driftAccel * dt` px/s on a sine of the
 * ticks left in the latch (period SQUID.driftPeriodTicks), so it snakes instead of holding a line.
 * Does nothing to a racer that isn't latched.
 *
 * @param dt Tick length in seconds.
 */
export function driftLatched(racer: Racer, dt: number): void {
  if (racer.status.latched === 0) return;
  racer.body.vy += SQUID.driftAccel * dt * sin((2 * Math.PI * racer.status.latched) / SQUID.driftPeriodTicks);
}
