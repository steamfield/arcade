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
const idle: FrameInput = {
  race: NO_INPUT,
  confirmPressed: false,
  menu: { left: false, right: false, up: false, down: false, back: false },
};
const forward: FrameInput = { ...idle, race: { ...NO_INPUT, forward: true } };
const fire: FrameInput = { ...idle, confirmPressed: true, race: { ...NO_INPUT, firePressed: true } };
const jump: FrameInput = { ...idle, race: { ...NO_INPUT, jumpPressed: true, jumpHeld: true } };
const FINISH_TICKS = 192;
const STAGED_FINISH_TICKS = 150;
let storeCount = 0;
const openStore = (gameId = `racer-runtime-${storeCount++}`) =>
  createSaveStore({ gameId, version: SAVE_VERSION, schema: SaveSchema, migrate: migrations });

async function start(
  saves: SaveStore<SaveData>,
  options: Partial<Pick<RuntimeOptions, 'stage' | 'character' | 'startScene' | 'course'>> = {},
) {
  const notices: string[] = [];
  const held = { frame: idle, reads: 0, afterTicks: 0, notices };
  const runtime = await Runtime.start({
    gameId: 'race-test',
    saves,
    course,
    seed: 1,
    character: null,
    stage: null,
    startScene: 'race',
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
    return runtime.advance(ticks);
  }
  return { runtime, held, advance };
}

afterEach(() => configureLogging(() => {}));

it('uses consecutive step numbers and starts the next countdown on the step after restart', async () => {
  const { runtime, advance } = await start(await openStore());
  const firstSteps: number[] = [];
  for (let i = 0; i < 3; i++) {
    advance(1, forward);
    firstSteps.push(runtime.events.tick);
  }
  const endTick = RACE.countdownTicks + FINISH_TICKS - 1;
  const restartTick = endTick + RESULTS_CONFIRM_DELAY_TICKS;
  advance(endTick + 1 - firstSteps.length, forward);
  await runtime.settled();
  advance(RESULTS_CONFIRM_DELAY_TICKS - 1);
  advance(1, fire);
  advance(1);
  const playerAndRaceEvents = runtime.events.all().filter((event) => !('id' in event) || event.id === 'player');
  expect({ firstSteps, events: playerAndRaceEvents }).toMatchObject({
    firstSteps: [0, 1, 2],
    events: [
      { type: 'race.countdown', tick: 0, n: 3 },
      { type: 'race.countdown', tick: 60, n: 2 },
      { type: 'race.countdown', tick: 120, n: 1 },
      { type: 'race.started', tick: 180 },
      { type: 'racer.finished', id: 'player', tick: endTick },
      { type: 'race.ended', tick: endTick },
      { type: 'best.new', tick: endTick },
      { type: 'save.written', tick: endTick },
      { type: 'race.restarted', tick: restartTick },
      { type: 'race.countdown', tick: restartTick + 1, n: 3 },
    ],
  });
  await runtime.settled();
});

it('shows results on the finish tick, records a best, and restores it from IndexedDB', async () => {
  const saves = await openStore();
  const { runtime, advance } = await start(saves);
  advance(RACE.countdownTicks + FINISH_TICKS - 1, forward);
  expect(runtime.scene).toBe('race');
  advance(1, forward);
  expect(runtime.summary()).toMatchObject({ scene: 'results', finishTicks: FINISH_TICKS });
  expect(runtime.bests).toEqual({ [course.id]: FINISH_TICKS });
  expect(runtime.events.all().slice(-2)).toMatchObject([
    { type: 'race.ended', ticks: FINISH_TICKS, tick: RACE.countdownTicks + FINISH_TICKS - 1 },
    { type: 'best.new', course: course.id, ticks: FINISH_TICKS, tick: RACE.countdownTicks + FINISH_TICKS - 1 },
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
    { course: course.id, ticks: FINISH_TICKS, tick: RACE.countdownTicks + FINISH_TICKS - 1 },
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
  await runtime.settled();
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
  const endTick = RACE.countdownTicks + FINISH_TICKS;
  expect(runtime.events.all().at(-1)).toMatchObject({
    type: 'race.restarted',
    tick: endTick + RESULTS_CONFIRM_DELAY_TICKS,
  });
  expect(held.reads).toBe(endTick + RESULTS_CONFIRM_DELAY_TICKS + 1);
  expect(held.afterTicks).toBe(held.reads);
  await runtime.settled();
});

it('requires a fresh screen confirm after the delay and ignores race fire', async () => {
  const { runtime, advance } = await start(await openStore());
  advance(RACE.countdownTicks + FINISH_TICKS, forward);
  await runtime.settled();
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

function menu(direction: keyof FrameInput['menu']): FrameInput {
  return { ...idle, menu: { ...idle.menu, [direction]: true } };
}

it('opens on title, highlights the saved character and clamps navigation to the 4x2 grid', async () => {
  const saves = await openStore();
  await saves.save('main', { character: 'duke', bests: {} });
  const { runtime, advance } = await start(saves, { startScene: 'title' });
  expect(runtime.summary()).toMatchObject({ scene: 'title', place: 1, tick: 0 });
  expect(runtime.summary()).not.toHaveProperty('cursor');
  advance(4, jump);
  expect(runtime.scene).toBe('title');
  advance(1, fire);
  expect(runtime.summary()).toMatchObject({ scene: 'select', cursor: 5, tick: 0 });
  advance(1, jump);
  expect(runtime.summary()).toMatchObject({ scene: 'select', cursor: 5, tick: 0 });
  const moves: [keyof FrameInput['menu'], number][] = [
    ['down', 5],
    ['right', 6],
    ['right', 7],
    ['right', 7],
    ['up', 3],
    ['up', 3],
    ['left', 2],
    ['left', 1],
    ['left', 0],
    ['left', 0],
    ['down', 4],
  ];
  for (const [direction, cursor] of moves) {
    advance(1, menu(direction));
    expect(runtime.summary()).toMatchObject({ scene: 'select', cursor, tick: 0 });
  }
  advance(1, menu('back'));
  expect(runtime.scene).toBe('title');
  advance(1, fire);
  expect(runtime.cursor).toBe(5);
  expect(runtime.saving).toBe(false);
  expect((await start(saves)).runtime.summary()).toMatchObject({ scene: 'race', place: 1 });
});

it('highlights the saved pick from title even when direct races use a launch override', async () => {
  const saves = await openStore();
  await saves.save('main', { character: 'duke', bests: {} });
  const title = await start(saves, { character: 'shade', startScene: 'title' });
  title.advance(1, fire);
  expect(title.runtime.summary()).toMatchObject({ scene: 'select', cursor: 5 });
  const direct = await start(saves, { character: 'shade', startScene: 'race' });
  expect(playerOf(direct.runtime.world).character).toBe('shade');
});

it('stops a test-mode batch at a selection write and keeps save and countdown events in order', async () => {
  async function confirm(batch: number) {
    const { runtime, advance } = await start(await openStore(), { startScene: 'title' });
    advance(1, fire);
    advance(1, menu('right'));
    expect(advance(batch, fire)).toBe(1);
    expect(runtime.saving).toBe(true);
    expect(runtime.world.tick).toBe(0);
    expect(advance(1)).toBe(0);
    await runtime.settled();
    expect(advance(1)).toBe(1);
    return runtime.events.all();
  }
  const batched = await confirm(2);
  expect(batched).toEqual(await confirm(1));
  expect(batched).toMatchObject([
    { type: 'save.written', tick: 2 },
    { type: 'race.countdown', tick: 3, n: 3 },
  ]);
});

it('starts a four-racer countdown and persists the picked character with the stored bests', async () => {
  const saves = await openStore();
  const bests = { [course.id]: 169 };
  await saves.save('main', { character: 'duke', bests });
  const { runtime, advance } = await start(saves, { startScene: 'title' });
  advance(1, fire);
  advance(1, menu('right'));
  advance(1, fire);
  expect(runtime.summary()).toMatchObject({ scene: 'race', phase: 'countdown', place: 1, tick: 0 });
  expect(runtime.summary()).not.toHaveProperty('cursor');
  expect(runtime.world.racers).toHaveLength(4);
  expect(playerOf(runtime.world).character).toBe('dusk');
  expect(runtime.saving).toBe(true);
  await runtime.settled();
  expect(await saves.load('main')).toEqual({ kind: 'ok', data: { character: 'dusk', bests } });
});

it('shows fourth place as rivals pass an idle player and returns to the selected card after the results delay', async () => {
  const saves = await openStore();
  await saves.save('main', { character: 'shade', bests: {} });
  const { runtime, advance } = await start(saves);
  advance(RACE.countdownTicks + 1);
  expect(runtime.summary()).toMatchObject({ scene: 'race', place: 4, finishTicks: null });
  while (runtime.scene === 'race' && runtime.world.raceTicks <= FINISH_TICKS + RACE.rivalsDoneGraceTicks) advance(1);
  expect(runtime.summary()).toMatchObject({ scene: 'results', place: 4, finishTicks: null });
  expect(runtime.events.all().find((event) => event.type === 'race.ended')).toMatchObject({
    reason: 'rivals-finished',
  });
  await runtime.settled();
  advance(RESULTS_CONFIRM_DELAY_TICKS - 2);
  advance(1, menu('back'));
  expect(runtime.scene).toBe('results');
  advance(1, menu('back'));
  expect(runtime.summary()).toMatchObject({ scene: 'select', place: 4, cursor: 3 });
  expect(runtime.bests).toEqual({});
  expect(runtime.events.all().filter((event) => event.type === 'best.new')).toEqual([]);
  await runtime.settled();
  expect(await saves.load('main')).toEqual({ kind: 'ok', data: { character: 'shade', bests: {} } });
});

it('keeps stored bests at the race limit and ignores jump even after results unlock', async () => {
  const saves = await openStore();
  const save: SaveData = { character: 'grit', bests: { 'other-course': 200 } };
  await saves.save('main', save);
  const long: Course = { ...course, path: [{ kind: 'straight', length: 10000 }], finishS: 10000 };
  const { runtime, advance } = await start(saves, { course: long });
  advance(RACE.countdownTicks + RACE.limitTicks);
  expect(runtime.summary()).toMatchObject({ scene: 'results', finishTicks: null });
  expect(runtime.events.all().at(-1)).toMatchObject({ type: 'race.ended', reason: 'limit', ticks: RACE.limitTicks });
  await runtime.settled();
  advance(RESULTS_CONFIRM_DELAY_TICKS - 1);
  advance(1, jump);
  expect(runtime.scene).toBe('results');
  expect(runtime.bests).toEqual(save.bests);
  expect(runtime.events.all().filter((event) => event.type === 'best.new')).toEqual([]);
  expect(await saves.load('main')).toEqual({ kind: 'ok', data: save });
});

it.each(['staged', 'blocked'] as const)('does not write the picked character in a %s session', async (session) => {
  const gameId = `racer-runtime-${storeCount++}`;
  if (session === 'blocked') {
    const old = await createSaveStore({ gameId, version: SAVE_VERSION, schema: z.object({ racer: z.string() }) });
    expect(await old.save('main', { racer: 'old format' })).toMatchObject({ ok: true });
  }
  const saves = await openStore(gameId);
  if (session === 'staged') await saves.save('main', { character: 'grit', bests: {} });
  const original = await saves.exportJson('main');
  expect(original).not.toBeNull();
  const { runtime, advance } = await start(saves, {
    startScene: session === 'staged' ? 'race' : 'title',
    stage: session === 'staged' ? 'near-finish' : null,
  });
  if (session === 'staged') {
    advance(STAGED_FINISH_TICKS, forward);
    advance(RESULTS_CONFIRM_DELAY_TICKS - 1);
    advance(1, menu('back'));
  } else {
    advance(1, fire);
  }
  expect(runtime.scene).toBe('select');
  advance(1, menu('right'));
  advance(1, fire);
  expect(runtime.scene).toBe('race');
  expect(playerOf(runtime.world).character).toBe('skip');
  expect(runtime.saving).toBe(false);
  await runtime.settled();
  expect(await saves.exportJson('main')).toBe(original);
});
