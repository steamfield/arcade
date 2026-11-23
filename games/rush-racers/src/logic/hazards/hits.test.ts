import { describe, expect, it } from 'vitest';
import { ABILITY } from '../abilities.ts';
import { FLASH } from '../powerups/tuning.ts';
import { centreOf } from '../racers.ts';
import { eventsIn, giveItems, placeOnTile, raceOn, racerOf, step } from '../test-world.ts';
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

describe('a hit on a racer holding nothing', () => {
  it('stuns the racer for 50 ticks, shortened by its ability (the default Rudy shakes it off)', () => {
    const { log, player, hit } = setup();

    expect(hit()).toBe('stunned');

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
    giveItems(player, ['jetFin', 'puffer']);
    hit();
    const after = { items: structuredClone(player.items), events: eventsIn(log).length };

    expect(player.status.invulnerable).toBe(60);
    expect(hit()).toBeNull();

    expect(player.items).toEqual(after.items);
    expect(eventsIn(log)).toHaveLength(after.events);
  });

  it('follows a hit a Bubble Shield absorbed too', () => {
    const { player, hit } = setup();
    giveItems(player, ['bubbleShield']);

    hit();

    expect(player.status.invulnerable).toBe(60);
    expect(hit()).toBeNull();
  });

  it('runs out after 60 ticks, when hits land again', () => {
    const { world, log, hit } = setup();
    hit();

    step(world, log, 59);
    expect(hit()).toBeNull();
    step(world, log, 1);
    expect(hit()).toBe('stunned');
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

describe('a lightning hit', () => {
  it('stuns like a flash and keeps the items the racer holds', () => {
    const { world, log, player, offset } = setup();
    giveItems(player, ['jetFin']);

    expect(applyHit(world, player, 'lightning', null, offset(0, -8))).toBe('stunned');

    expect(player.status.stunned).toBe(Math.round(FLASH.stunTicks * ABILITY.shakeItOff.statusMul));
    expect(player.items[0]).toEqual({ kind: 'jetFin', charges: expect.any(Number) });
    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'lightning', by: null },
      { type: 'racer.stunned', id: 'player' },
    ]);
  });

  it('lands on Selene, who ignores only static wisps (jellies)', () => {
    const { world, log, player, offset } = setup();
    player.character = 'selene';

    expect(applyHit(world, player, 'jelly', null, offset(0, -8))).toBeNull();
    expect(applyHit(world, player, 'lightning', null, offset(0, -8))).toBe('stunned');
    expect(eventsIn(log, 'racer.hit')).toEqual([{ type: 'racer.hit', id: 'player', cause: 'lightning', by: null }]);
  });
});

describe('a hit on a fallen racer', () => {
  it('misses while the racer waits to respawn, so it keeps its pearls and comes back unstunned', () => {
    const { log, player, hit } = setup();
    player.status.fallen = 30;
    player.pearls = 5;

    expect(hit()).toBeNull();

    expect(player.status.stunned).toBe(0);
    expect(player.pearls).toBe(5);
    expect(eventsIn(log)).toEqual([]);
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

describe('pearls knocked loose', () => {
  it('drops three of five pearls at the racer centre on a landed hit, after the hit events', () => {
    const { world, log, player, hit } = setup();
    player.pearls = 5;
    const centre = centreOf(player);

    expect(hit()).toBe('stunned');

    expect(player.pearls).toBe(2);
    expect(world.loosePearls.map(({ at, age, droppedBy }) => ({ at, age, droppedBy }))).toEqual(
      Array.from({ length: 3 }, () => ({ at: centre, age: 0, droppedBy: 'player' })),
    );
    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'jelly', by: null },
      { type: 'racer.stunned', id: 'player' },
      { type: 'pearls.dropped', id: 'player', count: 3 },
    ]);
  });

  it('drops every pearl of a racer holding fewer than three, and nothing from one holding none', () => {
    const two = setup();
    two.player.pearls = 2;
    two.hit();
    const none = setup();
    none.hit();

    expect([two.player.pearls, two.world.loosePearls.length]).toEqual([0, 2]);
    expect(eventsIn(two.log, 'pearls.dropped')).toEqual([{ type: 'pearls.dropped', id: 'player', count: 2 }]);
    expect(none.world.loosePearls).toEqual([]);
    expect(eventsIn(none.log, 'pearls.dropped')).toEqual([]);
  });

  it('drops them when the hit knocks an item off too', () => {
    const { world, player, hit } = setup();
    giveItems(player, ['jetFin']);
    player.pearls = 4;

    expect(hit()).toBe('knocked');

    expect([player.pearls, world.loosePearls.length]).toEqual([1, 3]);
  });

  it('keeps every pearl when a Bubble Shield absorbs the hit', () => {
    const { world, log, player, hit } = setup();
    giveItems(player, ['bubbleShield']);
    player.pearls = 5;

    expect(hit()).toBe('absorbed');

    expect(player.pearls).toBe(5);
    expect(world.loosePearls).toEqual([]);
    expect(eventsIn(log, 'pearls.dropped')).toEqual([]);
  });

  it('keeps every pearl when the hit does not land', () => {
    const { world, player, hit } = setup();
    player.pearls = 5;
    player.status.invulnerable = 10;

    expect(hit()).toBeNull();

    expect([player.pearls, world.loosePearls.length]).toEqual([5, 0]);
  });
});
