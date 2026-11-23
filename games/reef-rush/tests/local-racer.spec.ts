/**
 * `?local=<slot>`: a debug race in which the screen follows another slot. The keyboard drives that
 * slot, the AI swims slot 1, and the summary, HUD, results and save all describe the followed racer.
 */
import type { GameDriver } from '@arcade/testing';
import { expect, test } from '@arcade/testing/playwright';
import { HARD_SAVE, hold, IDLE_TO_RESULTS, TITLE_TO_RACE, tap, wait } from '../scenarios/kit.ts';
import { COUNTDOWN_TICKS } from '../src/logic/race/standings.ts';
import { TILE } from '../src/logic/types.ts';

/** The racer fields `debugState().racers` carries that these tests read. */
interface RacerState {
  id: string;
  place: number;
  body: { x: number; y: number; w: number; h: number };
}

/** Ticks of holding right after GO: enough to cross more than two tiles. */
const SWIM_TICKS = 60;

/** Each racer in `debugState()`, by slot. */
async function racersBySlot(game: GameDriver): Promise<Record<string, RacerState>> {
  const state = (await game.state()) as { racers: RacerState[] };
  return Object.fromEntries(state.racers.map((racer) => [racer.id, racer]));
}

/** The tile holding a racer's centre, as `debugSummary().player.tile` reports it. */
function centreTile({ body }: RacerState): [number, number] {
  return [Math.floor((body.x + body.w / 2) / TILE), Math.floor((body.y + body.h / 2) / TILE)];
}

/** Opens the game with `?local=` (and `?stage=` when given), loads `save` when given, and starts a race from the title. */
async function startRace(game: GameDriver, options: { debug: boolean; local: string; save?: unknown; stage?: string }) {
  const query: Record<string, string> = { local: options.local };
  if (options.stage) query.stage = options.stage;
  await game.open({ debug: options.debug, query });
  if (options.save) await game.loadState(options.save);
  await game.play(TITLE_TO_RACE);
}

/** Console warnings about `?local=`. */
function localWarnings(game: GameDriver): string[] {
  return game.console.filter((line) => line.includes('?local='));
}

test('?debug=1&local=tess follows tess: the keyboard swims her and the summary describes her', async ({ game }) => {
  await startRace(game, { debug: true, local: 'tess', save: HARD_SAVE });
  const start = await racersBySlot(game);
  await game.play([wait(COUNTDOWN_TICKS), hold('right', SWIM_TICKS)]);

  const summary = await game.summary();
  const racers = await racersBySlot(game);
  expect(summary).toMatchObject({ scene: 'race', phase: 'racing', local: 'tess', raceDifficulty: 'hard' });
  expect(racers.tess?.body.x).toBeGreaterThan((start.tess?.body.x ?? 0) + 2 * TILE);
  expect((summary.player as { tile: number[] }).tile).toEqual(centreTile(racers.tess as RacerState));
  expect(localWarnings(game)).toEqual([]);
});

test('in a ?local=tess race the AI swims slot 1, and a dash kicks tess alone', async ({ game }) => {
  await startRace(game, { debug: true, local: 'tess', save: HARD_SAVE });
  const start = await racersBySlot(game);
  await game.play([wait(COUNTDOWN_TICKS), wait(SWIM_TICKS)]);
  expect((await racersBySlot(game)).player?.body.x).toBeGreaterThan(start.player?.body.x ?? 0);

  const beforeTap = await game.events();
  await game.play([tap('dash')]);
  const all = await game.events();
  // The tap is one tick, so everything logged after it was stamped on the tap's tick.
  const onTap = all.slice(beforeTap.length);
  const kicks = onTap.filter((event) => event.type === 'racer.kicked');
  expect(kicks, 'the dash press kicks tess and nobody else').toEqual([
    expect.objectContaining({ type: 'racer.kicked', id: 'tess' }),
  ]);
  expect(onTap.map((event) => event.tick)).toEqual(onTap.map(() => kicks[0]?.tick));
  expect(all.filter((event) => event.type === 'racer.takeover' && event.id === 'tess')).toEqual([]);
});

test('a ?local=tess race seats the picked character in the followed slot', async ({ game }) => {
  const pickedGil = { ...HARD_SAVE, data: { ...HARD_SAVE.data, character: 'gil' } };
  await startRace(game, { debug: true, local: 'tess', save: pickedGil });

  const racers = (await game.state()) as { racers: { id: string; character: string }[] };
  expect(racers.racers.find((racer) => racer.id === 'tess')?.character).toBe('gil');
  expect(racers.racers.filter((racer) => racer.character === 'gil').map((racer) => racer.id)).toEqual(['tess']);
});

