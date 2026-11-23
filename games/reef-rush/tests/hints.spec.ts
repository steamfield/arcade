import { type GameDriver, parseInput } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';
import { COUNTDOWN_TICKS } from '../src/logic/race/standings.ts';
import normalSave from './fixtures/save-v4.json' with { type: 'json' };

/** The v4 fixture is three races in, on Normal: past the first race, so only Easy brings the hints back. */
const easySave = {
  ...normalSave,
  data: { ...normalSave.data, settings: { ...normalSave.data.settings, difficulty: 'easy' } },
};

/** Opens the title with `save` loaded, picks the saved racer and starts a race staged with held items. */
async function startStagedRace(game: GameDriver, save: unknown, stage = 'icons-b') {
  await game.open({ debug: true, query: { stage } });
  await game.loadState(save);
  await game.play(parseInput('_*20 fire _*2'));
  await game.play(parseInput('_*20 fire _*2'));
  await game.advance(COUNTDOWN_TICKS + 5);
}

test('a later Normal race shows no hints', async ({ game }) => {
  await startStagedRace(game, normalSave);
  expect(await game.summary()).toMatchObject({
    scene: 'race',
    difficulty: 'normal',
    items: ['mimic:1', 'cannonball:1', null],
    hints: { pressFire: false, kick: false, pulseItems: false },
  });
});

test('a later Easy race still shows PRESS FIRE for a held item', async ({ game }) => {
  await startStagedRace(game, easySave);
  expect(await game.summary()).toMatchObject({ difficulty: 'easy', hints: { pressFire: true } });
});

test('PRESS FIRE goes away once the player fires an item, even though items are still held', async ({ game }) => {
  // icons-a holds three; firing spends the selected Homing Squid, so two stay held and prove the hint retired for the use, not an empty inventory.
  await startStagedRace(game, easySave, 'icons-a');
  expect(await game.summary()).toMatchObject({ hints: { pressFire: true } });
  await game.play(parseInput('fire'));
  expect(await game.summary()).toMatchObject({
    hints: { pressFire: false },
    items: [null, 'riptide:2', 'undertow:1'],
    selected: 1,
  });
});

test('a squid locked on the player calls for a DASH only once it is close enough to dodge', async ({ game }) => {
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
  expect(called, 'DASH! should show before the squid latches').toBe(true);
});

test('the on-screen A button shows the selected item while one is held', async ({ game, page }) => {
  const icon = page.locator('[data-testid="touch-overlay"] button[data-action="fire"] img');
  await game.open({ scene: 'race', touch: true });
  await game.advance(5);
  await expect(icon).toHaveCount(0);

  await game.open({ scene: 'race', touch: true, debug: true, query: { stage: 'icons-b' } });
  await game.advance(5);
  await expect(icon).toHaveCount(1);
});

test('the on-screen A button goes back to a plain A once firing uses up the last item', async ({ game, page }) => {
  const icon = page.locator('[data-testid="touch-overlay"] button[data-action="fire"] img');
  // icons-c holds a lone one-charge Undertow, which is gone once fired.
  await game.open({ scene: 'race', touch: true, debug: true, query: { stage: 'icons-c' } });
  await game.advance(COUNTDOWN_TICKS + 5);
  await expect(icon).toHaveCount(1);
  await game.play(parseInput('fire'));
  expect(await game.summary()).toMatchObject({ items: [null, null, null] });
  await expect(icon).toHaveCount(0);
});
