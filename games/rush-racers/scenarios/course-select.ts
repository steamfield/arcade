/**
 * Course select with two listed courses: Sunlit Shallows first, then Bramble Run. Picking Bramble Run
 * races it in Thornwood's run medium, and dash on the select screen goes back to course select.
 */
import { expect } from '@playwright/test';
import { scenario, tap, wait } from './kit.ts';

/**
 * A v6 save on Hard whose last course is Sunlit Shallows, with a best on each course, so course
 * select opens on Sunlit Shallows with a best on both rows.
 */
const TWO_COURSE_SAVE = {
  version: 6,
  savedAt: '2026-11-23T00:00:00.000Z',
  data: {
    bests: {
      'sunlit-shallows': { easy: null, normal: null, hard: { ticks: 5400, place: 1 } },
      'bramble-run': { easy: null, normal: null, hard: { ticks: 6000, place: 2 } },
    },
    lastCourse: 'sunlit-shallows',
    races: 0,
    settings: { muted: false, reducedMotion: null, difficulty: 'hard' },
    character: 'rudy',
  },
};

/**
 * Title Race opens course select on Sunlit Shallows, the course in force. Down moves to Bramble Run
 * and fire picks it. Dash on the select screen goes back to course select, whose cursor now starts
 * on Bramble Run, so fire picks it again; fire on select races it as the saved pick.
 */
export default scenario({
  description: 'course select picks Bramble Run, select goes back to it, and the race runs on foot in Thornwood',
  start: { save: TWO_COURSE_SAVE, seed: 1 },
  input: [
    wait(25),
    tap('fire'),
    wait(5),
    tap('down'),
    wait(20),
    tap('fire'),
    wait(25),
    tap('dash'),
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(10),
  ],
  expect({ summary, events }) {
    expect(summary).toMatchObject({
      scene: 'race',
      phase: 'countdown',
      course: 'bramble-run',
      medium: 'run',
      character: 'rudy',
    });
    const scenes = events.filter((e) => e.type === 'scene.started').map((e) => e.scene);
    // Loading the save restarts the title, so the walk is checked from course select on.
    expect(scenes.slice(scenes.indexOf('course'))).toEqual(['course', 'select', 'course', 'select', 'race']);
  },
});
