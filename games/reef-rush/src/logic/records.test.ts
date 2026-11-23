import { describe, expect, it } from 'vitest';
import { bestFor, isNewBest, recordRace } from './records.ts';
import { NEW_GAME, NO_BESTS, type SaveData } from './save.ts';
import { courseFromLevel } from './test-world.ts';
import type { RaceResult } from './types.ts';

const SUNLIT = 'sunlit-shallows';
const settings = { muted: true, reducedMotion: false, difficulty: 'easy' as const };
/** A saved pick other than the default, so a test sees it carried through. */
const character = 'gil' as const;

function finish(ticks: number, place: number): RaceResult {
  return { standings: ['player', 'tess', 'squib', 'bo'], playerPlace: place, playerTicks: ticks };
}

const dnf: RaceResult = { standings: ['tess', 'squib', 'bo', 'player'], playerPlace: 4, playerTicks: null };

/** A save with a best of 3000 ticks, 2nd place, on Sunlit's Easy only, and a course the game no longer has. */
const easyBest: SaveData = {
  bests: {
    [SUNLIT]: { ...NO_BESTS, easy: { ticks: 3000, place: 2 } },
    'gone-course': { ...NO_BESTS, hard: { ticks: 1, place: 1 } },
  },
  lastCourse: SUNLIT,
  races: 4,
  settings,
  character,
};

describe('recording a race', () => {
  it('sets the first best time from a first finish, and remembers the course', () => {
    expect(recordRace(NEW_GAME, SUNLIT, 'easy', finish(3000, 2))).toEqual({
      ...NEW_GAME,
      bests: { [SUNLIT]: { ...NO_BESTS, easy: { ticks: 3000, place: 2 } } },
      lastCourse: SUNLIT,
      races: 1,
    });
    expect(isNewBest(NEW_GAME, SUNLIT, 'easy', finish(3000, 2))).toBe(true);
  });

  it('keeps the old best after a slower finish, even with a better place', () => {
    expect(recordRace(easyBest, SUNLIT, 'easy', finish(3200, 1))).toEqual({ ...easyBest, races: 5 });
    expect(isNewBest(easyBest, SUNLIT, 'easy', finish(3200, 1))).toBe(false);
  });

  it('keeps the old best after a finish that only ties it', () => {
    expect(bestFor(recordRace(easyBest, SUNLIT, 'easy', finish(3000, 1)), SUNLIT, 'easy')).toEqual({
      ticks: 3000,
      place: 2,
    });
    expect(isNewBest(easyBest, SUNLIT, 'easy', finish(3000, 1))).toBe(false);
  });

  it('replaces the best with a faster finish and its place, keeping other courses', () => {
    expect(recordRace(easyBest, SUNLIT, 'easy', finish(2900, 3))).toEqual({
      ...easyBest,
      bests: { ...easyBest.bests, [SUNLIT]: { ...NO_BESTS, easy: { ticks: 2900, place: 3 } } },
      races: 5,
    });
    expect(isNewBest(easyBest, SUNLIT, 'easy', finish(2900, 3))).toBe(true);
  });

  it('counts a DNF as a race without setting or changing a best', () => {
    expect(recordRace(NEW_GAME, SUNLIT, 'easy', dnf)).toEqual({ ...NEW_GAME, races: 1, lastCourse: SUNLIT });
    expect(recordRace(easyBest, SUNLIT, 'easy', dnf)).toEqual({ ...easyBest, races: 5 });
    expect(isNewBest(NEW_GAME, SUNLIT, 'easy', dnf)).toBe(false);
  });

  it('compares a finish only with the best on its own level', () => {
    // 3500 ticks is slower than Easy's best but the first finish on Hard, so it is a new best there.
    expect(isNewBest(easyBest, SUNLIT, 'hard', finish(3500, 1))).toBe(true);
    expect(recordRace(easyBest, SUNLIT, 'hard', finish(3500, 1)).bests[SUNLIT]).toEqual({
      ...NO_BESTS,
      easy: { ticks: 3000, place: 2 },
      hard: { ticks: 3500, place: 1 },
    });
    // 2500 ticks beats Easy's best, but Normal has none of its own to beat.
    expect(bestFor(recordRace(easyBest, SUNLIT, 'normal', finish(2500, 3)), SUNLIT, 'easy')).toEqual({
      ticks: 3000,
      place: 2,
    });
  });

  it('gives an unlisted course no best and never makes it the last course', () => {
    const preview = courseFromLevel('#1234.F#');
    expect(isNewBest(NEW_GAME, preview.id, 'easy', finish(100, 1))).toBe(false);
    expect(recordRace(easyBest, preview.id, 'easy', finish(100, 1))).toEqual({ ...easyBest, races: 5 });
  });

  it('reads no best for a course without one, including names that are not plain keys', () => {
    expect(bestFor(easyBest, 'kelp-forest', 'easy')).toBeNull();
    expect(bestFor(easyBest, '__proto__', 'easy')).toBeNull();
    expect(bestFor(easyBest, 'constructor', 'easy')).toBeNull();
    expect(bestFor(easyBest, 'gone-course', 'hard')).toEqual({ ticks: 1, place: 1 });
  });
});
