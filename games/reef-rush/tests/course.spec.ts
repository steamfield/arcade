import { expect, test } from '@arcade/testing/playwright';
import { TITLE_TO_RACE } from '../scenarios/kit.ts';

test('?course=sunlit-shallows races Sunlit Shallows', async ({ game }) => {
  await game.open({ query: { course: 'sunlit-shallows' } });
  await game.play(TITLE_TO_RACE);
  expect(await game.summary()).toMatchObject({ scene: 'race', course: 'sunlit-shallows', medium: 'swim' });
  expect(game.console.filter((line) => line.includes('unknown course'))).toEqual([]);
});

test('an unknown ?course= warns once and races Sunlit Shallows', async ({ game }) => {
  await game.open({ query: { course: 'nope' } });
  await game.play(TITLE_TO_RACE);
  expect(await game.summary()).toMatchObject({ scene: 'race', course: 'sunlit-shallows' });
  // The runtime unit test checks the warning names the id; console text renders the data object differently per browser.
  expect(game.console.filter((line) => line.includes('unknown course'))).toEqual([
    expect.stringMatching(/^\[warning\] \[reef-rush\] unknown course in \?course=, racing the default/),
  ]);
});
