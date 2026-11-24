/** Item effects, projectiles, and hit timing in live race ticks. */
import { expect, it } from 'vitest';
import { DASH, ITEMS, RACE, RUN } from '../tuning.ts';
import type { Feature } from '../types.ts';
import { start, startPair } from './item-test-kit.ts';

it('holds Rocket Boots speed for 40 movement ticks, then glides without spending dash charges', () => {
  const { player, advance } = start();
  player.slots[0] = { kind: 'boots', charges: ITEMS.charges.boots };
  advance(1, { firePressed: true });
  expect(player).toMatchObject({ s: 0, vs: ITEMS.bootsSpeed, bootsTicks: ITEMS.bootsTicks, dashCharges: DASH.charges });
  advance(ITEMS.bootsTicks - 1, { forward: true });
  expect(player.vs).toBe(ITEMS.bootsSpeed);
  expect(player.bootsTicks).toBe(1);
  advance(1, { forward: true });
  expect(player.s).toBeCloseTo((ITEMS.bootsTicks * ITEMS.bootsSpeed) / 60);
  expect(player.vs).toBe(ITEMS.bootsSpeed);
  expect(player.bootsTicks).toBe(0);
  advance(1, { forward: true });
  expect(player.vs).toBeCloseTo(ITEMS.bootsSpeed - DASH.drag / 60);
  expect(player.dashCharges).toBe(DASH.charges);
});

it('hits on the firing tick and the last puffed tick, and stops hitting when the Burr Ball wears off', () => {
  const { player, rival, events, advance } = startPair();
  player.slots[0] = { kind: 'burr', charges: ITEMS.charges.burr };
  player.s = rival.s = 30;
  player.d = rival.d = 0;
  rival.slots[0] = { kind: 'pie', charges: 2 };
  advance(1, { firePressed: true });
  expect(player.burrTicks).toBe(ITEMS.burrTicks);
  expect(player.slots[0]).toEqual({ kind: 'burr', charges: 1 });
  rival.d = 4;
  rival.stunTicks = ITEMS.burrTicks;
  advance(ITEMS.burrTicks - 2);
  rival.invulnTicks = 0;
  player.s = rival.s;
  player.d = rival.d;
  advance();
  expect(player.burrTicks).toBe(1);
  racerContact();
  expect(player.burrTicks).toBe(0);
  expect(events.all().filter((event) => event.type === 'racer.hit')).toMatchObject([
    { id: 'r1', by: 'player', kind: 'burr', outcome: 'dropped', tick: RACE.countdownTicks },
    { id: 'r1', by: 'player', kind: 'burr', outcome: 'stunned', tick: RACE.countdownTicks + ITEMS.burrTicks - 1 },
  ]);
  expect(events.all().filter((event) => event.type === 'racer.bumped' && event.id === 'r1')).toHaveLength(3);

  function racerContact() {
    rival.invulnTicks = 0;
    player.s = rival.s;
    player.d = rival.d;
    advance();
  }
});

it('clears active item effects and cooldown on the finish tick', () => {
  const { world, player, advance } = start([], false, 4, 40);
  player.s = 39.5;
  player.vs = ITEMS.bootsSpeed;
  player.bootsTicks = 5;
  player.slots[0] = { kind: 'burr', charges: 2 };
  advance(1, { forward: true, firePressed: true });
  expect(player).toMatchObject({
    state: 'racing',
    bootsTicks: 4,
    burrTicks: ITEMS.burrTicks,
    itemCooldown: ITEMS.cooldownTicks,
  });
  advance(1, { forward: true });
  expect(world.phase).toBe('finished');
  expect(player).toMatchObject({
    state: 'finished',
    bootsTicks: 0,
    burrTicks: 0,
    stunTicks: 0,
    trappedTicks: 0,
    itemCooldown: 0,
  });
});

it('absorbs a hit with a Sap Shield in another slot, then drops all charges of the selected item', () => {
  const { player, rival, events, advance } = startPair();
  player.slots = [
    { kind: 'boots', charges: 3 },
    { kind: 'pie', charges: 3 },
    { kind: 'shield', charges: 1 },
  ];
  player.selected = 1;
  rival.d = 3;
  function getBumped() {
    rival.s = player.s;
    rival.d = player.d;
    rival.burrTicks = 3;
    advance();
    rival.d = 3;
  }
  getBumped();
  expect(player.slots).toEqual([{ kind: 'boots', charges: 3 }, { kind: 'pie', charges: 3 }, null]);
  expect(player.selected).toBe(1);
  expect(player.invulnTicks).toBe(RUN.invulnTicks);
  advance(RUN.invulnTicks - 2);
  getBumped();
  expect(player.slots[1]).toEqual({ kind: 'pie', charges: 3 });
  getBumped();
  expect(player.slots).toEqual([{ kind: 'boots', charges: 3 }, null, null]);
  expect(player.selected).toBe(0);
  expect(player.invulnTicks).toBe(RUN.invulnTicks);
  expect(events.all().filter((event) => event.type === 'racer.hit')).toMatchObject([
    { id: 'player', by: 'r1', kind: 'burr', outcome: 'shielded', tick: RACE.countdownTicks },
    { id: 'player', by: 'r1', kind: 'burr', outcome: 'dropped', tick: RACE.countdownTicks + RUN.invulnTicks },
  ]);
});

