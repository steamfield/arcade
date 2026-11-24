/**
 * `?course=` and the course a session races: a listed or unknown id from the URL, and Bramble Run
 * or Thunderhead Pass picked on course select becoming the save's last course, which the title's
 * best line follows.
 */
import { expect, test } from '@arcade/testing/playwright';
import { IDLE_TO_RESULTS, TITLE_TO_RACE, tap, wait } from '../scenarios/kit.ts';

test('?course=sunlit-shallows races Sunlit Shallows', async ({ game }) => {
  await game.open({ query: { course: 'sunlit-shallows' } });
  await game.play(TITLE_TO_RACE);
  expect(await game.summary()).toMatchObject({ scene: 'race', course: 'sunlit-shallows', medium: 'swim' });
  expect(game.console.filter((line) => line.includes('unknown course'))).toEqual([]);
});

test('?course=bramble-run races Bramble Run on foot', async ({ game }) => {
  await game.open({ query: { course: 'bramble-run' } });
  // Course select opens on the course in force, so the walk's fire on it keeps Bramble Run.
  await game.play(TITLE_TO_RACE);
  expect(await game.summary()).toMatchObject({ scene: 'race', course: 'bramble-run', medium: 'run' });
  expect(game.console.filter((line) => line.includes('unknown course'))).toEqual([]);
});

test('an unknown ?course= warns once and races Sunlit Shallows', async ({ game }) => {
  await game.open({ query: { course: 'nope' } });
  await game.play(TITLE_TO_RACE);
  expect(await game.summary()).toMatchObject({ scene: 'race', course: 'sunlit-shallows' });
  // The runtime unit test checks the warning names the id; console text renders the data object differently per browser.
  expect(game.console.filter((line) => line.includes('unknown course'))).toEqual([
    expect.stringMatching(/^\[warning\] \[rush-racers\] unknown course in \?course=, racing the default/),
  ]);
});

/** A v6 save on Hard with a best on each listed course and Sunlit Shallows as the last course raced. */
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

/** The title's best line for each course in `TWO_COURSE_SAVE` on Hard. */
const SUNLIT_BEST = 'Best 1:30.00 (1st)';
const BRAMBLE_BEST = 'Best 1:40.00 (2nd)';

test('a race on Bramble Run makes it the last course, and the title shows its best, after a reload too', async ({
  game,
}) => {
  await game.open();
  await game.loadState(TWO_COURSE_SAVE);
  expect(await game.summary()).toMatchObject({ scene: 'title', course: 'sunlit-shallows', best: SUNLIT_BEST });

  // Race opens course select on Sunlit Shallows; down moves to Bramble Run.
  await game.play([wait(25), tap('fire'), wait(5), tap('down'), wait(2)]);
  expect(await game.summary()).toMatchObject({
    scene: 'course',
    courseSelect: {
      rows: [{ id: 'sunlit-shallows' }, { id: 'bramble-run' }, { id: 'thunderhead-pass' }, { id: 'slingshot-alley' }],
      selected: 1,
    },
  });
  // Fire picks it: select shows Thornwood's cast, the cursor on the saved pick's slot (rudy is Grit there).
  await game.play([wait(20), tap('fire'), wait(2)]);
  expect(await game.summary()).toMatchObject({ scene: 'select', course: 'bramble-run', selectName: 'GRIT' });
  // Race as the saved pick, on foot, and stand still to a DNF.
  await game.play([wait(25), tap('fire'), wait(2)]);
  expect(await game.summary()).toMatchObject({ scene: 'race', course: 'bramble-run', medium: 'run' });
  await game.play([wait(IDLE_TO_RESULTS)]);
  expect(await game.summary()).toMatchObject({ scene: 'results', course: 'bramble-run', medium: 'run' });
  // A DNF saves no best, so both bests stay the save's.
  expect(await game.state()).toMatchObject({
    save: { lastCourse: 'bramble-run', races: 1, bests: TWO_COURSE_SAVE.data.bests },
  });

  // Results' Title, two rows down, shows Bramble Run's best.
  await game.play([tap('down'), wait(1), tap('down'), tap('fire'), wait(5)]);
  expect(await game.summary()).toMatchObject({ scene: 'title', course: 'bramble-run', best: BRAMBLE_BEST });

  await game.open();
  expect(await game.summary()).toMatchObject({ scene: 'title', course: 'bramble-run', best: BRAMBLE_BEST });
});

/** `TWO_COURSE_SAVE` with a Hard best on Thunderhead Pass as well. */
const THREE_COURSE_SAVE = {
  ...TWO_COURSE_SAVE,
  data: {
    ...TWO_COURSE_SAVE.data,
    bests: {
      ...TWO_COURSE_SAVE.data.bests,
      'thunderhead-pass': { easy: null, normal: null, hard: { ticks: 6600, place: 3 } },
    },
  },
};

/** The title's best line for Thunderhead Pass in `THREE_COURSE_SAVE` on Hard. */
const THUNDERHEAD_BEST = 'Best 1:50.00 (3rd)';

test('Thunderhead Pass, third on course select, races in flight with the Cloudreach cast and becomes the last course', async ({
  game,
}) => {
  await game.open();
  await game.loadState(THREE_COURSE_SAVE);

  // Race opens course select on Sunlit Shallows, each row with its Hard best; down twice reaches Thunderhead Pass.
  await game.play([wait(25), tap('fire'), wait(5), tap('down'), wait(1), tap('down'), wait(2)]);
  expect(await game.summary()).toMatchObject({
    scene: 'course',
    courseSelect: {
      rows: [
        { id: 'sunlit-shallows', name: 'Sunlit Shallows', best: '1:30.00' },
        { id: 'bramble-run', name: 'Bramble Run', best: '1:40.00' },
        { id: 'thunderhead-pass', name: 'Thunderhead Pass', best: '1:50.00' },
        { id: 'slingshot-alley', name: 'Slingshot Alley', best: '-:--.--' },
      ],
      selected: 2,
    },
  });
  // Fire picks it: select shows Cloudreach's cast, the cursor on the saved pick's slot (rudy is Bumper there).
  await game.play([wait(20), tap('fire'), wait(2)]);
  expect(await game.summary()).toMatchObject({ scene: 'select', course: 'thunderhead-pass', selectName: 'BUMPER' });
  // Race as the saved pick, in flight, and idle to a DNF.
  await game.play([wait(25), tap('fire'), wait(2)]);
  expect(await game.summary()).toMatchObject({ scene: 'race', course: 'thunderhead-pass', medium: 'flight' });
  await game.play([wait(IDLE_TO_RESULTS)]);
  expect(await game.summary()).toMatchObject({ scene: 'results', course: 'thunderhead-pass', medium: 'flight' });
  // A DNF saves no best, so every best stays the save's.
  expect(await game.state()).toMatchObject({
    save: { lastCourse: 'thunderhead-pass', races: 1, bests: THREE_COURSE_SAVE.data.bests },
  });

  // Results' Title, two rows down, shows Thunderhead Pass's best, after a reload too.
  await game.play([tap('down'), wait(1), tap('down'), tap('fire'), wait(5)]);
  expect(await game.summary()).toMatchObject({ scene: 'title', course: 'thunderhead-pass', best: THUNDERHEAD_BEST });
  await game.open();
  expect(await game.summary()).toMatchObject({ scene: 'title', course: 'thunderhead-pass', best: THUNDERHEAD_BEST });
});
