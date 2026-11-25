import { EventLog } from '@arcade/core';
import { expect, it } from 'vitest';
import type { GameEvent } from './events.ts';
import { bootsSpeedFloor, canBeHit, isImmobilized, isPuffed, onSplatMud } from './status.ts';
import { ITEMS } from './tuning.ts';
import type { Course, Splat } from './types.ts';
import { createWorld, playerOf } from './world.ts';

const course: Course = {
  id: 'straight',
  name: 'Straight',
  path: [{ kind: 'straight', length: 200 }],
  halfWidth: 5,
  hills: [],
  startS: 0,
  finishS: 200,
  parTicks: 900,
  features: [],
};

function racerOnGrid() {
  return playerOf(createWorld(new EventLog<GameEvent>(), { course, seed: 4, character: 'grit', rivals: false }));
}

it.each(['stunTicks', 'trappedTicks'] as const)('immobilizes a racer with one tick of %s left', (timer) => {
  const racer = racerOnGrid();
  expect(isImmobilized(racer)).toBe(false);
  racer.items[timer] = 1;
  expect(isImmobilized(racer)).toBe(true);
});

it('accepts a hit only while racing with no invulnerability', () => {
  const racer = racerOnGrid();
  expect(canBeHit(racer)).toBe(true);
  racer.invulnTicks = 1;
  expect(canBeHit(racer)).toBe(false);
  racer.invulnTicks = 0;
  racer.state = 'fallen';
  expect(canBeHit(racer)).toBe(false);
});

it('holds the boots speed floor through the last boost tick', () => {
  const racer = racerOnGrid();
  expect(bootsSpeedFloor(racer)).toBe(0);
  racer.items.bootsTicks = 1;
  expect(bootsSpeedFloor(racer)).toBe(ITEMS.bootsSpeed);
});

it('counts a racer as puffed through the last burr tick', () => {
  const racer = racerOnGrid();
  expect(isPuffed(racer)).toBe(false);
  racer.items.burrTicks = 1;
  expect(isPuffed(racer)).toBe(true);
});

it('counts a rival splat from its near edge and ignores the racer’s own splat', () => {
  const racer = racerOnGrid();
  const splat: Splat = { owner: 'r1', s0: 0, s1: 6, d0: 0, d1: 4, ticksLeft: 1 };
  expect(onSplatMud([splat], racer)).toBe(true);
  expect(onSplatMud([{ ...splat, owner: racer.id }], racer)).toBe(false);
  racer.s = splat.s1;
  expect(onSplatMud([splat], racer)).toBe(false);
});
