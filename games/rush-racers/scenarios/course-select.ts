/**
 * Course select with its listed courses: Sunlit Shallows first, then Bramble Run, each with its best
 * on the level in force. Picking Bramble Run opens select on its world, and dash there goes back to
 * course select with the cursor on Bramble Run.
 */
import { expect } from '@playwright/test';
import { scenario, TWO_COURSE_SAVE, tap, wait } from './kit.ts';

/**
 * Title Race opens course select on Sunlit Shallows, the course in force. Down moves to Bramble Run
 * and fire picks it. Dash on the select screen goes back to course select, whose cursor now starts
 * on Bramble Run, the course picked. A scenario sees only where it ends, so the select screen's
 * Thornwood cast and the race on foot are checked mid-walk in `tests/course.spec.ts`.
 */
export default scenario({
  description: 'course select lists every course with its best, picks Bramble Run, and select goes back to it',
  start: { save: TWO_COURSE_SAVE, seed: 1 },
  input: [wait(25), tap('fire'), wait(5), tap('down'), wait(20), tap('fire'), wait(25), tap('dash'), wait(5)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({
      scene: 'course',
      course: 'bramble-run',
      courseSelect: {
        rows: [
          { id: 'sunlit-shallows', name: 'Sunlit Shallows', best: '1:30.00' },
          { id: 'bramble-run', name: 'Bramble Run', best: '1:40.00' },
          { id: 'thunderhead-pass', name: 'Thunderhead Pass' },
          { id: 'slingshot-alley', name: 'Slingshot Alley', best: '-:--.--' },
        ],
        selected: 1,
      },
    });
    const scenes = events.filter((e) => e.type === 'scene.started').map((e) => e.scene);
    // Loading the save restarts the title, so the walk is checked from course select on.
    expect(scenes.slice(scenes.indexOf('course'))).toEqual(['course', 'select', 'course']);
  },
});
