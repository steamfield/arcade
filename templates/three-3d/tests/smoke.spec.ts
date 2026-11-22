import { parseInput } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';

test('starts on WebGL2, loads physics, and keeps progress across a reload', async ({ game }) => {
  await game.open();
  expect(await game.renderer()).toBe('webgl2');
  expect(await game.summary()).toMatchObject({ physics: 'ready', orbs: '0/6' });

  await game.play(parseInput('forward*50'));
  expect(await game.summary()).toMatchObject({ orbs: '1/6' });
  expect((await game.events()).map((e) => e.type)).toContain('save.written');

  await game.open();
  expect(await game.summary()).toMatchObject({ orbs: '1/6' });
});

test('on-screen controls move the player @touch', async ({ game, page }) => {
  await game.open();
  const button = page.locator('[data-testid="touch-overlay"] button[data-action="forward"]');
  await button.dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
  await game.advance(30);
  await button.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true });
  expect(await game.summary()).toMatchObject({ player: { z: -2.5 } });
});
