import { expect, test } from '@arcade/testing/playwright';
import { COUNTDOWN_TICKS } from '../src/logic/race/standings.ts';

const STAGE = { scene: 'race', debug: true, query: { stage: 'icons-a' } } as const;

test('a race starts with two dash charges and no pearls', async ({ game }) => {
  await game.open(STAGE);
  await game.advance(COUNTDOWN_TICKS + 5);
  expect(await game.summary()).toMatchObject({ scene: 'race', dashCharges: 2, pearls: 0 });
});
