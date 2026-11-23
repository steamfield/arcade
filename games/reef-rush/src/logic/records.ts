/**
 * How a finished race changes the save: the race count always goes up, a listed course becomes the
 * last course, and the best time for the race's course and level moves only when the player
 * finished faster than before there. Unlisted courses (tests, previews) never get a best.
 */
import { courseById } from './courses/index.ts';
import { NO_BESTS, type SaveData } from './save.ts';
import type { Difficulty, RaceResult } from './types.ts';

/** A saved best: the finish time in ticks and the place it earned. */
export type Best = NonNullable<SaveData['bests'][string][Difficulty]>;

const isListed = (courseId: string): boolean => courseById(courseId)?.listed === true;

/** The saved best on `courseId` at `difficulty`, or null when there is none. */
export function bestFor(save: SaveData, courseId: string, difficulty: Difficulty): Best | null {
  if (!Object.hasOwn(save.bests, courseId)) return null;
  return save.bests[courseId]?.[difficulty] ?? null;
}

/**
 * True when the player finished this race on a listed course faster than the saved best there at
 * `difficulty`, or set that course and level's first best.
 */
export function isNewBest(save: SaveData, courseId: string, difficulty: Difficulty, result: RaceResult): boolean {
  const ticks = result.playerTicks;
  if (ticks === null || !isListed(courseId)) return false;
  const best = bestFor(save, courseId, difficulty);
  return best === null || ticks < best.ticks;
}

/**
 * The save after one more race on `courseId` at `difficulty`. A DNF counts as a race but never
 * touches a best time; an unlisted course counts as a race and changes nothing else.
 */
export function recordRace(save: SaveData, courseId: string, difficulty: Difficulty, result: RaceResult): SaveData {
  const races = save.races + 1;
  if (!isListed(courseId)) return { ...save, races };
  if (result.playerTicks === null || !isNewBest(save, courseId, difficulty, result)) {
    return { ...save, races, lastCourse: courseId };
  }
  const levels = Object.hasOwn(save.bests, courseId) ? (save.bests[courseId] ?? NO_BESTS) : NO_BESTS;
  const best = { ticks: result.playerTicks, place: result.playerPlace };
  return {
    ...save,
    races,
    lastCourse: courseId,
    bests: { ...save.bests, [courseId]: { ...levels, [difficulty]: best } },
  };
}
