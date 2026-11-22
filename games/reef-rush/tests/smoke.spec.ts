import { parseInput } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';

test('starts on WebGL, races from the title, and swims after the countdown', async ({ game }) => {
  await game.open();
  expect(await game.renderer()).toBe('webgl');
  expect(await game.state()).toMatchObject({ scene: 'title', menu: { options: ['Race'] } });

  await game.play(parseInput('kick _*2'));
  expect(await game.summary()).toMatchObject({ scene: 'play', phase: 'countdown' });

  await game.play(parseInput('_*180 right*60'));
  const summary = await game.summary();
  expect(summary).toMatchObject({ scene: 'play', phase: 'racing' });
  expect((summary.player as { tile: number[] }).tile[0]).toBeGreaterThan(4);
  expect((await game.events()).map((e) => e.type)).toContain('race.started');
});

test('on-screen controls start the race and swim the player @touch', async ({ game, page }) => {
  await game.open();
  const hold = async (action: string, ticks: number) => {
    const button = page.locator(`[data-testid="touch-overlay"] button[data-action="${action}"]`);
    await button.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
    await game.advance(ticks);
    await button.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
  };
  await hold('kick', 1);
  await game.advance(182);
  await hold('right', 60);
  const summary = await game.summary();
  expect(summary).toMatchObject({ scene: 'play', phase: 'racing' });
  expect((summary.player as { tile: number[] }).tile[0]).toBeGreaterThan(4);
});