test("the HUD's place in a ?local=tess race is tess's, not slot 1's", async ({ game }) => {
  await startRace(game, { debug: true, local: 'tess', save: HARD_SAVE });
  const start = await racersBySlot(game);
  // Tess idles while the AI swims slot 1 away, so the two places differ.
  await game.play([wait(COUNTDOWN_TICKS + SWIM_TICKS)]);
  const racers = await racersBySlot(game);
  expect(racers.tess?.body.x, 'no AI swims the followed slot').toBe(start.tess?.body.x);
  expect(racers.tess?.place).not.toBe(racers.player?.place);
  expect(await game.summary()).toMatchObject({ place: `${racers.tess?.place}/4` });
});

test('?local=tess without ?debug=1 races as slot 1', async ({ game }) => {
  await startRace(game, { debug: false, local: 'tess', save: HARD_SAVE });
  const start = await racersBySlot(game);
  await game.play([wait(COUNTDOWN_TICKS), hold('right', SWIM_TICKS)]);

  const summary = await game.summary();
  const racers = await racersBySlot(game);
  expect(summary).not.toHaveProperty('local');
  expect(racers.player?.body.x).toBeGreaterThan((start.player?.body.x ?? 0) + 2 * TILE);
  expect((summary.player as { tile: number[] }).tile).toEqual(centreTile(racers.player as RacerState));
  expect(localWarnings(game)).toEqual([]);
});

test('?debug=1&local=nobody warns once, naming it, and races as slot 1', async ({ game }) => {
  await startRace(game, { debug: true, local: 'nobody', save: HARD_SAVE });
  await game.play([wait(COUNTDOWN_TICKS), hold('right', SWIM_TICKS)]);

  const summary = await game.summary();
  const racers = await racersBySlot(game);
  expect(summary).toMatchObject({ scene: 'race', raceDifficulty: 'hard' });
  expect(summary).not.toHaveProperty('local');
  expect((summary.player as { tile: number[] }).tile).toEqual(centreTile(racers.player as RacerState));
  expect(localWarnings(game)).toEqual([
    expect.stringMatching(/^\[warning\] \[reef-rush\] unknown slot in \?local=nobody, racing as slot 1/),
  ]);
});

test('?debug=1&local=tess on a fresh save races on Normal, with one warning, since Easy is for slot 1', async ({
  game,
}) => {
  await startRace(game, { debug: true, local: 'tess' });
  expect(await game.summary()).toMatchObject({ scene: 'race', difficulty: 'easy', local: 'tess' });
  expect(await game.state()).toMatchObject({ raceDifficulty: 'normal' });
  expect(localWarnings(game)).toEqual([
    expect.stringMatching(/^\[warning\] \[reef-rush\] \?local=tess races on Normal: Easy is single-player in slot 1/),
  ]);
});

test('a finished ?local=tess race shows tess on the results and writes no save', async ({ game }) => {
  await startRace(game, { debug: true, local: 'tess', save: HARD_SAVE });
  const raceStart = (await game.events()).length;
  const before = ((await game.state()) as { save: { races: number; bests: unknown } }).save;

  // Tess never swims, so she is last when the race ends on the DNF grace or the limit.
  await game.play([wait(IDLE_TO_RESULTS)]);
  const finish = (await game.events()).slice(raceStart);
  expect(await game.summary()).toMatchObject({
    scene: 'results',
    result: { place: 4, ticks: null, newBest: false, saveFailed: false },
  });
  expect(finish.filter((event) => event.type === 'race.finished')).toMatchObject([
    { standings: [expect.any(String), expect.any(String), expect.any(String), 'tess'] },
  ]);
  expect(finish.filter((event) => event.type === 'save.written' || event.type === 'save.failed')).toEqual([]);

  await game.open({ debug: true, query: { local: 'tess' } });
  expect(await game.summary()).toMatchObject({ scene: 'title' });
  expect(await game.state()).toMatchObject({ save: { races: before.races, bests: before.bests } });
});

test('?debug=1&local=player races as slot 1 and still says it is a ?local= race', async ({ game }) => {
  await startRace(game, { debug: true, local: 'player', save: HARD_SAVE });
  await game.play([wait(COUNTDOWN_TICKS), hold('right', SWIM_TICKS)]);

  const summary = await game.summary();
  const racers = await racersBySlot(game);
  expect(summary).toMatchObject({ scene: 'race', local: 'player', raceDifficulty: 'hard' });
  expect((summary.player as { tile: number[] }).tile).toEqual(centreTile(racers.player as RacerState));
});

test('a stage in a ?local=tess race is set up around tess: a staged squid locks on her', async ({ game }) => {
  await startRace(game, { debug: true, local: 'tess', save: HARD_SAVE, stage: 'squid-lockon' });
  await game.advance(2);
  expect(await game.summary()).toMatchObject({ local: 'tess', threat: { lockedOn: true, latched: false } });
});
