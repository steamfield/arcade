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
import { catchUpTarget } from './race/catch-up.ts';
import { isHuman } from './racers.ts';
import type { MoveModifiers, Racer, World } from './types.ts';

/**
 * Modifiers for `racer` in `world`. A human slot (taken over or not) gets the level's own push
 * (`playerCatchUpMul`) while it trails the leader. Every other racer moves at the level's
 * `rivalForceMul` and its catch-up to `catchUpTarget`, which waits `rivalCatchUpDelayTicks` after
 * the GO.
 *
 * @throws {Error} When the world names a course or medium that is neither shipped nor registered.
 */
export function modifiersFor(world: World, racer: Racer): MoveModifiers {
  const levelMul = isHuman(world, racer.id) ? humanLevelMul(world, racer) : rivalLevelMul(world, racer);
  const base = effectiveTuning(world).base;
  return abilityModifiers(
    racer,
    withPassives(racer, { ...base, forceMul: base.forceMul * racer.profile.forceMul * levelMul }),
  );
}

/** The level's force factor on a human slot: its push while trailing the leader. */
function humanLevelMul(world: World, racer: Racer): number {
  return playerCatchUpMul(racer, world.racers, tuningOf(world));
}

/** The level's force factor on a rival: `rivalForceMul`, times its catch-up once the delay after the GO is over. */
function rivalLevelMul(world: World, racer: Racer): number {
  const tuning = tuningOf(world);
  if (world.race.raceTick < tuning.rivalCatchUpDelayTicks) return tuning.rivalForceMul;
  return tuning.rivalForceMul * catchUpMul(racer, catchUpTarget(world), rivalCatchUpFor(world));
}
