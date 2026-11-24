import { createRng } from '@arcade/core';
import { expect, it } from 'vitest';
import { CRATE, ITEMS, RACE, RUN } from '../tuning.ts';
import { ITEM_KINDS } from '../types.ts';
import { rollItem } from './index.ts';
import { start, startPair } from './item-test-kit.ts';

const crate = { kind: 'crate', s: 30, d: 0 } as const;

it('fills the first empty slot and shuts the crate for all racers for 90 ticks', () => {
  const { world, player, rival, events, advance } = startPair([crate]);
  const roll = rollItem(createRng(world.rngState), 1);
  const heldKind = roll === 'boots' ? 'pie' : 'boots';
  player.slots = [null, { kind: heldKind, charges: 1 }, null];
  player.selected = 1;
  player.s = crate.s - CRATE.touchRadius - 0.01;
  player.vs = RUN.runSpeed;
  player.d = crate.d;
  player.y = CRATE.height - RUN.radius;
  player.grounded = false;
  player.vy = RUN.gravity / 60;
  rival.state = 'fallen';
  rival.outTicks = 2;
  advance(1, { forward: true, jumpHeld: true });
  const opened = events.all().find((event) => event.type === 'crate.opened');
  expect(opened).toMatchObject({ id: 'player', crate: 0, tick: RACE.countdownTicks });
  if (!opened) throw new Error('expected a crate to open');
  expect(player.slots).toEqual([
    { kind: opened.kind, charges: ITEMS.charges[opened.kind] },
    { kind: heldKind, charges: 1 },
    null,
  ]);
  expect(player.selected).toBe(1);
  expect(world.crates).toEqual([{ shutTicks: ITEMS.crateShutTicks, touching: ['player'] }]);

  player.d = 4;
  rival.state = 'racing';
  rival.outTicks = 0;
  rival.s = crate.s;
  rival.d = crate.d;
  rival.stunTicks = ITEMS.crateShutTicks;
  advance(ITEMS.crateShutTicks - 1);
  expect(rival.slots).toEqual([null, null, null]);
  expect(world.crates).toEqual([{ shutTicks: 1, touching: [] }]);
  advance();
  expect(rival.slots[0]).not.toBeNull();
  expect(events.all().filter((event) => event.type === 'crate.opened')).toMatchObject([
    { id: 'player', tick: RACE.countdownTicks },
    { id: 'r1', crate: 0, tick: RACE.countdownTicks + ITEMS.crateShutTicks },
  ]);
});

it('leaves a crate open on a full inventory or a duplicate and spends just one roll on the duplicate', () => {
  const { world, player, events, advance } = start([crate]);
  const rng = createRng(world.rngState);
  const kind = rollItem(rng, 1);
  player.s = crate.s;
  player.slots = ITEM_KINDS.filter((item) => item !== kind).map((item) => ({ kind: item, charges: 1 }));
  advance();
  expect(world.rngState).toBe(world.seed);
  expect(world.crates).toEqual([{ shutTicks: 0, touching: [] }]);
  player.slots = [{ kind, charges: 1 }, null, null];
  player.d = 2;
  advance();
  player.d = 0;
  advance();
  advance(3);
  expect(world.rngState).toBe(rng.state());
  expect(world.crates).toEqual([{ shutTicks: 0, touching: ['player'] }]);
  expect(player.slots).toEqual([{ kind, charges: 1 }, null, null]);
  expect(events.all().filter((event) => event.type === 'crate.opened')).toEqual([]);
  player.d = 2;
  advance();
  expect(world.crates).toEqual([{ shutTicks: 0, touching: [] }]);
  player.d = 0;
  advance();
  expect(player.slots[1]).toEqual({ kind: 'shield', charges: 1 });
});