it('stuns an empty-handed racer and grants invulnerability on the hit tick', () => {
  const { player, rival, events, advance } = startPair();
  player.s = rival.s = 32;
  player.d = rival.d = 0;
  rival.burrTicks = 2;
  advance();
  expect(player).toMatchObject({ stunTicks: ITEMS.stunTicks, invulnTicks: RUN.invulnTicks, vs: 0 });
  expect(events.all().filter((event) => event.type === 'racer.hit')).toMatchObject([
    { id: 'player', by: 'r1', kind: 'burr', outcome: 'stunned', tick: RACE.countdownTicks },
  ]);
});

it.each(['stunTicks', 'trappedTicks'] as const)(
  'keeps the racer fixed during a bump on the last tick of %s',
  (timer) => {
    const { player, rival, advance, events } = startPair();
    player.s = rival.s = 35;
    player.d = 0;
    rival.d = 0.2;
    rival.vd = -2;
    player[timer] = 1;
    advance();
    expect(player).toMatchObject({ s: 35, d: 0, y: 0, vd: 0, [timer]: 0 });
    expect(rival.d).toBeGreaterThanOrEqual(2 * RUN.radius);
    expect(events.all()).toContainEqual(expect.objectContaining({ type: 'racer.bumped', by: 'r1', id: 'player' }));
  },
);

it('throws straight sap at the first eligible racer and traps them for 60 ticks', () => {
  const { world, player, rival, events, advance } = startPair();
  player.slots[0] = { kind: 'shield', charges: 1 };
  player.s = 25;
  player.d = 0;
  rival.s = 26.2;
  rival.d = 0;
  const farther = { ...rival, id: 'r2' as const, s: 28, slots: [null, null, null] };
  world.racers.splice(1, 0, farther);

  advance(1, { firePressed: true });
  expect(world.shots).toMatchObject([{ kind: 'sap', owner: 'player', d: 0, vs: ITEMS.sapSpeed }]);
  expect(world.shots[0]?.s).toBeCloseTo(25 + ITEMS.sapSpeed / 60);
  expect(player.slots[0]).toBeNull();
  expect(rival.trappedTicks).toBe(0);
  // Both racers are in reach this tick, with the farther racer first in step order.
  farther.s = 26.45;
  farther.d = 0;
  advance();
  expect(world.shots).toEqual([]);
  expect(rival.trappedTicks).toBe(ITEMS.sapTrapTicks);
  farther.d = 4;
  const y = rival.y;
  const s = rival.s;
  const d = rival.d;
  advance(ITEMS.sapTrapTicks);
  expect(rival).toMatchObject({ s, d, y, trappedTicks: 0 });
  advance();
  expect(rival.s).toBeGreaterThan(s);
  expect(events.all().filter((event) => event.type === 'racer.trapped')).toMatchObject([
    { id: 'r1', by: 'player', tick: RACE.countdownTicks + 1 },
  ]);
});

it.each([
  { surface: 'ground', afterFire: 7, outcome: 'racer.landed' },
  { surface: 'pit', afterFire: 24, outcome: 'racer.fell' },
] as const)('keeps falling after an airborne sap hit over $surface', ({ surface, afterFire, outcome }) => {
  const features: Feature[] = surface === 'pit' ? [{ kind: 'pit', s0: 30, s1: 40, d0: -6, d1: 6 }] : [];
  const { player, rival, events, advance } = startPair(features);
  Object.assign(player, { s: 29.1, d: 0, y: 1, vy: -6, grounded: false });
  Object.assign(rival, { s: 30, d: 0, y: 1, vy: -6, grounded: false });
  player.slots[0] = { kind: 'shield', charges: 1 };

  advance(1, { firePressed: true });
  expect(rival.trappedTicks).toBe(ITEMS.sapTrapTicks);
  expect(events.all()).toContainEqual(
    expect.objectContaining({ type: 'racer.trapped', id: 'r1', by: 'player', tick: RACE.countdownTicks }),
  );
  const { s, d } = rival;
  advance(afterFire - 1);
  expect(rival).toMatchObject({ s, d, state: 'racing', grounded: false });
  advance();
  expect(events.all()).toContainEqual(
    expect.objectContaining({ type: outcome, id: 'r1', tick: RACE.countdownTicks + afterFire }),
  );
  expect(rival).toMatchObject({
    s,
    d,
    state: surface === 'ground' ? 'racing' : 'fallen',
    grounded: surface === 'ground',
    trappedTicks: ITEMS.sapTrapTicks - afterFire,
  });
});

