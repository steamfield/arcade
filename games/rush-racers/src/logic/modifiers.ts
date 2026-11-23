/**
 * Combines everything that changes how a racer moves this tick into one MoveModifiers: the medium's
 * base with the course's overrides, its profile, the difficulty level and catch-up, then held
 * power-ups and timed statuses through `powerups/passives.ts`, then its character's ability.
 */
import { abilityModifiers } from './abilities.ts';
import { catchUpMul } from './ai/rival.ts';
import { playerCatchUpMul, rivalCatchUpFor, tuningOf } from './difficulty-level.ts';
import { effectiveTuning } from './media/index.ts';
import { withPassives } from './powerups/passives.ts';
import { playerOf } from './racers.ts';
import type { MoveModifiers, Racer, World } from './types.ts';

/**
 * Modifiers for `racer` in `world`. A rival moves at the level's `rivalForceMul` and its catch-up
 * (which waits `rivalCatchUpDelayTicks` after the GO); the player gets the level's own push
 * (`playerCatchUpMul`) while it trails the leader.
 *
 * @throws {Error} When the world names a course or medium that is neither shipped nor registered.
 */
export function modifiersFor(world: World, racer: Racer): MoveModifiers {
  const tuning = tuningOf(world);
  const levelMul =
    racer.id === 'player'
      ? playerCatchUpMul(racer, world.racers, tuning)
      : tuning.rivalForceMul *
        (world.race.raceTick < tuning.rivalCatchUpDelayTicks
          ? 1
          : catchUpMul(racer, playerOf(world), rivalCatchUpFor(world)));
  const base = effectiveTuning(world).base;
  return abilityModifiers(
    racer,
    withPassives(racer, { ...base, forceMul: base.forceMul * racer.profile.forceMul * levelMul }),
  );
}
