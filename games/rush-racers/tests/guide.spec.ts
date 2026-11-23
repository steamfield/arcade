import { parseInput } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';
import { TITLE_TO_RACE } from '../scenarios/kit.ts';
import { COUNTDOWN_TICKS } from '../src/logic/race/standings.ts';
import normalSave from './fixtures/save-v4.json' with { type: 'json' };

/** The first wall in the course whose way on is up or down, with the player already stuck against it. */
const STAGE = { scene: 'race', debug: true, query: { stage: 'guide' } } as const;

test('a stuck player on Easy is shown the way on, and the arrow goes once they swim along it', async ({ game }) => {
  await game.open(STAGE);
  await game.advance(COUNTDOWN_TICKS + 5);
  const stuck = await game.summary();
  expect(stuck).toMatchObject({ scene: 'race', raceDifficulty: 'easy' });
  const way = (stuck.hints as { guide: { x: number; y: number } | null }).guide;
  expect(way, 'the guide should point up or down along the wall').not.toBeNull();
  expect(way?.x).toBe(0);
  expect(Math.abs(way?.y ?? 0)).toBe(1);

  // Swimming the way it points makes headway, so the arrow clears.
  await game.play(parseInput(`${way?.y === 1 ? 'down' : 'up'}*40`));
  expect(await game.summary()).toMatchObject({ hints: { guide: null } });
});

test('Normal gets no arrow, however long the player is stuck', async ({ game }) => {
  await game.open({ debug: true, query: { stage: 'guide' } });
  await game.loadState(normalSave);
  await game.play(TITLE_TO_RACE);
  await game.advance(COUNTDOWN_TICKS + 5);
  expect(await game.summary()).toMatchObject({ raceDifficulty: 'normal', hints: { guide: null } });
});
