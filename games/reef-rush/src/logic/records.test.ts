import { describe, expect, it } from 'vitest';
import { isNewBest, recordResult } from './records.ts';
import { NEW_GAME, type SaveData } from './save.ts';
import type { RaceResult } from './types.ts';

const settings = { muted: true, reducedMotion: false, difficulty: 'easy' as const };
/** A saved pick other than the default, so a test sees it carried through. */
const character = 'gil' as const;
const none = { easy: null, normal: null, hard: null };

function finish(ticks: number, place: number): RaceResult {
  return { standings: ['player', 'tess', 'squib', 'bo'], playerPlace: place, playerTicks: ticks };
}

const dnf: RaceResult = { standings: ['tess', 'squib', 'bo', 'player'], playerPlace: 4, playerTicks: null };

/** A save with a best of 3000 ticks, 2nd place, on Easy only. */
const easyBest: SaveData = { best: { ...none, easy: { ticks: 3000, place: 2 } }, races: 4, settings, character };

describe('recording a race', () => {
  it('sets the first best time from a first finish', () => {
    expect(recordResult(NEW_GAME, finish(3000, 2), 'easy')).toEqual({
      best: { ...none, easy: { ticks: 3000, place: 2 } },
      races: 1,
      settings: NEW_GAME.settings,
      character: NEW_GAME.character,
    });
    expect(isNewBest(NEW_GAME, finish(3000, 2), 'easy')).toBe(true);
  });

  it('keeps the old best after a slower finish, even with a better place', () => {
    expect(recordResult(easyBest, finish(3200, 1), 'easy')).toEqual({ ...easyBest, races: 5 });
    expect(isNewBest(easyBest, finish(3200, 1), 'easy')).toBe(false);
  });

  it('keeps the old best after a finish that only ties it', () => {
    expect(recordResult(easyBest, finish(3000, 1), 'easy').best.easy).toEqual({ ticks: 3000, place: 2 });
    expect(isNewBest(easyBest, finish(3000, 1), 'easy')).toBe(false);
  });

  it('replaces the best with a faster finish and its place', () => {
    expect(recordResult(easyBest, finish(2900, 3), 'easy')).toEqual({
      ...easyBest,
      best: { ...none, easy: { ticks: 2900, place: 3 } },
      races: 5,
    });
    expect(isNewBest(easyBest, finish(2900, 3), 'easy')).toBe(true);
  });

  it('counts a DNF as a race without setting or changing a best', () => {
    expect(recordResult(NEW_GAME, dnf, 'easy')).toEqual({ ...NEW_GAME, races: 1 });
    expect(recordResult(easyBest, dnf, 'easy')).toEqual({ ...easyBest, races: 5 });
    expect(isNewBest(NEW_GAME, dnf, 'easy')).toBe(false);
  });

  it('compares a finish only with the best on its own level', () => {
    // 3500 ticks is slower than Easy's best but the first finish on Hard, so it is a new best there.
    expect(isNewBest(easyBest, finish(3500, 1), 'hard')).toBe(true);
    expect(recordResult(easyBest, finish(3500, 1), 'hard').best).toEqual({
      ...none,
      easy: { ticks: 3000, place: 2 },
      hard: { ticks: 3500, place: 1 },
    });
    // 2500 ticks beats Easy's best, but Normal has none of its own to beat.
    expect(recordResult(easyBest, finish(2500, 3), 'normal').best.easy).toEqual({ ticks: 3000, place: 2 });
  });
});
