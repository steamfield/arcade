import { describe, expect, it } from 'vitest';
import { ABILITY } from '../abilities.ts';
import { centreOf } from '../racers.ts';
import { eventsIn, placeOnTile, raceOn, racerOf, step } from '../test-world.ts';
import type { Vec } from '../types.ts';
import { applyHit } from './hits.ts';
import { HIT } from './tuning.ts';

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
  it('stuns the racer for 50 ticks, shortened by its ability (the default Rudy shakes it off)', () => {
    const { log, player, hit } = setup();

    expect(hit()).toBe(true);

    expect(player.status.stunned).toBe(Math.round(HIT.stunTicks * ABILITY.shakeItOff.statusMul));
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

describe('a bubble hit', () => {
  it('needs the racer that fired the bubble', () => {
    const { world, player, offset } = setup();

    expect(() => applyHit(world, player, 'bubble', null, offset(-8, 0))).toThrow(/has no owner/);
  });

  it('needs the owner even when the racer would ignore the hit', () => {
    const { world, player, offset } = setup();
    player.status.invulnerable = 20;

    expect(() => applyHit(world, player, 'bubble', null, offset(-8, 0))).toThrow(/has no owner/);
  });
});

describe('a hit during a dash', () => {
  it('ends the dash, so the racer moves away from the source on the next tick', () => {
    const { world, log, player, offset, hit } = setup();
    placeOnTile(player, 9, 1);
    player.status.dashing = 12;
    player.dashDir = { x: 1, y: 0 };
    player.body.vx = 200;

    hit(offset(8, 0));
    step(world, log, 1);

    expect(player.status.dashing).toBe(0);
    expect(player.body.vx).toBeLessThan(0);
  });
});
