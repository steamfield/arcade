import { type GameDriver, parseInput } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';
import { COUNTDOWN_TICKS } from '../src/logic/race/standings.ts';
import normalSave from './fixtures/save-v4.json' with { type: 'json' };

/** The v4 fixture is three races in, on Normal: past the first race, so only Easy brings the hints back. */
const easySave = {
  ...normalSave,
  data: { ...normalSave.data, settings: { ...normalSave.data.settings, difficulty: 'easy' } },
};

/** Opens the title with `save` loaded, picks the saved racer and starts a race staged with a held power-up. */
async function startStagedRace(game: GameDriver, save: unknown, stage = 'icons-b') {
  await game.open({ debug: true, query: { stage } });
  await game.loadState(save);
  await game.play(parseInput('_*20 kick _*2'));
  await game.play(parseInput('_*20 kick _*2'));
  await game.advance(COUNTDOWN_TICKS + 5);
}

test('a later Normal race shows no hints', async ({ game }) => {
  await startStagedRace(game, normalSave);
  expect(await game.summary()).toMatchObject({
    scene: 'race',
    difficulty: 'normal',
    stack: ['mimic'],
    hints: { pressB: false, kick: false, pulseStack: false },
  });
});

test('a later Easy race still shows PRESS B for a held power-up', async ({ game }) => {
  await startStagedRace(game, easySave);
  expect(await game.summary()).toMatchObject({ difficulty: 'easy', hints: { pressB: true } });
});

test('PRESS B goes away once the player fires the stack, even though power-ups are still held', async ({ game }) => {
  // icons-a holds three; firing spends only the Undertow, so two stay in the stack and prove the hint retired for the burst, not the empty stack.
  await startStagedRace(game, easySave, 'icons-a');
  expect(await game.summary()).toMatchObject({ hints: { pressB: true } });
  await game.play(parseInput('burst'));
  const summary = await game.summary();
  expect(summary).toMatchObject({ hints: { pressB: false } });
  expect((summary.stack as string[]).length).toBeGreaterThan(0);
});

test('a squid locked on the player calls for a KICK only once it is close enough to dodge', async ({ game }) => {
  await game.open({ scene: 'race', debug: true, query: { stage: 'squid-lockon' } });
  await game.advance(COUNTDOWN_TICKS + 1);
  const far = await game.summary();
  expect(far).toMatchObject({ threat: { lockedOn: true }, hints: { kick: false } });

  let called = false;
  for (let step = 0; step < 40 && !called; step++) {
    await game.advance(2);
    const summary = await game.summary();
    const latched = (summary.threat as { latched: boolean }).latched;
    called = (summary.hints as { kick: boolean }).kick;
    if (latched) break;
  }
  expect(called, 'KICK! should show before the squid latches').toBe(true);
});

test('the on-screen B button shows the newest held power-up while the stack holds one', async ({ game, page }) => {
  const icon = page.locator('[data-testid="touch-overlay"] button[data-action="burst"] img');
  await game.open({ scene: 'race', touch: true });
  await game.advance(5);
  await expect(icon).toHaveCount(0);

  await game.open({ scene: 'race', touch: true, debug: true, query: { stage: 'icons-b' } });
  await game.advance(5);
  await expect(icon).toHaveCount(1);
});

test('the on-screen B button goes back to a plain B once firing spends the stack', async ({ game, page }) => {
  const icon = page.locator('[data-testid="touch-overlay"] button[data-action="burst"] img');
  // icons-c holds a lone Undertow, which is gone once fired.
  await game.open({ scene: 'race', touch: true, debug: true, query: { stage: 'icons-c' } });
  await game.advance(COUNTDOWN_TICKS + 5);
  await expect(icon).toHaveCount(1);
  await game.play(parseInput('burst'));
  expect(await game.summary()).toMatchObject({ stack: [] });
  await expect(icon).toHaveCount(0);
});
