import { expect, test } from '@arcade/testing/playwright';
import { COUNTDOWN_TICKS } from '../src/logic/race/standings.ts';

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

test('a squid locked on the player is announced before it latches, and the latch ends', async ({ game }) => {
  // The staged squid is real: once the race starts the logic flies it at the player.
  await game.open({ scene: 'race', debug: true, query: { stage: 'squid-lockon' } });
  await game.advance(COUNTDOWN_TICKS + 1);
  expect(await game.summary()).toMatchObject({ threat: { lockedOn: true, latched: false } });
  await game.advance(120);
  const events = await game.events();
  const latch = events.find((e) => e.type === 'squid.latched' && e.id === 'player');
  expect(latch, 'the staged squid should reach the player').toBeDefined();
  await game.advance(200);
  expect(await game.summary()).toMatchObject({ threat: { lockedOn: false, latched: false } });
});
