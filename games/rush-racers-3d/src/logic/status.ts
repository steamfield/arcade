/**
 * Read-only checks on a racer's item status, for movement, bumps and AI. Only `logic/items/` changes
 * that status; everything here reads it.
 */
import type { Racer, Splat } from './types.ts';

/** Whether stun or sap currently blocks the racer's movement controls and firing. */
export function isImmobilized(_racer: Racer): boolean {
  throw new Error('not implemented');
}

/** Whether a racing racer can take a hit or be trapped. */
export function canBeHit(_racer: Racer): boolean {
  throw new Error('not implemented');
}

/** The forward speed Rocket Boots hold the racer at, or 0 without a boost. */
export function bootsSpeedFloor(_racer: Racer): number {
  throw new Error('not implemented');
}

/** Whether the racer stands in a Mud Pie patch that isn't its own. */
export function onSplatMud(_splats: readonly Splat[], _racer: Racer): boolean {
  throw new Error('not implemented');
}

/** Whether a Burr Ball has the racer puffed up. */
export function isPuffed(_racer: Racer): boolean {
  throw new Error('not implemented');
}
