import { ITEMS } from '../tuning.ts';
import type { Racer, World } from '../types.ts';
import { hitRacer } from './hits.ts';

export function fireBurr(racer: Racer): void {
  racer.burrTicks = ITEMS.burrTicks;
}

export function burrContact(world: World, attacker: Racer, target: Racer): void {
  if (attacker.burrTicks > 0) hitRacer(world, target, attacker.id, 'burr');
}
