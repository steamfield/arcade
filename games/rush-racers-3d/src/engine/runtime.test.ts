import 'fake-indexeddb/auto';
import { configureLogging, type LogEntry } from '@arcade/core';
import { createSaveStore, type SaveStore } from '@arcade/save';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod';
import { NO_INPUT } from '../logic/racer.ts';
import { migrations, SAVE_VERSION, type SaveData, SaveSchema } from '../logic/save.ts';
import { RACE } from '../logic/tuning.ts';
import type { Course } from '../logic/types.ts';
import { playerOf } from '../logic/world.ts';
import { type FrameInput, RESULTS_CONFIRM_DELAY_TICKS, Runtime, type RuntimeOptions } from './runtime.ts';

const course: Course = {
  id: 'thornwood-trail',
  name: 'Short straight',
  path: [{ kind: 'straight', length: 200 }],
  halfWidth: 5,
  hills: [],
  startS: 0,
  finishS: 40,
  parTicks: 300,
  features: [],
};
const idle: FrameInput = { race: NO_INPUT, confirmPressed: false };
const forward: FrameInput = { ...idle, race: { ...NO_INPUT, forward: true } };
const fire: FrameInput = { confirmPressed: true, race: { ...NO_INPUT, firePressed: true } };
const FINISH_TICKS = 192;
const STAGED_FINISH_TICKS = 150;
let storeCount = 0;
const openStore = (gameId = `racer-runtime-${storeCount++}`) =>
  createSaveStore({ gameId, version: SAVE_VERSION, schema: SaveSchema, migrate: migrations });

async function start(saves: SaveStore<SaveData>, options: Partial<Pick<RuntimeOptions, 'stage' | 'character'>> = {}) {
  const notices: string[] = [];
  const held = { frame: idle, reads: 0, afterTicks: 0, notices };
  const runtime = await Runtime.start({
    gameId: 'race-test',
    saves,
    course,
    seed: 1,
    character: null,
    stage: null,
    notice: (message) => held.notices.push(message),
    readInput: () => {
      held.reads++;
      return held.frame;
    },
    afterTick: () => {
      held.afterTicks++;
    },
    ...options,
  });
  function advance(ticks: number, frame: FrameInput = idle) {
    held.frame = frame;
    runtime.advance(ticks);
  }
  return { runtime, held, advance };
}

afterEach(() => configureLogging(() => {}));

it('shows results on the finish tick, records a best, and restores it from IndexedDB', async () => {
  const saves = await openStore();
  const { runtime, advance } = await start(saves);
  advance(RACE.countdownTicks + FINISH_TICKS - 1, forward);
  expect(runtime.scene).toBe('race');
  advance(1, forward);
  expect(runtime.summary()).toMatchObject({ scene: 'results', finishTicks: FINISH_TICKS });
  expect(runtime.bests).toEqual({ [course.id]: FINISH_TICKS });
  expect(runtime.events.all().slice(-2)).toMatchObject([
    { type: 'race.ended', ticks: FINISH_TICKS, tick: RACE.countdownTicks + FINISH_TICKS },
    { type: 'best.new', course: course.id, ticks: FINISH_TICKS, tick: RACE.countdownTicks + FINISH_TICKS },
  ]);
  expect(runtime.saving).toBe(true);
  await runtime.settled();
  expect(runtime.saving).toBe(false);
  expect(runtime.events.all().at(-1)?.type).toBe('save.written');
  expect((await start(saves)).runtime.bests).toEqual({ [course.id]: FINISH_TICKS });
});

it.each([FINISH_TICKS - 1, FINISH_TICKS])(
  'keeps an existing best of %s ticks without announcing a new best',
  async (ticks) => {
    const saves = await openStore();
    await saves.save('main', { character: 'dusk', bests: { [course.id]: ticks, 'other-course': 200 } });
    const { runtime, advance } = await start(saves);
    const bests = runtime.bests;
    advance(RACE.countdownTicks + FINISH_TICKS, forward);
    await runtime.settled();
    expect(runtime.summary()).toMatchObject({ scene: 'results', finishTicks: FINISH_TICKS });
    expect(runtime.bests).toBe(bests);
    expect(runtime.events.all().filter((event) => event.type === 'best.new')).toHaveLength(0);
    expect(await saves.load('main')).toEqual({
      kind: 'ok',
      data: { character: 'dusk', bests: { [course.id]: ticks, 'other-course': 200 } },
    });
  },
);

