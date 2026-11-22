import { parseInput } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';
import { TOP_ROUTE, wait } from '../scenarios/kit.ts';

test('starts on WebGL, races from the title through the select screen, and swims after the countdown', async ({
  game,
}) => {
  await game.open();
  expect(await game.renderer()).toBe('webgl');
  expect(await game.summary()).toMatchObject({
    scene: 'title',
    menu: { options: ['Race', 'Sound', 'Motion'], selected: 0 },
    best: null,
  });

  // Menus and the select screen ignore kick for their first 20 ticks.
  await game.play(parseInput('_*20 kick _*2'));
  expect(await game.summary()).toMatchObject({ scene: 'select', character: 'rudy' });
  await game.play(parseInput('_*20 kick _*2'));
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
  await hold('kick', 1);
  await game.advance(21);
  await hold('right', 1);
  await game.advance(1);
  await hold('kick', 1);
  await game.advance(182);
  await hold('right', 60);
  const summary = await game.summary();
  expect(summary).toMatchObject({ scene: 'race', phase: 'racing', character: 'gil' });
  expect((summary.player as { tile: number[] }).tile[0]).toBeGreaterThan(4);
});

test('a finished race is saved and its best time shows on the title after a reload', async ({ game }) => {
  await game.open({ scene: 'race' });
  await game.play([...TOP_ROUTE, wait(90)]);
  const results = await game.summary();
  expect(results).toMatchObject({ scene: 'results', result: { newBest: true, saveFailed: false } });
  const { ticks, place } = results.result as { ticks: number; place: number };

  await game.open();
  expect(await game.summary()).toMatchObject({
    scene: 'title',
    best: expect.stringMatching(/^Best \d:\d\d\.\d\d \(\d(st|nd|rd|th)\)$/),
  });
  expect(await game.state()).toMatchObject({ save: { best: { ticks, place }, races: 1 } });
});
