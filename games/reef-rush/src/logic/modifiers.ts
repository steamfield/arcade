/**
 * Combines everything that changes how a racer swims this tick into one
 * MoveModifiers: its profile, the difficulty level and catch-up, then held power-ups and timed
 * statuses through `powerups/passives.ts`, then its character's ability.
 */
import { abilityModifiers } from './abilities.ts';
import { catchUpMul } from './ai/rival.ts';
import { playerCatchUpMul, tuningOf } from './difficulty-level.ts';
import { withPassives } from './powerups/passives.ts';
import { playerOf } from './racers.ts';
import { BASE_MODIFIERS } from './swim/physics.ts';
import type { MoveModifiers, Racer, World } from './types.ts';

/**
 * Modifiers for `racer` in `world`. A rival swims at the level's `rivalForceMul` and its catch-up
 * (which waits `rivalCatchUpDelayTicks` after the GO); the player gets the level's own push
 * (`playerCatchUpMul`) while it trails the leader.
 */
export function modifiersFor(world: World, racer: Racer): MoveModifiers {
  const tuning = tuningOf(world);
  const levelMul =
    racer.id === 'player'
      ? playerCatchUpMul(racer, world.racers, tuning)
      : tuning.rivalForceMul *
        (world.race.raceTick < tuning.rivalCatchUpDelayTicks
          ? 1
          : catchUpMul(racer, playerOf(world), tuning.rivalCatchUp));
  return abilityModifiers(
    racer,
    withPassives(racer, { ...BASE_MODIFIERS, forceMul: racer.profile.forceMul * levelMul }),
  );
}
