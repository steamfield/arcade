/** Rocket Boots activation and the speed floor during a boost. */
import { ITEMS } from '../tuning.ts';
import type { Racer } from '../types.ts';

/** Starts a boost and raises the racer's forward speed to at least `ITEMS.bootsSpeed`. */
export function fireBoots(racer: Racer): void {
  racer.bootsTicks = ITEMS.bootsTicks;
  racer.vs = Math.max(racer.vs, ITEMS.bootsSpeed);
}

/** The minimum forward speed while Boots are active, or zero after they expire. */
export function bootsSpeedFloor(racer: Racer): number {
  return racer.bootsTicks > 0 ? ITEMS.bootsSpeed : 0;
}