it.each([
  [1, 1, 'pie', 3],
  [1, 4, 'burr', 2],
  [7, 1, 'boots', 3],
  [9, 1, 'shield', 1],
] as const)(
  'awards the seeded crate roll with its full charges (seed %i, place %i, %s × %i)',
  (seed, place, kind, charges) => {
    const { world, player, events, advance } = start([crate], place === 4, seed);
    for (const racer of world.racers.slice(1)) {
      racer.state = 'finished';
      racer.finishTicks = 1;
    }
    world.rngState = seed;
    player.s = crate.s;
    player.d = crate.d;
    advance();
    expect(player.slots).toEqual([{ kind, charges }, null, null]);
    expect(events.all().filter((event) => event.type === 'crate.opened')).toMatchObject([
      { id: 'player', kind, crate: 0, tick: RACE.countdownTicks },
    ]);
  },
);

it.each([
  [0.965, true],
  [0.98, false],
] as const)('opens a crate only when a dash passes within reach between ticks (d = %s, opens %s)', (d, opens) => {
  const { player, events, advance } = start([crate]);
  player.s = 29.8;
  player.d = d;
  advance(1, { dashPressed: true });
  expect(player.s).toBeCloseTo(30.2);
  expect(events.all().some((event) => event.type === 'crate.opened')).toBe(opens);
});

it('ignores crates outside the contact radius and any crate reached by a fallen or finished racer', () => {
  const { world, player, events, advance } = start([crate, { ...crate, s: 50 }], false, 4, 50);
  player.s = crate.s;
  player.y = CRATE.height + CRATE.touchRadius + RUN.radius;
  player.grounded = false;
  advance();
  expect(player.slots).toEqual([null, null, null]);
  player.y = 0;
  player.state = 'fallen';
  player.outTicks = 2;
  advance();
  expect(player.slots).toEqual([null, null, null]);
  player.state = 'racing';
  player.s = 49.99;
  player.vs = RUN.runSpeed;
  player.grounded = true;
  advance(1, { forward: true });
  expect(player.state).toBe('finished');
  expect(world.crates).toEqual([
    { shutTicks: 0, touching: [] },
    { shutTicks: 0, touching: [] },
  ]);
  expect(events.all().filter((event) => event.type === 'crate.opened')).toEqual([]);
});

it('rolls all four kinds at every place with repeatable odds favoring defence up front and speed at the back', () => {
  function rolls(place: number) {
    const rng = createRng(42);
    return Array.from({ length: 1000 }, () => rollItem(rng, place));
  }
  const speedShares = [1, 2, 3, 4].map((place) => {
    const items = rolls(place);
    expect(items).toEqual(rolls(place));
    expect(new Set(items)).toEqual(new Set(ITEM_KINDS));
    return items.filter((kind) => kind === 'boots' || kind === 'burr').length;
  });
  expect(speedShares[0]).toBeLessThan(500);
  expect(speedShares[3]).toBeGreaterThan(500);
  expect(speedShares).toEqual([...speedShares].sort((a, b) => a - b));
});

it('cycles only held slots both ways and keeps the selection on empty or single-item inventories', () => {
  const { player, events, advance } = start();
  player.selected = 2;
  advance(1, { nextPressed: true });
  expect(player.selected).toBe(2);
  player.slots = [{ kind: 'boots', charges: 1 }, null, { kind: 'pie', charges: 2 }];
  advance(1, { nextPressed: true });
  expect(player.selected).toBe(0);
  advance(1, { nextPressed: true });
  expect(player.selected).toBe(2);
  advance(1, { prevPressed: true });
  expect(player.selected).toBe(0);
  advance(1, { prevPressed: true });
  expect(player.selected).toBe(2);
  player.slots[0] = null;
  advance(1, { nextPressed: true });
  expect(player.selected).toBe(2);
  expect(events.all().filter((event) => event.type === 'item.selected')).toMatchObject(
    [0, 2, 0, 2].map((slot, i) => ({ id: 'player', slot, tick: RACE.countdownTicks + i + 1 })),
  );
});

