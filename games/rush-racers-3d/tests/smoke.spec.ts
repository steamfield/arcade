import { parseInput } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';

/**
 * `debugState().worldHash` after the countdown and a run down the first straight with a steer, a
 * jump and a dash. The hash covers logic state only. Every browser project must compute the same
 * number.
 */
const RUN_HASH = 328495537;

const COUNTDOWN = '_*180';

test('starts on WebGL2 in the countdown, then runs once it ends', async ({ game }) => {
  await game.open({ query: { scene: 'race' } });
  expect(await game.renderer()).toBe('webgl2');
  expect(await game.summary()).toMatchObject({ phase: 'countdown', scene: 'race' });

  await game.play(parseInput(`${COUNTDOWN} forward*60`));
  const summary = (await game.summary()) as { phase: string; player: { s: number } };
  expect(summary.phase).toBe('racing');
  expect(summary.player.s).toBeGreaterThan(10);
});

test('the same run reaches the same world on every browser', async ({ game }) => {
  await game.open({ query: { scene: 'race' } });
  await game.play(
    parseInput(`${COUNTDOWN} forward*40 forward+right*20 forward+jump*10 forward*20 forward+dash forward*30`),
  );
  expect(await game.state()).toMatchObject({ worldHash: RUN_HASH });
});

test('on-screen controls run the player @touch', async ({ game }) => {
  await game.open({ query: { scene: 'race' } });
  await game.play(parseInput(COUNTDOWN));
  await game.touch('forward', 30);
  const summary = (await game.summary()) as { player: { speed: number } };
  expect(summary.player.speed).toBeGreaterThan(0);
});

test('a player arriving from the arcade lands in the game with no start button to press', async ({ game, page }) => {
  // No test flag: this is what a player gets from a link on the landing page.
  await page.goto(game.path);
  await page.waitForFunction(() => window.__arcade?.ready === true || (window.__arcade?.errors.length ?? 0) > 0);
  expect(await page.evaluate(() => window.__arcade?.errors)).toEqual([]);
  await expect(page.locator('[data-arcade-start]')).toHaveCount(0);
  await expect(page.locator('canvas')).toBeVisible();
});
