import { describe, expect, it } from 'vitest';
import { centreOf } from '../racers.ts';
import { eventsIn, raceOn, racerOf, step } from '../test-world.ts';
import type { Vec } from '../types.ts';
import { applyHit } from './hits.ts';

/** One walled lane per racer, so stepping never brings racers together. */
const LANES = `
  ####################
  #1................F#
  ####################
  #2................F#
  ####################
  #3................F#
  ####################
  #4................F#
  ####################
`;

function setup() {
  const { world, log } = raceOn(LANES);
  const player = racerOf(world, 'player');
  const offset = (dx: number, dy: number): Vec => ({ x: centreOf(player).x + dx, y: centreOf(player).y + dy });
  const hit = (from = offset(-8, 0)) => applyHit(world, player, 'jelly', null, from);
  return { world, log, player, offset, hit };
}

describe('a hit on an empty stack', () => {
  it('stuns the racer for 50 ticks', () => {
    const { log, player, hit } = setup();

    expect(hit()).toBe(true);

    expect(player.status.stunned).toBe(50);
    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'jelly', by: null },
      { type: 'racer.stunned', id: 'player' },
    ]);
  });
});

describe('invulnerability', () => {
  it('follows every landed hit for 60 ticks, and hits during it do nothing', () => {
    const { log, player, hit } = setup();
    player.stack = ['jetFin', 'puffer'];
    hit();
    const after = { stack: [...player.stack], events: eventsIn(log).length };

    expect(player.status.invulnerable).toBe(60);
    expect(hit()).toBe(false);

    expect(player.stack).toEqual(after.stack);
    expect(eventsIn(log)).toHaveLength(after.events);
  });

  it('follows a hit a Bubble Shield absorbed too', () => {
    const { player, hit } = setup();
    player.stack = ['bubbleShield'];

    hit();

    expect(player.status.invulnerable).toBe(60);
    expect(hit()).toBe(false);
  });

  it('runs out after 60 ticks, when hits land again', () => {
    const { world, log, hit } = setup();
    hit();

    step(world, log, 59);
    expect(hit()).toBe(false);
    step(world, log, 1);
    expect(hit()).toBe(true);
  });
});

describe('knockback', () => {
  it('sends the racer off at 80 px/s straight away from the source', () => {
    const { player, offset, hit } = setup();

    hit(offset(-8, 0));

    expect(player.body.vx).toBeCloseTo(80, 6);
    expect(player.body.vy).toBeCloseTo(0, 6);
  });

  it('follows the source direction on a diagonal', () => {
    const { player, offset, hit } = setup();

    hit(offset(-3, 4));

    expect(player.body.vx).toBeCloseTo(48, 6);
    expect(player.body.vy).toBeCloseTo(-64, 6);
  });
});
