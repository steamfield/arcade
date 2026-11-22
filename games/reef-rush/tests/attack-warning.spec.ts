import { expect, test } from '@arcade/testing/playwright';

test('a staged lock-on reaches the HUD state, and a staged latch calls for kicks', async ({ game }) => {
  await game.open({ scene: 'race', debug: true, query: { stage: 'squid-lockon' } });
  await game.advance(2);
  expect(await game.summary()).toMatchObject({ scene: 'race', threat: { lockedOn: true, latched: false } });
});

test('a staged latch shows as latched', async ({ game }) => {
  await game.open({ scene: 'race', debug: true, query: { stage: 'squid-latched' } });
  await game.advance(2);
  expect(await game.summary()).toMatchObject({ threat: { lockedOn: false, latched: true } });
});

test('without a stage the HUD reports no threat', async ({ game }) => {
  await game.open({ scene: 'race' });
  await game.advance(2);
  expect(await game.summary()).toMatchObject({ threat: { lockedOn: false, latched: false } });
});
