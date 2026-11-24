/** Burr Ball activation and hits from racer contact. */
import { ITEMS } from '../tuning.ts';
import type { Racer, World } from '../types.ts';
import { hitRacer } from './hits.ts';

/** Puffs up the racer for `ITEMS.burrTicks`. */
export function fireBurr(racer: Racer): void {
  racer.burrTicks = ITEMS.burrTicks;
}

/** Applies a hit on contact if the attacker is still puffed up. */
export function burrContact(world: World, attacker: Racer, target: Racer): void {
  if (attacker.burrTicks > 0) hitRacer(world, target, attacker.id, 'burr');
}
