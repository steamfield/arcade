/** Rocket Boots activation. */
import { ITEMS } from '../tuning.ts';
import type { Racer } from '../types.ts';

/** Starts a boost and raises the racer's forward speed to at least `ITEMS.bootsSpeed`. */
export function fireBoots(racer: Racer): void {
  racer.items.bootsTicks = ITEMS.bootsTicks;
  racer.vs = Math.max(racer.vs, ITEMS.bootsSpeed);
}
