/**
 * Combines everything that changes how a racer swims this tick into one
 * MoveModifiers: its profile, the difficulty level and catch-up, then held power-ups and timed
 * statuses through `powerups/passives.ts`, then its character's ability.
 */
import { abilityModifiers } from './abilities.ts';
import { catchUpMul } from './ai/rival.ts';
import { DIFFICULTY, type DifficultyTuning, playerCatchUpMul } from './difficulty-level.ts';
import { withPassives } from './powerups/passives.ts';
import { BASE_MODIFIERS } from './swim/physics.ts';
import type { MoveModifiers, Racer } from './types.ts';

/**
 * Modifiers for `racer` given the player's position. Catch-up applies to rivals only, and a
 * rival also swims at the level's `rivalForceMul`; the player's racer gets the level's own
 * catch-up push (`playerCatchUpMul`) when `racers` shows it trailing the leader. `tuning` is Hard's
 * (no change) by default.
 */
export function modifiersFor(
  racer: Racer,
  player: Racer,
  tuning: DifficultyTuning = DIFFICULTY.hard,
  racers: readonly Racer[] = [],
): MoveModifiers {
  const levelMul =
    racer.id === 'player'
      ? playerCatchUpMul(racer, racers, tuning)
      : tuning.rivalForceMul * catchUpMul(racer, player, tuning.rivalCatchUp);
  return abilityModifiers(
    racer,
    withPassives(racer, { ...BASE_MODIFIERS, forceMul: racer.profile.forceMul * levelMul }),
  );
}
