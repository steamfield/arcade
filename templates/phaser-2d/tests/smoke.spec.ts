import { parseInput } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';

test('starts on WebGL, plays, and offers Continue after a reload', async ({ game }) => {
  await game.open();
  expect(await game.renderer()).toBe('webgl');
  expect(await game.summary()).toMatchObject({ scene: 'title' });

  await game.play(parseInput('jump'));
  await game.play(parseInput('right*120'));
  expect(await game.summary()).toMatchObject({ scene: 'play', coins: '1/9' });
  expect((await game.events()).map((e) => e.type)).toContain('save.written');

  await game.open();
  expect(await game.state()).toMatchObject({ scene: 'title', menu: { options: ['Continue', 'New game'] } });
  await game.play(parseInput('jump _*2'));
  expect(await game.summary()).toMatchObject({ scene: 'play', coins: '1/9' });
});

test('on-screen controls start the game and move the player @touch', async ({ game, page }) => {
  await game.open();
  const hold = async (action: string, ticks: number) => {
    const button = page.locator(`[data-testid="touch-overlay"] button[data-action="${action}"]`);
    await button.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
    await game.advance(ticks);
    await button.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
  };
  await hold('jump', 1);
  await game.advance(2);
  await hold('right', 60);
  expect(await game.summary()).toMatchObject({ scene: 'play', player: { tile: [7, 9] } });
});
