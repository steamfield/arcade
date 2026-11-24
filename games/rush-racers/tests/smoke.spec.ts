/**
 * Smoke checks on every browser project: boot, the menus into a race on each world, touch controls
 * on the phone, a saved best surviving a reload, and the world hash agreeing across engines.
 */
import { parseInput } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';
import { HARD_SAVE, TITLE_TO_RACE, TOP_ROUTE, wait } from '../scenarios/kit.ts';

test('starts on WebGL, races from the title through course select and the select screen, and swims after the countdown', async ({
  game,
}) => {
  await game.open();
  expect(await game.renderer()).toBe('webgl');
  expect(await game.summary()).toMatchObject({
    scene: 'title',
    menu: { options: ['Race', 'How to play', 'Difficulty', 'Sound', 'Motion'], selected: 0 },
    best: null,
  });

  // Menus, course select and the select screen ignore fire for their first 20 ticks.
  await game.play(parseInput('_*20 fire _*2'));
  expect(await game.summary()).toMatchObject({ scene: 'course' });
  await game.play(parseInput('_*20 fire _*2'));
  expect(await game.summary()).toMatchObject({ scene: 'select', character: 'rudy', course: 'sunlit-shallows' });
  await game.play(parseInput('_*20 fire _*2'));
  expect(await game.summary()).toMatchObject({ scene: 'race', phase: 'countdown', character: 'rudy' });

  await game.play(parseInput('_*180 right*60'));
  const summary = await game.summary();
  expect(summary).toMatchObject({ scene: 'race', phase: 'racing' });
  expect((summary.player as { tile: number[] }).tile[0]).toBeGreaterThan(4);
  const events = await game.events();
  expect(events.filter((e) => e.type === 'menu.selected')).toMatchObject([{ option: 'Race' }]);
  expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual([
    'title',
    'course',
    'select',
    'race',
  ]);
  expect(events.map((e) => e.type)).toContain('race.started');
});

test('on-screen controls pick a course and a racer, start the race and swim the player @touch', async ({
  game,
  page,
}) => {
  await game.open();
  const hold = async (action: string, ticks: number) => {
    const button = page.locator(`[data-testid="touch-overlay"] button[data-action="${action}"]`);
    await button.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
    await game.advance(ticks);
    await button.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
  };
  await game.advance(20);
  await hold('fire', 1);
  // Course select: fire keeps the course in force.
  await game.advance(21);
  await hold('fire', 1);
  await game.advance(21);
  await hold('right', 1);
  await game.advance(1);
  await hold('fire', 1);
  await game.advance(182);
  await hold('right', 60);
  const summary = await game.summary();
  expect(summary).toMatchObject({ scene: 'race', phase: 'racing', character: 'gil' });
  expect((summary.player as { tile: number[] }).tile[0]).toBeGreaterThan(4);
});

test('a Bramble Run race starts from the menus and runs 600 ticks on foot', async ({ game }) => {
  await game.open();
  // Title Race, then down to Bramble Run on course select once it has armed.
  await game.play(parseInput('_*20 fire _*2 _*20 down _*1 fire _*2'));
  expect(await game.summary()).toMatchObject({ scene: 'select', course: 'bramble-run', medium: 'run' });
  await game.play(parseInput('_*20 fire _*2 _*180 right*600'));
  // The game fixture fails the test on any console error, failed request or game error along the way.
  const summary = await game.summary();
  expect(summary).toMatchObject({ scene: 'race', phase: 'racing', course: 'bramble-run', medium: 'run' });
  expect(summary.raceTick).toBeGreaterThanOrEqual(600);
});

test('a Slingshot Alley race starts from the menus and drifts 600 ticks', async ({ game }) => {
  await game.open();
  await game.loadState(HARD_SAVE);
  // Title Race, then down twice to Slingshot Alley on course select once it has armed.
  await game.play(parseInput('_*20 fire _*2 _*20 down _*1 down _*1 fire _*2'));
  expect(await game.summary()).toMatchObject({ scene: 'select', course: 'slingshot-alley', medium: 'drift' });
  await game.play(parseInput('_*20 fire _*2 _*180 right*600'));
  const summary = await game.summary();
  expect(summary).toMatchObject({ scene: 'race', phase: 'racing', course: 'slingshot-alley', medium: 'drift' });
  expect(summary.raceTick).toBeGreaterThanOrEqual(600);
});

