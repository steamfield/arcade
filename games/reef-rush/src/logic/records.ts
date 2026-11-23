/**
 * How a finished race changes the save: the race count always goes up, and the
 * best time for the race's level moves only when the player finished faster
 * than before on that level.
 */
import type { SaveData } from './save.ts';
import type { Difficulty, RaceResult } from './types.ts';

/** True when the player finished this race faster than the saved best on `difficulty`, or set that level's first best. */
export function isNewBest(save: SaveData, result: RaceResult, difficulty: Difficulty): boolean {
  const ticks = result.playerTicks;
  if (ticks === null) return false;
  const best = save.best[difficulty];
  return best === null || ticks < best.ticks;
}

/** The save after one more race on `difficulty`. A DNF counts as a race but never touches a best time. */
export function recordResult(save: SaveData, result: RaceResult, difficulty: Difficulty): SaveData {
  const best =
    isNewBest(save, result, difficulty) && result.playerTicks !== null
      ? { ...save.best, [difficulty]: { ticks: result.playerTicks, place: result.playerPlace } }
      : save.best;
  return { ...save, races: save.races + 1, best };
}
