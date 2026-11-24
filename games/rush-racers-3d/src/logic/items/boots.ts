import { ITEMS } from '../tuning.ts';
import type { Racer } from '../types.ts';

export function fireBoots(racer: Racer): void {
  racer.bootsTicks = ITEMS.bootsTicks;
  racer.vs = Math.max(racer.vs, ITEMS.bootsSpeed);
}

export function bootsSpeedFloor(racer: Racer): number {
  return racer.bootsTicks > 0 ? ITEMS.bootsSpeed : 0;
}
