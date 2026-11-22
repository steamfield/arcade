/**
 * How a finished race changes the save: the race count always goes up, and the
 * best time moves only when the player finished faster than before.
 */
import type { SaveData } from './save.ts';
import type { RaceResult } from './types.ts';

/** True when the player finished this race faster than the saved best, or set the first best. */
export function isNewBest(save: SaveData, result: RaceResult): boolean {
  const ticks = result.playerTicks;
  if (ticks === null) return false;
  return save.best === null || ticks < save.best.ticks;
}

/** The save after one more race. A DNF counts as a race but never touches the best time. */
export function recordResult(save: SaveData, result: RaceResult): SaveData {
  const best =
    isNewBest(save, result) && result.playerTicks !== null
      ? { ticks: result.playerTicks, place: result.playerPlace }
      : save.best;
  return { ...save, races: save.races + 1, best };
}