it('lets sap pass through an invulnerable racer and expires it after its full range', () => {
  const { world, player, rival, events, advance } = startPair();
  player.slots[0] = { kind: 'shield', charges: 1 };
  player.s = 25;
  player.d = 0;
  rival.s = 25.9;
  rival.d = 0;
  rival.invulnTicks = RUN.invulnTicks;
  advance(1, { firePressed: true });
  expect(rival.trappedTicks).toBe(0);
  rival.d = 4;
  const rangeTicks = (ITEMS.sapRange * 60) / ITEMS.sapSpeed;
  advance(rangeTicks - 2);
  expect(world.shots).toMatchObject([{ kind: 'sap', travelled: ITEMS.sapRange - ITEMS.sapSpeed / 60 }]);
  advance();
  expect(world.shots).toEqual([]);
  expect(events.all().filter((event) => event.type === 'racer.trapped')).toEqual([]);
});

it('lobs a Mud Pie with the thrower’s velocity and leaves mud for everyone but its owner for 300 ticks', () => {
  const { world, player, rival, events, advance } = startPair();
  player.slots[0] = { kind: 'pie', charges: ITEMS.charges.pie };
  player.s = 25;
  player.d = 0;
  player.vs = 10;
  player.vd = 2;
  const drive = { forward: true, steer: 2 / RUN.steerSpeed };
  advance(1, { ...drive, firePressed: true });
  const shot = world.shots[0];
  expect(shot).toMatchObject({
    kind: 'pie',
    owner: 'player',
    vs: player.vs + ITEMS.pieThrowSpeed,
    vd: player.vd,
    vy: ITEMS.pieThrowUp - RUN.gravity / 60,
  });
  expect(shot?.y).toBeGreaterThan(player.y + RUN.radius);
  const firstY = shot?.y ?? Infinity;
  advance(12);
  expect(world.shots[0]?.y).toBeGreaterThan(firstY);
  advance(21);
  expect(world.splats).toEqual([]);
  advance();
  expect(world.shots).toEqual([]);
  const splat = world.splats[0];
  expect(splat).toMatchObject({ owner: 'player', ticksLeft: ITEMS.splatTicks });
  if (!splat) throw new Error('expected the pie to splat');
  expect(splat.s1 - splat.s0).toBeCloseTo(ITEMS.splatLength);
  expect(splat.d1 - splat.d0).toBeCloseTo(ITEMS.splatWidth);
  const s = 36.855;
  const d = 1.182;
  expect((splat.s0 + splat.s1) / 2).toBeCloseTo(s);
  expect((splat.d0 + splat.d1) / 2).toBeCloseTo(d);
  expect(events.all().filter((event) => event.type === 'pie.splatted')).toMatchObject([
    { owner: 'player', s: expect.closeTo(s), d: expect.closeTo(d), tick: RACE.countdownTicks + 34 },
  ]);

  player.s = rival.s = s;
  player.d = d - 0.7;
  rival.d = d + 0.7;
  player.vs = rival.vs = RUN.runSpeed;
  rival.dashCharges = 0;
  advance(1, drive);
  expect(player.vs).toBe(RUN.runSpeed);
  expect(rival.vs).toBeCloseTo(RUN.runSpeed * RUN.mudSpeedMul);
  advance(ITEMS.splatTicks - 2);
  expect(world.splats).toMatchObject([{ ticksLeft: 1 }]);
  advance();
  expect(world.splats).toEqual([]);
});

it('drops a Mud Pie into a pit without leaving a splat', () => {
  const { world, player, events, advance } = start([{ kind: 'pit', s0: 30, s1: 65, d0: -6, d1: 6 }]);
  player.s = 28;
  player.slots[0] = { kind: 'pie', charges: 1 };
  advance(1, { firePressed: true });
  expect(world.shots).toHaveLength(1);
  advance(34);
  expect(world.shots).toEqual([]);
  expect(world.splats).toEqual([]);
  expect(events.all().filter((event) => event.type === 'pie.splatted')).toEqual([]);
});

it('adds the thrower’s lift to a Mud Pie when fired during a jump', () => {
  const { world, player, advance } = start();
  player.slots[0] = { kind: 'pie', charges: 1 };
  advance(1, { jumpPressed: true, jumpHeld: true, firePressed: true });
  expect(player.vy).toBeGreaterThan(0);
  expect(world.shots).toMatchObject([{ kind: 'pie', vy: player.vy + ITEMS.pieThrowUp - RUN.gravity / 60 }]);
});
