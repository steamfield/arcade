import { describe, expect, it } from 'vitest';
import { isNewBest, recordResult } from './records.ts';
import { NEW_GAME, type SaveData } from './save.ts';
import type { RaceResult } from './types.ts';

const settings = { muted: true, reducedMotion: false };
/** A saved pick other than the default, so a test sees it carried through. */
const character = 'gil' as const;

function finish(ticks: number, place: number): RaceResult {
  return { standings: ['player', 'tess', 'squib', 'bo'], playerPlace: place, playerTicks: ticks };
}

const dnf: RaceResult = { standings: ['tess', 'squib', 'bo', 'player'], playerPlace: 4, playerTicks: null };

describe('recording a race', () => {
  it('sets the first best time from a first finish', () => {
    expect(recordResult(NEW_GAME, finish(3000, 2))).toEqual({
      best: { ticks: 3000, place: 2 },
      races: 1,
      settings: NEW_GAME.settings,
      character: NEW_GAME.character,
    });
    expect(isNewBest(NEW_GAME, finish(3000, 2))).toBe(true);
  });

  it('keeps the old best after a slower finish, even with a better place', () => {
    const before: SaveData = { best: { ticks: 3000, place: 2 }, races: 4, settings, character };

    expect(recordResult(before, finish(3200, 1))).toEqual({
      best: { ticks: 3000, place: 2 },
      races: 5,
      settings,
      character,
    });
    expect(isNewBest(before, finish(3200, 1))).toBe(false);
  });

  it('keeps the old best after a finish that only ties it', () => {
    const before: SaveData = { best: { ticks: 3000, place: 2 }, races: 4, settings, character };

    expect(recordResult(before, finish(3000, 1)).best).toEqual({ ticks: 3000, place: 2 });
    expect(isNewBest(before, finish(3000, 1))).toBe(false);
  });

  it('replaces the best with a faster finish and its place', () => {
    const before: SaveData = { best: { ticks: 3000, place: 2 }, races: 4, settings, character };

    expect(recordResult(before, finish(2900, 3))).toEqual({
      best: { ticks: 2900, place: 3 },
      races: 5,
      settings,
      character,
    });
    expect(isNewBest(before, finish(2900, 3))).toBe(true);
  });

  it('counts a DNF as a race without setting or changing a best', () => {
    const before: SaveData = { best: { ticks: 3000, place: 2 }, races: 4, settings, character };

    expect(recordResult(NEW_GAME, dnf)).toEqual({ ...NEW_GAME, races: 1 });
    expect(recordResult(before, dnf)).toEqual({ ...before, races: 5 });
    expect(isNewBest(NEW_GAME, dnf)).toBe(false);
  });
});