it('replaces a slower stored best and keeps the other course record', async () => {
  const saves = await openStore();
  const stored = { [course.id]: FINISH_TICKS + 20, 'other-course': 321 };
  await saves.save('main', { character: 'grit', bests: stored });
  const { runtime, advance } = await start(saves);
  advance(RACE.countdownTicks + FINISH_TICKS, forward);
  const improved = { ...stored, [course.id]: FINISH_TICKS };
  expect(runtime.bests).toEqual(improved);
  expect(runtime.events.all().filter((event) => event.type === 'best.new')).toMatchObject([
    { course: course.id, ticks: FINISH_TICKS, tick: RACE.countdownTicks + FINISH_TICKS },
  ]);
  await runtime.settled();
  expect((await start(saves)).runtime.bests).toEqual(improved);
});

it('ignores fire in a race and before the results delay, then restarts at the exact delay with the same character', async () => {
  const saves = await openStore();
  await saves.save('main', { character: 'fang', bests: {} });
  const { runtime, held, advance } = await start(saves);
  const world = runtime.world;
  advance(RACE.countdownTicks);
  advance(1, fire);
  expect(runtime.world).toBe(world);
  expect(world.raceTicks).toBe(1);
  advance(FINISH_TICKS - 1, forward);
  advance(1, { ...fire, race: { ...forward.race, firePressed: true } });
  expect(runtime.scene).toBe('results');
  advance(1, fire);
  expect(runtime.world).toBe(world);
  advance(RESULTS_CONFIRM_DELAY_TICKS - 3);
  advance(1, fire);
  expect(runtime.scene).toBe('results');
  expect(runtime.events.all().filter((event) => event.type === 'race.restarted')).toHaveLength(0);
  advance(1, fire);
  expect(runtime.world).not.toBe(world);
  expect(playerOf(runtime.world).character).toBe('fang');
  expect(runtime.summary()).toMatchObject({ scene: 'race', phase: 'countdown', tick: 0, finishTicks: null });
  const endTick = RACE.countdownTicks + FINISH_TICKS + 1;
  expect(runtime.events.all().at(-1)).toMatchObject({
    type: 'race.restarted',
    tick: endTick + RESULTS_CONFIRM_DELAY_TICKS,
  });
  expect(held.reads).toBe(endTick + RESULTS_CONFIRM_DELAY_TICKS);
  expect(held.afterTicks).toBe(held.reads);
  await runtime.settled();
});

it('requires a fresh screen confirm after the delay and ignores race fire', async () => {
  const { runtime, advance } = await start(await openStore());
  advance(RACE.countdownTicks + FINISH_TICKS, forward);
  advance(RESULTS_CONFIRM_DELAY_TICKS - 2);
  advance(1, { ...idle, confirmPressed: true });
  advance(1, { ...fire, confirmPressed: false });
  expect(runtime.scene).toBe('results');
  expect(runtime.events.all().filter((event) => event.type === 'race.restarted')).toEqual([]);
  advance(1, { ...idle, confirmPressed: true });
  expect(runtime.summary()).toMatchObject({ scene: 'race', phase: 'countdown', tick: 0 });
  expect(runtime.events.all().filter((event) => event.type === 'race.restarted')).toHaveLength(1);
  await runtime.settled();
});

