import { expect } from '@playwright/test';
import { scenario, wait } from './kit.ts';

/**
 * Loading a save while the title is already up restarts the title, which must stay running. The save
 * is the current version's, since v7 drops bests on the courses it lengthened.
 */
const save = {
  version: 7,
  savedAt: '2026-11-24T00:00:00.000Z',
  data: {
    bests: { 'sunlit-shallows': { easy: { ticks: 2712, place: 2 }, normal: null, hard: null } },
    lastCourse: 'sunlit-shallows',
    races: 3,
    settings: { muted: false, reducedMotion: null, difficulty: 'easy' },
    character: 'rudy',
  },
};

export default scenario({
  description: 'a save with a best time shows that time and place on a running title screen',
  start: { save },
  input: [wait(5)],
  expect({ summary }) {
    expect(summary).toMatchObject({
      scene: 'title',
      best: 'Best 0:45.20 (2nd)',
      menu: { options: ['Race', 'Friends', 'How to play', 'Difficulty', 'Sound', 'Motion'] },
    });
  },
});