it('fires only the selected slot and wraps right after the last charge, with 20 ticks between fires', () => {
  const { player, events, advance } = start();
  player.slots = [{ kind: 'pie', charges: 3 }, null, { kind: 'boots', charges: 1 }];
  player.selected = 2;
  advance(1, { firePressed: true });
  expect(player.slots).toEqual([{ kind: 'pie', charges: 3 }, null, null]);
  expect(player.selected).toBe(0);
  expect(player.itemCooldown).toBe(ITEMS.cooldownTicks);
  advance(ITEMS.cooldownTicks - 1, { firePressed: true });
  expect(player.slots[0]).toEqual({ kind: 'pie', charges: 3 });
  advance(1, { firePressed: true });
  expect(player.slots[0]).toEqual({ kind: 'pie', charges: 2 });
  expect(events.all().filter((event) => event.type === 'item.fired')).toMatchObject([
    { id: 'player', kind: 'boots', tick: RACE.countdownTicks },
    { id: 'player', kind: 'pie', tick: RACE.countdownTicks + ITEMS.cooldownTicks },
  ]);
});

it.each([
  [{ nextPressed: true }, 2],
  [{ prevPressed: true }, 0],
  [{ firePressed: true }, 2],
] as const)('takes the correct direction with three filled slots (%j → %i)', (input, slot) => {
  const { player, events, advance } = start();
  player.slots = [
    { kind: 'burr', charges: 2 },
    { kind: 'boots', charges: 1 },
    { kind: 'pie', charges: 3 },
  ];
  player.selected = 1;
  advance(1, input);
  expect(player.selected).toBe(slot);
  expect(events.all().filter((event) => event.type === 'item.selected')).toMatchObject([
    { id: 'player', slot, tick: RACE.countdownTicks },
  ]);
});

it('respawns at rest and needs a fresh fire press to use Rocket Boots', () => {
  const { player, events, advance, world } = start([crate]);
  player.state = 'fallen';
  player.outTicks = 1;
  player.s = 32;
  player.safeS = 28;
  player.slots[0] = { kind: 'boots', charges: 3 };
  advance(1, { firePressed: true, nextPressed: true });
  expect(player).toMatchObject({ state: 'racing', vs: 0, slots: [{ kind: 'boots', charges: 3 }, null, null] });
  expect(world.crates).toEqual([{ shutTicks: 0, touching: [] }]);
  advance(1, { firePressed: true });
  expect(events.all().filter((event) => 'id' in event)).toMatchObject([
    { type: 'racer.respawned', id: 'player', tick: RACE.countdownTicks },
    { type: 'item.fired', id: 'player', kind: 'boots', tick: RACE.countdownTicks + 1 },
  ]);
});

it.each(['stunTicks', 'trappedTicks'] as const)(
  'blocks movement, dash and fire for %s while allowing selection',
  (timer) => {
    const { player, events, advance } = start([{ kind: 'gust', s0: 0, s1: 30, d0: -6, d1: 6, push: 4 }]);
    player[timer] = 2;
    player.slots = [{ kind: 'pie', charges: 2 }, null, { kind: 'boots', charges: 2 }];
    const eager = { firePressed: true, dashPressed: true, jumpPressed: true, forward: true, steer: 1 };
    advance(1, { ...eager, nextPressed: true });
    expect(player).toMatchObject({ s: 0, d: 0, y: 0, selected: 2, [timer]: 1 });
    advance(1, eager);
    expect(player).toMatchObject({ s: 0, d: 0, y: 0, [timer]: 0 });
    expect(player.slots[2]).toEqual({ kind: 'boots', charges: 2 });
    advance(1, eager);
    expect(events.all().filter((event) => 'id' in event)).toMatchObject([
      { type: 'item.selected', slot: 2, tick: RACE.countdownTicks },
      { type: 'racer.jumped', tick: RACE.countdownTicks + 2 },
      { type: 'racer.dashed', tick: RACE.countdownTicks + 2 },
      { type: 'item.fired', kind: 'boots', tick: RACE.countdownTicks + 2 },
    ]);
  },
);
