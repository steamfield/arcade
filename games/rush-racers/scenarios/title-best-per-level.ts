import { expect } from '@playwright/test';
import { scenario, tap, wait } from './kit.ts';

/** A current-version save (v7 drops bests on the courses it lengthened) with Sunlit Shallows bests on two levels. */
const save = {
  version: 7,
  savedAt: '2026-11-24T00:00:00.000Z',
  data: {
    bests: {
      'sunlit-shallows': { easy: { ticks: 3100, place: 3 }, normal: null, hard: { ticks: 2650, place: 1 } },
    },
    lastCourse: 'sunlit-shallows',
    races: 7,
    settings: { muted: true, reducedMotion: true, difficulty: 'hard' },
    character: 'baron',
  },
};

/**
 * The save is on Hard with a best of 0:44.16 (1st) there and 0:51.66 (3rd) on Easy. Level is three
 * rows below Race and cycles Hard to Easy in one press, and the best on show follows it.
 */
export default scenario({
  description: 'the title shows the best for the selected level and changes it when Level cycles',
  start: { save },
  input: [wait(25), tap('down'), wait(2), tap('down'), wait(2), tap('down'), wait(2), tap('fire'), wait(5)],
  expect({ summary }) {
    expect(summary).toMatchObject({ scene: 'title', difficulty: 'easy', best: 'Best 0:51.66 (3rd)' });
  },
});
