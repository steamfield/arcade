/** Read-only racer status checks. */
import { ITEMS } from './tuning.ts';
import type { Racer, Splat } from './types.ts';

/** Whether stun or sap currently blocks the racer's movement controls and firing. */
export function isImmobilized(racer: Racer): boolean {
  return racer.items.stunTicks > 0 || racer.items.trappedTicks > 0;
}

/** Whether a racing racer can take a hit or be trapped. */
export function canBeHit(racer: Racer): boolean {
  return racer.state === 'racing' && racer.invulnTicks === 0;
}

/** The forward speed Rocket Boots hold the racer at, or 0 without a boost. */
export function bootsSpeedFloor(racer: Racer): number {
  return racer.items.bootsTicks > 0 ? ITEMS.bootsSpeed : 0;
}

/** Whether another racer's splat covers this racer's track position. */
export function onSplatMud(splats: readonly Splat[], { id, s, d }: Racer): boolean {
  return splats.some((patch) => patch.owner !== id && patch.s0 <= s && s < patch.s1 && patch.d0 <= d && d < patch.d1);
}

/** Whether a Burr Ball has the racer puffed up. */
export function isPuffed(racer: Racer): boolean {
  return racer.items.burrTicks > 0;
}
