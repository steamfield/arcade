import { parseInput } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';
import { HARD_SAVE, TITLE_TO_RACE, TOP_ROUTE, wait } from '../scenarios/kit.ts';

test('starts on WebGL, races from the title through the select screen, and swims after the countdown', async ({
  game,
}) => {
  await game.open();
  expect(await game.renderer()).toBe('webgl');
  expect(await game.summary()).toMatchObject({
    scene: 'title',
    menu: { options: ['Race', 'How to play', 'Difficulty', 'Sound', 'Motion'], selected: 0 },
    best: null,
  });

  // Menus and the select screen ignore fire for their first 20 ticks.
  await game.play(parseInput('_*20 fire _*2'));
  expect(await game.summary()).toMatchObject({ scene: 'select', character: 'rudy' });
  await game.play(parseInput('_*20 fire _*2'));
  expect(await game.summary()).toMatchObject({ scene: 'race', phase: 'countdown', character: 'rudy' });

  await game.play(parseInput('_*180 right*60'));
  const summary = await game.summary();
  expect(summary).toMatchObject({ scene: 'race', phase: 'racing' });
  expect((summary.player as { tile: number[] }).tile[0]).toBeGreaterThan(4);
  const events = await game.events();
  expect(events.filter((e) => e.type === 'menu.selected')).toMatchObject([{ option: 'Race' }]);
  expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual(['title', 'select', 'race']);
  expect(events.map((e) => e.type)).toContain('race.started');
});

test('on-screen controls pick a racer, start the race and swim the player @touch', async ({ game, page }) => {
  await game.open();
  const hold = async (action: string, ticks: number) => {
    const button = page.locator(`[data-testid="touch-overlay"] button[data-action="${action}"]`);
    await button.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
    await game.advance(ticks);
    await button.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
  };
  await game.advance(20);
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

/**
 * `debugState().worldHash` at the end of `TOP_ROUTE` on Hard, 30 ticks after the finish and before
 * the results screen. Online races run the
 * same simulation on each player's browser and compare this hash, so the engines must agree on it.
 * It differs from the pin in `src/logic/top-route.test.ts`, whose replay stops on the finish tick.
 */
const TOP_ROUTE_BROWSER_HASH = 873020956;

test('a finished race is saved and its best time shows on the title after a reload', async ({ game }) => {
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