/**
 * `debugState().worldHash` after a Drift Test race on Hard that swings round the planet bend, flies
 * the top corridor into the black hole, is swallowed and comes back (the flight `well-swing` and
 * the old hand-flown `hole-respawn` recorded). It covers the drift medium with both kinds of
 * gravity well and the fall-out timer, the way `TOP_ROUTE_BROWSER_HASH` covers swimming: every
 * browser project must compute the same number.
 */
const DRIFT_WELLS_BROWSER_HASH = 963384121;

test('a Drift Test race swings past the planet, is swallowed by the black hole and comes back, to one hash on every browser', async ({
  game,
}) => {
  await game.open({ query: { course: 'drift-test' } });
  await game.loadState(HARD_SAVE);
  // Drift Test is unlisted, so Race skips course select; the wait lands the first hold on the race's first tick.
  await game.play(
    parseInput(
      '_*25 fire _*25 fire _*180 right*290 up*60 left+up*40 right+down*40 right*60 right+up*3 right*190 up*40 _*80',
    ),
  );
  const summary = await game.summary();
  expect(summary).toMatchObject({ scene: 'race', phase: 'racing', course: 'drift-test', medium: 'drift' });
  const events = await game.events();
  const player = events.filter((e) => (e.type === 'racer.fell' || e.type === 'racer.respawned') && e.id === 'player');
  expect(player.map((e) => e.type)).toEqual(['racer.fell', 'racer.respawned']);
  expect(await game.state()).toMatchObject({ worldHash: DRIFT_WELLS_BROWSER_HASH });
});

test('on Bramble Run the on-screen Up button jumps @touch', async ({ game, page }) => {
  await game.open();
  const hold = async (action: string, ticks: number) => {
    const button = page.locator(`[data-testid="touch-overlay"] button[data-action="${action}"]`);
    await button.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
    await game.advance(ticks);
    await button.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
  };
  await game.advance(20);
  await hold('fire', 1);
  // Course select: down to Bramble Run, then pick it; then race as the saved pick.
  await game.advance(21);
  await hold('down', 1);
  await hold('fire', 1);
  await game.advance(21);
  await hold('fire', 1);
  await game.advance(190);
  await hold('up', 10);
  expect(await game.summary()).toMatchObject({ scene: 'race', phase: 'racing', course: 'bramble-run' });
  const events = await game.events();
  expect(events.filter((e) => e.type === 'racer.jumped' && e.id === 'player')).toHaveLength(1);
});

/**
 * `debugState().worldHash` at the end of `TOP_ROUTE` on Hard, 30 ticks after the finish and before
 * the results screen. Online races run the
 * same simulation on each player's browser and compare this hash, so the engines must agree on it.
 * It differs from the pin in `src/logic/top-route.test.ts`, whose replay stops on the finish tick.
 */
const TOP_ROUTE_BROWSER_HASH = 3893755221;

test('a finished race is saved and its best time shows on the title after a reload', async ({ game }) => {
  test.slow(true, 'swims the whole course, about 250 input steps');
  // TOP_ROUTE was recorded on Hard; a fresh save races on Easy.
  await game.open();
  await game.loadState(HARD_SAVE);
  await game.play([...TITLE_TO_RACE, ...TOP_ROUTE]);
  // Read before the results delay runs, so the number depends on the inputs alone. One number for
  // every browser project: Chromium, the phone and WebKit computed the same race.
  expect(await game.state()).toMatchObject({ worldHash: TOP_ROUTE_BROWSER_HASH });
  await game.play([wait(90)]);
  const results = await game.summary();
  expect(results).toMatchObject({ scene: 'results', result: { newBest: true, saveFailed: false } });
  const { ticks, place } = results.result as { ticks: number; place: number };

  await game.open();
  expect(await game.summary()).toMatchObject({
    scene: 'title',
    best: expect.stringMatching(/^Best \d:\d\d\.\d\d \(\d(st|nd|rd|th)\)$/),
  });
  expect(await game.state()).toMatchObject({
    save: { bests: { 'sunlit-shallows': { hard: { ticks, place } } }, lastCourse: 'sunlit-shallows', races: 1 },
  });
});

test('a player arriving from the arcade lands in the game with no start button to press', async ({ page }) => {
  // No test flag: this is what a player gets from a link on the landing page.
  await page.goto('/games/rush-racers/');
  await page.waitForFunction(() => window.__arcade?.ready === true || (window.__arcade?.errors.length ?? 0) > 0);
  expect(await page.evaluate(() => window.__arcade?.errors)).toEqual([]);
  await expect(page.locator('[data-arcade-start]')).toHaveCount(0);
  await expect(page.locator('canvas')).toBeVisible();
});