it('keeps the stored best across staged finishes and staged restarts without queuing a write', async () => {
  const saves = await openStore();
  await saves.save('main', { character: 'grit', bests: { [course.id]: 200 } });
  const original = await saves.exportJson('main');
  const { runtime, advance } = await start(saves, { stage: 'near-finish' });
  advance(STAGED_FINISH_TICKS, forward);
  expect(runtime.summary()).toMatchObject({ scene: 'results', finishTicks: STAGED_FINISH_TICKS + 1 });
  expect(runtime.saving).toBe(false);
  advance(RESULTS_CONFIRM_DELAY_TICKS - 1);
  advance(1, fire);
  expect(runtime.summary()).toMatchObject({ scene: 'race', phase: 'racing', player: { s: 10 } });
  advance(STAGED_FINISH_TICKS, forward);
  expect(runtime.scene).toBe('results');
  expect(runtime.saving).toBe(false);
  await runtime.settled();
  expect(runtime.bests).toEqual({ [course.id]: 200 });
  expect(
    runtime.events.all().filter((event) => ['best.new', 'save.failed', 'save.written'].includes(event.type)),
  ).toEqual([]);
  expect(await saves.exportJson('main')).toBe(original);
});

it('warns on an unreadable save and leaves its bytes untouched after a finish', async () => {
  const gameId = `racer-runtime-${storeCount++}`;
  const old = await createSaveStore({ gameId, version: SAVE_VERSION, schema: z.object({ racer: z.string() }) });
  await old.save('main', { racer: 'old format' });
  const original = await old.exportJson('main');
  const saves = await openStore(gameId);
  const { runtime, held, advance } = await start(saves);
  expect(held.notices).toHaveLength(1);
  advance(RACE.countdownTicks + FINISH_TICKS, forward);
  expect(runtime.scene).toBe('results');
  expect(runtime.bests).toEqual({ [course.id]: FINISH_TICKS });
  expect(runtime.saving).toBe(false);
  await runtime.settled();
  expect(runtime.events.all().filter((event) => ['save.failed', 'save.written'].includes(event.type))).toEqual([]);
  expect(await saves.exportJson('main')).toBe(original);
});

it.each(['reports a failure', 'throws'])(
  'logs save.failed when a write %s and saves the next race after the failure',
  async (failure) => {
    const saves = await openStore();
    const write = saves.save;
    saves.save = () => {
      saves.save = write;
      if (failure === 'throws') throw new Error('disk full');
      return Promise.resolve({ ok: false, reason: 'disk full' });
    };
    const logged: LogEntry[] = [];
    configureLogging((entry) => logged.push(entry));
    const { runtime, advance } = await start(saves);
    advance(RACE.countdownTicks + FINISH_TICKS, forward);
    expect(runtime.saving).toBe(true);
    expect(runtime.scene).toBe('results');
    await expect(runtime.settled()).resolves.toBeUndefined();
    expect(runtime.saving).toBe(false);
    expect(runtime.events.all().at(-1)).toMatchObject({ type: 'save.failed', reason: 'disk full' });
    advance(RESULTS_CONFIRM_DELAY_TICKS - 1);
    advance(1, fire);
    expect(runtime.scene).toBe('race');
    advance(RACE.countdownTicks + FINISH_TICKS, forward);
    expect(runtime.scene).toBe('results');
    await expect(runtime.settled()).resolves.toBeUndefined();
    expect(runtime.saving).toBe(false);
    expect(
      runtime.events.all().filter((event) => event.type === 'save.failed' || event.type === 'save.written'),
    ).toMatchObject([{ type: 'save.failed', reason: 'disk full' }, { type: 'save.written' }]);
    expect(logged).toEqual([{ level: 'warn', namespace: 'race-test', message: 'race progress not saved: disk full' }]);
    expect(await saves.load('main')).toEqual({
      kind: 'ok',
      data: { character: 'grit', bests: { [course.id]: FINISH_TICKS } },
    });
  },
);

it('uses the launch character override in the race and saves it with the new best', async () => {
  const saves = await openStore();
  await saves.save('main', { character: 'grit', bests: { 'other-course': 123 } });
  const { runtime, advance } = await start(saves, { character: 'shade' });
  expect(runtime.character).toBe('shade');
  expect(playerOf(runtime.world).character).toBe('shade');
  advance(RACE.countdownTicks + FINISH_TICKS, forward);
  await runtime.settled();
  expect(await saves.load('main')).toEqual({
    kind: 'ok',
    data: { character: 'shade', bests: { 'other-course': 123, [course.id]: FINISH_TICKS } },
  });
});
