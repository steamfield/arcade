/**
 * Combines everything that changes how a racer swims this tick into one
 * MoveModifiers: its profile and catch-up, then held power-ups and timed
 * statuses through `powerups/passives.ts`.
 */
import { catchUpMul } from './ai/rival.ts';
import { withPassives } from './powerups/passives.ts';
import { BASE_MODIFIERS } from './swim/physics.ts';
import type { MoveModifiers, Racer } from './types.ts';

/** Modifiers for `racer` given the player's position. Catch-up applies to rivals only, never to the player's racer. */
export function modifiersFor(racer: Racer, player: Racer): MoveModifiers {
  const catchUp = racer.id === 'player' ? 1 : catchUpMul(racer, player);
  const base = { ...BASE_MODIFIERS, forceMul: racer.profile.forceMul * catchUp };
  return hasPassives(racer) ? withPassives(racer, base) : base;
}

/** True when anything held or any status could change swimming; otherwise the profile alone decides. */
function hasPassives(racer: Racer): boolean {
  const { boost, slowed, inflated } = racer.status;
  return racer.stack.length > 0 || boost > 0 || slowed > 0 || inflated > 0;
}
